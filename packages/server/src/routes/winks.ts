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
  WINKS_PROCESSED_DIR,
  WINKS_ORIGINAL_DIR,
  WINKS_TEMP_DIR,
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

    let targetPath = path.join(WINKS_PROCESSED_DIR, safeFilename);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(WINKS_ORIGINAL_DIR, safeFilename);
      if (!fs.existsSync(targetPath)) {
        return sendError(reply, 404, 'file_not_found');
      }
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
  app.post('/api/admin/winks/upload', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const db = getDb();
    const isMultipart = typeof request.isMultipart === 'function' ? request.isMultipart() : false;

    let name = '';
    let category = 'diversao';
    let emoji = '✨';
    let description = '';
    let defaultVolume = 1.0;
    let autoPublish = true;
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

            if (!['.mov', '.mp4', '.webm'].includes(ext)) {
              return sendError(reply, 400, 'unsupported_file_format', {
                details: 'Apenas arquivos MOV, MP4 e WebM são aceitos',
              });
            }

            tempSavePath = path.join(WINKS_ORIGINAL_DIR, `${winkId}_original${ext}`);
            const writeStream = fs.createWriteStream(tempSavePath);
            await pipeline(part.file, writeStream);
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
        }
      }

      if (!fileFound || !tempSavePath) {
        return sendError(reply, 400, 'file_required');
      }
    } else {
      // JSON body fallback for tests / automation
      const body = request.body as Record<string, any>;
      if (!body) return sendError(reply, 400, 'body_required');

      name = body.name || '';
      category = body.category || 'diversao';
      emoji = body.emoji || '✨';
      description = body.description || '';
      defaultVolume = typeof body.defaultVolume === 'number' ? body.defaultVolume : 1.0;
      autoPublish = body.autoPublish !== false;

      if (body.videoBase64) {
        originalFilename = body.originalFilename || 'video.mov';
        originalMime = body.originalMime || 'video/quicktime';
        const ext = path.extname(originalFilename).toLowerCase() || '.mov';
        tempSavePath = path.join(WINKS_ORIGINAL_DIR, `${winkId}_original${ext}`);
        const buffer = Buffer.from(body.videoBase64, 'base64');
        fs.writeFileSync(tempSavePath, buffer);
        originalSize = buffer.length;
      } else if (body.existingFilePath && fs.existsSync(body.existingFilePath)) {
        originalFilename = path.basename(body.existingFilePath);
        const ext = path.extname(originalFilename).toLowerCase() || '.mov';
        tempSavePath = path.join(WINKS_ORIGINAL_DIR, `${winkId}_original${ext}`);
        fs.copyFileSync(body.existingFilePath, tempSavePath);
        originalSize = fs.statSync(tempSavePath).size;
      } else {
        return sendError(reply, 400, 'file_required');
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
}
