import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { PermissionBits } from '@concord/shared/src/permissions.js';
import { config } from '../config.js';
import { livekitRoutes } from './livekit.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentCallerId = 'user-owner';

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
      if (clean) db.exec(clean);
    }
  }
}

function parseJwtPayload(token: string): any {
  const parts = token.split('.');
  const b64 = parts[1];
  if (!b64) return null;
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

const mutableLiveKit = config.livekit as { apiKey?: string; apiSecret?: string; url?: string };

describe('LiveKit Routes & Preview Token', () => {
  let app: FastifyInstance;
  const SPACE_ID = 'space-1';
  const VOICE_CHANNEL_ID = 'channel-voice-1';
  const OWNER_ID = 'user-owner';
  const GUEST_ID = 'user-guest';
  const OUTSIDER_ID = 'user-outsider';
  const DM_CHANNEL_ID = 'dm-channel-1';

  const origApiKey = mutableLiveKit.apiKey;
  const origApiSecret = mutableLiveKit.apiSecret;
  const origUrl = mutableLiveKit.url;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    testDb = drizzle(sqlite, { schema });

    mutableLiveKit.apiKey = 'devkey';
    mutableLiveKit.apiSecret = 'secret-that-is-at-least-32-chars-long-for-livekit!!';
    mutableLiveKit.url = 'wss://livekit.test.example';

    currentCallerId = OWNER_ID;

    // Seed test users
    const now = Date.now();
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(OWNER_ID, 'owner', 'hash', now);
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(GUEST_ID, 'guest', 'hash', now);
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(OUTSIDER_ID, 'outsider', 'hash', now);

    // Seed space
    sqlite.prepare('INSERT INTO spaces (id, name, owner_id, type, created_at) VALUES (?, ?, ?, ?, ?)').run(SPACE_ID, 'Test Space', OWNER_ID, 'private', now);

    // Seed space members
    sqlite.prepare('INSERT INTO space_members (space_id, user_id, joined_at) VALUES (?, ?, ?)').run(SPACE_ID, OWNER_ID, now);
    sqlite.prepare('INSERT INTO space_members (space_id, user_id, joined_at) VALUES (?, ?, ?)').run(SPACE_ID, GUEST_ID, now);

    // Default @everyone role with VIEW_CHANNEL and CONNECT
    const everyonePermissions = (BigInt(PermissionBits.VIEW_CHANNEL) | BigInt(PermissionBits.CONNECT) | BigInt(PermissionBits.SPEAK)).toString();
    sqlite.prepare('INSERT INTO roles (id, space_id, name, permissions, position, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      SPACE_ID,
      SPACE_ID,
      '@everyone',
      everyonePermissions,
      0,
      now
    );

    // Voice channel in space
    sqlite.prepare('INSERT INTO channels (id, space_id, name, type, position, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      VOICE_CHANNEL_ID,
      SPACE_ID,
      'voice-channel',
      'voice',
      0,
      now
    );

    // DM channel between OWNER and GUEST
    sqlite.prepare('INSERT INTO dm_channels (id, created_at) VALUES (?, ?)').run(DM_CHANNEL_ID, now);
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(DM_CHANNEL_ID, OWNER_ID);
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run(DM_CHANNEL_ID, GUEST_ID);

    app = Fastify();
    await app.register(livekitRoutes);
    await app.ready();
  });

  afterEach(async () => {
    mutableLiveKit.apiKey = origApiKey;
    mutableLiveKit.apiSecret = origApiSecret;
    mutableLiveKit.url = origUrl;
    if (app) await app.close();
    sqlite.close();
  });

  it('returns 503 voice_disabled when livekit configuration is missing or incomplete', async () => {
    mutableLiveKit.url = undefined;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { channelId: VOICE_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('voice_disabled');
  });

  it('returns 400 validation_failed if neither channelId nor dmChannelId is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_failed');
  });

  it('returns 404 channel_not_found if channelId does not exist and is not a DM', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { channelId: 'non-existent-channel' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('channel_not_found');
  });

  it('returns 403 voice_connect_forbidden if user is not in space and has no permission', async () => {
    currentCallerId = OUTSIDER_ID;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { channelId: VOICE_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('voice_connect_forbidden');
  });

  it('generates a spectator preview token for a space voice channel with hidden=true and canPublish=false', async () => {
    currentCallerId = GUEST_ID;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { channelId: VOICE_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.url).toBe('wss://livekit.test.example');
    expect(body.token).toBeDefined();

    const payload = parseJwtPayload(body.token);
    expect(payload).toBeDefined();
    expect(payload.sub).toMatch(/^preview:user-guest:\d+$/);
    expect(payload.video).toMatchObject({
      room: VOICE_CHANNEL_ID,
      roomJoin: true,
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
      hidden: true,
    });
  });

  it('generates preview token for DM channel when caller is a member', async () => {
    currentCallerId = GUEST_ID;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { dmChannelId: DM_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.url).toBe('wss://livekit.test.example');
    expect(body.token).toBeDefined();

    const payload = parseJwtPayload(body.token);
    expect(payload.video).toMatchObject({
      room: `dm-${DM_CHANNEL_ID}`,
      roomJoin: true,
      canPublish: false,
      hidden: true,
    });
  });

  it('returns 403 not_dm_member if caller is not in DM channel', async () => {
    currentCallerId = OUTSIDER_ID;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { dmChannelId: DM_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('not_dm_member');
  });

  it('resolves DM channel correctly even if passed as channelId parameter fallback', async () => {
    currentCallerId = OWNER_ID;

    const res = await app.inject({
      method: 'POST',
      url: '/api/livekit/preview-token',
      payload: { channelId: DM_CHANNEL_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const payload = parseJwtPayload(body.token);
    expect(payload.video.room).toBe(`dm-${DM_CHANNEL_ID}`);
    expect(payload.video.hidden).toBe(true);
    expect(payload.video.canPublish).toBe(false);
  });
});
