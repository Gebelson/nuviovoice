import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { signJwt, hashPassword } from '../utils/auth.js';
import { ensureDefaults } from '../db/migrate.js';

setWorkerId(31);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let app: FastifyInstance;

const sendToUserMock = vi.fn();

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: (...args: any[]) => sendToUserMock(...args),
    sendToSpace: vi.fn(),
    sendToDmMembers: vi.fn(),
    setUserShowActivity: vi.fn(),
    clearUserActivities: vi.fn(),
    getUserStatus: vi.fn(() => 'online'),
    forceDisconnectUser: vi.fn(),
  },
}));

function applyMigrations(db: Database.Database): void {
  const dir = path.resolve(__dirname, '../../drizzle');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sqlText = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const stmt of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) db.exec(clean);
    }
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const { userRoutes } = await import('./users.js');
  const f = Fastify({ logger: false });
  await f.register(userRoutes);
  await f.ready();
  return f;
}

const LOCAL_ID = 'local-user-1';
const LOCAL_USERNAME = 'alice';
const LOCAL_PASSWORD = 'password123';

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${signJwt({ userId: LOCAL_ID, username: LOCAL_USERNAME })}` };
}

beforeEach(async () => {
  vi.clearAllMocks();
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  ensureDefaults(sqlite);
  testDb = drizzle(sqlite, { schema });

  testDb.insert(schema.users).values({
    id: LOCAL_ID,
    username: LOCAL_USERNAME,
    passwordHash: await hashPassword(LOCAL_PASSWORD),
    isAdmin: 0,
    discoverable: 1,
    friendDiscoveryVisibility: 'everyone',
    receiveWinks: 1,
    createdAt: Date.now(),
  }).run();

  app = await buildApp();
});

describe('User Privacy Settings API (/api/users/@me)', () => {
  it('GET /api/users/@me includes friendDiscoveryVisibility and receiveWinks for self', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/@me',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.friendDiscoveryVisibility).toBe('everyone');
    expect(body.receiveWinks).toBe(true);
  });

  it('PATCH /api/users/@me successfully updates friendDiscoveryVisibility to mutual_friends', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: authHeader(),
      payload: {
        friendDiscoveryVisibility: 'mutual_friends',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.friendDiscoveryVisibility).toBe('mutual_friends');

    const inDb = sqlite.prepare('SELECT friend_discovery_visibility, discoverable FROM users WHERE id = ?').get(LOCAL_ID) as any;
    expect(inDb.friend_discovery_visibility).toBe('mutual_friends');
    expect(inDb.discoverable).toBe(1);

    expect(sendToUserMock).toHaveBeenCalled();
  });

  it('PATCH /api/users/@me successfully updates friendDiscoveryVisibility to nobody and keeps discoverable=0', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: authHeader(),
      payload: {
        friendDiscoveryVisibility: 'nobody',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.friendDiscoveryVisibility).toBe('nobody');

    const inDb = sqlite.prepare('SELECT friend_discovery_visibility, discoverable FROM users WHERE id = ?').get(LOCAL_ID) as any;
    expect(inDb.friend_discovery_visibility).toBe('nobody');
    expect(inDb.discoverable).toBe(0);
  });

  it('PATCH /api/users/@me rejects invalid friendDiscoveryVisibility', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: authHeader(),
      payload: {
        friendDiscoveryVisibility: 'invalid_option',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('validation_failed');
  });

  it('PATCH /api/users/@me successfully updates receiveWinks to false', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: authHeader(),
      payload: {
        receiveWinks: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.receiveWinks).toBe(false);

    const inDb = sqlite.prepare('SELECT receive_winks FROM users WHERE id = ?').get(LOCAL_ID) as any;
    expect(inDb.receive_winks).toBe(0);
  });

  it('PATCH /api/users/@me rejects non-boolean receiveWinks', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: authHeader(),
      payload: {
        receiveWinks: 'no',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('validation_failed');
  });
});
