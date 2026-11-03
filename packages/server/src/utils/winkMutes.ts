import { eq, and, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { generateSnowflake } from './snowflake.js';
import type { WinkMuteDuration } from '@concord/shared/src/winks.js';

export function calculateMuteExpiration(duration: WinkMuteDuration, fromTime = Date.now()): {
  muteType: 'temporary' | 'indefinite';
  expiresAt: number | null;
} {
  switch (duration) {
    case '1h':
      return { muteType: 'temporary', expiresAt: fromTime + 3600 * 1000 };
    case '8h':
      return { muteType: 'temporary', expiresAt: fromTime + 8 * 3600 * 1000 };
    case '24h':
      return { muteType: 'temporary', expiresAt: fromTime + 24 * 3600 * 1000 };
    case 'indefinite':
    default:
      return { muteType: 'indefinite', expiresAt: null };
  }
}

/**
 * Checks whether `userId` has muted incoming Winks from `targetUserId`.
 * Checks for indefinite mutes and unexpired temporary mutes.
 * Cleans up expired temporary mutes on the fly.
 */
export function isUserWinkMuted(userId: string, targetUserId: string): boolean {
  if (!userId || !targetUserId || userId === targetUserId) return false;
  try {
    const db = getDb();
    const mute = db
      .select()
      .from(schema.winkContactMutes)
      .where(
        and(
          eq(schema.winkContactMutes.userId, userId),
          eq(schema.winkContactMutes.targetUserId, targetUserId)
        )
      )
      .get();

    if (!mute) return false;

    if (mute.muteType === 'indefinite') {
      return true;
    }

    if (mute.expiresAt) {
      if (mute.expiresAt > Date.now()) {
        return true;
      } else {
        // Expired — remove row asynchronously
        try {
          db.delete(schema.winkContactMutes)
            .where(eq(schema.winkContactMutes.id, mute.id))
            .run();
        } catch {}
        return false;
      }
    }

    return false;
  } catch (err) {
    console.warn('[winkMutes] Error checking mute status:', err);
    return false;
  }
}

/**
 * Records a real successful Wink send in the user's recent winks.
 * Upserts the record and maintains a maximum of 20 unique items.
 */
export function recordWinkRecent(userId: string, winkId: string): void {
  if (!userId || !winkId) return;
  try {
    const db = getDb();
    const now = Date.now();

    const existing = db
      .select()
      .from(schema.winkRecents)
      .where(
        and(
          eq(schema.winkRecents.userId, userId),
          eq(schema.winkRecents.winkId, winkId)
        )
      )
      .get();

    if (existing) {
      db.update(schema.winkRecents)
        .set({ usedAt: now, id: generateSnowflake() })
        .where(eq(schema.winkRecents.id, existing.id))
        .run();
    } else {
      const id = generateSnowflake();
      db.insert(schema.winkRecents)
        .values({
          id,
          userId,
          winkId,
          usedAt: now,
        })
        .run();
    }

    // Cap at 20 most recent
    const allRecents = db
      .select({ id: schema.winkRecents.id })
      .from(schema.winkRecents)
      .where(eq(schema.winkRecents.userId, userId))
      .orderBy(desc(schema.winkRecents.usedAt), desc(schema.winkRecents.id))
      .all();

    if (allRecents.length > 20) {
      const excess = allRecents.slice(20);
      for (const item of excess) {
        db.delete(schema.winkRecents)
          .where(eq(schema.winkRecents.id, item.id))
          .run();
      }
    }
  } catch (err) {
    console.warn('[winkMutes] Error recording recent wink:', err);
  }
}
