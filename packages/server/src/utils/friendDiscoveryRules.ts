import { sql, or, eq, and, inArray, isNull, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

/**
 * Finds all user IDs that have at least one confirmed, active friendship in common with `viewerId`.
 *
 * Rules:
 * - Only active friendships from the `friends` table are considered.
 * - Pending friend requests, space memberships, or followers do NOT count.
 * - If viewer has no friends, returns empty array (nobody has mutual friends with viewer).
 */
export function getConfirmedMutualFriendUserIds(
  viewerId: string,
  myFriendIds: Set<string> | string[],
  db: BetterSQLite3Database<typeof schema>,
): string[] {
  const friendIdList = Array.isArray(myFriendIds) ? myFriendIds : [...myFriendIds];
  if (friendIdList.length === 0) return [];

  const rows = db.all<{ id: string }>(sql`
    SELECT DISTINCT
      CASE WHEN user_id IN ${friendIdList} THEN friend_id ELSE user_id END as id
    FROM friends
    WHERE user_id IN ${friendIdList} OR friend_id IN ${friendIdList}
  `);

  return rows.map((r) => r.id).filter((id) => id !== viewerId && !friendIdList.includes(id));
}

/**
 * Builds the Drizzle SQL condition enforcing friend discovery privacy rules:
 * - 'nobody': completely hidden from discovery and search.
 * - 'everyone' (or null): visible to all eligible viewers.
 * - 'mutual_friends': visible only if the user shares >= 1 confirmed mutual friend with the viewer.
 */
export function buildDiscoveryVisibilityCondition(
  mutualUserIds: string[],
): SQL {
  return or(
    isNull(schema.users.friendDiscoveryVisibility),
    eq(schema.users.friendDiscoveryVisibility, 'everyone'),
    and(
      eq(schema.users.friendDiscoveryVisibility, 'mutual_friends'),
      mutualUserIds.length > 0 ? inArray(schema.users.id, mutualUserIds) : sql`0 = 1`,
    ),
  )!;
}
