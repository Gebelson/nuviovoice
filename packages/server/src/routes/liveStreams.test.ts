import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { liveStreamRoutes } from './liveStreams.js';
import { setWorkerId } from '../utils/snowflake.js';

try { setWorkerId(1); } catch { /* ignore if already set */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToAll: vi.fn(),
    sendToUser: vi.fn(),
    sendToSpace: vi.fn(),
  },
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (
    request: { userId?: string; headers: Record<string, string> },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    const auth = request.headers.authorization;
    if (!auth) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    request.userId = auth;
  },
}));

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

  // Ensure streamer_channels table exists
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS streamer_channels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      channel_url TEXT NOT NULL,
      linked_space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
      is_live INTEGER NOT NULL DEFAULT 0,
      stream_title TEXT,
      stream_game TEXT,
      stream_thumbnail TEXT,
      viewer_count INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER,
      last_checked_at INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_streamer_channels_user ON streamer_channels(user_id);
    CREATE INDEX IF NOT EXISTS idx_streamer_channels_live ON streamer_channels(is_live);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_streamer_channels_platform_channel ON streamer_channels(platform, channel_name);
  `);
}

describe('Live Streams API', () => {
  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(liveStreamRoutes);
    await app.ready();

    const now = Date.now();

    // Seed test users: alice, bob
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'alice', 'alice', 'Alice Gamer', 'hash', 0, now
    );
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'bob', 'bob', 'Bob Streamer', 'hash', 0, now
    );

    // Seed a public space for Bob
    sqlite.prepare('INSERT INTO spaces (id, name, owner_id, type, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'bob-space', 'Comunidade do Bob', 'bob', 'public', now
    );
  });

  it('GET /api/live/streams returns empty array when no streams are live', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/live/streams',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.streams).toEqual([]);
  });

  it('POST /api/live/channels/link validates input and requires auth', async () => {
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/live/channels/link',
      payload: { channelInput: 'https://twitch.tv/alice' },
    });
    expect(unauthRes.statusCode).toBe(401);

    const badInputRes = await app.inject({
      method: 'POST',
      url: '/api/live/channels/link',
      headers: { authorization: 'alice' },
      payload: { channelInput: '' },
    });
    expect(badInputRes.statusCode).toBe(400);
  });

  it('links a channel, retrieves it via GET /api/live/channels/me, and can unlink it', async () => {
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/live/channels/link',
      headers: { authorization: 'bob' },
      payload: {
        channelInput: 'https://twitch.tv/bobstreamer',
        linkedSpaceId: 'bob-space',
      },
    });

    expect(linkRes.statusCode).toBe(201);
    const linkBody = JSON.parse(linkRes.body);
    expect(linkBody.channel).toBeDefined();
    expect(linkBody.channel.platform).toBe('twitch');
    expect(linkBody.channel.channelName).toBe('bobstreamer');
    expect(linkBody.channel.linkedSpaceId).toBe('bob-space');

    // Retrieve via /me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/live/channels/me',
      headers: { authorization: 'bob' },
    });
    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.channels).toHaveLength(1);
    expect(meBody.channels[0].channelName).toBe('bobstreamer');

    // Unlink
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/live/channels/${linkBody.channel.id}`,
      headers: { authorization: 'bob' },
    });
    expect(delRes.statusCode).toBe(200);

    const meResAfter = await app.inject({
      method: 'GET',
      url: '/api/live/channels/me',
      headers: { authorization: 'bob' },
    });
    expect(JSON.parse(meResAfter.body).channels).toHaveLength(0);
  });

  it('GET /api/live/streams returns live streams with streamer info and linked space', async () => {
    const now = Date.now();
    // Insert a live stream directly into DB for testing stream list response
    sqlite.prepare(`
      INSERT INTO streamer_channels (
        id, user_id, platform, channel_id, channel_name, channel_url,
        linked_space_id, is_live, stream_title, stream_game, viewer_count,
        started_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'chan-123', 'bob', 'twitch', 'bobstreamer', 'bobstreamer', 'https://twitch.tv/bobstreamer',
      'bob-space', 1, 'Jogando com a Comunidade!', 'Minecraft', 142,
      now - 3600000, now, now
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/live/streams',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.streams).toHaveLength(1);
    const s = body.streams[0];
    expect(s.id).toBe('chan-123');
    expect(s.channelName).toBe('bobstreamer');
    expect(s.streamer.username).toBe('bob');
    expect(s.streamer.displayName).toBe('Bob Streamer');
    expect(s.platform).toBe('twitch');
    expect(s.streamTitle).toBe('Jogando com a Comunidade!');
    expect(s.streamGame).toBe('Minecraft');
    expect(s.viewerCount).toBe(142);
    expect(s.linkedSpace).toBeDefined();
    expect(s.linkedSpace?.id).toBe('bob-space');
    expect(s.linkedSpace?.name).toBe('Comunidade do Bob');
    expect(s.embedUrl).toContain('player.twitch.tv');

    // Individual stream endpoint
    const singleRes = await app.inject({
      method: 'GET',
      url: '/api/live/streams/chan-123',
    });
    expect(singleRes.statusCode).toBe(200);
    expect(JSON.parse(singleRes.body).stream.id).toBe('chan-123');
  });
});
