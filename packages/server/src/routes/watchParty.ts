import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { getChannelSpaceId, hasPermission, PermissionBits } from '../utils/permissions.js';

// Extract video ID for YouTube URLs (matches Haven logic)
export function parseVideoUrl(url: string): { type: 'youtube' | 'direct'; videoId?: string; directUrl?: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id && /^[\w-]{11}$/.test(id)) return { type: 'youtube', videoId: id };
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'gaming.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return { type: 'youtube', videoId: v };
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m && m[1]) return { type: 'youtube', videoId: m[1] };
    }
    // Direct audio/video files
    if (/\.(mp4|webm|mkv|mov|ogg)$/i.test(u.pathname)) {
      return { type: 'direct', directUrl: url };
    }
    return null;
  } catch {
    return null;
  }
}

export async function watchPartyRoutes(app: FastifyInstance): Promise<void> {
  // Create Watch Party
  app.post<{ Body: { channelId: string; videoUrl: string; isExclusive?: boolean } }>('/api/watch-party/create', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { channelId, videoUrl, isExclusive = true } = request.body || {};
    if (!channelId || !videoUrl) {
      return sendError(reply, 400, 'validation_failed');
    }

    const parsed = parseVideoUrl(videoUrl);
    if (!parsed) {
      return sendError(reply, 400, 'validation_failed');
    }

    const spaceId = getChannelSpaceId(channelId);
    if (!spaceId) {
      return sendError(reply, 404, 'channel_not_found');
    }

    // Must be able to speak/connect in channel
    if (!hasPermission(request.userId, spaceId, PermissionBits.CONNECT, channelId)) {
      return sendError(reply, 403, 'missing_permission');
    }

    const db = getDb();
    const sessionId = randomUUID();
    const now = Date.now();

    const sessionRow = {
      id: sessionId,
      channelId,
      hostUserId: request.userId,
      videoUrl,
      videoType: parsed.type,
      currentTime: 0.0,
      state: 'waiting', // Start in waiting state (synchronized wait room)
      isExclusive: isExclusive ? 1 : 0,
      updatedAt: now,
      createdAt: now,
    };

    db.insert(schema.watchPartySessions).values(sessionRow).run();

    // Auto-join host
    db.insert(schema.watchPartyMembers).values({
      sessionId,
      userId: request.userId,
      joinedAt: now,
    }).run();

    return reply.code(201).send({
      session: sessionRow,
      videoDetails: parsed,
    });
  });

  // Get Watch Party session details
  app.get<{ Params: { sessionId: string } }>('/api/watch-party/session/:sessionId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const db = getDb();

    const session = db.select().from(schema.watchPartySessions).where(eq(schema.watchPartySessions.id, sessionId)).get();
    if (!session) {
      return sendError(reply, 404, 'not_found');
    }

    const members = db.select({
      userId: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      joinedAt: schema.watchPartyMembers.joinedAt,
    })
      .from(schema.watchPartyMembers)
      .innerJoin(schema.users, eq(schema.watchPartyMembers.userId, schema.users.id))
      .where(eq(schema.watchPartyMembers.sessionId, sessionId))
      .all();

    return reply.send({
      session,
      members,
    });
  });

  // Join Watch Party session
  app.post<{ Params: { sessionId: string } }>('/api/watch-party/session/:sessionId/join', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const db = getDb();

    const session = db.select().from(schema.watchPartySessions).where(eq(schema.watchPartySessions.id, sessionId)).get();
    if (!session) {
      return sendError(reply, 404, 'not_found');
    }

    db.insert(schema.watchPartyMembers).values({
      sessionId,
      userId: request.userId,
      joinedAt: Date.now(),
    }).onConflictDoNothing().run();

    return reply.send({ success: true, sessionId });
  });

  // Leave Watch Party session
  app.post<{ Params: { sessionId: string } }>('/api/watch-party/session/:sessionId/leave', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const db = getDb();

    db.delete(schema.watchPartyMembers)
      .where(and(
        eq(schema.watchPartyMembers.sessionId, sessionId),
        eq(schema.watchPartyMembers.userId, request.userId),
      ))
      .run();

    return reply.send({ success: true });
  });

  // Synchronize playback action (Host control or collaborative)
  app.post<{
    Params: { sessionId: string };
    Body: { action: 'play' | 'pause' | 'seek' | 'end'; currentTime?: number };
  }>('/api/watch-party/session/:sessionId/action', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const { action, currentTime = 0.0 } = request.body || {};
    const db = getDb();

    const session = db.select().from(schema.watchPartySessions).where(eq(schema.watchPartySessions.id, sessionId)).get();
    if (!session) {
      return sendError(reply, 404, 'not_found');
    }

    // In exclusive mode, only the host can control playback
    if (session.isExclusive && session.hostUserId !== request.userId) {
      return sendError(reply, 403, 'forbidden');
    }

    const now = Date.now();

    if (action === 'end') {
      db.delete(schema.watchPartySessions).where(eq(schema.watchPartySessions.id, sessionId)).run();
      return reply.send({ success: true, ended: true });
    }

    const nextState = action === 'play' ? 'playing' : action === 'pause' ? 'paused' : session.state;

    db.update(schema.watchPartySessions)
      .set({
        state: nextState,
        currentTime,
        updatedAt: now,
      })
      .where(eq(schema.watchPartySessions.id, sessionId))
      .run();

    const syncEvent = {
      type: 'watch_party_sync',
      sessionId,
      action,
      state: nextState,
      currentTime,
      updatedAt: now,
      actorUserId: request.userId,
    };

    return reply.send({ success: true, event: syncEvent });
  });
}
