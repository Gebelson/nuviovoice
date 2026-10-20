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
import { botsRoutes } from './bots.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentCallerId = 'user-owner';

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (req: { userId?: string }) => {
    req.userId = currentCallerId;
  },
  requireAdmin: async () => {},
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
    sendToSpace: vi.fn(),
    sendToChannel: vi.fn(),
    addUserSpace: vi.fn(),
    removeUserSpace: vi.fn(),
    getRoom: vi.fn().mockReturnValue(null),
  },
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

describe('Bot Library and Application Directory Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    testDb = drizzle(sqlite, { schema });

    const now = Date.now();

    // Seed test users
    testDb.insert(schema.users).values([
      {
        id: 'user-owner',
        username: 'alice',
        displayName: 'Alice Owner',
        passwordHash: 'hash',
        createdAt: now,
      },
      {
        id: 'user-member',
        username: 'bob',
        displayName: 'Bob Member',
        passwordHash: 'hash',
        createdAt: now,
      },
      {
        id: 'user-bot-sentinel',
        username: 'sentinel_bot',
        displayName: 'Nuvio Sentinel',
        passwordHash: 'bot_auth_managed',
        isBot: 1,
        createdAt: now,
      },
    ]).run();

    // Seed test space
    testDb.insert(schema.spaces).values({
      id: 'space-1',
      name: 'Comunidade Alpha',
      ownerId: 'user-owner',
      createdAt: now,
    }).run();

    // Seed channel
    testDb.insert(schema.channels).values({
      id: 'chan-1',
      spaceId: 'space-1',
      name: 'geral',
      type: 'text',
      createdAt: now,
    }).run();

    // Seed space memberships
    testDb.insert(schema.spaceMembers).values([
      { spaceId: 'space-1', userId: 'user-owner', joinedAt: now },
      { spaceId: 'space-1', userId: 'user-member', joinedAt: now },
    ]).run();

    // Seed bot categories
    testDb.insert(schema.botCategories).values([
      { id: 'bcat_mod', name: 'Moderação', slug: 'moderacao', description: 'Proteja seus espaços', icon: 'Shield', sortOrder: 1, createdAt: now },
      { id: 'bcat_util', name: 'Utilidades', slug: 'utilidades', description: 'Ferramentas úteis', icon: 'Wrench', sortOrder: 2, createdAt: now },
    ]).run();

    // Seed a published bot
    testDb.insert(schema.bots).values({
      id: 'bot-sentinel',
      slug: 'nuvio-sentinel',
      name: 'Nuvio Sentinel',
      tagline: 'Moderação e segurança completa',
      description: 'Bot oficial para moderação.',
      developerId: 'user-owner',
      botUserId: 'user-bot-sentinel',
      status: 'published',
      isVerified: 1,
      isOfficial: 1,
      prefix: '/',
      botToken: 'nbot_test_token_123',
      requiredPermissions: JSON.stringify(['MANAGE_MESSAGES']),
      tags: JSON.stringify(['moderação', 'segurança']),
      categories: JSON.stringify(['moderacao']),
      commands: JSON.stringify([
        { name: 'limpar', description: 'Limpa mensagens recentes do canal', usage: '/limpar <quantidade>' },
        { name: 'seguranca', description: 'Exibe o status de proteção do espaço' },
      ]),
      layoutData: JSON.stringify([]),
      installCount: 5,
      ratingAverage: 5.0,
      ratingCount: 1,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
    }).run();

    currentCallerId = 'user-owner';

    app = Fastify();
    await app.register(botsRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  it('GET /api/bots/categories returns category list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bots/categories',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories).toBeDefined();
    expect(body.categories.length).toBe(2);
    expect(body.categories[0].slug).toBe('moderacao');
  });

  it('GET /api/bots returns published catalog with search and filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bots?search=sentinel',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bots.length).toBe(1);
    expect(body.bots[0].slug).toBe('nuvio-sentinel');
    expect(body.bots[0].isVerified).toBe(true);
    // botToken should never leak in public catalog
    expect(body.bots[0].botToken).toBeUndefined();
  });

  it('GET /api/bots/:slugOrId returns detailed bot info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bots/nuvio-sentinel',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bot.name).toBe('Nuvio Sentinel');
    expect(body.bot.commands.length).toBe(2);
    expect(body.bot.commands[0].name).toBe('limpar');
  });

  it('POST /api/spaces/:spaceId/bots/:botId/install installs bot in space', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/spaces/space-1/bots/bot-sentinel/install',
      payload: {
        grantedPermissions: ['MANAGE_MESSAGES'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify bot appears in installed space list
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/spaces/space-1/bots',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.bots.length).toBe(1);
    expect(listBody.bots[0].bot.slug).toBe('nuvio-sentinel');

    // Verify bot was added to spaceMembers
    const botMember = testDb.select().from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.userId, 'user-bot-sentinel'))
      .get();
    expect(botMember).toBeDefined();
  });

  it('POST /api/channels/:channelId/commands/execute executes bot command', async () => {
    // Install bot first
    await app.inject({
      method: 'POST',
      url: '/api/spaces/space-1/bots/bot-sentinel/install',
      payload: { grantedPermissions: ['MANAGE_MESSAGES'] },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels/chan-1/commands/execute',
      payload: {
        command: 'seguranca',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.message.content).toContain('Painel de Segurança do Espaço');
    expect(body.message.user.isBot).toBe(true);
  });

  it('Developer portal: create bot, view own bots, regenerate token', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/developers/bots',
      payload: {
        name: 'Auto Role Bot',
        tagline: 'Atribui cargos automaticamente',
        commands: [{ name: 'autorole', description: 'Configura o cargo padrão' }],
      },
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json().bot;
    expect(created.name).toBe('Auto Role Bot');
    expect(created.botToken).toBeDefined();

    // List developer bots
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/developers/bots',
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().bots.length).toBeGreaterThanOrEqual(1);

    // Regenerate token
    const regenRes = await app.inject({
      method: 'POST',
      url: `/api/developers/bots/${created.id}/regenerate-token`,
    });
    expect(regenRes.statusCode).toBe(200);
    expect(regenRes.json().botToken).toBeDefined();
    expect(regenRes.json().botToken).not.toBe(created.botToken);
  });

  it('DELETE /api/spaces/:spaceId/bots/:botId uninstalls bot from space', async () => {
    // Install
    await app.inject({
      method: 'POST',
      url: '/api/spaces/space-1/bots/bot-sentinel/install',
      payload: { grantedPermissions: [] },
    });

    // Uninstall
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/spaces/space-1/bots/bot-sentinel',
    });
    expect(delRes.statusCode).toBe(200);

    // Verify empty
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/spaces/space-1/bots',
    });
    expect(listRes.json().bots.length).toBe(0);
  });
});
