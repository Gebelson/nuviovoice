import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as schema from '../db/schema.js';
import { ensureDefaults } from '../db/migrate.js';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks.js';
import { setWorkerId } from '../utils/snowflake.js';

const execFile = promisify(execFileCb);
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
  requireAdmin: async (
    request: { userId?: string },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    const user = sqlite.prepare('SELECT is_admin FROM users WHERE id = ?').get(request.userId) as
      | { is_admin: number }
      | undefined;
    if (!user || user.is_admin !== 1) {
      return reply.code(403).send({ error: 'Forbidden', statusCode: 403, code: 'forbidden' });
    }
  },
}));

import { dmRoutes } from './dm.js';
import { messageRoutes } from './messages.js';
import { winksRoutes } from './winks.js';
import { probeVideoFile, processWinkMedia } from '../utils/winkProcessor.js';

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
    process.env.DATA_DIR = testDataDir;

    sqlite = new Database(path.join(testDataDir, 'test.db'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    setWorkerId(1);

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(multipart);
    await app.register(dmRoutes);
    await app.register(messageRoutes);
    await app.register(winksRoutes);
    await app.ready();

    // Seed test users
    const now = Date.now();
    sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at)
      VALUES
        ('user-admin', 'sysadmin', 'Administrator', 'hash0', 1, ?),
        ('user-1', 'alice', 'Alice', 'hash1', 0, ?),
        ('user-2', 'bob', 'Bob', 'hash2', 0, ?),
        ('user-3', 'charlie', 'Charlie', 'hash3', 0, ?)
    `).run(now, now, now, now);

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

    // Seed a space with a channel (owned by user-1 who is NOT global admin)
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

  // ─── Video & Admin Pipeline Tests ───

  it('STRICTLY REJECTS non-admins and space owners from managing Winks', async () => {
    // Normal user
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/admin/winks',
      headers: { authorization: 'user-2' },
    });
    expect(res1.statusCode).toBe(403);

    // Space owner who is NOT global admin
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'user-1' }, // user-1 owns space-1
      payload: { name: 'Unauthorized Wink' },
    });
    expect(res2.statusCode).toBe(403);
  });

  it('allows global admin to list Winks and inspect summary metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/winks',
      headers: { authorization: 'user-admin' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.winks).toBeDefined();
    expect(body.metrics).toBeDefined();
    expect(body.metrics.total).toBe(16); // 16 seeded preset winks
    expect(body.metrics.published).toBe(16);
  });

  it('processes a real transparent MOV ProRes 4444 video file with alpha preservation', async () => {
    // 1. Generate a real test ProRes 4444 MOV with alpha transparency using FFmpeg
    const proresMov = path.join(testDataDir, 'sample_alpha.mov');
    await execFile('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'color=c=blue@0.7:s=320x240:d=1,format=rgba',
      '-c:v', 'prores_ks',
      '-profile:v', '4',
      '-pix_fmt', 'yuva444p10le',
      '-y', proresMov,
    ]);

    expect(fs.existsSync(proresMov)).toBe(true);

    // 2. Test FFprobe analysis
    const probe = await probeVideoFile(proresMov);
    expect(probe.videoCodec).toBe('prores');
    expect(probe.hasAlpha).toBe(true);
    expect(probe.width).toBe(320);
    expect(probe.height).toBe(240);

    // 3. Admin upload via API endpoint (with existingFilePath for test convenience)
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'user-admin' },
      payload: {
        name: 'Cinema 4D Alpha Test',
        category: 'humor',
        emoji: '🎬',
        existingFilePath: proresMov,
        autoPublish: true,
      },
    });

    expect(uploadRes.statusCode).toBe(201);
    const createdWink = uploadRes.json();
    expect(createdWink.id).toBeDefined();
    expect(createdWink.name).toBe('Cinema 4D Alpha Test');

    // 4. Run media processor
    await processWinkMedia(createdWink.id);

    // 5. Inspect database row
    const updated = sqlite.prepare('SELECT * FROM winks WHERE id = ?').get(createdWink.id) as any;
    expect(updated.status).toBe('completed');
    expect(updated.has_alpha).toBe(1);
    expect(updated.webm_path).toBeDefined();
    expect(fs.existsSync(updated.webm_path)).toBe(true);
    expect(fs.existsSync(updated.mp4_path)).toBe(true);
    expect(fs.existsSync(updated.thumbnail_path)).toBe(true);

    // 6. Verify media streaming endpoint returns 200
    const mediaRes = await app.inject({
      method: 'GET',
      url: `/api/winks/media/${createdWink.id}.webm`,
    });
    expect(mediaRes.statusCode).toBe(200);

    // 7. Verify published wink is now listed in /api/winks
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/winks',
    });
    expect(listRes.statusCode).toBe(200);
    const publicList = listRes.json();
    const found = publicList.find((w: any) => w.id === createdWink.id);
    expect(found).toBeDefined();
    expect(found.hasAlpha).toBe(true);
    expect(found.webmUrl).toContain(`${createdWink.id}.webm`);

    // 8. Normal DM member can now send this newly published video wink!
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      headers: { authorization: 'user-1' },
      payload: { winkId: createdWink.id },
    });
    expect(sendRes.statusCode).toBe(201);
    const sendBody = sendRes.json();
    expect(sendBody.type).toBe('wink');
    expect(sendBody.content).toContain(createdWink.id);

    // 9. Unpublish the wink and verify it can NO LONGER be sent
    await app.inject({
      method: 'POST',
      url: `/api/admin/winks/${createdWink.id}/unpublish`,
      headers: { authorization: 'user-admin' },
    });

    const sendAgainRes = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1/winks',
      headers: { authorization: 'user-1' },
      payload: { winkId: createdWink.id },
    });
    expect(sendAgainRes.statusCode).toBe(400); // Unpublished wink is rejected!
  });
});
