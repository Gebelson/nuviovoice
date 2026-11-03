import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../utils/auth.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { getVapidKeys } from '../utils/webPush.js';

interface SubscribeBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

interface UnsubscribeBody {
  endpoint: string;
}

export async function pushRoutes(app: FastifyInstance) {
  // GET /api/push/vapid-public-key - Public endpoint to retrieve application server key for PushManager.subscribe()
  app.get('/api/push/vapid-public-key', async (_request, reply) => {
    try {
      const keys = getVapidKeys();
      return reply.send({ publicKey: keys.publicKey });
    } catch (err: any) {
      return reply.code(500).send({ error: 'failed_to_get_vapid_key', message: err?.message });
    }
  });

  // POST /api/push/subscribe - Register or update a Web Push subscription for the logged-in user
  app.post<{ Body: SubscribeBody }>('/api/push/subscribe', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.userId;
    const { endpoint, keys, userAgent } = request.body || {};

    if (!endpoint || typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: 'invalid_subscription_payload' });
    }

    const db = getDb();
    const now = Date.now();

    // Check if endpoint already registered
    const existing = db
      .select({ id: schema.pushSubscriptions.id })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint))
      .get();

    if (existing) {
      db.update(schema.pushSubscriptions)
        .set({
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent ?? null,
          updatedAt: now,
        })
        .where(eq(schema.pushSubscriptions.id, existing.id))
        .run();

      return reply.send({ success: true, id: existing.id, updated: true });
    }

    const id = generateSnowflake();
    db.insert(schema.pushSubscriptions)
      .values({
        id,
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return reply.code(201).send({ success: true, id, updated: false });
  });

  // POST /api/push/unsubscribe - Remove a push subscription
  app.post<{ Body: UnsubscribeBody }>('/api/push/unsubscribe', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.userId;
    const { endpoint } = request.body || {};

    if (!endpoint || typeof endpoint !== 'string') {
      return reply.code(400).send({ error: 'invalid_endpoint' });
    }

    const db = getDb();
    db.delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, userId),
          eq(schema.pushSubscriptions.endpoint, endpoint)
        )
      )
      .run();

    return reply.send({ success: true });
  });

  // GET /api/push/status - Inspect registered subscriptions for current user
  app.get('/api/push/status', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.userId;
    const db = getDb();

    const subs = db
      .select({
        id: schema.pushSubscriptions.id,
        endpoint: schema.pushSubscriptions.endpoint,
        createdAt: schema.pushSubscriptions.createdAt,
      })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
      .all();

    const keys = getVapidKeys();
    return reply.send({
      subscriptionCount: subs.length,
      subscriptions: subs,
      publicKey: keys.publicKey,
    });
  });
}
