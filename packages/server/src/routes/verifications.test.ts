import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { verificationRoutes } from './verifications.js';
import { exploreRoutes } from './explore.js';
import { grantOfficialTeamBadge } from '../scripts/grant-official-team.js';
import { setWorkerId } from '../utils/snowflake.js';

try { setWorkerId(1); } catch { /* ignore if already set */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
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
  requireAdmin: async (
    request: { userId?: string },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    if (request.userId !== 'adminUser') {
      return reply.code(403).send({ error: 'Forbidden: Admin access required', statusCode: 403 });
    }
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
}

describe('Verifications and Verification Badges API', () => {
  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(verificationRoutes);
    await app.register(exploreRoutes);
    await app.ready();

    const now = Date.now();

    // Instance settings for Explore discovery
    sqlite.prepare('INSERT OR REPLACE INTO instance_settings (id, discovery_enabled, updated_at) VALUES (1, 1, ?)').run(now);

    // Seed test users: alice, bob, gebelson, adminUser, remoteUser
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'alice', 'alice', 'Alice Developer', 'hash', 0, now
    );
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'bob', 'bob', 'Bob Creator', 'hash', 0, now
    );
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'gebelson', 'gebelson', 'Gebelson Admin', 'hash', 1, now
    );
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'adminUser', 'admin', 'System Admin', 'hash', 1, now
    );
    sqlite.prepare('INSERT INTO users (id, username, display_name, password_hash, is_admin, home_instance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'remoteUser', 'remote', 'Remote User', 'hash', 0, 'orbit.remote', now
    );

    // Seed spaces: publicSpace, unverifiedPublicSpace, privateSpace
    sqlite.prepare(`
      INSERT INTO spaces (id, name, type, visibility, publication_status, owner_id, verification_status, verification_category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('space-verified', 'Comunidade Verificada', 'public', 'public', 'published', 'alice', 'verified', 'organization', now);

    sqlite.prepare(`
      INSERT INTO spaces (id, name, type, visibility, publication_status, owner_id, verification_status, verification_category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('space-unverified', 'Comunidade Normal', 'public', 'public', 'published', 'bob', 'none', null, now);

    sqlite.prepare(`
      INSERT INTO spaces (id, name, type, visibility, publication_status, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('space-private', 'Grupo Secreto', 'private', 'private', 'draft', 'alice', now);
  });

  afterEach(async () => {
    if (app) await app.close();
    if (sqlite) sqlite.close();
  });

  it('GET /api/verifications/me returns default status and verificationStatus', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/verifications/me',
      headers: { authorization: 'alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('none');
    expect(body.verificationStatus).toBe('none');
    expect(body.verification).toBeNull();
    expect(body.activeRequest).toBeNull();
  });

  it('POST /api/verifications/requests accepts frontend schema (description, website, domainName, socialLinks)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/verifications/requests',
      headers: { authorization: 'alice' },
      payload: {
        category: 'creator',
        publicName: 'Alice Ilustradora',
        description: 'Criadora de arte digital e quadrinhos autorais',
        website: 'https://alice.art',
        domainName: 'alice.art',
        socialLinks: [{ platform: 'twitter', url: 'https://twitter.com/alice' }],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.id).toBe(body.requestId);
    expect(body.status).toBe('pending');
    expect(body.domainToken).toMatch(/^nuvio-verify-/);

    // GET /api/verifications/me should now return pending request with mapped aliases
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/verifications/me',
      headers: { authorization: 'alice' },
    });
    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json();
    expect(meBody.status).toBe('pending');
    expect(meBody.verificationStatus).toBe('pending');
    expect(meBody.activeRequest).toBeDefined();
    expect(meBody.activeRequest.description).toBe('Criadora de arte digital e quadrinhos autorais');
    expect(meBody.activeRequest.website).toBe('https://alice.art');
    expect(meBody.activeRequest.domainName).toBe('alice.art');
  });

  it('POST /api/verifications/spaces/:spaceId/requests accepts frontend schema and validates ownership', async () => {
    // Non-owner bob cannot request for alice's verified space
    const resForbidden = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-verified/requests',
      headers: { authorization: 'bob' },
      payload: {
        category: 'space',
        publicName: 'Comunidade Hacker',
        description: 'Tentativa indevida de solicitação',
      },
    });
    expect(resForbidden.statusCode).toBe(403);

    // Private space cannot request public verification
    const resPrivate = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-private/requests',
      headers: { authorization: 'alice' },
      payload: {
        category: 'space',
        publicName: 'Grupo Secreto',
        description: 'Tentativa em espaço privado',
      },
    });
    expect(resPrivate.statusCode).toBe(400);

    // Bob can request for his public unverified space using frontend aliases
    const resOk = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-unverified/requests',
      headers: { authorization: 'bob' },
      payload: {
        category: 'space',
        publicName: 'Comunidade Oficial de Criadores',
        description: 'Comunidade oficial reunindo criadores e desenvolvedores',
        website: 'https://creators.hub',
        domainName: 'creators.hub',
      },
    });
    expect(resOk.statusCode).toBe(201);
    const body = resOk.json();
    expect(body.success).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.status).toBe('pending');
  });

  describe('Admin Approval, Rejection, Revocation, and Official Grant', () => {
    let requestId: string;

    beforeEach(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/verifications/requests',
        headers: { authorization: 'bob' },
        payload: {
          category: 'organization',
          publicName: 'Studio Bob Games',
          description: 'Estúdio independente de jogos',
          website: 'https://bobgames.com',
          domainName: 'bobgames.com',
        },
      });
      requestId = res.json().requestId;
    });

    it('approves request using frontend notes alias and sets user verification status and category', async () => {
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/admin/verifications/requests/${requestId}/approve`,
        headers: { authorization: 'adminUser' },
        payload: { notes: 'Aprovado após conferência documental.' },
      });

      expect(approveRes.statusCode).toBe(200);
      const approveBody = approveRes.json();
      expect(approveBody.success).toBe(true);
      expect(approveBody.verified).toBe(true);
      expect(approveBody.status).toBe('approved');
      expect(approveBody.verificationId).toBeDefined();

      // Check bob's status
      const bobRes = await app.inject({
        method: 'GET',
        url: '/api/verifications/me',
        headers: { authorization: 'bob' },
      });
      expect(bobRes.statusCode).toBe(200);
      const bobBody = bobRes.json();
      expect(bobBody.status).toBe('verified');
      expect(bobBody.verificationStatus).toBe('verified');
      expect(bobBody.verification.category).toBe('organization');

      // Admin revokes using reason alias
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/entities/user/bob/revoke',
        headers: { authorization: 'adminUser' },
        payload: { reason: 'Organização encerrou atividades operacionais.' },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().revoked).toBe(true);

      const bobRevoked = await app.inject({
        method: 'GET',
        url: '/api/verifications/me',
        headers: { authorization: 'bob' },
      });
      expect(bobRevoked.json().status).toBe('revoked');
    });

    it('grants official team badge by targetUserId and targetUsername with audit logging', async () => {
      // 1. Grant to alice using targetUserId and notes
      const grantRes1 = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/official/grant',
        headers: { authorization: 'adminUser' },
        payload: {
          targetUserId: 'alice',
          notes: 'Membro oficial do time de desenvolvimento Nuvio.',
        },
      });

      expect(grantRes1.statusCode).toBe(200);
      const grantBody1 = grantRes1.json();
      expect(grantBody1.success).toBe(true);
      expect(grantBody1.verified).toBe(true);
      expect(grantBody1.user.verification.category).toBe('official');

      // 2. Grant to gebelson using targetUsername and justification
      const grantRes2 = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/official/grant',
        headers: { authorization: 'adminUser' },
        payload: {
          targetUsername: '@gebelson',
          justification: 'Conta oficial do mantenedor e fundador Gebelson.',
        },
      });

      expect(grantRes2.statusCode).toBe(200);
      const grantBody2 = grantRes2.json();
      expect(grantBody2.success).toBe(true);
      expect(grantBody2.user.username).toBe('gebelson');
      expect(grantBody2.user.verification.category).toBe('official');

      // 3. Confirm audit log
      const auditRes = await app.inject({
        method: 'GET',
        url: '/api/admin/verifications/audit',
        headers: { authorization: 'adminUser' },
      });
      expect(auditRes.statusCode).toBe(200);
      const logs = auditRes.json().logs || auditRes.json().items;
      expect(logs.some((l: any) => l.action === 'official_granted' && l.targetId === 'gebelson')).toBe(true);
      expect(logs.some((l: any) => l.action === 'official_granted' && l.targetId === 'alice')).toBe(true);
    });
  });

  describe('Explore Verified Filter and Public Preview', () => {
    it('GET /api/spaces/explore?verifiedOnly=true filters out unverified spaces', async () => {
      // Unfiltered request returns both verified and unverified
      const allRes = await app.inject({
        method: 'GET',
        url: '/api/spaces/explore',
        headers: { authorization: 'alice' },
      });
      expect(allRes.statusCode).toBe(200);
      const allSpaces = allRes.json().spaces;
      expect(allSpaces.some((s: any) => s.id === 'space-verified')).toBe(true);
      expect(allSpaces.some((s: any) => s.id === 'space-unverified')).toBe(true);

      // Filtered request returns ONLY verified space
      const verifiedRes = await app.inject({
        method: 'GET',
        url: '/api/spaces/explore?verifiedOnly=true',
        headers: { authorization: 'alice' },
      });
      expect(verifiedRes.statusCode).toBe(200);
      const verifiedSpaces = verifiedRes.json().spaces;
      expect(verifiedSpaces.length).toBe(1);
      expect(verifiedSpaces[0].id).toBe('space-verified');
      expect(verifiedSpaces[0].verification).toEqual({
        status: 'verified',
        category: 'organization',
        verifiedAt: expect.any(Number),
      });
    });

    it('GET /api/spaces/:id/public-preview returns verification details', async () => {
      const previewRes = await app.inject({
        method: 'GET',
        url: '/api/spaces/space-verified/public-preview',
        headers: { authorization: 'bob' },
      });
      expect(previewRes.statusCode).toBe(200);
      const preview = previewRes.json();
      expect(preview.id).toBe('space-verified');
      expect(preview.verification).toEqual({
        status: 'verified',
        category: 'organization',
        verifiedAt: expect.any(Number),
      });
    });
  });

  describe('grantOfficialTeamBadge CLI Script', () => {
    it('grants official badge, enforces local homing, and records audit', () => {
      const result = grantOfficialTeamBadge(db, {
        identifier: 'gebelson',
        confirmed: true,
        operatorJustification: 'Concessão oficial via CLI de infraestrutura.',
      });

      expect(result.success).toBe(true);
      expect(result.targetUser.username).toBe('gebelson');
      expect(result.targetUser.verificationStatus).toBe('verified');
      expect(result.targetUser.verificationCategory).toBe('official');

      // Verify DB row directly
      const userRow = sqlite.prepare("SELECT * FROM users WHERE username = 'gebelson'").get() as any;
      expect(userRow.verification_status).toBe('verified');
      expect(userRow.verification_category).toBe('official');

      const auditRow = sqlite.prepare("SELECT * FROM verification_audit_logs WHERE target_id = ?").get(userRow.id) as any;
      expect(auditRow).toBeDefined();
      expect(auditRow.action).toBe('official_granted');
      expect(auditRow.category).toBe('official');
      expect(auditRow.justification).toBe('Concessão oficial via CLI de infraestrutura.');
    });

    it('refuses to grant without confirmation', () => {
      expect(() => {
        grantOfficialTeamBadge(db, {
          identifier: 'gebelson',
          confirmed: false,
        });
      }).toThrow(/confirmação explícita obrigatória/i);
    });

    it('refuses to grant official badge to federated remote user', () => {
      expect(() => {
        grantOfficialTeamBadge(db, {
          identifier: 'remoteUser',
          confirmed: true,
        });
      }).toThrow(/A conta @remote .* é federada/i);
    });
  });
});
