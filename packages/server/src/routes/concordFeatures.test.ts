import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fastify, { FastifyInstance } from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { soundsRoutes } from './sounds.js';
import { watchPartyRoutes } from './watchParty.js';
import { e2eeRoutes } from './e2ee.js';
import { webhooksRoutes } from './webhooks.js';
import { signJwt } from '../utils/auth.js';
import { setWorkerId } from '../utils/snowflake.js';

setWorkerId(42);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

describe('Concord Integrated Features (Haven + Backspace synthesis)', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    testDb = drizzle(sqlite, { schema });

    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    migrate(testDb, { migrationsFolder });

    // Seed test user, space, channel
    const now = Date.now();
    sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, created_at)
      VALUES ('user_alice', 'alice', 'Alice', 'hash123', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO spaces (id, name, owner_id, created_at)
      VALUES ('space_general', 'General Space', 'user_alice', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO space_members (space_id, user_id, joined_at)
      VALUES ('space_general', 'user_alice', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO channels (id, space_id, name, type, position, created_at)
      VALUES ('channel_lounge', 'space_general', 'lounge', 'voice', 0, ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO dm_channels (id, owner_id, created_at)
      VALUES ('dm_group_1', 'user_alice', ?)
    `).run(now);

    sqlite.prepare(`
      INSERT INTO dm_members (dm_channel_id, user_id)
      VALUES ('dm_group_1', 'user_alice')
    `).run();

    authToken = signJwt({ userId: 'user_alice', username: 'alice' });

    // Create fastify test instance
    app = fastify({ logger: false });

    await app.register(soundsRoutes);
    await app.register(watchPartyRoutes);
    await app.register(e2eeRoutes);
    await app.register(webhooksRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  describe('Soundboard API', () => {
    it('creates a sound and lists it for the space', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sounds/space/space_general',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Victory Horn',
          audioBase64: Buffer.from('RIFFtestWAVEfmt sounddata').toString('base64'),
          format: 'wav',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.sound.name).toBe('Victory Horn');
      expect(data.sound.spaceId).toBe('space_general');

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/sounds/space/space_general',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const listData = JSON.parse(listRes.body);
      expect(listData.sounds.length).toBe(1);
      expect(listData.sounds[0].name).toBe('Victory Horn');
    });

    it('sets and retrieves soundboard preferences', async () => {
      const prefRes = await app.inject({
        method: 'POST',
        url: '/api/sounds/preferences/space_general',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { volume: 0.75, muted: false },
      });
      expect(prefRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/sounds/preferences/space_general',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const data = JSON.parse(getRes.body);
      expect(data.preference.volume).toBe(0.75);
      expect(data.preference.muted).toBe(0);
    });
  });

  describe('Watch Party Synchronized Playback', () => {
    it('creates a watch party session and joins members', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/watch-party/create',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          channelId: 'channel_lounge',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isExclusive: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.session.videoType).toBe('youtube');
      expect(data.videoDetails.videoId).toBe('dQw4w9WgXcQ');

      const sessionId = data.session.id;

      // Query session details
      const sessionRes = await app.inject({
        method: 'GET',
        url: `/api/watch-party/session/${sessionId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(sessionRes.statusCode).toBe(200);
      const sessionData = JSON.parse(sessionRes.body);
      expect(sessionData.session.channelId).toBe('channel_lounge');
      expect(sessionData.members.length).toBe(1);

      // Playback action
      const actionRes = await app.inject({
        method: 'POST',
        url: `/api/watch-party/session/${sessionId}/action`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { action: 'play', currentTime: 42.5 },
      });
      expect(actionRes.statusCode).toBe(200);
      const actionData = JSON.parse(actionRes.body);
      expect(actionData.event.state).toBe('playing');
      expect(actionData.event.currentTime).toBe(42.5);
    });
  });

  describe('End-to-End Encryption (E2EE) Key Exchange', () => {
    it('publishes and retrieves user signing keys', async () => {
      const pubRes = await app.inject({
        method: 'POST',
        url: '/api/e2ee/keys',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          fingerprint: 'fp_sha256_abcdef123456',
          jwk: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: '1234567890' }),
        },
      });
      expect(pubRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/e2ee/keys/user_alice',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const data = JSON.parse(getRes.body);
      expect(data.keys.length).toBe(1);
      expect(data.keys[0].fingerprint).toBe('fp_sha256_abcdef123456');
    });

    it('manages group DM epoch ratchets', async () => {
      const epochRes = await app.inject({
        method: 'POST',
        url: '/api/e2ee/dm/dm_group_1/epoch',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          epoch: 1,
          signature: 'sig_base64_ed25519_proof',
          roster: JSON.stringify(['user_alice']),
        },
      });
      expect(epochRes.statusCode).toBe(201);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/e2ee/dm/dm_group_1/epochs',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const data = JSON.parse(listRes.body);
      expect(data.epochs.length).toBe(1);
      expect(data.epochs[0].epoch).toBe(1);
    });
  });

  describe('Webhooks & Slash Commands', () => {
    it('creates a webhook, posts an incoming message, and executes slash command', async () => {
      // Create webhook
      const hookRes = await app.inject({
        method: 'POST',
        url: '/api/webhooks/channel/channel_lounge',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { name: 'Deploy Bot' },
      });
      expect(hookRes.statusCode).toBe(201);
      const hookData = JSON.parse(hookRes.body);
      expect(hookData.webhook.name).toBe('Deploy Bot');

      const { id: webhookId, token } = hookData.webhook;

      // Post incoming webhook message (unauthenticated route using token)
      const msgRes = await app.inject({
        method: 'POST',
        url: `/api/webhooks/incoming/${webhookId}/${token}`,
        payload: {
          content: 'Deploy #42 succeeded on production!',
          username: 'GitHub Actions',
        },
      });
      expect(msgRes.statusCode).toBe(201);
      const msgData = JSON.parse(msgRes.body);
      expect(msgData.senderName).toBe('GitHub Actions');

      // Register slash command
      const cmdRes = await app.inject({
        method: 'POST',
        url: '/api/bot/commands/space/space_general',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          command: '/deploy',
          description: 'Triggers a cloud deployment',
          webhookId,
        },
      });
      expect(cmdRes.statusCode).toBe(201);

      // List slash commands
      const listCmdRes = await app.inject({
        method: 'GET',
        url: '/api/bot/commands/space/space_general',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(listCmdRes.statusCode).toBe(200);
      const listData = JSON.parse(listCmdRes.body);
      expect(listData.commands.length).toBe(1);
      expect(listData.commands[0].command).toBe('/deploy');
    });
  });
});
