import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { isDmMember } from '../utils/permissions.js';

export async function e2eeRoutes(app: FastifyInstance): Promise<void> {
  // Publish or update user public signing key
  app.post<{ Body: { fingerprint: string; jwk: string } }>('/api/e2ee/keys', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { fingerprint, jwk } = request.body || {};
    if (!fingerprint || !jwk) {
      return sendError(reply, 400, 'validation_failed');
    }

    const db = getDb();
    const now = Date.now();

    db.insert(schema.userSigningKeys).values({
      userId: request.userId,
      fingerprint,
      jwk,
      createdAt: now,
    }).onConflictDoUpdate({
      target: [schema.userSigningKeys.userId, schema.userSigningKeys.fingerprint],
      set: { jwk },
    }).run();

    return reply.send({ success: true, fingerprint });
  });

  // Get user public signing keys
  app.get<{ Params: { userId: string } }>('/api/e2ee/keys/:userId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { userId } = request.params;
    const db = getDb();

    const keys = db.select({
      userId: schema.userSigningKeys.userId,
      fingerprint: schema.userSigningKeys.fingerprint,
      jwk: schema.userSigningKeys.jwk,
      createdAt: schema.userSigningKeys.createdAt,
    })
      .from(schema.userSigningKeys)
      .where(eq(schema.userSigningKeys.userId, userId))
      .orderBy(desc(schema.userSigningKeys.createdAt))
      .all();

    return reply.send({ keys });
  });

  // Publish a new group DM epoch ratchet
  app.post<{
    Params: { dmChannelId: string };
    Body: { epoch: number; signature: string; roster: string };
  }>('/api/e2ee/dm/:dmChannelId/epoch', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { dmChannelId } = request.params;
    const { epoch, signature, roster } = request.body || {};

    if (epoch === undefined || !signature || !roster) {
      return sendError(reply, 400, 'validation_failed');
    }

    if (!isDmMember(dmChannelId, request.userId)) {
      return sendError(reply, 403, 'not_dm_member');
    }

    const db = getDb();
    const now = Date.now();

    db.insert(schema.dmGroupEpochs).values({
      dmChannelId,
      epoch,
      publishedBy: request.userId,
      signature,
      roster,
      createdAt: now,
    }).run();

    return reply.code(201).send({ success: true, epoch });
  });

  // Fetch epoch history for a group DM
  app.get<{ Params: { dmChannelId: string } }>('/api/e2ee/dm/:dmChannelId/epochs', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { dmChannelId } = request.params;

    if (!isDmMember(dmChannelId, request.userId)) {
      return sendError(reply, 403, 'not_dm_member');
    }

    const db = getDb();
    const epochs = db.select()
      .from(schema.dmGroupEpochs)
      .where(eq(schema.dmGroupEpochs.dmChannelId, dmChannelId))
      .orderBy(desc(schema.dmGroupEpochs.epoch))
      .all();

    return reply.send({ epochs });
  });
}
