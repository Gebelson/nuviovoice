import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { hasPermission, PermissionBits } from '../utils/permissions.js';

const MAX_SOUND_BYTES = 1024 * 1024; // 1 MB limit (matches Haven default)
const SOUNDS_DIR = path.resolve(process.env.DATA_DIR || './data', 'sounds');

export async function soundsRoutes(app: FastifyInstance): Promise<void> {
  await mkdir(SOUNDS_DIR, { recursive: true }).catch(() => {});

  // List sounds for a space
  app.get<{ Params: { spaceId: string } }>('/api/sounds/space/:spaceId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const db = getDb();

    // Check membership
    const membership = db.select()
      .from(schema.spaceMembers)
      .where(and(
        eq(schema.spaceMembers.spaceId, spaceId),
        eq(schema.spaceMembers.userId, request.userId),
      ))
      .get();

    if (!membership) {
      return sendError(reply, 403, 'forbidden');
    }

    const soundList = db.select({
      id: schema.sounds.id,
      spaceId: schema.sounds.spaceId,
      name: schema.sounds.name,
      filename: schema.sounds.filename,
      uploadedBy: schema.sounds.uploadedBy,
      createdAt: schema.sounds.createdAt,
    })
      .from(schema.sounds)
      .where(eq(schema.sounds.spaceId, spaceId))
      .orderBy(desc(schema.sounds.createdAt))
      .all();

    return reply.send({ sounds: soundList });
  });

  // Upload soundboard sound via base64 or JSON
  app.post<{
    Params: { spaceId: string };
    Body: { name: string; audioBase64: string; format?: string };
  }>('/api/sounds/space/:spaceId', {
    preHandler: authenticate,
    bodyLimit: Math.ceil(MAX_SOUND_BYTES / 3) * 4 + 8192,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const { name, audioBase64, format = 'mp3' } = request.body || {};

    const isOwnerOrAdmin = hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR) ||
      hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE);

    if (!isOwnerOrAdmin) {
      return sendError(reply, 403, 'forbidden');
    }

    if (!name || !audioBase64) {
      return sendError(reply, 400, 'validation_failed');
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > MAX_SOUND_BYTES) {
      return sendError(reply, 413, 'validation_failed');
    }

    const cleanName = name.slice(0, 32).trim() || 'Sound Effect';
    const ext = format.startsWith('.') ? format : `.${format}`;
    const soundId = randomUUID();
    const storedFilename = `${soundId}${ext}`;
    const destinationPath = path.join(SOUNDS_DIR, storedFilename);

    await writeFile(destinationPath, buffer);

    const db = getDb();
    const soundRow = {
      id: soundId,
      spaceId,
      name: cleanName,
      filename: storedFilename,
      uploadedBy: request.userId,
      createdAt: Date.now(),
    };

    db.insert(schema.sounds).values(soundRow).run();

    return reply.code(201).send({ sound: soundRow });
  });

  // Delete soundboard sound
  app.delete<{ Params: { soundId: string } }>('/api/sounds/:soundId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { soundId } = request.params;
    const db = getDb();

    const sound = db.select().from(schema.sounds).where(eq(schema.sounds.id, soundId)).get();
    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    const canDelete = sound.uploadedBy === request.userId ||
      hasPermission(request.userId, sound.spaceId, PermissionBits.ADMINISTRATOR) ||
      hasPermission(request.userId, sound.spaceId, PermissionBits.MANAGE_SPACE);

    if (!canDelete) {
      return sendError(reply, 403, 'forbidden');
    }

    db.delete(schema.sounds).where(eq(schema.sounds.id, soundId)).run();

    const filePath = path.join(SOUNDS_DIR, sound.filename);
    await unlink(filePath).catch(() => {});

    return reply.send({ success: true, soundId });
  });

  // Play soundboard effect
  app.post<{ Params: { soundId: string }; Body: { channelId: string; volume?: number } }>('/api/sounds/:soundId/play', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { soundId } = request.params;
    const { channelId, volume = 1.0 } = request.body || {};
    const db = getDb();

    const sound = db.select().from(schema.sounds).where(eq(schema.sounds.id, soundId)).get();
    if (!sound) {
      return sendError(reply, 404, 'not_found');
    }

    const canSpeak = hasPermission(request.userId, sound.spaceId, PermissionBits.SPEAK, channelId) ||
      hasPermission(request.userId, sound.spaceId, PermissionBits.ADMINISTRATOR);

    if (!canSpeak) {
      return sendError(reply, 403, 'forbidden');
    }

    const eventPayload = {
      type: 'soundboard_play',
      soundId,
      soundUrl: `/api/sounds/audio/${sound.filename}`,
      name: sound.name,
      spaceId: sound.spaceId,
      channelId,
      userId: request.userId,
      volume: Math.min(1.0, Math.max(0.0, volume)),
      timestamp: Date.now(),
    };

    return reply.send({ success: true, event: eventPayload });
  });

  // Get soundboard preferences for current user in space
  app.get<{ Params: { spaceId: string } }>('/api/sounds/preferences/:spaceId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const db = getDb();

    const pref = db.select()
      .from(schema.soundPreferences)
      .where(and(
        eq(schema.soundPreferences.userId, request.userId),
        eq(schema.soundPreferences.spaceId, spaceId),
      ))
      .get();

    return reply.send({
      preference: pref || { userId: request.userId, spaceId, volume: 1.0, muted: 0 },
    });
  });

  // Set soundboard preferences
  app.post<{
    Params: { spaceId: string };
    Body: { volume?: number; muted?: boolean };
  }>('/api/sounds/preferences/:spaceId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const { volume = 1.0, muted = false } = request.body || {};
    const db = getDb();

    const cleanVolume = Math.min(1.0, Math.max(0.0, volume));
    const cleanMuted = muted ? 1 : 0;

    db.insert(schema.soundPreferences).values({
      userId: request.userId,
      spaceId,
      volume: cleanVolume,
      muted: cleanMuted,
    }).onConflictDoUpdate({
      target: [schema.soundPreferences.userId, schema.soundPreferences.spaceId],
      set: {
        volume: cleanVolume,
        muted: cleanMuted,
      },
    }).run();

    return reply.send({
      success: true,
      preference: {
        userId: request.userId,
        spaceId,
        volume: cleanVolume,
        muted: cleanMuted,
      },
    });
  });

  // Serve sound audio file
  app.get<{ Params: { filename: string } }>('/api/sounds/audio/:filename', async (request, reply) => {
    const { filename } = request.params;
    const safeFilename = path.basename(filename);
    return reply.sendFile(safeFilename, SOUNDS_DIR);
  });
}
