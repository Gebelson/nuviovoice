import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { verificationRoutes } from './verifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
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

describe('Verifications API', () => {
  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(verificationRoutes);
    await app.ready();

    // Seed test users: alice, bob, adminUser, remoteUser
    const now = Date.now();
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'alice', 'alice', 'hash', 0, now
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'bob', 'bob', 'hash', 0, now
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'adminUser', 'admin', 'hash', 1, now
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, home_instance, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'remoteUser', 'remote', 'hash', 0, 'orbit.remote', now
    );

    // Seed spaces: publicSpace, privateSpace
    sqlite.prepare('INSERT INTO spaces (id, name, type, visibility, publication_status, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'space-public', 'Comunidade Aberta', 'public', 'public', 'published', 'alice', now
    );
    sqlite.prepare('INSERT INTO spaces (id, name, type, visibility, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'space-private', 'Grupo Secreto', 'private', 'private', 'alice', now
    );
  });

  afterEach(async () => {
    if (app) await app.close();
    if (sqlite) sqlite.close();
  });

  it('GET /api/verifications/me returns default none status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/verifications/me',
      headers: { authorization: 'alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verificationStatus).toBe('none');
    expect(body.verification).toBeNull();
    expect(body.activeRequest).toBeNull();
  });

  it('POST /api/verifications/requests rejects invalid category or unauthenticated user', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/verifications/requests',
      payload: { category: 'creator', publicName: 'Alice Creator' },
    });
    expect(unauth.statusCode).toBe(401);

    const badCat = await app.inject({
      method: 'POST',
      url: '/api/verifications/requests',
      headers: { authorization: 'alice' },
      payload: { category: 'official', publicName: 'Fake Official' },
    });
    expect(badCat.statusCode).toBe(400);
  });

  it('POST /api/verifications/requests creates pending request and prevents duplicates', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/verifications/requests',
      headers: { authorization: 'alice' },
      payload: {
        category: 'creator',
        publicName: 'Alice Ilustradora',
        activityDescription: 'Criadora de arte digital',
        officialWebsite: 'https://alice.art',
        domainToVerify: 'alice.art',
      },
    });

    expect(res1.statusCode).toBe(201);
    const body1 = res1.json();
    expect(body1.status).toBe('pending');
    expect(body1.publicName).toBe('Alice Ilustradora');
    expect(body1.domainToken).toMatch(/^nuvio-verify-/);

    // Duplicate request while pending should conflict
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/verifications/requests',
      headers: { authorization: 'alice' },
      payload: {
        category: 'creator',
        publicName: 'Alice Ilustradora 2',
      },
    });

    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toBe('request_already_pending');
  });

  it('POST /api/verifications/spaces/:spaceId/requests validates owner and public status', async () => {
    // Non-owner bob cannot request for alice's space
    const resForbidden = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-public/requests',
      headers: { authorization: 'bob' },
      payload: { publicName: 'Comunidade' },
    });
    expect(resForbidden.statusCode).toBe(403);

    // Private space cannot request public verification
    const resPrivate = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-private/requests',
      headers: { authorization: 'alice' },
      payload: { publicName: 'Grupo' },
    });
    expect(resPrivate.statusCode).toBe(400);

    // Public space by owner succeeds
    const resOk = await app.inject({
      method: 'POST',
      url: '/api/verifications/spaces/space-public/requests',
      headers: { authorization: 'alice' },
      payload: { publicName: 'Comunidade Oficial de Nuvio Designers' },
    });
    expect(resOk.statusCode).toBe(201);
  });

  describe('Admin Verification Workflow', () => {
    let requestId: string;

    beforeEach(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/verifications/requests',
        headers: { authorization: 'bob' },
        payload: {
          category: 'organization',
          publicName: 'Studio Bob Games',
          officialWebsite: 'https://bobgames.com',
        },
      });
      requestId = res.json().id;
    });

    it('blocks regular users from admin endpoints', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/verifications/metrics',
        headers: { authorization: 'alice' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('admin can request info, reject, or approve with audit logging', async () => {
      // 1. Check metrics
      const metricsRes = await app.inject({
        method: 'GET',
        url: '/api/admin/verifications/metrics',
        headers: { authorization: 'adminUser' },
      });
      expect(metricsRes.statusCode).toBe(200);
      expect(metricsRes.json().pendingRequests).toBe(1);

      // 2. Request info
      const infoRes = await app.inject({
        method: 'POST',
        url: `/api/admin/verifications/requests/${requestId}/request-info`,
        headers: { authorization: 'adminUser' },
        payload: { notes: 'Por favor, comprove o vínculo com o domínio corporativo.' },
      });
      expect(infoRes.statusCode).toBe(200);
      expect(infoRes.json().status).toBe('info_requested');

      // 3. Approve
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/admin/verifications/requests/${requestId}/approve`,
        headers: { authorization: 'adminUser' },
        payload: { justification: 'Documentação e domínio validados com sucesso' },
      });
      expect(approveRes.statusCode).toBe(200);
      expect(approveRes.json().verified).toBe(true);

      // 4. Verify user has verified status and category organization
      const bobRes = await app.inject({
        method: 'GET',
        url: '/api/verifications/me',
        headers: { authorization: 'bob' },
      });
      expect(bobRes.json().verificationStatus).toBe('verified');
      expect(bobRes.json().verification.category).toBe('organization');

      // 5. Admin can revoke
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/entities/user/bob/revoke',
        headers: { authorization: 'adminUser' },
        payload: { justification: 'Encerramento das atividades da organização' },
      });
      expect(revokeRes.statusCode).toBe(200);

      const bobRevoked = await app.inject({
        method: 'GET',
        url: '/api/verifications/me',
        headers: { authorization: 'bob' },
      });
      expect(bobRevoked.json().verificationStatus).toBe('revoked');
    });

    it('admin can grant official team badge only to local users with audit', async () => {
      // Federated user cannot receive official badge
      const fedRes = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/official/grant',
        headers: { authorization: 'adminUser' },
        payload: { userId: 'remoteUser', justification: 'Tentativa indevida' },
      });
      expect(fedRes.statusCode).toBe(400);
      expect(fedRes.json().error).toBe('federated_user_unsupported');

      // Local user receives official badge
      const grantRes = await app.inject({
        method: 'POST',
        url: '/api/admin/verifications/official/grant',
        headers: { authorization: 'adminUser' },
        payload: { userId: 'alice', justification: 'Conta oficial confirmada da liderança de engenharia' },
      });
      expect(grantRes.statusCode).toBe(200);
      expect(grantRes.json().user.verification.category).toBe('official');

      // Check audit log
      const auditRes = await app.inject({
        method: 'GET',
        url: '/api/admin/verifications/audit',
        headers: { authorization: 'adminUser' },
      });
      expect(auditRes.statusCode).toBe(200);
      const logs = auditRes.json().items;
      expect(logs.some((l: any) => l.action === 'official_granted' && l.targetId === 'alice')).toBe(true);
    });
  });
});
