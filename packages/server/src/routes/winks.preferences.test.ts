import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { ensureDefaults } from '../db/migrate.js';
import { winksRoutes } from './winks.js';
import { isUserWinkMuted, recordWinkRecent, calculateMuteExpiration } from '../utils/winkMutes.js';

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
  authenticate: async (request: any) => {
    request.userId = currentCallerId;
    request.username = 'testuser';
  },
  requireAdmin: async () => {},
  verifyJwt: () => ({ userId: currentCallerId, isGuest: false }),
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
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

describe('Winks Preferences API & Service', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite, { schema });
    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    currentCallerId = 'user-test-1';

    // Create test user 1 (the requester)
    testDb.insert(schema.users).values({
      id: 'user-test-1',
      username: 'nuvio_alice',
      displayName: 'Alice',
      passwordHash: 'dummy',
      createdAt: Date.now(),
    }).run();

    // Create test user 2 (the contact)
    testDb.insert(schema.users).values({
      id: 'user-test-2',
      username: 'nuvio_bob',
      displayName: 'Bob',
      passwordHash: 'dummy',
      createdAt: Date.now(),
    }).run();

    app = Fastify();
    await app.register(winksRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
    vi.restoreAllMocks();
  });

  describe('Contact Muting', () => {
    it('calculates mute expiration correctly for all durations', () => {
      const now = 1000000;
      const m1h = calculateMuteExpiration('1h', now);
      expect(m1h.muteType).toBe('temporary');
      expect(m1h.expiresAt).toBe(now + 3600 * 1000);

      const m8h = calculateMuteExpiration('8h', now);
      expect(m8h.muteType).toBe('temporary');
      expect(m8h.expiresAt).toBe(now + 8 * 3600 * 1000);

      const m24h = calculateMuteExpiration('24h', now);
      expect(m24h.muteType).toBe('temporary');
      expect(m24h.expiresAt).toBe(now + 24 * 3600 * 1000);

      const mIndef = calculateMuteExpiration('indefinite', now);
      expect(mIndef.muteType).toBe('indefinite');
      expect(mIndef.expiresAt).toBeNull();
    });

    it('creates, reads, and deletes a contact mute via API', async () => {
      // 1. Initial check: not muted
      const checkRes1 = await app.inject({
        method: 'GET',
        url: '/api/winks/mutes/user-test-2',
      });
      expect(checkRes1.statusCode).toBe(200);
      expect(checkRes1.json().isMuted).toBe(false);

      // 2. Mute Bob for 8h
      const muteRes = await app.inject({
        method: 'PUT',
        url: '/api/winks/mutes/user-test-2',
        payload: { duration: '8h' },
      });
      expect(muteRes.statusCode).toBe(200);
      const muteData = muteRes.json();
      expect(muteData.targetUserId).toBe('user-test-2');
      expect(muteData.muteType).toBe('temporary');
      expect(muteData.expiresAt).toBeGreaterThan(Date.now());
      expect(muteData.user.username).toBe('nuvio_bob');

      // 3. Service helper reports muted
      expect(isUserWinkMuted('user-test-1', 'user-test-2')).toBe(true);

      // 4. List mutes
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/winks/mutes',
      });
      expect(listRes.statusCode).toBe(200);
      const mutesList = listRes.json();
      expect(mutesList).toHaveLength(1);
      expect(mutesList[0].targetUserId).toBe('user-test-2');

      // 5. Change duration to indefinite
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/winks/mutes/user-test-2',
        payload: { duration: 'indefinite' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().muteType).toBe('indefinite');
      expect(updateRes.json().expiresAt).toBeNull();

      // 6. Delete mute
      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/winks/mutes/user-test-2',
      });
      expect(delRes.statusCode).toBe(200);
      expect(isUserWinkMuted('user-test-1', 'user-test-2')).toBe(false);
    });

    it('automatically expires temporary mutes past their expiresAt timestamp', () => {
      // Insert an expired mute
      testDb.insert(schema.winkContactMutes).values({
        id: 'mute-past',
        userId: 'user-test-1',
        targetUserId: 'user-test-2',
        muteType: 'temporary',
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000, // expired 1h ago
      }).run();

      expect(isUserWinkMuted('user-test-1', 'user-test-2')).toBe(false);
    });
  });

  describe('Favorite Winks', () => {
    it('adds, lists, and removes favorites', async () => {
      // 1. Initial: empty
      const list1 = await app.inject({ method: 'GET', url: '/api/winks/favorites' });
      expect(list1.statusCode).toBe(200);
      expect(list1.json()).toEqual([]);

      // 2. Add 'diabravinho' to favorites
      const add1 = await app.inject({
        method: 'PUT',
        url: '/api/winks/favorites/diabravinho',
      });
      expect(add1.statusCode).toBe(200);
      expect(add1.json().favorites).toContain('diabravinho');

      // 3. Add 'bolsogado' to favorites
      const add2 = await app.inject({
        method: 'PUT',
        url: '/api/winks/favorites/bolsogado',
      });
      expect(add2.statusCode).toBe(200);
      expect(add2.json().favorites).toEqual(expect.arrayContaining(['diabravinho', 'bolsogado']));

      // 4. Remove 'diabravinho'
      const rem = await app.inject({
        method: 'DELETE',
        url: '/api/winks/favorites/diabravinho',
      });
      expect(rem.statusCode).toBe(200);
      expect(rem.json().favorites).toEqual(['bolsogado']);
    });
  });

  describe('Recent Winks', () => {
    it('records recents, orders newest first, and caps at 20 unique items', async () => {
      // Send 3 recents
      await app.inject({ method: 'POST', url: '/api/winks/recents', payload: { winkId: 'diabravinho' } });
      await app.inject({ method: 'POST', url: '/api/winks/recents', payload: { winkId: 'bolsogado' } });
      await app.inject({ method: 'POST', url: '/api/winks/recents', payload: { winkId: 'nikole' } });

      let recentsRes = await app.inject({ method: 'GET', url: '/api/winks/recents' });
      expect(recentsRes.statusCode).toBe(200);
      expect(recentsRes.json()).toEqual(['nikole', 'bolsogado', 'diabravinho']);

      // Re-use 'diabravinho' — should move to front!
      await app.inject({ method: 'POST', url: '/api/winks/recents', payload: { winkId: 'diabravinho' } });
      recentsRes = await app.inject({ method: 'GET', url: '/api/winks/recents' });
      expect(recentsRes.json()).toEqual(['diabravinho', 'nikole', 'bolsogado']);

      // Cap at 20 test
      for (let i = 1; i <= 25; i++) {
        recordWinkRecent('user-test-1', `wink-extra-${i}`);
      }

      recentsRes = await app.inject({ method: 'GET', url: '/api/winks/recents' });
      const list = recentsRes.json();
      expect(list.length).toBe(20);
      expect(list[0]).toBe('wink-extra-25');
    });
  });
});
