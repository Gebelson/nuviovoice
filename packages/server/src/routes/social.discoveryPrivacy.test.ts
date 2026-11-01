import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { ensureDefaults } from '../db/migrate.js';

setWorkerId(32);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;

let currentCallerId = 'viewer-1';

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
    sendToAdmins: vi.fn(),
    sendToDmMembers: vi.fn(),
    getAllOnlineUserIds: () => [],
  },
}));

vi.mock('../utils/federationOutbox.js', () => ({
  appendMutationLog: vi.fn(),
  queueOutboxEvent: vi.fn(),
  buildFriendContextId: () => 'ctx',
  getFriendEventTargets: () => [],
}));

vi.mock('../utils/federationAuth.js', async (importActual) => {
  const actual = await importActual<typeof import('../utils/federationAuth.js')>();
  return { ...actual, getOurOrigin: () => 'https://local.test' };
});

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    const statements = sqlText.split(/-->\s*statement-breakpoint/);
    for (const stmt of statements) {
      const clean = stmt.trim();
      if (clean) db.exec(clean);
    }
  }
}

interface UserSeed {
  id: string;
  username: string;
  displayName?: string | null;
  friendDiscoveryVisibility?: 'everyone' | 'mutual_friends' | 'nobody';
}

function seedUser(u: UserSeed): void {
  testDb.insert(schema.users).values({
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? null,
    passwordHash: 'pass',
    status: 'offline',
    isAdmin: 0,
    isDeleted: 0,
    discoverable: u.friendDiscoveryVisibility === 'nobody' ? 0 : 1,
    friendDiscoveryVisibility: u.friendDiscoveryVisibility ?? 'everyone',
    receiveWinks: 1,
    createdAt: Date.now(),
  }).run();
}

function seedFriendship(userA: string, userB: string): void {
  testDb.insert(schema.friends).values({
    userId: userA,
    friendId: userB,
    createdAt: Date.now(),
  }).run();
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { socialRoutes } = await import('./social.js');
  await app.register(socialRoutes);
  await app.ready();
  return app;
}

describe('Friend Discovery Privacy (everyone / mutual_friends / nobody)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    currentCallerId = 'viewer-1';
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    testDb = drizzle(sqlite, { schema });

    seedUser({ id: 'viewer-1', username: 'viewer' });
    seedUser({ id: 'renan', username: 'renan', displayName: 'Renan', friendDiscoveryVisibility: 'everyone' });
    seedFriendship('viewer-1', 'renan');

    app = await buildApp();
  });

  it('OPÇÃO 1 (everyone): user is visible in discover and search for any viewer', async () => {
    seedUser({ id: 'target-everyone', username: 'alice', displayName: 'Alice Everyone', friendDiscoveryVisibility: 'everyone' });

    const discoverRes = await app.inject({ method: 'GET', url: '/api/social/discover' });
    expect(discoverRes.statusCode).toBe(200);
    const discoverBody = discoverRes.json();
    const ids = discoverBody.users.map((u: any) => u.id);
    expect(ids).toContain('target-everyone');

    const searchRes = await app.inject({ method: 'GET', url: '/api/social/search?q=alice' });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.map((u: any) => u.id)).toContain('target-everyone');
  });

  it('OPÇÃO 3 (nobody): user is hidden from discover and search for all viewers', async () => {
    seedUser({ id: 'target-nobody', username: 'bob', displayName: 'Bob Nobody', friendDiscoveryVisibility: 'nobody' });

    // Ensure bob is friends with Renan (mutual friend exists, but nobody takes absolute precedence)
    seedFriendship('target-nobody', 'renan');

    const discoverRes = await app.inject({ method: 'GET', url: '/api/social/discover' });
    expect(discoverRes.statusCode).toBe(200);
    const discoverBody = discoverRes.json();
    const ids = discoverBody.users.map((u: any) => u.id);
    expect(ids).not.toContain('target-nobody');

    const searchRes = await app.inject({ method: 'GET', url: '/api/social/search?q=bob' });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.map((u: any) => u.id)).not.toContain('target-nobody');
  });

  it('OPÇÃO 2 (mutual_friends): user is found if and only if viewer shares a confirmed mutual friend', async () => {
    // Charlie has visibility: mutual_friends and is friends with Renan (who is friends with viewer-1)
    seedUser({ id: 'target-charlie', username: 'charlie', displayName: 'Charlie Mutual', friendDiscoveryVisibility: 'mutual_friends' });
    seedFriendship('target-charlie', 'renan');

    // Dave has visibility: mutual_friends but has NO mutual friends with viewer-1
    seedUser({ id: 'target-dave', username: 'dave', displayName: 'Dave Isolated', friendDiscoveryVisibility: 'mutual_friends' });

    // 1. Check viewer-1 discovery: Charlie must be found, Dave must NOT
    const res1 = await app.inject({ method: 'GET', url: '/api/social/discover' });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    const ids1 = body1.users.map((u: any) => u.id);

    expect(ids1).toContain('target-charlie');
    expect(ids1).not.toContain('target-dave');

    // 2. Search check: Charlie matches search for viewer-1
    const searchCharlie = await app.inject({ method: 'GET', url: '/api/social/search?q=charlie' });
    expect(searchCharlie.json().map((u: any) => u.id)).toContain('target-charlie');

    // Dave does NOT match search for viewer-1
    const searchDave = await app.inject({ method: 'GET', url: '/api/social/search?q=dave' });
    expect(searchDave.json().map((u: any) => u.id)).not.toContain('target-dave');

    // 3. Switch viewer to viewer-2 (who has 0 friends)
    seedUser({ id: 'viewer-2', username: 'viewer2' });
    currentCallerId = 'viewer-2';

    const res2 = await app.inject({ method: 'GET', url: '/api/social/discover' });
    const ids2 = res2.json().users.map((u: any) => u.id);
    // Neither Charlie nor Dave can be seen by viewer-2 because viewer-2 shares no friends with them
    expect(ids2).not.toContain('target-charlie');
    expect(ids2).not.toContain('target-dave');
  });

  it('Pagination and total count accurately reflect visibility filter', async () => {
    seedUser({ id: 'u-open', username: 'open1', friendDiscoveryVisibility: 'everyone' });
    seedUser({ id: 'u-closed', username: 'closed1', friendDiscoveryVisibility: 'nobody' });

    const res = await app.inject({ method: 'GET', url: '/api/social/discover?limit=10' });
    const body = res.json();
    expect(body.users.map((u: any) => u.id)).toContain('u-open');
    expect(body.users.map((u: any) => u.id)).not.toContain('u-closed');
    expect(body.total).toBe(body.users.length);
  });
});
