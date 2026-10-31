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
    if (!request.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    request.userId = request.headers.authorization;
  },
}));

import { soundpadRoutes } from './soundpad.js';

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

beforeEach(async () => {
  testDataDir = await mkdtemp(path.join(tmpdir(), 'concord-soundpad-'));
  process.env.DATA_DIR = testDataDir;

  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  ensureDefaults(sqlite);

  db = drizzle(sqlite, { schema });

  const now = Date.now();
  // Seed test users
  db.insert(schema.users).values([
    { id: 'alice', username: 'alice', displayName: 'Alice', passwordHash: 'test', createdAt: now },
    { id: 'bob', username: 'bob', displayName: 'Bob', passwordHash: 'test', createdAt: now },
  ]).run();

  app = Fastify();
  await app.register(soundpadRoutes);
});

afterEach(async () => {
  if (app) await app.close();
  if (sqlite) sqlite.close();
  await rm(testDataDir, { recursive: true, force: true });
});

describe('soundpadRoutes', () => {
  it('requires authentication for soundpad API endpoints', async () => {
    const resGet = await app.inject({ method: 'GET', url: '/api/soundpad/sounds' });
    expect(resGet.statusCode).toBe(401);

    const resPost = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds',
      payload: { name: 'Test', audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
    });
    expect(resPost.statusCode).toBe(401);
  });

  it('lists official sounds and categories for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/soundpad/sounds',
      headers: { authorization: 'alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sounds).toBeInstanceOf(Array);
    // ensureDefaults seeds the 16 official presets
    expect(body.sounds.some((s: any) => s.id === 'official-airhorn')).toBe(true);
    expect(body.categories).toBeInstanceOf(Array);
  });

  it('allows user to create a personal custom sound', async () => {
    // 44-byte minimal WAV header base64
    const wavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

    const res = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds',
      headers: { authorization: 'alice' },
      payload: {
        name: 'My Sound',
        audioBase64: wavBase64,
        category: 'Personalizados',
        scope: 'personal',
        emoji: '🎵',
        durationMs: 1500,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.sound).toBeDefined();
    expect(body.sound.name).toBe('My Sound');
    expect(body.sound.ownerId).toBe('alice');
    expect(body.sound.scope).toBe('personal');
  });

  it('toggles favorites for a sound', async () => {
    // 1. Favorite
    const resFav = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds/official-airhorn/favorite',
      headers: { authorization: 'alice' },
    });
    expect(resFav.statusCode).toBe(200);
    expect(resFav.json().isFavorite).toBe(true);

    // 2. Verify it shows in GET /sounds with isFavorite true
    const resList = await app.inject({
      method: 'GET',
      url: '/api/soundpad/sounds',
      headers: { authorization: 'alice' },
    });
    const airhorn = resList.json().sounds.find((s: any) => s.id === 'official-airhorn');
    expect(airhorn?.isFavorite).toBe(true);

    // 3. Unfavorite
    const resUnfav = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds/official-airhorn/favorite',
      headers: { authorization: 'alice' },
    });
    expect(resUnfav.statusCode).toBe(200);
    expect(resUnfav.json().isFavorite).toBe(false);
  });

  it('records sound play event and increments playCount', async () => {
    const resPlay = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds/official-airhorn/play',
      headers: { authorization: 'alice' },
      payload: { channelId: 'channel-1' },
    });

    expect(resPlay.statusCode).toBe(200);
    expect(resPlay.json().success).toBe(true);
    expect(resPlay.json().soundId).toBe('official-airhorn');

    // Verify GET /sounds reflects the updated playCount for this user
    const resList = await app.inject({
      method: 'GET',
      url: '/api/soundpad/sounds',
      headers: { authorization: 'alice' },
    });
    const airhorn = resList.json().sounds.find((s: any) => s.id === 'official-airhorn');
    expect(airhorn?.playCount).toBe(1);
  });

  it('allows owner to delete their custom sound, but forbids deleting official sound', async () => {
    // Attempt deleting official sound -> should be 403
    const resDelOfficial = await app.inject({
      method: 'DELETE',
      url: '/api/soundpad/sounds/official-airhorn',
      headers: { authorization: 'alice' },
    });
    expect(resDelOfficial.statusCode).toBe(403);

    // Create a sound by alice
    const wavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/soundpad/sounds',
      headers: { authorization: 'alice' },
      payload: {
        name: 'Temporary Sound',
        audioBase64: wavBase64,
        category: 'Personalizados',
        scope: 'personal',
      },
    });
    const soundId = resCreate.json().sound.id;

    // Bob tries to delete Alice's sound -> 403
    const resBobDelete = await app.inject({
      method: 'DELETE',
      url: `/api/soundpad/sounds/${soundId}`,
      headers: { authorization: 'bob' },
    });
    expect(resBobDelete.statusCode).toBe(403);

    // Alice deletes her own sound -> 200
    const resAliceDelete = await app.inject({
      method: 'DELETE',
      url: `/api/soundpad/sounds/${soundId}`,
      headers: { authorization: 'alice' },
    });
    expect(resAliceDelete.statusCode).toBe(200);
    expect(resAliceDelete.json().success).toBe(true);
  });
});
