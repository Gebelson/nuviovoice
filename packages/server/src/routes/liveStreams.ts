import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { generateSnowflake } from '../utils/snowflake.js';
import {
  type StreamPlatform,
  type LinkChannelInput,
  parseChannelInput,
  validateChannelInput,
  getStreamExternalUrl,
} from '@concord/shared';
import {
  probeStream,
  pollSingleChannel,
  buildLiveStreamInfo,
} from '../services/liveStreamService.js';

export async function liveStreamRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /api/live/streams ──────────────────────────────────────────────────
  // Returns all currently live streams on this instance.
  app.get('/api/live/streams', async (_request: FastifyRequest, reply: FastifyReply) => {
    const db = getDb();
    const liveChannels = db
      .select()
      .from(schema.streamerChannels)
      .where(eq(schema.streamerChannels.isLive, 1))
      .orderBy(desc(schema.streamerChannels.viewerCount))
      .all();

    const streams = [];
    for (const ch of liveChannels) {
      const user = db.select().from(schema.users).where(eq(schema.users.id, ch.userId)).get();
      if (!user) continue;

      const space = ch.linkedSpaceId
        ? db.select().from(schema.spaces).where(eq(schema.spaces.id, ch.linkedSpaceId)).get()
        : null;

      streams.push(buildLiveStreamInfo(ch, user, space));
    }

    return reply.code(200).send({ streams });
  });

  // ─── GET /api/live/streams/:channelId ───────────────────────────────────────
  app.get<{ Params: { channelId: string } }>(
    '/api/live/streams/:channelId',
    async (request, reply) => {
      const db = getDb();
      const ch = db
        .select()
        .from(schema.streamerChannels)
        .where(eq(schema.streamerChannels.id, request.params.channelId))
        .get();

      if (!ch) {
        return reply.code(404).send({ error: 'Stream not found' });
      }

      const user = db.select().from(schema.users).where(eq(schema.users.id, ch.userId)).get();
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const space = ch.linkedSpaceId
        ? db.select().from(schema.spaces).where(eq(schema.spaces.id, ch.linkedSpaceId)).get()
        : null;

      const stream = buildLiveStreamInfo(ch, user, space);
      return reply.code(200).send({ stream });
    }
  );

  // ─── GET /api/live/channels/me ──────────────────────────────────────────────
  app.get(
    '/api/live/channels/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      const channels = db
        .select()
        .from(schema.streamerChannels)
        .where(eq(schema.streamerChannels.userId, request.userId))
        .all();

      return reply.code(200).send({ channels });
    }
  );

  // ─── POST /api/live/channels/link ───────────────────────────────────────────
  app.post<{ Body: LinkChannelInput }>(
    '/api/live/channels/link',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { channelInput, platform: platformHint, linkedSpaceId } = request.body || {};
      if (!channelInput || typeof channelInput !== 'string') {
        return reply.code(400).send({ error: 'channelInput is required' });
      }

      const validation = validateChannelInput(channelInput, platformHint);
      if (!validation.valid || !validation.parsed) {
        return reply.code(400).send({
          error: validation.error || 'Formato de canal inválido. Forneça o link ou nome do canal da Twitch, Kick ou YouTube.',
        });
      }
      const parsed = validation.parsed;

      const db = getDb();

      // Check if user already linked this exact channel or platform
      const existing = db
        .select()
        .from(schema.streamerChannels)
        .where(
          and(
            eq(schema.streamerChannels.platform, parsed.platform),
            eq(schema.streamerChannels.channelName, parsed.channelName)
          )
        )
        .get();

      if (existing) {
        if (existing.userId !== request.userId) {
          return reply.code(409).send({ error: 'Este canal já está vinculado a outra conta no Nuvio.' });
        }
        return reply.code(200).send({ channel: existing, alreadyLinked: true });
      }

      // Check linked space ownership if provided
      if (linkedSpaceId) {
        const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, linkedSpaceId)).get();
        if (!space || space.ownerId !== request.userId) {
          return reply.code(403).send({ error: 'Você só pode vincular espaços públicos dos quais é o proprietário.' });
        }
      }

      // Immediate platform probe to check validity and live status
      const probe = await probeStream(parsed.platform, parsed.channelName);

      const now = Date.now();
      const id = generateSnowflake();
      const channelId = probe.channelId || parsed.channelName;
      const channelUrl = getStreamExternalUrl(parsed.platform, parsed.channelName, parsed.cleanUrl);

      db.insert(schema.streamerChannels)
        .values({
          id,
          userId: request.userId,
          platform: parsed.platform,
          channelId,
          channelName: parsed.channelName,
          channelUrl,
          linkedSpaceId: linkedSpaceId || null,
          isLive: probe.isLive ? 1 : 0,
          streamTitle: probe.isLive ? probe.streamTitle : null,
          streamGame: probe.isLive ? probe.streamGame : null,
          streamThumbnail: probe.isLive ? probe.streamThumbnail : null,
          viewerCount: probe.isLive ? (probe.viewerCount || 0) : 0,
          startedAt: probe.isLive ? (probe.startedAt || now) : null,
          lastCheckedAt: now,
          metadata: probe.metadata ? JSON.stringify(probe.metadata) : '{}',
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const created = db.select().from(schema.streamerChannels).where(eq(schema.streamerChannels.id, id)).get()!;

      // Trigger poll/broadcast
      if (created.isLive === 1) {
        void pollSingleChannel(created.id);
      }

      return reply.code(201).send({ channel: created });
    }
  );

  // ─── DELETE /api/live/channels/:id ──────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/live/channels/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const db = getDb();
      const ch = db.select().from(schema.streamerChannels).where(eq(schema.streamerChannels.id, request.params.id)).get();
      if (!ch) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      const currentUser = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
      const isOwner = ch.userId === request.userId;
      const isAdmin = currentUser?.isAdmin === 1;

      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      db.delete(schema.streamerChannels).where(eq(schema.streamerChannels.id, ch.id)).run();
      return reply.code(200).send({ success: true });
    }
  );

  // ─── POST /api/live/channels/:id/refresh ────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/api/live/channels/:id/refresh',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await pollSingleChannel(request.params.id);
      return reply.code(200).send({ channel: result.channel, changed: result.changed });
    }
  );
}
