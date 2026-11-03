import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { pushRoutes } from './push.js';
import { ensureDefaults } from '../db/migrate.js';
import { sendPushToSubscription, sendWinkPushNotification } from '../utils/webPush.js';
import webpush from 'web-push';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentCallerId = 'user-test-1';

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (req: { userId?: string; username?: string }) => {
    req.userId = currentCallerId;
    req.username = 'testuser';
  },
}));

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const stmt of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) {
        try {
          db.exec(clean);
        } catch {
          // ignore already existing tables in sequential migration playback
        }
      }
    }
  }
}

describe('Push Notifications API & Service', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite, { schema });
    applyMigrations(sqlite);
    ensureDefaults(sqlite);

    // Create test user
    testDb.insert(schema.users).values({
      id: 'user-test-1',
      username: 'nuvio_user',
      displayName: 'Nuvio User',
      passwordHash: 'dummy',
      createdAt: Date.now(),
    }).run();

    app = Fastify();
    await app.register(pushRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
    vi.restoreAllMocks();
  });

  it('GET /api/push/vapid-public-key returns a valid VAPID public key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/push/vapid-public-key',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.publicKey).toBeDefined();
    expect(typeof body.publicKey).toBe('string');
    expect(body.publicKey.length).toBeGreaterThan(20);
  });

  it('POST /api/push/subscribe registers a new push subscription', async () => {
    const subPayload = {
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test-endpoint-1',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044YPP6WaEiIS',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: subPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBeDefined();

    // Verify stored in DB
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/push/status',
    });
    expect(statusRes.statusCode).toBe(200);
    const statusBody = statusRes.json();
    expect(statusBody.subscriptionCount).toBe(1);
    expect(statusBody.subscriptions[0].endpoint).toBe(subPayload.endpoint);
  });

  it('POST /api/push/unsubscribe removes the subscription', async () => {
    const subPayload = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-2',
      keys: {
        p256dh: 'dummy-p256dh',
        auth: 'dummy-auth',
      },
    };

    await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: subPayload,
    });

    const unsubRes = await app.inject({
      method: 'POST',
      url: '/api/push/unsubscribe',
      payload: { endpoint: subPayload.endpoint },
    });

    expect(unsubRes.statusCode).toBe(200);
    expect(unsubRes.json().success).toBe(true);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/push/status',
    });
    expect(statusRes.json().subscriptionCount).toBe(0);
  });

  it('sendWinkPushNotification sends properly structured payload to registered user subscriptions', async () => {
    // Register subscription
    await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: {
        endpoint: 'https://push.example.com/sub/12345',
        keys: { p256dh: 'test-p256', auth: 'test-auth' },
      },
    });

    let sentPayload: any = null;
    vi.spyOn(webpush, 'sendNotification').mockImplementation(async (_sub, payloadStr) => {
      sentPayload = JSON.parse(payloadStr as string);
      return { statusCode: 201, body: '', headers: {} };
    });

    const count = await sendWinkPushNotification({
      userId: 'user-test-1',
      senderName: 'Gebelson',
      dmChannelId: 'dm-channel-99',
      messageId: 'msg-123456',
    });

    expect(count).toBe(1);
    expect(sentPayload).toBeDefined();
    expect(sentPayload.type).toBe('wink');
    expect(sentPayload.body).toBe('Você recebeu um Wink!');
    expect(sentPayload.senderName).toBe('Gebelson');
    expect(sentPayload.dmChannelId).toBe('dm-channel-99');
    expect(sentPayload.icon).toBe('/icons/icon-192.png');
    expect(sentPayload.data.url).toBe('/channels/@me/dm-channel-99');
    expect(sentPayload.data.messageId).toBe('msg-123456');
  });

  it('sendPushToSubscription automatically prunes 404 or 410 expired subscriptions', async () => {
    const subRes = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: {
        endpoint: 'https://push.example.com/expired-endpoint',
        keys: { p256dh: 'test-p256', auth: 'test-auth' },
      },
    });
    const subId = subRes.json().id;

    vi.spyOn(webpush, 'sendNotification').mockRejectedValue({
      statusCode: 410,
      message: 'Gone',
    });

    const success = await sendPushToSubscription(
      {
        id: subId,
        endpoint: 'https://push.example.com/expired-endpoint',
        p256dh: 'test-p256',
        auth: 'test-auth',
      },
      { type: 'wink', title: 'Nuvio', body: 'Test' }
    );

    expect(success).toBe(false);

    // Verify pruned from DB
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/push/status',
    });
    expect(statusRes.json().subscriptionCount).toBe(0);
  });
});
