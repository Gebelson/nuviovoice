import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as schema from '../db/schema.js';
import { ensureDefaults } from '../db/migrate.js';
import { setWorkerId } from '../utils/snowflake.js';

const execFile = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let app: FastifyInstance;
let testDataDir: string;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../utils/auth.js', () => ({
  authenticate: async (
    request: { userId?: string; headers: Record<string, string> },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    const auth = request.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    request.userId = token;
  },
  requireAdmin: async (
    request: { userId?: string },
    reply: { code: (code: number) => { send: (body?: any) => void } }
  ) => {
    const user = sqlite.prepare('SELECT is_admin FROM users WHERE id = ?').get(request.userId) as
      | { is_admin: number }
      | undefined;
    if (!user || user.is_admin !== 1) {
      return reply.code(403).send({ error: 'Forbidden', statusCode: 403, code: 'forbidden' });
    }
  },
  verifyJwtAndUser: async (token: string) => {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const user = sqlite.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(cleanToken) as any;
    if (!user) throw new Error('Invalid token');
    return { userId: user.id, username: user.id, homeInstance: null };
  },
  AuthError: class AuthError extends Error {
    statusCode = 401;
  },
}));

import { winksRoutes } from './winks.js';
import { probeVideoFile, processWinkMedia } from '../utils/winkProcessor.js';

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

describe('Winks Chunked & Resumable Upload Architecture', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(path.join(tmpdir(), 'winks-upload-test-'));
    process.env.DATA_DIR = testDataDir;

    sqlite = new Database(path.join(testDataDir, 'test.db'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    setWorkerId(1);

    db = drizzle(sqlite, { schema });

    app = Fastify();
    await app.register(multipart, {
      limits: { fileSize: 500 * 1024 * 1024 },
    });
    await app.register(winksRoutes);
    await app.ready();

    const now = Date.now();
    sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at)
      VALUES
        ('user-admin', 'sysadmin', 'Administrator', 'hash0', 1, ?),
        ('user-1', 'alice', 'Alice', 'hash1', 0, ?)
    `).run(now, now);
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
    await rm(testDataDir, { recursive: true, force: true });
  });

  it('rejects uploads from non-admin users with 403', async () => {
    // 1. Direct upload attempt
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'Bearer user-1' },
      payload: { name: 'Unauthorized Wink' },
    });
    expect(res1.statusCode).toBe(403);

    // 2. Tus upload attempt
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-1',
        'tus-resumable': '1.0.0',
        'upload-length': '1000',
        'upload-metadata': 'filename dGVzdC5tb3Y=', // test.mov in base64
      },
    });
    expect(res2.statusCode).toBe(403);
  });

  it('rejects unsupported file formats (.txt, .exe) with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': '5000',
        'upload-metadata': 'filename aGFja2VyLmV4ZQ==', // hacker.exe in base64
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Apenas arquivos MOV, MP4 e WebM');
  });

  it('rejects files larger than 500 MB with 413 Payload Too Large', async () => {
    const hugeSize = 501 * 1024 * 1024; // 501 MB
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(hugeSize),
        'upload-metadata': 'filename aHVnZS5tb3Y=', // huge.mov in base64
      },
    });
    expect(res.statusCode).toBe(413);
    expect(res.body).toContain('Arquivo muito grande');
  });

  it('performs chunked Tus upload for 5 MB video payload and creates wink', async () => {
    const fileSize = 5 * 1024 * 1024; // 5 MB
    const chunkSize = 2.5 * 1024 * 1024; // 2.5 MB chunks
    const chunk1 = Buffer.alloc(chunkSize, 'A');
    const chunk2 = Buffer.alloc(fileSize - chunkSize, 'B');

    // Step 1: POST to create Tus upload
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(fileSize),
        'upload-metadata': 'filename dmlkZW9fNW1iLm1vdg==', // video_5mb.mov
      },
    });

    expect(createRes.statusCode).toBe(201);
    const location = createRes.headers['location'] as string;
    expect(location).toBeDefined();
    const uploadId = path.basename(location);

    // Step 2: PATCH chunk 1 (offset 0)
    const patch1 = await app.inject({
      method: 'PATCH',
      url: `/api/admin/winks/files/${uploadId}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-offset': '0',
        'content-type': 'application/offset+octet-stream',
      },
      payload: chunk1,
    });
    expect(patch1.statusCode).toBe(204);
    expect(patch1.headers['upload-offset']).toBe(String(chunk1.length));

    // Step 3: HEAD to verify offset resumption
    const headRes = await app.inject({
      method: 'HEAD',
      url: `/api/admin/winks/files/${uploadId}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
      },
    });
    expect(headRes.statusCode).toBe(200);
    expect(headRes.headers['upload-offset']).toBe(String(chunk1.length));

    // Step 4: PATCH chunk 2 (offset = chunk1.length)
    const patch2 = await app.inject({
      method: 'PATCH',
      url: `/api/admin/winks/files/${uploadId}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-offset': String(chunk1.length),
        'content-type': 'application/offset+octet-stream',
      },
      payload: chunk2,
    });
    expect([200, 204]).toContain(patch2.statusCode);
    expect(patch2.headers['upload-offset']).toBe(String(fileSize));

    // Step 5: Finalize Wink creation
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'Bearer user-admin' },
      payload: {
        uploadId,
        name: 'Wink 5MB Chunked',
        category: 'humor',
        emoji: '⚡',
        autoPublish: true,
      },
    });

    expect(completeRes.statusCode).toBe(201);
    const wink = completeRes.json();
    expect(wink.id).toBeDefined();
    expect(wink.originalSize).toBe(fileSize);
    expect(wink.originalFilename).toBe('video_5mb.mov');
  });

  it('supports cancellation and cleans up partial uploaded files on DELETE', async () => {
    const fileSize = 10 * 1024 * 1024;
    const chunk = Buffer.alloc(2 * 1024 * 1024, 'X');

    // Create upload
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(fileSize),
        'upload-metadata': 'filename Y2FuY2VsX3Rlc3QubW92', // cancel_test.mov
      },
    });
    expect(createRes.statusCode).toBe(201);
    const uploadId = path.basename(createRes.headers['location'] as string);

    // Upload first chunk
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/winks/files/${uploadId}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-offset': '0',
        'content-type': 'application/offset+octet-stream',
      },
      payload: chunk,
    });

    const stagedDir = path.join(testDataDir, 'winks', 'temp', '.tus');
    const stagedFile = path.join(stagedDir, uploadId);
    expect(fs.existsSync(stagedFile)).toBe(true);

    // Cancel upload via DELETE
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/winks/files/${uploadId}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
      },
    });
    expect([200, 204]).toContain(deleteRes.statusCode);

    // Verify partial file was cleaned up
    expect(fs.existsSync(stagedFile)).toBe(false);
  });

  it('detects duplicate uploads and protects against duplicate winks unless allowed', async () => {
    const fileSize = 2000;
    const chunk = Buffer.alloc(fileSize, 'D');

    // Upload file 1
    const create1 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(fileSize),
        'upload-metadata': 'filename ZHVwbGljYXRlX3Rlc3QubW92', // duplicate_test.mov
      },
    });
    const uploadId1 = path.basename(create1.headers['location'] as string);
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/winks/files/${uploadId1}`,
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-offset': '0',
        'content-type': 'application/offset+octet-stream',
      },
      payload: chunk,
    });

    const wink1Res = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'Bearer user-admin' },
      payload: {
        uploadId: uploadId1,
        name: 'Original Wink',
      },
    });
    expect(wink1Res.statusCode).toBe(201);

    // Attempt to upload duplicate file without allowDuplicate
    const create2 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(fileSize),
        'upload-metadata': 'filename ZHVwbGljYXRlX3Rlc3QubW92', // same filename and size
      },
    });
    expect(create2.statusCode).toBe(409);
    expect(create2.body).toContain('Já existe um Wink cadastrado');

    // Attempt with allowDuplicate: true
    const create3 = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/files',
      headers: {
        authorization: 'Bearer user-admin',
        'tus-resumable': '1.0.0',
        'upload-length': String(fileSize),
        'upload-metadata': 'filename ZHVwbGljYXRlX3Rlc3QubW92,allowDuplicate dHJ1ZQ==', // allowDuplicate: true
      },
    });
    expect(create3.statusCode).toBe(201);
  });

  it('validates uploads across benchmark sizes: 5 MB, 25 MB, 46.31 MB (iHazar), 100 MB, 250 MB', async () => {
    const stats = typeof fs.statfsSync === 'function' ? fs.statfsSync(testDataDir) : null;
    const freeBytes = stats ? Number(stats.bavail) * Number(stats.bsize) : 10 * 1024 * 1024 * 1024;

    const sizes = [
      { name: '5mb.mov', size: 5 * 1024 * 1024 },
      { name: '25mb.mov', size: 25 * 1024 * 1024 },
      { name: 'iHazar.mov', size: Math.round(46.31 * 1024 * 1024) }, // 48,559,841 bytes
      { name: '100mb.mov', size: 100 * 1024 * 1024 },
      { name: '250mb.mov', size: 250 * 1024 * 1024 },
    ];

    for (const item of sizes) {
      const b64Name = Buffer.from(item.name).toString('base64');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/admin/winks/files',
        headers: {
          authorization: 'Bearer user-admin',
          'tus-resumable': '1.0.0',
          'upload-length': String(item.size),
          'upload-metadata': `filename ${b64Name}`,
        },
      });

      const requiredBytes = item.size * 2 + 50 * 1024 * 1024;
      if (freeBytes < requiredBytes) {
        // Correctly triggered disk protection when drive space is insufficient
        expect(createRes.statusCode).toBe(507);
        expect(createRes.body).toContain('Espaço em disco insuficiente');
      } else {
        expect(createRes.statusCode).toBe(201);
        const loc = createRes.headers['location'] as string;
        const uploadId = path.basename(loc);

        const head = await app.inject({
          method: 'HEAD',
          url: `/api/admin/winks/files/${uploadId}`,
          headers: {
            authorization: 'Bearer user-admin',
            'tus-resumable': '1.0.0',
          },
        });
        expect(head.statusCode).toBe(200);
        expect(head.headers['upload-length']).toBe(String(item.size));
        expect(head.headers['upload-offset']).toBe('0');

        await app.inject({
          method: 'DELETE',
          url: `/api/admin/winks/files/${uploadId}`,
          headers: {
            authorization: 'Bearer user-admin',
            'tus-resumable': '1.0.0',
          },
        });
      }
    }
  });

  it('processes full pipeline for realistic ProRes 4444 MOV with audio (like iHazar.mov)', async () => {
    // 1. Generate ProRes 4444 MOV with alpha transparency and stereo audio using FFmpeg
    const movFile = path.join(testDataDir, 'iHazar_alpha_audio.mov');
    await execFile('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'color=c=red@0.6:s=320x240:d=1,format=rgba',
      '-f', 'lavfi',
      '-i', 'sine=frequency=1000:duration=1',
      '-c:v', 'prores_ks',
      '-profile:v', '4',
      '-pix_fmt', 'yuva444p10le',
      '-c:a', 'pcm_s16le',
      '-y', movFile,
    ]);

    expect(fs.existsSync(movFile)).toBe(true);

    // 2. Probe the generated file
    const probe = await probeVideoFile(movFile);
    expect(probe.videoCodec).toBe('prores');
    expect(probe.hasAlpha).toBe(true);
    expect(probe.hasAudio).toBe(true);

    // 3. Admin upload using existingFilePath
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/admin/winks/upload',
      headers: { authorization: 'Bearer user-admin' },
      payload: {
        name: 'iHazar Real Alpha',
        category: 'humor',
        emoji: '🔥',
        existingFilePath: movFile,
        autoPublish: true,
      },
    });

    expect(uploadRes.statusCode).toBe(201);
    const createdWink = uploadRes.json();

    // 4. Run media processor
    await processWinkMedia(createdWink.id);

    // 5. Inspect database row
    const row = sqlite.prepare('SELECT * FROM winks WHERE id = ?').get(createdWink.id) as any;
    expect(row.status).toBe('completed');
    expect(row.has_alpha).toBe(1);
    expect(row.has_audio).toBe(1);
    expect(row.webm_path).toBeDefined();
    expect(fs.existsSync(row.webm_path)).toBe(true);
    expect(fs.existsSync(row.mp4_path)).toBe(true);
    expect(fs.existsSync(row.thumbnail_path)).toBe(true);

    // 6. Inspect WebM output to verify alpha format
    const webmProbe = await probeVideoFile(row.webm_path);
    expect(webmProbe.hasAlpha).toBe(true);
    expect(webmProbe.hasAudio).toBe(true);
  });
});
