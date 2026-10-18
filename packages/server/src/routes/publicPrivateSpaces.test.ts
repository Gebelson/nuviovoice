import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { setPublicSpaceEligibilityChecker } from '../services/publicSpaceEligibility.js';
import { migrateExistingSpacesSeparation } from '../db/migrate.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentCallerId = 'user-1';

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
  },
}));

vi.mock('../services/directory.js', () => ({
  invalidatePublicSpacesDocument: vi.fn(),
  notifyDirectoryChanged: vi.fn(),
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

function seedUser(id: string, username: string): void {
  testDb
    .insert(schema.users)
    .values({
      id,
      username,
      passwordHash: 'x',
      status: 'offline',
      isAdmin: 0,
      createdAt: Date.now(),
    })
    .run();
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { spaceRoutes } = await import('./spaces.js');
  const { exploreRoutes } = await import('./explore.js');
  await app.register(spaceRoutes);
  await app.register(exploreRoutes);
  await app.ready();
  return app;
}

describe('Private vs Public Spaces Separation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    testDb = drizzle(sqlite, { schema });
    sqlite.exec(`INSERT OR REPLACE INTO instance_settings (id, discovery_enabled, updated_at) VALUES (1, 1, 1000)`);
    currentCallerId = 'user-1';
    seedUser('user-1', 'alice');
    seedUser('user-2', 'bob');
    setPublicSpaceEligibilityChecker(null);
    app = await buildApp();
  });

  afterEach(async () => {
    setPublicSpaceEligibilityChecker(null);
    await app.close();
    sqlite.close();
  });

  it('creates a private space via POST /api/spaces and never lists it in Explore', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { name: 'Friends Hangout', description: 'Private group' },
    });
    expect(res.statusCode).toBe(201);
    const space = res.json();
    expect(space.type).toBe('private');
    expect(space.visibility).toBe('private');
    expect(space.directoryListed).toBe(false);

    // Must not appear in Explore
    const exploreRes = await app.inject({
      method: 'GET',
      url: '/api/spaces/explore',
    });
    expect(exploreRes.statusCode).toBe(200);
    expect(exploreRes.json().spaces).toHaveLength(0);
  });

  it('rejects attempts to create a public space via the private endpoint', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { name: 'Fake Public', visibility: 'public' },
    });
    expect(res1.statusCode).toBe(400);
    expect(res1.json().code).toBe('space_visibility_invalid');

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/spaces/private',
      payload: { name: 'Fake Public 2', type: 'public' },
    });
    expect(res2.statusCode).toBe(400);
    expect(res2.json().code).toBe('space_visibility_invalid');
  });

  it('creates a published public space via POST /api/spaces/public and lists it in Explore', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/spaces/public',
      payload: {
        name: 'Nuvio Gamers',
        slug: 'nuvio-gamers',
        description: 'Official gaming community on Nuvio',
        fullDescription: 'Welcome to the largest gaming hub on Nuvio!',
        category: 'gaming',
        tags: ['fps', 'rpg', 'coop'],
        rules: '1. Be kind\n2. No spam',
        visibility: 'public',
        initialPermissions: 'standard',
      },
    });
    expect(res.statusCode).toBe(201);
    const space = res.json();
    expect(space.type).toBe('public');
    expect(space.publicationStatus).toBe('published');
    expect(space.slug).toBe('nuvio-gamers');
    expect(space.category).toBe('gaming');
    expect(space.tags).toEqual(['fps', 'rpg', 'coop']);
    expect(space.publishedAt).toBeTypeOf('number');

    // Check slug availability endpoint
    const slugCheck = await app.inject({
      method: 'GET',
      url: '/api/spaces/public/check-slug?slug=nuvio-gamers',
    });
    expect(slugCheck.statusCode).toBe(200);
    expect(slugCheck.json().available).toBe(false);

    // Appears in Explore and supports category filter
    const exploreGaming = await app.inject({
      method: 'GET',
      url: '/api/spaces/explore?category=gaming&sort=popular',
    });
    expect(exploreGaming.statusCode).toBe(200);
    expect(exploreGaming.json().spaces).toHaveLength(1);
    expect(exploreGaming.json().spaces[0].slug).toBe('nuvio-gamers');

    const exploreMusic = await app.inject({
      method: 'GET',
      url: '/api/spaces/explore?category=music',
    });
    expect(exploreMusic.statusCode).toBe(200);
    expect(exploreMusic.json().spaces).toHaveLength(0);
  });

  it('enforces canCreatePublicSpace(userId) monetization eligibility architecture', async () => {
    setPublicSpaceEligibilityChecker(async () => ({
      allowed: false,
      requiresPayment: true,
      reason: 'Subscription required to publish public spaces.',
    }));

    const eligRes = await app.inject({
      method: 'GET',
      url: '/api/spaces/public/eligibility',
    });
    expect(eligRes.statusCode).toBe(200);
    expect(eligRes.json().allowed).toBe(false);
    expect(eligRes.json().requiresPayment).toBe(true);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spaces/public',
      payload: {
        name: 'Blocked Public Space',
        slug: 'blocked-public-space',
        description: 'Should fail eligibility check',
        category: 'community',
      },
    });
    expect(createRes.statusCode).toBe(403);
    expect(createRes.json().code).toBe('forbidden');
  });

  it('prevents converting a private space to public via PATCH /api/spaces/:id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spaces/private',
      payload: { name: 'Secret Club' },
    });
    const spaceId = createRes.json().id;

    // Attempt to change type
    const patchType = await app.inject({
      method: 'PATCH',
      url: `/api/spaces/${spaceId}`,
      payload: { type: 'public' },
    });
    expect(patchType.statusCode).toBe(403);
    expect(patchType.json().code).toBe('forbidden');

    // Attempt to change visibility of private space to public
    const patchVis = await app.inject({
      method: 'PATCH',
      url: `/api/spaces/${spaceId}`,
      payload: { visibility: 'public' },
    });
    expect(patchVis.statusCode).toBe(400);
    expect(patchVis.json().code).toBe('space_visibility_invalid');
  });

  it('allows previewing a public space without joining it, and blocks previewing private spaces', async () => {
    const pubRes = await app.inject({
      method: 'POST',
      url: '/api/spaces/public',
      payload: {
        name: 'Open Art Lab',
        slug: 'open-art-lab',
        description: 'Digital art community',
        category: 'art_design',
      },
    });
    const pubId = pubRes.json().id;

    const privRes = await app.inject({
      method: 'POST',
      url: '/api/spaces/private',
      payload: { name: 'Private Studio' },
    });
    const privId = privRes.json().id;

    // Switch caller to user-2 (not a member of either space)
    currentCallerId = 'user-2';

    const previewPub = await app.inject({
      method: 'GET',
      url: `/api/spaces/${pubId}/public-preview`,
    });
    expect(previewPub.statusCode).toBe(200);
    expect(previewPub.json().name).toBe('Open Art Lab');
    expect(previewPub.json().joined).toBe(false);

    // Ensure user-2 was NOT added as a member just by previewing
    const members = testDb
      .select()
      .from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.spaceId, pubId))
      .all();
    expect(members.some((m) => m.userId === 'user-2')).toBe(false);

    // Private space preview must 403
    const previewPriv = await app.inject({
      method: 'GET',
      url: `/api/spaces/${privId}/public-preview`,
    });
    expect(previewPriv.statusCode).toBe(403);
  });

  it('migrates legacy spaces and backfills type, publicationStatus, and unique slugs', () => {
    sqlite.exec(`
      INSERT INTO spaces (id, name, owner_id, invite_code, visibility, created_at)
      VALUES
        ('leg-priv', 'Legacy Private', 'user-1', 'inv-1', 'private', 1000),
        ('leg-pub-1', 'Legacy Public', 'user-1', 'inv-2', 'public', 2000),
        ('leg-pub-2', 'Legacy Public', 'user-1', 'inv-3', 'request', 3000);
    `);

    migrateExistingSpacesSeparation(sqlite);

    const rows = sqlite
      .prepare('SELECT id, type, slug, publication_status FROM spaces ORDER BY created_at ASC')
      .all() as { id: string; type: string; slug: string | null; publication_status: string }[];

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      id: 'leg-priv',
      type: 'private',
      slug: null,
      publication_status: 'draft',
    });
    expect(rows[1]!.type).toBe('public');
    expect(rows[1]!.publication_status).toBe('published');
    expect(rows[1]!.slug).toBe('legacy-public-egpub1');

    expect(rows[2]!.type).toBe('public');
    expect(rows[2]!.publication_status).toBe('published');
    expect(rows[2]!.slug).toBe('legacy-public-egpub2');
  });
});
