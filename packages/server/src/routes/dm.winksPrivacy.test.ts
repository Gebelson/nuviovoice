import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentUserId = 'user-sender';

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (req: { userId?: string }) => {
    req.userId = currentUserId;
  },
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
    sendToDmMembers: vi.fn(),
    sendToAdmins: vi.fn(),
    getAllOnlineUserIds: () => [],
    getRoom: () => undefined,
    getUserRoom: () => undefined,
    leaveCurrentRoom: vi.fn(() => false),
    destroyRoom: vi.fn(),
    clearVoiceUserStatus: vi.fn(),
  },
}));

vi.mock('../utils/federationOutbox.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/federationOutbox.js')>('../utils/federationOutbox.js');
  return {
    ...actual,
    isFederationRelayEnabled: () => false,
    queueDmCloseRelay: vi.fn(),
    sendTypingRelay: vi.fn(),
    queueDmRelay: vi.fn(),
    queueGroupMetadataRelay: vi.fn(),
  };
});

function applyMigrations(db: Database.Database): void {
  const dir = path.resolve(__dirname, '../../drizzle');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    for (const stmt of fs.readFileSync(path.join(dir, f), 'utf8').split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) db.exec(clean);
    }
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { dmRoutes } = await import('./dm.js');
  await app.register(dmRoutes);
  await app.ready();
  return app;
}

describe('Winks Privacy (receiveWinks in 1:1 and group DMs)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    testDb = drizzle(sqlite, { schema });
    app = await buildApp();
    currentUserId = 'user-sender';

    // Seed sender
    testDb.insert(schema.users).values({
      id: 'user-sender',
      username: 'sender',
      passwordHash: 'hash',
      receiveWinks: 1,
      createdAt: 1000,
    }).run();
  });

  it('allows sending Wink in 1:1 DM when recipient has receiveWinks = 1', async () => {
    // Recipient with receiveWinks = 1
    testDb.insert(schema.users).values({
      id: 'user-recipient-open',
      username: 'recipient_open',
      passwordHash: 'hash',
      receiveWinks: 1,
      createdAt: 1000,
    }).run();

    // 1:1 DM channel (ownerId = null)
    testDb.insert(schema.dmChannels).values({
      id: 'dm-1-open',
      ownerId: null,
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmMembers).values([
      { dmChannelId: 'dm-1-open', userId: 'user-sender' },
      { dmChannelId: 'dm-1-open', userId: 'user-recipient-open' },
    ]).run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1-open/winks',
      payload: { winkId: 'diabravinho' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toBe('wink');
  });

  it('blocks sending Wink in 1:1 DM when recipient has receiveWinks = 0 (403 winks_disabled_by_recipient)', async () => {
    // Recipient with receiveWinks = 0
    testDb.insert(schema.users).values({
      id: 'user-recipient-closed',
      username: 'recipient_closed',
      passwordHash: 'hash',
      receiveWinks: 0,
      createdAt: 1000,
    }).run();

    // 1:1 DM channel (ownerId = null)
    testDb.insert(schema.dmChannels).values({
      id: 'dm-1-closed',
      ownerId: null,
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmMembers).values([
      { dmChannelId: 'dm-1-closed', userId: 'user-sender' },
      { dmChannelId: 'dm-1-closed', userId: 'user-recipient-closed' },
    ]).run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-1-closed/winks',
      payload: { winkId: 'diabravinho' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('winks_disabled_by_recipient');
    expect(body.error).toBe('Não foi possível enviar este Wink. O destinatário não está aceitando Winks.');

    // Verify no message was inserted into the database
    const msgCount = testDb.select().from(schema.dmMessages).where(eq(schema.dmMessages.dmChannelId, 'dm-1-closed')).all();
    expect(msgCount.length).toBe(0);
  });

  it('blocks disguised Wink sent via POST /api/dm/:id/messages when recipient has receiveWinks = 0', async () => {
    testDb.insert(schema.users).values({
      id: 'user-recipient-closed-2',
      username: 'recipient_closed_2',
      passwordHash: 'hash',
      receiveWinks: 0,
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmChannels).values({
      id: 'dm-disguised',
      ownerId: null,
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmMembers).values([
      { dmChannelId: 'dm-disguised', userId: 'user-sender' },
      { dmChannelId: 'dm-disguised', userId: 'user-recipient-closed-2' },
    ]).run();

    // Send disguised wink via /api/dm/:id/messages
    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-disguised/messages',
      payload: { content: '[wink:bolsogado]' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('winks_disabled_by_recipient');
    expect(body.error).toBe('Não foi possível enviar este Wink. O destinatário não está aceitando Winks.');
  });

  it('blocks Wink in group DM when any member has receiveWinks = 0 (403 winks_disabled_in_group)', async () => {
    // 2 members: one open, one closed
    testDb.insert(schema.users).values([
      { id: 'user-g1', username: 'g1', passwordHash: 'hash', receiveWinks: 1, createdAt: 1000 },
      { id: 'user-g2', username: 'g2', passwordHash: 'hash', receiveWinks: 0, createdAt: 1000 },
    ]).run();

    // Group DM (ownerId = user-sender)
    testDb.insert(schema.dmChannels).values({
      id: 'dm-group-1',
      ownerId: 'user-sender',
      name: 'Group 1',
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmMembers).values([
      { dmChannelId: 'dm-group-1', userId: 'user-sender' },
      { dmChannelId: 'dm-group-1', userId: 'user-g1' },
      { dmChannelId: 'dm-group-1', userId: 'user-g2' },
    ]).run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-group-1/winks',
      payload: { winkId: 'nikole' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('winks_disabled_in_group');
    expect(body.error).toBe('Não foi possível enviar o Wink nesta conversa.');

    // Verify no message was created
    const msgs = testDb.select().from(schema.dmMessages).where(eq(schema.dmMessages.dmChannelId, 'dm-group-1')).all();
    expect(msgs.length).toBe(0);
  });

  it('allows Wink in group DM when all recipients have receiveWinks = 1', async () => {
    testDb.insert(schema.users).values([
      { id: 'user-g3', username: 'g3', passwordHash: 'hash', receiveWinks: 1, createdAt: 1000 },
      { id: 'user-g4', username: 'g4', passwordHash: 'hash', receiveWinks: 1, createdAt: 1000 },
    ]).run();

    testDb.insert(schema.dmChannels).values({
      id: 'dm-group-all-open',
      ownerId: 'user-sender',
      name: 'Group All Open',
      createdAt: 1000,
    }).run();

    testDb.insert(schema.dmMembers).values([
      { dmChannelId: 'dm-group-all-open', userId: 'user-sender' },
      { dmChannelId: 'dm-group-all-open', userId: 'user-g3' },
      { dmChannelId: 'dm-group-all-open', userId: 'user-g4' },
    ]).run();

    const res = await app.inject({
      method: 'POST',
      url: '/api/dm/dm-group-all-open/winks',
      payload: { winkId: 'nikole' },
    });

    expect(res.statusCode).toBe(201);
  });
});
