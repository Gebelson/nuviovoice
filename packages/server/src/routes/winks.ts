import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { parseUploadMetadata } from '../utils/tusHooks.js';
import { safeMoveFile } from '../utils/fileOps.js';
import { verifyJwtAndUser, AuthError } from '../utils/auth.js';
import { connectionManager } from '../ws/handler.js';
import { calculateMuteExpiration, recordWinkRecent } from '../utils/winkMutes.js';
import type { WinkContactMute, WinkMuteDuration } from '@concord/shared/src/winks.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { generateSnowflake } from '../utils/snowflake.js';
import {
  WINKS_DIR,
  WINKS_PROCESSED_DIR,
  WINKS_ORIGINAL_DIR,
  WINKS_TEMP_DIR,
  getWinksDir,
  getWinksOriginalDir,
  getWinksProcessedDir,
  getWinksTempDir,
  ensureWinksDirectories,
  queueWinkProcessing,
} from '../utils/winkProcessor.js';
import type { OfficialWink, WinkAdminMetrics, WinkCategory, WinkStatus } from '@concord/shared/src/winks.js';

function mapWinkRow(row: typeof schema.winks.$inferSelect): OfficialWink {
  return {
    id: row.id,
    name: row.name,
    category: row.category as WinkCategory,
    description: row.description,
    durationMs: row.durationMs,
    hasAudio: row.hasAudio === 1,
    previewEmoji: row.emoji,
    originalFilename: row.originalFilename,
    originalMime: row.originalMime,
    originalSize: row.originalSize,
    videoPath: row.videoPath,
    webmPath: row.webmPath,
    webmUrl: row.webmUrl,
    mp4Path: row.mp4Path,
    mp4Url: row.mp4Url,
    thumbnailPath: row.thumbnailPath,
    thumbnailUrl: row.thumbnailUrl,
    hasAlpha: row.hasAlpha === 1,
    audioCodec: row.audioCodec,
    videoCodec: row.videoCodec,
    width: row.width,
    height: row.height,
    fps: row.fps,
    defaultVolume: row.defaultVolume,
    status: row.status as WinkStatus,
    errorMessage: row.errorMessage,
    published: row.published === 1,
    version: row.version,
    creatorId: row.creatorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

export async function winksRoutes(app: FastifyInstance): Promise<void> {
  ensureWinksDirectories();

  const winkTusDir = path.join(getWinksTempDir(), '.tus');
  fs.mkdirSync(winkTusDir, { recursive: true });

  const MAX_WINK_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB limit
  const WINK_ALLOWED_EXTENSIONS = ['.mov', '.mp4', '.webm'];

  function checkDiskSpaceAvailable(targetDir: string, requiredBytes: number): boolean {
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(targetDir);
        const freeBytes = Number(stats.bavail) * Number(stats.bsize);
        return freeBytes >= requiredBytes + 50 * 1024 * 1024;
      }
    } catch { /* best effort */ }
    return true;
  }

  if (!app.hasContentTypeParser('application/offset+octet-stream')) {
    app.addContentTypeParser(
      'application/offset+octet-stream',
      (_request, _payload, done) => done(null),
    );
  }

  const winkTusServer = new TusServer({
    path: '/api/admin/winks/files',
    datastore: new FileStore({
      directory: winkTusDir,
      expirationPeriodInMilliseconds: 24 * 60 * 60 * 1000,
    }),
    relativeLocation: true,
    disableTerminationForFinishedUploads: true,
    async onIncomingRequest(req, _res, uploadId) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw { status_code: 401, body: 'Missing or invalid authorization header' };
      }
      const token = authHeader.slice(7);
      let identity: { userId: string; username: string; homeInstance: string | null };
      try {
        identity = await verifyJwtAndUser(token);
      } catch (err) {
        if (err instanceof AuthError) {
          throw { status_code: err.statusCode, body: err.message };
        }
        throw { status_code: 401, body: 'Invalid or expired token' };
      }
      const db = getDb();
      const user = db.select().from(schema.users).where(eq(schema.users.id, identity.userId)).get();
      if (!user || user.isAdmin !== 1) {
        throw { status_code: 403, body: 'Admin privileges required' };
      }
      (req as any).userId = identity.userId;
    },
    async onUploadCreate(req, res, upload) {
      if (upload.size !== undefined && upload.size > MAX_WINK_UPLOAD_BYTES) {
        throw { status_code: 413, body: 'Arquivo muito grande. O limite máximo para Winks é de 500 MB.' };
      }

      if (upload.size !== undefined && !checkDiskSpaceAvailable(getWinksTempDir(), upload.size * 2)) {
        throw { status_code: 507, body: 'Espaço em disco insuficiente no servidor para processamento deste vídeo.' };
      }

      const rawMeta = req.headers['upload-metadata'] as string | undefined;
      const parsed = parseUploadMetadata(rawMeta || null);
      const originalName = parsed.originalName || parsed.filename || 'video.mov';
      const ext = path.extname(originalName).toLowerCase();
      if (!WINK_ALLOWED_EXTENSIONS.includes(ext)) {
        throw { status_code: 400, body: 'Apenas arquivos MOV, MP4 e WebM são aceitos para Winks.' };
      }

      const db = getDb();
      const existingWink = db.select()
        .from(schema.winks)
        .where(and(
          eq(schema.winks.originalFilename, originalName),
          eq(schema.winks.originalSize, upload.size ?? 0)
        ))
        .get();

      if (existingWink && parsed.allowDuplicate !== 'true') {
        throw {
          status_code: 409,
          body: `Já existe um Wink cadastrado com este arquivo ('${originalName}'). Marque 'permitir duplicata' se deseja prosseguir.`
        };
      }

      return {
        res,
        metadata: {
          ...upload.metadata,
          userId: (req as any).userId,
          originalName,
          filename: originalName,
          filetype: parsed.filetype || 'video/quicktime',
        },
      };
    },
    async onUploadFinish(req, res, upload) {
      const meta = upload.metadata || {};
      const originalName = (meta.originalName || meta.filename || 'video.mov') as string;
      return {
        res,
        status_code: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          filename: originalName,
          size: upload.size,
        }),
      };
    },
  });

  // Support canonical /api/admin/winks/files and /api/admin/winks/files/
  app.all('/api/admin/winks/files', (request, reply) => {
    reply.hijack();
    winkTusServer.handle(request.raw, reply.raw);
  });
  app.all('/api/admin/winks/files/', (request, reply) => {
    reply.hijack();
    winkTusServer.handle(request.raw, reply.raw);
  });
  app.all('/api/admin/winks/files/*', (request, reply) => {
    reply.hijack();
    winkTusServer.handle(request.raw, reply.raw);
  });

  app.delete<{ Params: { id: string } }>('/api/admin/winks/files/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const cleanId = path.basename(id);
    const targetFile = path.join(winkTusDir, cleanId);
    const sidecarFile = path.join(winkTusDir, `${cleanId}.json`);
    try { if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile); } catch {}
    try { if (fs.existsSync(sidecarFile)) fs.unlinkSync(sidecarFile); } catch {}
    if (request.headers['tus-resumable']) {
      return reply.code(204).header('Tus-Resumable', '1.0.0').send();
    }
    return reply.code(200).send({ success: true, id: cleanId });
  });

  // ─── 1. Public / User: List Published Winks ────────────────────────────────
  app.get('/api/winks', async (_request, reply) => {
    const db = getDb();
    const rows = db
      .select()
      .from(schema.winks)
      .where(and(eq(schema.winks.published, 1), eq(schema.winks.status, 'completed')))
      .orderBy(desc(schema.winks.createdAt))
      .all();

    const winks = rows.map(mapWinkRow);
    return reply.code(200).send(winks);
  });

  // ─── 2. Public / User: Get Single Published Wink ───────────────────────────
  app.get<{ Params: { id: string } }>('/api/winks/:id', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db
      .select()
      .from(schema.winks)
      .where(and(eq(schema.winks.id, id), eq(schema.winks.published, 1), eq(schema.winks.status, 'completed')))
      .get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    return reply.code(200).send(mapWinkRow(row));
  });

  // ─── 3. Media Serving: Stream WebM, MP4 or Thumbnail ───────────────────────
  app.get<{ Params: { filename: string } }>('/api/winks/media/:filename', async (request, reply) => {
    const { filename } = request.params;
    const safeFilename = path.basename(filename);

    const candidatePaths = [
      path.join(getWinksProcessedDir(), safeFilename),
      path.join(getWinksDir(), safeFilename),
      path.join(getWinksOriginalDir(), safeFilename),
      path.resolve(process.cwd(), 'packages/web/public/winks', safeFilename),
      path.resolve(process.cwd(), '../web/public/winks', safeFilename),
      path.resolve(process.cwd(), 'public/winks', safeFilename),
    ];

    const targetPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!targetPath) {
      return sendError(reply, 404, 'file_not_found');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.webm': 'video/webm',
      '.mp4': 'video/mp4',
      '.webp': 'image/webp',
      '.mov': 'video/quicktime',
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    reply.header('Content-Type', mime);

    if (typeof (reply as any).sendFile === 'function') {
      try {
        return await (reply as any).sendFile(safeFilename, path.dirname(targetPath));
      } catch {
        // Fallback to stream
      }
    }

    const stream = fs.createReadStream(targetPath);
    return reply.send(stream);
  });

  // ─── 4. Admin: List All Winks with Metrics & Filters ───────────────────────
  app.get<{
    Querystring: {
      category?: string;
      status?: string;
      search?: string;
    };
  }>('/api/admin/winks', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const db = getDb();
    const { category, status, search } = request.query;

    const allRows = db.select().from(schema.winks).orderBy(desc(schema.winks.createdAt)).all();

    const metrics: WinkAdminMetrics = {
      total: allRows.length,
      published: allRows.filter((r) => r.published === 1 && r.status === 'completed').length,
      processing: allRows.filter((r) => r.status === 'pending' || r.status === 'validating' || r.status === 'processing').length,
      drafts: allRows.filter((r) => r.published === 0 && r.status === 'completed').length,
      failed: allRows.filter((r) => r.status === 'failed').length,
    };

    let filtered = allRows;

    if (category && category !== 'all') {
      filtered = filtered.filter((r) => r.category === category);
    }

    if (status && status !== 'all') {
      if (status === 'published') {
        filtered = filtered.filter((r) => r.published === 1 && r.status === 'completed');
      } else if (status === 'draft') {
        filtered = filtered.filter((r) => r.published === 0 && r.status === 'completed');
      } else {
        filtered = filtered.filter((r) => r.status === status);
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return reply.code(200).send({
      winks: filtered.map(mapWinkRow),
      metrics,
    });
  });

  // ─── 5. Admin: Upload New Wink Video ───────────────────────────────────────
  app.post('/api/admin/winks/upload', {
    bodyLimit: 500 * 1024 * 1024,
    preHandler: [authenticate, requireAdmin],
  }, async (request, reply) => {
    const db = getDb();
    const isMultipart = typeof request.isMultipart === 'function' ? request.isMultipart() : false;

    let name = '';
    let category = 'diversao';
    let emoji = '✨';
    let description = '';
    let defaultVolume = 1.0;
    let autoPublish = true;
    let allowDuplicate = false;
    let originalFilename = 'video.mov';
    let originalMime = 'video/quicktime';
    let originalSize = 0;
    let tempSavePath = '';
    const winkId = generateSnowflake();

    if (isMultipart) {
      const parts = request.parts();
      let fileFound = false;

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'file') {
            fileFound = true;
            originalFilename = part.filename;
            originalMime = part.mimetype;
            const ext = path.extname(originalFilename).toLowerCase() || '.mov';

            if (!WINK_ALLOWED_EXTENSIONS.includes(ext)) {
              return sendError(reply, 400, 'unsupported_file_format', {
                details: 'Apenas arquivos MOV, MP4 e WebM são aceitos',
              });
            }

            if (!checkDiskSpaceAvailable(getWinksTempDir(), 50 * 1024 * 1024)) {
              return reply.code(507).send({
                error: 'Espaço em disco insuficiente no servidor',
                code: 'insufficient_storage',
                statusCode: 507,
                details: 'Espaço em disco insuficiente no servidor',
              });
            }

            tempSavePath = path.join(getWinksOriginalDir(), `${winkId}_original${ext}`);
            const writeStream = fs.createWriteStream(tempSavePath);
            try {
              await pipeline(part.file, writeStream);
            } catch (streamErr) {
              try { if (fs.existsSync(tempSavePath)) fs.unlinkSync(tempSavePath); } catch {}
              throw streamErr;
            }
            originalSize = fs.existsSync(tempSavePath) ? fs.statSync(tempSavePath).size : 0;
          } else {
            // Drain unexpected file
            await part.toBuffer();
          }
        } else {
          // Regular field
          const val = String(part.value || '');
          if (part.fieldname === 'name') name = val;
          else if (part.fieldname === 'category') category = val;
          else if (part.fieldname === 'emoji') emoji = val;
          else if (part.fieldname === 'description') description = val;
          else if (part.fieldname === 'defaultVolume') defaultVolume = parseFloat(val) || 1.0;
          else if (part.fieldname === 'autoPublish') autoPublish = val === 'true' || val === '1';
          else if (part.fieldname === 'allowDuplicate') allowDuplicate = val === 'true' || val === '1';
        }
      }

      if (!fileFound || !tempSavePath) {
        return sendError(reply, 400, 'file_required');
      }
    } else {
      // JSON body fallback for chunked uploads / tests / automation
      const body = request.body as Record<string, any>;
      if (!body) return sendError(reply, 400, 'body_required');

      name = body.name || '';
      category = body.category || 'diversao';
      emoji = body.emoji || '✨';
      description = body.description || '';
      defaultVolume = typeof body.defaultVolume === 'number' ? body.defaultVolume : 1.0;
      autoPublish = body.autoPublish !== false;
      allowDuplicate = body.allowDuplicate === true;

      if (body.uploadId) {
        const cleanUploadId = path.basename(body.uploadId);
        const stagedPath = path.join(winkTusDir, cleanUploadId);
        const sidecarPath = path.join(winkTusDir, `${cleanUploadId}.json`);
        if (!fs.existsSync(stagedPath)) {
          return reply.code(404).send({
            error: 'Arquivo de upload fragmentado não encontrado ou expirado',
            code: 'staged_file_not_found',
            statusCode: 404,
            details: 'Arquivo de upload fragmentado não encontrado ou expirado.',
          });
        }
        let stagedMeta: any = {};
        try {
          if (fs.existsSync(sidecarPath)) {
            stagedMeta = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')).metadata || {};
          }
        } catch { /* ignore */ }

        originalFilename = body.originalFilename || stagedMeta.originalName || stagedMeta.filename || 'video.mov';
        originalMime = body.originalMime || stagedMeta.filetype || 'video/quicktime';
        const ext = path.extname(originalFilename).toLowerCase() || '.mov';
        if (!WINK_ALLOWED_EXTENSIONS.includes(ext)) {
          return sendError(reply, 400, 'unsupported_file_format', {
            details: 'Apenas arquivos MOV, MP4 e WebM são aceitos',
          });
        }

        tempSavePath = path.join(getWinksOriginalDir(), `${winkId}_original${ext}`);
        safeMoveFile(stagedPath, tempSavePath);
        try { if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath); } catch {}
        originalSize = fs.existsSync(tempSavePath) ? fs.statSync(tempSavePath).size : 0;
      } else if (body.videoBase64) {
        originalFilename = body.originalFilename || 'video.mov';
        originalMime = body.originalMime || 'video/quicktime';
        const ext = path.extname(originalFilename).toLowerCase() || '.mov';
        tempSavePath = path.join(getWinksOriginalDir(), `${winkId}_original${ext}`);
        const buffer = Buffer.from(body.videoBase64, 'base64');
        fs.writeFileSync(tempSavePath, buffer);
        originalSize = buffer.length;
      } else if (body.existingFilePath && fs.existsSync(body.existingFilePath)) {
        originalFilename = path.basename(body.existingFilePath);
        const ext = path.extname(originalFilename).toLowerCase() || '.mov';
        tempSavePath = path.join(getWinksOriginalDir(), `${winkId}_original${ext}`);
        fs.copyFileSync(body.existingFilePath, tempSavePath);
        originalSize = fs.statSync(tempSavePath).size;
      } else {
        return sendError(reply, 400, 'file_required');
      }
    }

    // Duplicate check
    if (!allowDuplicate) {
      const existingWink = db.select()
        .from(schema.winks)
        .where(and(
          eq(schema.winks.originalFilename, originalFilename),
          eq(schema.winks.originalSize, originalSize)
        ))
        .get();
      if (existingWink) {
        if (tempSavePath && fs.existsSync(tempSavePath)) {
          try { fs.unlinkSync(tempSavePath); } catch {}
        }
        return reply.code(409).send({
          error: 'Wink duplicado',
          code: 'duplicate_wink',
          statusCode: 409,
          details: `Já existe um Wink cadastrado com este arquivo ('${originalFilename}'). Marque 'permitir duplicata' se deseja prosseguir.`,
        });
      }
    }

    if (!name.trim()) {
      name = path.parse(originalFilename).name;
    }

    const now = Date.now();

    db.insert(schema.winks).values({
      id: winkId,
      name: name.trim().slice(0, 64),
      category: category.trim().toLowerCase(),
      description: description.trim().slice(0, 256),
      emoji: emoji.slice(0, 8),
      originalFilename,
      originalMime,
      originalSize,
      videoPath: tempSavePath,
      defaultVolume: Math.min(1.5, Math.max(0.0, defaultVolume)),
      status: 'pending',
      published: autoPublish ? 1 : 0,
      creatorId: request.userId,
      createdAt: now,
      updatedAt: now,
      publishedAt: autoPublish ? now : null,
    }).run();

    // Trigger async processing
    queueWinkProcessing(winkId);

    const created = db.select().from(schema.winks).where(eq(schema.winks.id, winkId)).get();
    return reply.code(201).send(mapWinkRow(created!));
  });

  // ─── 6. Admin: Get Single Wink Status ──────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/admin/winks/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    return reply.code(200).send(mapWinkRow(row));
  });

  // ─── 7. Admin: Update Wink Metadata ────────────────────────────────────────
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      category?: string;
      emoji?: string;
      description?: string;
      defaultVolume?: number;
    };
  }>('/api/admin/winks/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    const { name, category, emoji, description, defaultVolume } = request.body;
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (name !== undefined) updates.name = name.trim().slice(0, 64);
    if (category !== undefined) updates.category = category.trim().toLowerCase();
    if (emoji !== undefined) updates.emoji = emoji.slice(0, 8);
    if (description !== undefined) updates.description = description.trim().slice(0, 256);
    if (typeof defaultVolume === 'number') updates.defaultVolume = Math.min(1.5, Math.max(0, defaultVolume));

    db.update(schema.winks).set(updates).where(eq(schema.winks.id, id)).run();

    const updated = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();
    return reply.code(200).send(mapWinkRow(updated!));
  });

  // ─── 8. Admin: Publish Wink ────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/admin/winks/:id/publish', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    if (row.status !== 'completed') {
      return sendError(reply, 400, 'wink_not_ready', {
        details: 'O processamento do Wink precisa estar concluído antes da publicação.',
      });
    }

    const now = Date.now();
    db.update(schema.winks)
      .set({
        published: 1,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.winks.id, id))
      .run();

    const updated = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();
    return reply.code(200).send(mapWinkRow(updated!));
  });

  // ─── 9. Admin: Unpublish Wink ──────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/admin/winks/:id/unpublish', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    const now = Date.now();
    db.update(schema.winks)
      .set({
        published: 0,
        updatedAt: now,
      })
      .where(eq(schema.winks.id, id))
      .run();

    const updated = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();
    return reply.code(200).send(mapWinkRow(updated!));
  });

  // ─── 10. Admin: Retry Failed Processing ────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/admin/winks/:id/retry', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    db.update(schema.winks)
      .set({
        status: 'pending',
        errorMessage: null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.winks.id, id))
      .run();

    queueWinkProcessing(id);

    const updated = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();
    return reply.code(200).send(mapWinkRow(updated!));
  });

  // ─── 11. Admin: Delete Wink ────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/admin/winks/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const row = db.select().from(schema.winks).where(eq(schema.winks.id, id)).get();

    if (!row) {
      return sendError(reply, 404, 'wink_not_found');
    }

    // Cleanup files on disk
    for (const f of [row.videoPath, row.webmPath, row.mp4Path, row.thumbnailPath]) {
      if (f && fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore cleanup errors
        }
      }
    }

    db.delete(schema.winks).where(eq(schema.winks.id, id)).run();

    return reply.code(200).send({ success: true, id });
  });

  // ─── 12. User: Wink Contact Mutes ──────────────────────────────────────────
  app.get('/api/winks/mutes', { preHandler: authenticate }, async (request, reply) => {
    const db = getDb();
    const rows = db
      .select()
      .from(schema.winkContactMutes)
      .where(eq(schema.winkContactMutes.userId, request.userId))
      .all();

    const now = Date.now();
    const activeMutes: WinkContactMute[] = [];

    for (const r of rows) {
      if (r.muteType === 'temporary' && r.expiresAt && r.expiresAt <= now) {
        // Expired on the fly
        try {
          db.delete(schema.winkContactMutes).where(eq(schema.winkContactMutes.id, r.id)).run();
        } catch {}
        continue;
      }

      // Lookup target user info for display
      const targetUser = db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        })
        .from(schema.users)
        .where(eq(schema.users.id, r.targetUserId))
        .get();

      activeMutes.push({
        id: r.id,
        userId: r.userId,
        targetUserId: r.targetUserId,
        muteType: r.muteType as 'temporary' | 'indefinite',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        expiresAt: r.expiresAt,
        user: targetUser || null,
      });
    }

    return reply.code(200).send(activeMutes);
  });

  app.get<{ Params: { targetUserId: string } }>('/api/winks/mutes/:targetUserId', { preHandler: authenticate }, async (request, reply) => {
    const { targetUserId } = request.params;
    const db = getDb();
    const row = db
      .select()
      .from(schema.winkContactMutes)
      .where(
        and(
          eq(schema.winkContactMutes.userId, request.userId),
          eq(schema.winkContactMutes.targetUserId, targetUserId)
        )
      )
      .get();

    if (!row) {
      return reply.code(200).send({ isMuted: false, mute: null });
    }

    const now = Date.now();
    if (row.muteType === 'temporary' && row.expiresAt && row.expiresAt <= now) {
      try {
        db.delete(schema.winkContactMutes).where(eq(schema.winkContactMutes.id, row.id)).run();
      } catch {}
      return reply.code(200).send({ isMuted: false, mute: null });
    }

    const targetUser = db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
      })
      .from(schema.users)
      .where(eq(schema.users.id, row.targetUserId))
      .get();

    return reply.code(200).send({
      isMuted: true,
      mute: {
        id: row.id,
        userId: row.userId,
        targetUserId: row.targetUserId,
        muteType: row.muteType as 'temporary' | 'indefinite',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        expiresAt: row.expiresAt,
        user: targetUser || null,
      },
    });
  });

  app.put<{ Params: { targetUserId: string }; Body: { duration?: WinkMuteDuration } }>('/api/winks/mutes/:targetUserId', { preHandler: authenticate }, async (request, reply) => {
    const { targetUserId } = request.params;
    const duration = request.body?.duration || 'indefinite';

    if (targetUserId === request.userId) {
      return sendError(reply, 400, 'validation_failed');
    }

    const db = getDb();
    const now = Date.now();
    const { muteType, expiresAt } = calculateMuteExpiration(duration, now);

    const existing = db
      .select()
      .from(schema.winkContactMutes)
      .where(
        and(
          eq(schema.winkContactMutes.userId, request.userId),
          eq(schema.winkContactMutes.targetUserId, targetUserId)
        )
      )
      .get();

    let id = existing?.id;
    if (existing) {
      db.update(schema.winkContactMutes)
        .set({
          muteType,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(schema.winkContactMutes.id, existing.id))
        .run();
    } else {
      id = generateSnowflake();
      db.insert(schema.winkContactMutes)
        .values({
          id,
          userId: request.userId,
          targetUserId,
          muteType,
          createdAt: now,
          updatedAt: now,
          expiresAt,
        })
        .run();
    }

    const targetUser = db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
      })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .get();

    const muteObj: WinkContactMute = {
      id: id!,
      userId: request.userId,
      targetUserId,
      muteType,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      expiresAt,
      user: targetUser || null,
    };

    // Broadcast update to all user's connected sessions for cross-device sync
    connectionManager.sendToUser(request.userId, {
      type: 'wink_mute_updated',
      targetUserId,
      mute: muteObj,
    });

    return reply.code(200).send(muteObj);
  });

  app.delete<{ Params: { targetUserId: string } }>('/api/winks/mutes/:targetUserId', { preHandler: authenticate }, async (request, reply) => {
    const { targetUserId } = request.params;
    const db = getDb();

    db.delete(schema.winkContactMutes)
      .where(
        and(
          eq(schema.winkContactMutes.userId, request.userId),
          eq(schema.winkContactMutes.targetUserId, targetUserId)
        )
      )
      .run();

    connectionManager.sendToUser(request.userId, {
      type: 'wink_mute_removed',
      targetUserId,
    });

    return reply.code(200).send({ success: true, targetUserId });
  });

  // ─── 13. User: Favorite Winks ──────────────────────────────────────────────
  app.get('/api/winks/favorites', { preHandler: authenticate }, async (request, reply) => {
    const db = getDb();
    const rows = db
      .select({ winkId: schema.winkFavorites.winkId })
      .from(schema.winkFavorites)
      .where(eq(schema.winkFavorites.userId, request.userId))
      .orderBy(desc(schema.winkFavorites.createdAt))
      .all();

    return reply.code(200).send(rows.map((r) => r.winkId));
  });

  app.put<{ Params: { winkId: string } }>('/api/winks/favorites/:winkId', { preHandler: authenticate }, async (request, reply) => {
    const { winkId } = request.params;
    const db = getDb();

    const existing = db
      .select()
      .from(schema.winkFavorites)
      .where(
        and(
          eq(schema.winkFavorites.userId, request.userId),
          eq(schema.winkFavorites.winkId, winkId)
        )
      )
      .get();

    if (!existing) {
      db.insert(schema.winkFavorites)
        .values({
          id: generateSnowflake(),
          userId: request.userId,
          winkId,
          createdAt: Date.now(),
        })
        .run();
    }

    const all = db
      .select({ winkId: schema.winkFavorites.winkId })
      .from(schema.winkFavorites)
      .where(eq(schema.winkFavorites.userId, request.userId))
      .orderBy(desc(schema.winkFavorites.createdAt))
      .all();

    const favorites = all.map((r) => r.winkId);

    connectionManager.sendToUser(request.userId, {
      type: 'wink_favorite_added',
      winkId,
    });

    return reply.code(200).send({ success: true, favorites });
  });

  app.delete<{ Params: { winkId: string } }>('/api/winks/favorites/:winkId', { preHandler: authenticate }, async (request, reply) => {
    const { winkId } = request.params;
    const db = getDb();

    db.delete(schema.winkFavorites)
      .where(
        and(
          eq(schema.winkFavorites.userId, request.userId),
          eq(schema.winkFavorites.winkId, winkId)
        )
      )
      .run();

    const all = db
      .select({ winkId: schema.winkFavorites.winkId })
      .from(schema.winkFavorites)
      .where(eq(schema.winkFavorites.userId, request.userId))
      .orderBy(desc(schema.winkFavorites.createdAt))
      .all();

    const favorites = all.map((r) => r.winkId);

    connectionManager.sendToUser(request.userId, {
      type: 'wink_favorite_removed',
      winkId,
    });

    return reply.code(200).send({ success: true, favorites });
  });

  // ─── 14. User: Recent Winks ────────────────────────────────────────────────
  app.get('/api/winks/recents', { preHandler: authenticate }, async (request, reply) => {
    const db = getDb();
    const rows = db
      .select({ winkId: schema.winkRecents.winkId })
      .from(schema.winkRecents)
      .where(eq(schema.winkRecents.userId, request.userId))
      .orderBy(desc(schema.winkRecents.usedAt), desc(schema.winkRecents.id))
      .limit(20)
      .all();

    return reply.code(200).send(rows.map((r) => r.winkId));
  });

  app.post<{ Body: { winkId: string } }>('/api/winks/recents', { preHandler: authenticate }, async (request, reply) => {
    const { winkId } = request.body || {};
    if (!winkId) {
      return sendError(reply, 400, 'validation_failed');
    }

    recordWinkRecent(request.userId, winkId);

    const db = getDb();
    const rows = db
      .select({ winkId: schema.winkRecents.winkId })
      .from(schema.winkRecents)
      .where(eq(schema.winkRecents.userId, request.userId))
      .orderBy(desc(schema.winkRecents.usedAt), desc(schema.winkRecents.id))
      .limit(20)
      .all();

    const recents = rows.map((r) => r.winkId);

    connectionManager.sendToUser(request.userId, {
      type: 'wink_recent_added',
      winkId,
    });

    return reply.code(200).send({ success: true, recents });
  });

}