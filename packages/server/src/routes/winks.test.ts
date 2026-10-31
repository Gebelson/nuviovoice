import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { ensureDefaults } from '../db/migrate.js';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks.js';
import { setWorkerId } from '../utils/snowflake.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;
let testDataDir: string;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../utils/auth.js', () => ({
  authenticate: async (
    request: { userId?: string; headers: Record<string, string> },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    if (!request.headers.authorization) return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    request.userId = request.headers.authorization;
  },
}));

import { dmRoutes } from './dm.js';
import { messageRoutes } from './messages.js';

function applyMigrations(dbInstance: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const stmt of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) dbInstance.exec(clean);
    }
  }
}

describe('Winks backend API & security rules', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(path.join(tmpdir(), 'winks-test-'));
    sqlite = new Database(path.join(testDataDir, 'test.db'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    setWorkerId(1);

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(dmRoutes);
    await app.register(messageRoutes);
    await app.ready();

    // Seed test users
    const now = Date.now();
    sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, created_at)
      VALUES
        ('user-1', 'alice', 'Alice', 'hash1', ?),
        ('user-2', 'bob', 'Bob', 'hash2', ?),
        ('user-3', 'charlie', 'Charlie', 'hash3', ?)
    `).run(now, now, now);

    // Seed a DM channel between user-1 and user-2
    sqlite.prepare(`
      INSERT INTO dm_channels (id, created_at)
      VALUES ('dm-1', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO dm_members (dm_channel_id, user_id)
      VALUES
        ('dm-1', 'user-1'),
        ('dm-1', 'user-2')
    `).run();

    // Seed a space with a channel
    sqlite.prepare(`
      INSERT INTO spaces (id, name, owner_id, created_at)
      VALUES ('space-1', 'Test Space', 'user-1', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO space_members (space_id, user_id, joined_at)
      VALUES ('space-1', 'user-1', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO channels (id, space_id, name, type, position, created_at)
      VALUES ('channel-1', 'space-1', 'general', 'text', 0, ?)
    `).run(now);
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
    await rm(testDataDir, { recursive: true, force: true });
  });

  it('requires authentication to send a wink', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      payload: { winkId: 'kiss' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows a DM member to send an official wink', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      headers: { authorization: 'user-1' },
      payload: { winkId: 'kiss' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.dmChannelId).toBe('dm-1');
    expect(body.userId).toBe('user-1');
    expect(body.type).toBe('wink');
    expect(body.content).toContain('kiss');

    // Confirm stored in SQLite
    const row = sqlite.prepare('SELECT * FROM dm_messages WHERE id = ?').get(body.id) as any;
    expect(row).toBeDefined();
    expect(row.type).toBe('wink');
    expect(row.content).toContain('"type":"wink"');
    expect(row.content).toContain('"winkId":"kiss"');
  });

  it('rejects sending a non-existent winkId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      headers: { authorization: 'user-1' },
      payload: { winkId: 'invalid-nonexistent-wink' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects sending a wink if user is not a member of the DM', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      headers: { authorization: 'user-3' }, // Charlie is not in dm-1
      payload: { winkId: 'confetti' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('not_dm_member');
  });

  it('STRICTLY REJECTS sending a wink to a space channel via /api/channels/:id/winks', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels/channel-1/winks',
      headers: { authorization: 'user-1' },
      payload: { winkId: 'giant-heart' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('winks_not_allowed_in_channels');
  });

  it('STRICTLY REJECTS sending a wink to a space channel via /api/channels/:id/messages', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels/channel-1/messages',
      headers: { authorization: 'user-1' },
      payload: {
        content: JSON.stringify({ type: 'wink', winkId: 'kiss' }),
        type: 'wink',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('winks_not_allowed_in_channels');
  });

  it('verifies that all 16 official winks can be sent in DMs', async () => {
    expect(OFFICIAL_WINKS.length).toBe(16);

    for (const wink of OFFICIAL_WINKS) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dm/dm-1/winks',
        headers: { authorization: 'user-2' },
        payload: { winkId: wink.id },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.type).toBe('wink');
      expect(body.content).toContain(wink.id);
    }
  });
});
