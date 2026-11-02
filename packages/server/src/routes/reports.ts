import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { generateSnowflake } from '../utils/snowflake.js';
import {
  hashMessageEvidence,
  generateReportProtocol,
  determineReportPriority,
} from '../utils/evidenceHasher.js';
import type { SafetyReportCategory } from '@concord/shared/src/types.js';

function nextId(): string {
  try {
    return generateSnowflake();
  } catch {
    return randomUUID();
  }
}

const VALID_CATEGORIES: SafetyReportCategory[] = [
  'threat',
  'harassment',
  'fraud',
  'extortion',
  'stalking',
  'csam_exploitation',
  'hate_speech',
  'violence',
  'unauthorized_personal_data',
  'illegal_other',
];

interface ReportMessageBody {
  messageId: string;
  category: SafetyReportCategory;
  description?: string;
  includeContext?: boolean;
}

interface ReportSpaceBody {
  spaceId: string;
  category: SafetyReportCategory;
  description?: string;
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // ─── Report Message ────────────────────────────────────────────────────────
  app.post(
    '/api/reports/message',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Body: ReportMessageBody }>, reply: FastifyReply) => {
      const { messageId, category, description, includeContext } = request.body || {};

      if (!messageId || typeof messageId !== 'string') {
        return reply.code(400).send({ error: 'messageId is required', code: 'validation_failed', statusCode: 400 });
      }

      if (!category || !VALID_CATEGORIES.includes(category)) {
        return reply.code(400).send({
          error: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      if (description && description.length > 2000) {
        return reply.code(400).send({
          error: 'Description exceeds maximum length of 2000 characters',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const currentUserId = request.userId;

      // 1. Look for channel message first
      const channelMsg = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, messageId))
        .get();

      let targetChannelId: string | null = null;
      let targetSpaceId: string | null = null;
      let targetAuthorId = '';
      let targetAuthorUsername = 'Unknown';
      let targetContent = '';
      let targetTimestamp = Date.now();
      let contextMessages: Array<{
        id: string;
        userId: string;
        content: string | null;
        createdAt: number;
        authorUsername?: string;
      }> = [];

      if (channelMsg) {
        // Find channel and space
        const channel = db
          .select()
          .from(schema.channels)
          .where(eq(schema.channels.id, channelMsg.channelId))
          .get();

        if (!channel) {
          return reply.code(404).send({ error: 'Channel not found', code: 'not_found', statusCode: 404 });
        }

        // Verify reporter has access to the space
        const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, channel.spaceId)).get();
        if (!space) {
          return reply.code(404).send({ error: 'Space not found', code: 'not_found', statusCode: 404 });
        }

        const isMember = db
          .select()
          .from(schema.spaceMembers)
          .where(
            and(
              eq(schema.spaceMembers.spaceId, channel.spaceId),
              eq(schema.spaceMembers.userId, currentUserId)
            )
          )
          .get();

        if (!isMember && space.type !== 'public' && space.visibility !== 'public') {
          return reply.code(403).send({
            error: 'You do not have permission to report messages from this space',
            code: 'forbidden',
            statusCode: 403,
          });
        }

        targetChannelId = channel.id;
        targetSpaceId = channel.spaceId;
        targetAuthorId = channelMsg.userId;
        targetContent = channelMsg.content || '';
        targetTimestamp = channelMsg.createdAt;

        const author = db.select().from(schema.users).where(eq(schema.users.id, channelMsg.userId)).get();
        if (author) targetAuthorUsername = author.username;

        if (includeContext) {
          const prior = db
            .select()
            .from(schema.messages)
            .where(
              and(
                eq(schema.messages.channelId, channel.id),
                lt(schema.messages.createdAt, channelMsg.createdAt)
              )
            )
            .orderBy(desc(schema.messages.createdAt))
            .limit(5)
            .all();

          contextMessages = prior.reverse();
        }
      } else {
        // 2. Look for DM message
        const dmMsg = db
          .select()
          .from(schema.dmMessages)
          .where(eq(schema.dmMessages.id, messageId))
          .get();

        if (!dmMsg) {
          return reply.code(404).send({ error: 'Message not found', code: 'not_found', statusCode: 404 });
        }

        // Verify reporter is participant in the DM channel
        const isDmParticipant = db
          .select()
          .from(schema.dmMembers)
          .where(
            and(
              eq(schema.dmMembers.dmChannelId, dmMsg.dmChannelId),
              eq(schema.dmMembers.userId, currentUserId)
            )
          )
          .get();

        if (!isDmParticipant) {
          return reply.code(403).send({
            error: 'You do not have permission to report messages from this private conversation',
            code: 'forbidden',
            statusCode: 403,
          });
        }

        targetChannelId = dmMsg.dmChannelId;
        targetAuthorId = dmMsg.userId;
        targetContent = dmMsg.content || '';
        targetTimestamp = dmMsg.createdAt;

        const author = db.select().from(schema.users).where(eq(schema.users.id, dmMsg.userId)).get();
        if (author) targetAuthorUsername = author.username;

        if (includeContext) {
          const prior = db
            .select()
            .from(schema.dmMessages)
            .where(
              and(
                eq(schema.dmMessages.dmChannelId, dmMsg.dmChannelId),
                lt(schema.dmMessages.createdAt, dmMsg.createdAt)
              )
            )
            .orderBy(desc(schema.dmMessages.createdAt))
            .limit(5)
            .all();

          contextMessages = prior.reverse();
        }
      }

      const protocol = generateReportProtocol();
      const priority = determineReportPriority(category);
      const reportId = nextId();
      const now = Date.now();

      // Insert Safety Report
      db.insert(schema.safetyReports)
        .values({
          id: reportId,
          protocol,
          reporterId: currentUserId,
          targetType: 'message',
          targetId: messageId,
          channelId: targetChannelId,
          spaceId: targetSpaceId,
          category,
          priority,
          description: description?.trim() || null,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Attach main reported message as evidence
      const mainEvidenceHash = hashMessageEvidence({
        messageId,
        authorId: targetAuthorId,
        content: targetContent,
        timestamp: targetTimestamp,
      });

      db.insert(schema.safetyReportEvidences)
        .values({
          id: nextId(),
          reportId,
          messageId,
          contentSnapshot: targetContent,
          authorId: targetAuthorId,
          authorUsername: targetAuthorUsername,
          timestamp: targetTimestamp,
          attachments: null,
          sha256Hash: mainEvidenceHash,
          createdAt: now,
        })
        .run();

      // Attach context messages if requested
      for (const ctx of contextMessages) {
        let ctxAuthorUsername = 'Unknown';
        const ctxAuthor = db.select().from(schema.users).where(eq(schema.users.id, ctx.userId)).get();
        if (ctxAuthor) ctxAuthorUsername = ctxAuthor.username;

        const ctxHash = hashMessageEvidence({
          messageId: ctx.id,
          authorId: ctx.userId,
          content: ctx.content,
          timestamp: ctx.createdAt,
        });

        db.insert(schema.safetyReportEvidences)
          .values({
            id: nextId(),
            reportId,
            messageId: ctx.id,
            contentSnapshot: ctx.content,
            authorId: ctx.userId,
            authorUsername: ctxAuthorUsername,
            timestamp: ctx.createdAt,
            attachments: null,
            sha256Hash: ctxHash,
            createdAt: now,
          })
          .run();
      }

      return reply.code(201).send({
        protocol,
        reportId,
        priority,
        status: 'pending',
        evidenceCount: 1 + contextMessages.length,
      });
    }
  );

  // ─── Report Space ──────────────────────────────────────────────────────────
  app.post(
    '/api/reports/space',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Body: ReportSpaceBody }>, reply: FastifyReply) => {
      const { spaceId, category, description } = request.body || {};

      if (!spaceId || typeof spaceId !== 'string') {
        return reply.code(400).send({ error: 'spaceId is required', code: 'validation_failed', statusCode: 400 });
      }

      if (!category || !VALID_CATEGORIES.includes(category)) {
        return reply.code(400).send({
          error: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const currentUserId = request.userId;

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return reply.code(404).send({ error: 'Space not found', code: 'not_found', statusCode: 404 });
      }

      const protocol = generateReportProtocol();
      const priority = determineReportPriority(category);
      const reportId = nextId();
      const now = Date.now();

      db.insert(schema.safetyReports)
        .values({
          id: reportId,
          protocol,
          reporterId: currentUserId,
          targetType: 'space',
          targetId: spaceId,
          spaceId,
          channelId: null,
          category,
          priority,
          description: description?.trim() || null,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        })
        .run();

      return reply.code(201).send({
        protocol,
        reportId,
        priority,
        status: 'pending',
      });
    }
  );

  // ─── Get User's Reports ────────────────────────────────────────────────────
  app.get(
    '/api/reports/my',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      const reports = db
        .select({
          id: schema.safetyReports.id,
          protocol: schema.safetyReports.protocol,
          targetType: schema.safetyReports.targetType,
          category: schema.safetyReports.category,
          priority: schema.safetyReports.priority,
          status: schema.safetyReports.status,
          resolutionNotes: schema.safetyReports.resolutionNotes,
          resolvedAt: schema.safetyReports.resolvedAt,
          createdAt: schema.safetyReports.createdAt,
        })
        .from(schema.safetyReports)
        .where(eq(schema.safetyReports.reporterId, request.userId))
        .orderBy(desc(schema.safetyReports.createdAt))
        .all();

      return reply.code(200).send({ reports });
    }
  );
}
