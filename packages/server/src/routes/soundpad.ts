import type { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { hasPermission, PermissionBits } from '../utils/permissions.js';
import type { SoundScope, SoundpadSound, SoundpadCategory } from '@concord/shared';

const MAX_SOUNDPAD_BYTES = 10 * 1024 * 1024; // 10 MB limit
const SOUNDPAD_DIR = path.resolve(process.env.DATA_DIR || './data', 'soundpad');

export async function soundpadRoutes(app: FastifyInstance): Promise<void> {
  await mkdir(SOUNDPAD_DIR, { recursive: true }).catch(() => {});

  // ─── 1. List sounds (official + user's personal + space sounds if spaceId given) ───
  app.get<{
    Querystring: { spaceId?: string; category?: string; search?: string };
  }>('/api/soundpad/sounds', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId, category, search } = request.query;
    const db = getDb();
    const userId = request.userId;

    // Conditions: official OR (personal of this user) OR (space sounds if in space)
    const scopeConditions = [
      eq(schema.soundpadSounds.scope, 'official'),
      and(
        eq(schema.soundpadSounds.scope, 'personal'),
        eq(schema.soundpadSounds.ownerId, userId)
      ),
    ];

    if (spaceId) {
      // Verify space membership
      const membership = db.select()
        .from(schema.spaceMembers)
        .where(and(
          eq(schema.spaceMembers.spaceId, spaceId),
          eq(schema.spaceMembers.userId, userId)
        ))
        .get();

      if (membership) {
        scopeConditions.push(
          and(
            eq(schema.soundpadSounds.scope, 'space'),
            eq(schema.soundpadSounds.spaceId, spaceId),
            eq(schema.soundpadSounds.status, 'approved')
          )
        );
      }
    }

    const rawSounds = db.select()
      .from(schema.soundpadSounds)
      .where(or(...scopeConditions))
      .all();

    // Fetch user favorites
    const favRows = db.select({ soundId: schema.soundpadFavorites.soundId })
      .from(schema.soundpadFavorites)
      .where(eq(schema.soundpadFavorites.userId, userId))
      .all();
    const favSet = new Set(favRows.map((f) => f.soundId));

    // Fetch user usage counts
    const usageRows = db.select({
      soundId: schema.soundpadUsage.soundId,
      playCount: schema.soundpadUsage.playCount,
    })
      .from(schema.soundpadUsage)
      .where(eq(schema.soundpadUsage.userId, userId))
      .all();
    const usageMap = new Map(usageRows.map((u) => [u.soundId, u.playCount]));

    let sounds: SoundpadSound[] = rawSounds.map((row) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags);
      } catch {
        tags = [];
      }

      return {
        id: row.id,
        name: row.name,
        scope: row.scope as SoundScope,
        ownerId: row.ownerId,
        spaceId: row.spaceId,
        category: row.category,
        audioUrl: row.audioUrl,
        storageKey: row.storageKey,
        builtinSoundId: row.builtinSoundId,
        durationMs: row.durationMs,
        defaultVolume: row.defaultVolume,
        emoji: row.emoji,
        iconUrl: row.iconUrl,
        tags,
        isFavorite: favSet.has(row.id),
        playCount: usageMap.get(row.id) ?? 0,
        createdAt: new Date(row.createdAt).toISOString(),
      };
    });

    // Apply category filter if provided
    if (category && category !== 'all') {
      sounds = sounds.filter((s) => s.category.toLowerCase() === category.toLowerCase());
    }

    // Apply search filter if provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      sounds = sounds.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Build categories aggregation
    const categoryCounts = new Map<string, number>();
    for (const s of rawSounds) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
    }

    const categories: SoundpadCategory[] = Array.from(categoryCounts.entries()).map(([name, count]) => ({
      id: name.toLowerCase(),
      name,
      count,
    }));

    return reply.send({ sounds, categories });
  });

  // ─── 2. Create / Upload custom sound ───
  app.post<{
    Body: {
      name: string;
      audioBase64: string;
      format?: string;
      scope?: SoundScope;
      spaceId?: string | null;
      category?: string;
      emoji?: string | null;
      tags?: string[];
      defaultVolume?: number;
      durationMs?: number;
    };
  }>('/api/soundpad/sounds', {
    preHandler: authenticate,
    bodyLimit: 16 * 1024 * 1024,
  }, async (request, reply) => {
    const {
      name,
      audioBase64,
      format = 'wav',
      scope = 'personal',
      spaceId = null,
      category = 'Personalizados',
      emoji = '🎵',
      tags = [],
      defaultVolume = 1.0,
      durationMs = 0,
    } = request.body || {};

    if (!name || !name.trim()) {
      return sendError(reply, 400, 'validation_failed');
    }
    if (!audioBase64) {
      return sendError(reply, 400, 'validation_failed');
    }

    const userId = request.userId;
    const db = getDb();

    // Check space permissions if scope is 'space'
    if (scope === 'space') {
      if (!spaceId) {
        return sendError(reply, 400, 'validation_failed');
      }
      const canManage = hasPermission(userId, spaceId, PermissionBits.MANAGE_SOUNDPAD) ||
        hasPermission(userId, spaceId, PermissionBits.ADMINISTRATOR) ||
        hasPermission(userId, spaceId, PermissionBits.MANAGE_SPACE);

      if (!canManage) {
        return sendError(reply, 403, 'forbidden');
      }
    }

    // Process base64
    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > MAX_SOUNDPAD_BYTES) {
      return sendError(reply, 413, 'validation_failed');
    }

    // Save audio file to storage
    const soundId = randomUUID();
    const cleanExt = format.replace(/^\./, '').toLowerCase() || 'wav';
    const storedFilename = `${soundId}.${cleanExt}`;
    const destinationPath = path.join(SOUNDPAD_DIR, storedFilename);

    await writeFile(destinationPath, buffer);

    const now = Date.now();
    const cleanName = name.trim().slice(0, 48);
    const audioUrl = `/api/soundpad/audio/${storedFilename}`;

    const newSoundRow = {
      id: soundId,
      name: cleanName,
      scope,
      ownerId: scope === 'personal' ? userId : (spaceId ? userId : null),
      spaceId: scope === 'space' ? spaceId : null,
      category: category.trim().slice(0, 32) || 'Personalizados',
      audioUrl,
      storageKey: storedFilename,
      builtinSoundId: null,
      durationMs: Math.max(0, Math.min(30000, durationMs || 0)),
      defaultVolume: Math.min(1.5, Math.max(0, defaultVolume || 1.0)),
      emoji: emoji ? emoji.slice(0, 8) : '🎵',
      iconUrl: null,
      tags: JSON.stringify(tags || []),
      status: 'approved',
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.soundpadSounds).values(newSoundRow).run();

    const createdSound: SoundpadSound = {
      id: soundId,
      name: cleanName,
      scope,
      ownerId: newSoundRow.ownerId,
      spaceId: newSoundRow.spaceId,
      category: newSoundRow.category,
      audioUrl,
      storageKey: storedFilename,
      builtinSoundId: null,
      durationMs: newSoundRow.durationMs,
      defaultVolume: newSoundRow.defaultVolume,
      emoji: newSoundRow.emoji,
      iconUrl: null,
      tags: tags || [],
      isFavorite: false,
      playCount: 0,
      createdAt: new Date(now).toISOString(),
    };

    return reply.code(201).send({ sound: createdSound });
  });

  // ─── 3. Delete sound ───
  app.delete<{
    Params: { id: string };
  }>('/api/soundpad/sounds/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const userId = request.userId;

    const sound = db.select()
      .from(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .get();

    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    if (sound.scope === 'official') {
      return sendError(reply, 403, 'forbidden');
    }

    const isOwner = sound.ownerId === userId;
    let isSpaceAdmin = false;
    if (sound.scope === 'space' && sound.spaceId) {
      isSpaceAdmin = hasPermission(userId, sound.spaceId, PermissionBits.MANAGE_SOUNDPAD) ||
        hasPermission(userId, sound.spaceId, PermissionBits.ADMINISTRATOR);
    }

    if (!isOwner && !isSpaceAdmin) {
      return sendError(reply, 403, 'forbidden');
    }

    db.delete(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .run();

    if (sound.storageKey) {
      const filePath = path.join(SOUNDPAD_DIR, sound.storageKey);
      await unlink(filePath).catch(() => {});
    }

    return reply.send({ success: true, soundId: id });
  });

  // ─── 4. Toggle Favorite ───
  app.post<{
    Params: { id: string };
  }>('/api/soundpad/sounds/:id/favorite', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const userId = request.userId;

    const sound = db.select()
      .from(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .get();

    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    const existing = db.select()
      .from(schema.soundpadFavorites)
      .where(and(
        eq(schema.soundpadFavorites.userId, userId),
        eq(schema.soundpadFavorites.soundId, id)
      ))
      .get();

    if (existing) {
      db.delete(schema.soundpadFavorites)
        .where(and(
          eq(schema.soundpadFavorites.userId, userId),
          eq(schema.soundpadFavorites.soundId, id)
        ))
        .run();
      return reply.send({ isFavorite: false, soundId: id });
    } else {
      db.insert(schema.soundpadFavorites)
        .values({
          userId,
          soundId: id,
          createdAt: Date.now(),
        })
        .run();
      return reply.send({ isFavorite: true, soundId: id });
    }
  });

  // ─── 5. Record play / usage stats ───
  app.post<{
    Params: { id: string };
    Body: { channelId?: string; spaceId?: string; volume?: number };
  }>('/api/soundpad/sounds/:id/play', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const userId = request.userId;

    const sound = db.select()
      .from(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .get();

    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    const now = Date.now();
    const existing = db.select()
      .from(schema.soundpadUsage)
      .where(and(
        eq(schema.soundpadUsage.userId, userId),
        eq(schema.soundpadUsage.soundId, id)
      ))
      .get();

    if (existing) {
      db.update(schema.soundpadUsage)
        .set({
          playCount: existing.playCount + 1,
          lastPlayedAt: now,
        })
        .where(and(
          eq(schema.soundpadUsage.userId, userId),
          eq(schema.soundpadUsage.soundId, id)
        ))
        .run();
    } else {
      db.insert(schema.soundpadUsage)
        .values({
          userId,
          soundId: id,
          playCount: 1,
          lastPlayedAt: now,
        })
        .run();
    }

    return reply.send({ success: true, soundId: id });
  });

  // ─── 6. Update sound metadata ───
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      emoji?: string;
      category?: string;
      tags?: string[];
      defaultVolume?: number;
    };
  }>('/api/soundpad/sounds/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const userId = request.userId;

    const sound = db.select()
      .from(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .get();

    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    const isOwner = sound.ownerId === userId;
    let isSpaceAdmin = false;
    if (sound.scope === 'space' && sound.spaceId) {
      isSpaceAdmin = hasPermission(userId, sound.spaceId, PermissionBits.MANAGE_SOUNDPAD) ||
        hasPermission(userId, sound.spaceId, PermissionBits.ADMINISTRATOR);
    }

    if (!isOwner && !isSpaceAdmin) {
      return sendError(reply, 403, 'forbidden');
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (request.body.name) updates.name = request.body.name.trim().slice(0, 48);
    if (request.body.emoji) updates.emoji = request.body.emoji.slice(0, 8);
    if (request.body.category) updates.category = request.body.category.trim().slice(0, 32);
    if (request.body.tags) updates.tags = JSON.stringify(request.body.tags);
    if (request.body.defaultVolume !== undefined) {
      updates.defaultVolume = Math.min(1.5, Math.max(0, request.body.defaultVolume));
    }

    db.update(schema.soundpadSounds)
      .set(updates)
      .where(eq(schema.soundpadSounds.id, id))
      .run();

    const updated = db.select()
      .from(schema.soundpadSounds)
      .where(eq(schema.soundpadSounds.id, id))
      .get();

    return reply.send({ sound: updated });
  });

  // ─── 7. Serve uploaded sound audio ───
  app.get<{ Params: { filename: string } }>('/api/soundpad/audio/:filename', async (request, reply) => {
    const { filename } = request.params;
    const safeFilename = path.basename(filename);
    return reply.sendFile(safeFilename, SOUNDPAD_DIR);
  });
}
