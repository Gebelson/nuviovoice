import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { DEFAULT_EVERYONE_PERMISSIONS } from '@concord/shared/src/permissions.js';
import { voiceInviteRoutes } from './voiceInvites.js';

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
  authenticate: async (req: { userId?: string }) => {
    req.userId = currentCallerId;
  },
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
    sendToSpace: vi.fn(),
    addUserSpace: vi.fn(),
    removeUserSpace: vi.fn(),
    getRoom: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../utils/federationOutbox.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    queueDmRelay: vi.fn(),
  };
});

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

describe('Voice Invites Routes', () => {
  let app: FastifyInstance;
  const SPACE_ID = 'space-1';
  const VOICE_CHANNEL_ID = 'channel-voice-1';
  const TEXT_CHANNEL_ID = 'channel-text-1';
  const OWNER_ID = 'user-owner';
  const GUEST_ID = 'user-guest';

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    testDb = drizzle(sqlite, { schema });

    currentCallerId = OWNER_ID;

    // Seed test users
    sqlite.prepare(`
      INSERT INTO users (id, username, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(OWNER_ID, 'owner', 'hash', Date.now());

    sqlite.prepare(`
      INSERT INTO users (id, username, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(GUEST_ID, 'guest', 'hash', Date.now());

    // Seed space owned by OWNER_ID
    sqlite.prepare(`
      INSERT INTO spaces (id, name, owner_id, type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(SPACE_ID, 'Vocal Lounge', OWNER_ID, 'private', Date.now());

    // Add owner as space member
    sqlite.prepare(`
      INSERT INTO space_members (space_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(SPACE_ID, OWNER_ID, Date.now());

    // Seed @everyone role
    sqlite.prepare(`
      INSERT INTO roles (id, space_id, name, permissions, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(SPACE_ID, SPACE_ID, '@everyone', DEFAULT_EVERYONE_PERMISSIONS.toString(), 0, Date.now());

    // Seed channels
    sqlite.prepare(`
      INSERT INTO channels (id, space_id, name, type, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(VOICE_CHANNEL_ID, SPACE_ID, 'Bate-papo Voz', 'voice', 0, Date.now());

    sqlite.prepare(`
      INSERT INTO channels (id, space_id, name, type, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(TEXT_CHANNEL_ID, SPACE_ID, 'geral', 'text', 1, Date.now());

    app = Fastify();
    await app.register(voiceInviteRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  it('creates a voice invite with valid token and URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: {
        expiresInSeconds: 3600,
        maxUses: 5,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.token).toBeTruthy();
    expect(body.channelId).toBe(VOICE_CHANNEL_ID);
    expect(body.spaceId).toBe(SPACE_ID);
    expect(body.maxUses).toBe(5);
    expect(body.inviteUrl).toBe(`https://nuviovoice.vercel.app/voice/invite/${body.token}`);
  });

  it('rejects creating a voice invite for a text channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/${TEXT_CHANNEL_ID}/voice-invites`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('channel_type_invalid');
  });

  it('rejects non-existent channel with 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/channels/invalid-id/voice-invites`,
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('channel_not_found');
  });

  it('previews an active voice invite', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: {},
    });
    const token = createRes.json().token;

    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/voice-invites/${token}/preview`,
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json();
    expect(preview.token).toBe(token);
    expect(preview.space.name).toBe('Vocal Lounge');
    expect(preview.channel.name).toBe('Bate-papo Voz');
    expect(preview.channel.type).toBe('voice');
  });

  it('allows a user to join via voice invite and increments usedCount', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: { maxUses: 2 },
    });
    const token = createRes.json().token;

    // Switch caller to GUEST_ID
    currentCallerId = GUEST_ID;

    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/voice-invites/${token}/join`,
    });

    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().channel.id).toBe(VOICE_CHANNEL_ID);

    // Verify member was added to space
    const memberRow = sqlite.prepare('SELECT * FROM space_members WHERE space_id = ? AND user_id = ?')
      .get(SPACE_ID, GUEST_ID);
    expect(memberRow).toBeTruthy();

    // Verify usedCount incremented
    const inviteRow = sqlite.prepare('SELECT used_count FROM voice_invites WHERE token = ?').get(token) as { used_count: number };
    expect(inviteRow.used_count).toBe(1);
  });

  it('enforces maxUses limit', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: { maxUses: 1 },
    });
    const token = createRes.json().token;

    currentCallerId = GUEST_ID;

    // Use 1 (ok)
    const firstJoin = await app.inject({
      method: 'POST',
      url: `/api/voice-invites/${token}/join`,
    });
    expect(firstJoin.statusCode).toBe(200);

    // Use 2 (expired / maxUses reached -> 410)
    const secondJoin = await app.inject({
      method: 'POST',
      url: `/api/voice-invites/${token}/join`,
    });
    expect(secondJoin.statusCode).toBe(410);
  });

  it('lists active voice invites for a channel and revokes an invite', async () => {
    currentCallerId = OWNER_ID;
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: {},
    });
    const { id } = createRes.json();

    // List
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().invites.length).toBeGreaterThanOrEqual(1);

    // Revoke
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/voice-invites/${id}`,
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().success).toBe(true);

    // Verify revoked invite is excluded from list
    const listAfter = await app.inject({
      method: 'GET',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
    });
    expect(listAfter.json().invites.find((inv: { id: string }) => inv.id === id)).toBeUndefined();
  });

  it('sends a voice invite to a friend via direct message', async () => {
    currentCallerId = OWNER_ID;
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/channels/${VOICE_CHANNEL_ID}/voice-invites`,
      payload: {},
    });
    const token = createRes.json().token;

    const dmRes = await app.inject({
      method: 'POST',
      url: `/api/dm/voice-invite`,
      payload: {
        targetUserId: GUEST_ID,
        token,
      },
    });

    expect(dmRes.statusCode).toBe(201);
    expect(dmRes.json().success).toBe(true);
    expect(dmRes.json().messageId).toBeTruthy();
  });
});
