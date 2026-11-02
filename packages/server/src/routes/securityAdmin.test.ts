import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { securityAdminRoutes } from './securityAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../utils/auth.js', () => ({
  authenticate: async (
    request: { userId?: string; username?: string; headers: Record<string, string> },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    if (!request.headers.authorization) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    request.userId = request.headers.authorization;
    request.username = request.headers.authorization;
  },
  requireAdmin: async (
    request: { userId?: string },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    const user = sqlite.prepare('SELECT is_admin FROM users WHERE id = ?').get(request.userId) as
      | { is_admin: number }
      | undefined;
    if (!user || user.is_admin !== 1) {
      return reply.code(403).send({ error: 'Only instance admins can perform this action', code: 'forbidden', statusCode: 403 });
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

describe('Security Center Admin API', () => {
  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(securityAdminRoutes);

    // Seed admin and non-admin users
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'admin_user', 'admin', 'hash', 1, Date.now()
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'regular_user', 'regular', 'hash', 0, Date.now()
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, is_admin, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'suspended_user', 'spammer', 'hash', 0, 1, Date.now()
    );
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  it('blocks non-admin users with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/security/overview',
      headers: { authorization: 'regular_user' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('calculates real overview metrics from database rows', async () => {
    // Seed 1 pending report and 1 active alert
    sqlite.prepare(`
      INSERT INTO safety_reports (id, protocol, reporter_id, target_type, target_id, category, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('rep_1', 'REP-20261101-001', 'regular_user', 'user', 'suspended_user', 'harassment', 'high', 'pending', Date.now(), Date.now());

    sqlite.prepare(`
      INSERT INTO security_alerts (id, alert_type, severity, technical_explanation, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('alert_1', 'friend_request_spike', 'medium', '25 friend requests sent in 3 minutes', 'active', Date.now());

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/security/overview',
      headers: { authorization: 'admin_user' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metrics.pendingReportsCount).toBe(1);
    expect(body.metrics.activeAlertsCount).toBe(1);
    expect(body.metrics.suspendedUsersCount).toBe(1);
  });

  it('requires justification when updating a report and records audit log', async () => {
    sqlite.prepare(`
      INSERT INTO safety_reports (id, protocol, reporter_id, target_type, target_id, category, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('rep_2', 'REP-20261101-002', 'regular_user', 'user', 'suspended_user', 'harassment', 'high', 'pending', Date.now(), Date.now());

    // Fails without justification
    const failRes = await app.inject({
      method: 'PATCH',
      url: '/api/admin/security/reports/rep_2',
      headers: { authorization: 'admin_user' },
      payload: { status: 'triaged' },
    });
    expect(failRes.statusCode).toBe(400);

    // Succeeds with justification
    const okRes = await app.inject({
      method: 'PATCH',
      url: '/api/admin/security/reports/rep_2',
      headers: { authorization: 'admin_user' },
      payload: { status: 'triaged', justification: 'Verificando contexto das mensagens' },
    });
    expect(okRes.statusCode).toBe(200);

    // Verify audit log entry
    const auditLogs = sqlite.prepare('SELECT * FROM security_audit_logs WHERE resource_id = ?').all('rep_2') as any[];
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].admin_id).toBe('admin_user');
    expect(auditLogs[0].justification).toBe('Verificando contexto das mensagens');
  });

  it('registers and lists authority requests (Marco Civil Art. 15)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/security/authorities',
      headers: { authorization: 'admin_user' },
      payload: {
        protocolNumber: 'OFICIO-PCSP-2026-9871',
        requestingBody: 'Polícia Civil de SP - Delegacia de Crimes Cibernéticos',
        authorityName: 'Delegado Dr. Silva',
        authorityContact: 'crimesciberneticos@policiacivil.sp.gov.br',
        requestType: 'preservation_order',
        legalBasis: 'Art. 15 da Lei 12.965/2014 (Marco Civil da Internet)',
        targetUserId: 'suspended_user',
        preservationDays: 180,
        notes: 'Inquérito policial nº 1234/2026',
        justification: 'Cumprimento de ordem formal de autoridade policial',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.protocolNumber).toBe('OFICIO-PCSP-2026-9871');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/security/authorities',
      headers: { authorization: 'admin_user' },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().requests.length).toBe(1);
  });

  it('deposits into evidence vault, verifies sha256, and protects extremely sensitive material', async () => {
    // 1. Deposit
    const depositRes = await app.inject({
      method: 'POST',
      url: '/api/admin/security/evidence',
      headers: { authorization: 'admin_user' },
      payload: {
        evidenceType: 'extracted_message_payload',
        source: 'manual_preservation',
        payload: 'CONFIDENTIAL EVIDENCE PAYLOAD FOR POLICE INQUIRY',
        metadata: JSON.stringify({ ip: '192.168.1.1', userAgent: 'NuvioDesktop/1.0' }),
        isExtremelySensitive: true,
        justification: 'Preservação de evidência para inquérito policial',
      },
    });

    expect(depositRes.statusCode).toBe(201);
    const { id, hashSha256 } = depositRes.json();
    expect(hashSha256).toMatch(/^[a-f0-9]{64}$/);

    // 2. Accessing requires justification
    const failRead = await app.inject({
      method: 'GET',
      url: `/api/admin/security/evidence/${id}`,
      headers: { authorization: 'admin_user' },
    });
    expect(failRead.statusCode).toBe(400);

    // 3. Accessing with justification returns safety notice instead of raw rendering for extremely sensitive
    const readRes = await app.inject({
      method: 'GET',
      url: `/api/admin/security/evidence/${id}?justification=Auditoria+legal+obrigatoria`,
      headers: { authorization: 'admin_user' },
    });
    expect(readRes.statusCode).toBe(200);
    const evidenceData = readRes.json().evidence;
    expect(evidenceData.isExtremelySensitive).toBe(true);
    expect(evidenceData.restrictedNotice).toBeDefined();
    expect(evidenceData.payloadEncrypted).toBeUndefined(); // Raw sensitive payload not served to UI
    expect(evidenceData.hashSha256).toBe(hashSha256);
  });

  it('suspends a user with justification and refuses suspending admins', async () => {
    // Attempting to suspend admin fails
    const adminSuspend = await app.inject({
      method: 'POST',
      url: '/api/admin/security/users/admin_user/suspend',
      headers: { authorization: 'admin_user' },
      payload: { justification: 'Teste de segurança' },
    });
    expect(adminSuspend.statusCode).toBe(400);

    // Suspending regular user succeeds
    const userSuspend = await app.inject({
      method: 'POST',
      url: '/api/admin/security/users/regular_user/suspend',
      headers: { authorization: 'admin_user' },
      payload: { justification: 'Violação grave dos termos de uso e atividade ilícita' },
    });
    expect(userSuspend.statusCode).toBe(200);

    const user = sqlite.prepare('SELECT is_deleted FROM users WHERE id = ?').get('regular_user') as any;
    expect(user.is_deleted).toBe(1);
  });
});
