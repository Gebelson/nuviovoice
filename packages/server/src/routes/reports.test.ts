import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { reportRoutes } from './reports.js';

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
    if (!request.headers.authorization) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    request.userId = request.headers.authorization;
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

describe('Safety Reports API', () => {
  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(reportRoutes);

    // Seed test users
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      'user_reporter', 'reporter', 'hash', Date.now()
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      'user_target', 'badguy', 'hash', Date.now()
    );
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      'user_stranger', 'stranger', 'hash', Date.now()
    );

    // Seed a space, channel and message
    sqlite.prepare('INSERT INTO spaces (id, name, owner_id, created_at, type) VALUES (?, ?, ?, ?, ?)').run(
      'space_1', 'Test Space', 'user_target', Date.now(), 'private'
    );
    sqlite.prepare('INSERT INTO space_members (space_id, user_id, joined_at) VALUES (?, ?, ?)').run(
      'space_1', 'user_reporter', Date.now()
    );
    sqlite.prepare('INSERT INTO channels (id, space_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'chan_1', 'space_1', 'general', 'text', Date.now()
    );
    sqlite.prepare('INSERT INTO messages (id, channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'msg_1', 'chan_1', 'user_target', 'Offensive content here', 1000
    );
    sqlite.prepare('INSERT INTO messages (id, channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'msg_ctx1', 'chan_1', 'user_target', 'Preceding context message 1', 900
    );

    // Seed a private DM conversation between user_target and user_stranger (user_reporter is NOT a participant)
    sqlite.prepare('INSERT INTO dm_channels (id, created_at) VALUES (?, ?)').run('dm_private', Date.now());
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run('dm_private', 'user_target');
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run('dm_private', 'user_stranger');
    sqlite.prepare('INSERT INTO dm_messages (id, dm_channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'dm_msg_secret', 'dm_private', 'user_target', 'Secret DM', 1200
    );

    // Seed a DM conversation between user_reporter and user_target
    sqlite.prepare('INSERT INTO dm_channels (id, created_at) VALUES (?, ?)').run('dm_shared', Date.now());
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run('dm_shared', 'user_reporter');
    sqlite.prepare('INSERT INTO dm_members (dm_channel_id, user_id) VALUES (?, ?)').run('dm_shared', 'user_target');
    sqlite.prepare('INSERT INTO dm_messages (id, dm_channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'dm_msg_1', 'dm_shared', 'user_target', 'Threatening DM', 1500
    );
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  it('creates report for space message with SHA-256 evidence snapshot and protocol', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/message',
      headers: { authorization: 'user_reporter' },
      payload: {
        messageId: 'msg_1',
        category: 'harassment',
        description: 'Target is harassing members',
        includeContext: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.protocol).toMatch(/^REP-\d{8}-[0-9A-F]{8}$/);
    expect(body.priority).toBe('high');
    expect(body.status).toBe('pending');
    expect(body.evidenceCount).toBe(2);

    // Verify stored report
    const report = sqlite.prepare('SELECT * FROM safety_reports WHERE id = ?').get(body.reportId) as any;
    expect(report).toBeDefined();
    expect(report.reporter_id).toBe('user_reporter');
    expect(report.category).toBe('harassment');
    expect(report.priority).toBe('high');

    // Verify stored evidence with sha256 hash
    const evidences = sqlite.prepare('SELECT * FROM safety_report_evidences WHERE report_id = ?').all(body.reportId) as any[];
    expect(evidences.length).toBe(2);
    expect(evidences[0].sha256_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sets priority to urgent automatically for csam_exploitation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/message',
      headers: { authorization: 'user_reporter' },
      payload: {
        messageId: 'msg_1',
        category: 'csam_exploitation',
        description: 'Emergency report',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.priority).toBe('urgent');
  });

  it('refuses reporting space message if reporter is not a member of private space', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/message',
      headers: { authorization: 'user_stranger' },
      payload: {
        messageId: 'msg_1',
        category: 'threat',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('allows reporting DM message when user is a participant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/message',
      headers: { authorization: 'user_reporter' },
      payload: {
        messageId: 'dm_msg_1',
        category: 'threat',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.priority).toBe('urgent');
  });

  it('strictly forbids reporting DM messages from conversations user is not in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/message',
      headers: { authorization: 'user_reporter' },
      payload: {
        messageId: 'dm_msg_secret',
        category: 'threat',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('reports a space directly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/space',
      headers: { authorization: 'user_reporter' },
      payload: {
        spaceId: 'space_1',
        category: 'fraud',
        description: 'Illegal space activities',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.protocol).toMatch(/^REP-\d{8}-[0-9A-F]{8}$/);
    expect(body.priority).toBe('high');
  });

  it('returns submitted reports for the authenticated user', async () => {
    // First create a report
    await app.inject({
      method: 'POST',
      url: '/api/reports/space',
      headers: { authorization: 'user_reporter' },
      payload: {
        spaceId: 'space_1',
        category: 'fraud',
        description: 'Test report',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/my',
      headers: { authorization: 'user_reporter' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reports.length).toBe(1);
    expect(body.reports[0].category).toBe('fraud');
  });
});
