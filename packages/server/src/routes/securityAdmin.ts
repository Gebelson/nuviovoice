import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { recordSecurityAudit } from '../utils/securityAuditor.js';
import { computeSha256 } from '../utils/evidenceHasher.js';
import type {
  SafetyReportStatus,
  SecurityCaseStatus,
  AuthorityRequestStatus,
  SecurityAlertStatus,
  SecurityOverviewMetrics,
} from '@concord/shared/src/types.js';

function nextId(): string {
  try {
    return generateSnowflake();
  } catch {
    return randomUUID();
  }
}

export async function securityAdminRoutes(app: FastifyInstance): Promise<void> {
  // ─── Overview Metrics ──────────────────────────────────────────────────────
  app.get(
    '/api/admin/security/overview',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();

      const pendingReportsRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.safetyReports)
        .where(eq(schema.safetyReports.status, 'pending'))
        .get();

      const openCasesRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.securityCases)
        .where(inArray(schema.securityCases.status, ['received', 'under_investigation', 'pending_info']))
        .get();

      const activeAlertsRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.securityAlerts)
        .where(eq(schema.securityAlerts.status, 'active'))
        .get();

      const authorityReqsRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.authorityRequests)
        .where(inArray(schema.authorityRequests.status, ['received', 'in_progress', 'preserved']))
        .get();

      const suspendedUsersRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(eq(schema.users.isDeleted, 1))
        .get();

      const totalEvidenceRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.evidenceVault)
        .get();

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentAuditRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.securityAuditLogs)
        .where(sql`${schema.securityAuditLogs.createdAt} >= ${oneDayAgo}`)
        .get();

      const metrics: SecurityOverviewMetrics = {
        pendingReportsCount: pendingReportsRow?.count ?? 0,
        openCasesCount: openCasesRow?.count ?? 0,
        activeAlertsCount: activeAlertsRow?.count ?? 0,
        authorityRequestsCount: authorityReqsRow?.count ?? 0,
        suspendedUsersCount: suspendedUsersRow?.count ?? 0,
        totalEvidenceItems: totalEvidenceRow?.count ?? 0,
        recentAuditCount: recentAuditRow?.count ?? 0,
        lastIncidentTimestamp: null,
      };

      return reply.code(200).send({ metrics });
    }
  );

  // ─── Reports ───────────────────────────────────────────────────────────────
  app.get(
    '/api/admin/security/reports',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Querystring: { status?: SafetyReportStatus; priority?: string; category?: string };
      }>,
      reply: FastifyReply
    ) => {
      const db = getDb();
      const { status, priority, category } = request.query || {};

      let query = db.select().from(schema.safetyReports);
      const conditions: any[] = [];

      if (status) conditions.push(eq(schema.safetyReports.status, status));
      if (priority) conditions.push(eq(schema.safetyReports.priority, priority as any));
      if (category) conditions.push(eq(schema.safetyReports.category, category as any));

      const reports = conditions.length > 0
        ? query.where(and(...conditions)).orderBy(desc(schema.safetyReports.createdAt)).all()
        : query.orderBy(desc(schema.safetyReports.createdAt)).all();

      return reply.code(200).send({ reports });
    }
  );

  app.get(
    '/api/admin/security/reports/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = getDb();
      const report = db
        .select()
        .from(schema.safetyReports)
        .where(eq(schema.safetyReports.id, request.params.id))
        .get();

      if (!report) {
        return reply.code(404).send({ error: 'Report not found', code: 'not_found', statusCode: 404 });
      }

      // Fetch attached evidences strictly (only what was submitted with this report)
      const evidences = db
        .select()
        .from(schema.safetyReportEvidences)
        .where(eq(schema.safetyReportEvidences.reportId, report.id))
        .orderBy(schema.safetyReportEvidences.createdAt)
        .all();

      return reply.code(200).send({ report: { ...report, evidences } });
    }
  );

  app.patch(
    '/api/admin/security/reports/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          status?: SafetyReportStatus;
          assignedAdminId?: string;
          resolutionNotes?: string;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { status, assignedAdminId, resolutionNotes, justification } = request.body || {};

      if (!justification || justification.trim().length < 5) {
        return reply.code(400).send({
          error: 'A mandatory justification (minimum 5 characters) is required for moderation actions',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const report = db
        .select()
        .from(schema.safetyReports)
        .where(eq(schema.safetyReports.id, request.params.id))
        .get();

      if (!report) {
        return reply.code(404).send({ error: 'Report not found', code: 'not_found', statusCode: 404 });
      }

      const updates: Record<string, any> = { updatedAt: Date.now() };
      if (status) {
        updates.status = status;
        if (status === 'resolved' || status === 'archived') {
          updates.resolvedAt = Date.now();
        }
      }
      if (assignedAdminId !== undefined) updates.assignedAdminId = assignedAdminId;
      if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;

      db.update(schema.safetyReports)
        .set(updates)
        .where(eq(schema.safetyReports.id, report.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: `update_report_status:${status || report.status}`,
        resourceType: 'safety_report',
        resourceId: report.id,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, report: { ...report, ...updates } });
    }
  );

  // ─── Security Cases ────────────────────────────────────────────────────────
  app.get(
    '/api/admin/security/cases',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      const cases = db
        .select()
        .from(schema.securityCases)
        .orderBy(desc(schema.securityCases.createdAt))
        .all();

      return reply.code(200).send({ cases });
    }
  );

  app.post(
    '/api/admin/security/cases',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Body: {
          title: string;
          category: string;
          priority?: string;
          reportId?: string;
          subjectUserId?: string;
          subjectUsername?: string;
          subjectSpaceId?: string;
          summary?: string;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        title,
        category,
        priority = 'medium',
        reportId,
        subjectUserId,
        subjectUsername,
        subjectSpaceId,
        summary,
        justification,
      } = request.body || {};

      if (!title || !category || !justification) {
        return reply.code(400).send({
          error: 'Title, category and justification are required',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const id = nextId();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const protocol = `CAS-${dateStr}-${id.slice(-6).toUpperCase()}`;
      const now = Date.now();

      db.insert(schema.securityCases)
        .values({
          id,
          protocol,
          reportId: reportId || null,
          title,
          category,
          priority,
          status: 'received',
          subjectUserId: subjectUserId || null,
          subjectUsername: subjectUsername || null,
          subjectSpaceId: subjectSpaceId || null,
          assignedTo: request.userId,
          summary: summary || null,
          resolution: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'create_security_case',
        resourceType: 'security_case',
        resourceId: id,
        caseId: id,
        justification,
        ip: request.ip,
      });

      return reply.code(201).send({ success: true, caseId: id, protocol });
    }
  );

  app.patch(
    '/api/admin/security/cases/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          status?: SecurityCaseStatus;
          summary?: string;
          resolution?: string;
          assignedTo?: string;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { status, summary, resolution, assignedTo, justification } = request.body || {};

      if (!justification) {
        return reply.code(400).send({
          error: 'Justification is required for updating case',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const caseItem = db
        .select()
        .from(schema.securityCases)
        .where(eq(schema.securityCases.id, request.params.id))
        .get();

      if (!caseItem) {
        return reply.code(404).send({ error: 'Case not found', code: 'not_found', statusCode: 404 });
      }

      const updates: Record<string, any> = { updatedAt: Date.now() };
      if (status) updates.status = status;
      if (summary !== undefined) updates.summary = summary;
      if (resolution !== undefined) updates.resolution = resolution;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;

      db.update(schema.securityCases)
        .set(updates)
        .where(eq(schema.securityCases.id, caseItem.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: `update_case:${status || caseItem.status}`,
        resourceType: 'security_case',
        resourceId: caseItem.id,
        caseId: caseItem.id,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, case: { ...caseItem, ...updates } });
    }
  );

  // ─── Authority Requests (Marco Civil Art. 15 / Ordens Judiciais) ──────────
  app.get(
    '/api/admin/security/authorities',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      const requests = db
        .select()
        .from(schema.authorityRequests)
        .orderBy(desc(schema.authorityRequests.createdAt))
        .all();

      return reply.code(200).send({ requests });
    }
  );

  app.post(
    '/api/admin/security/authorities',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Body: {
          protocolNumber: string;
          requestingBody: string;
          authorityName: string;
          authorityContact: string;
          requestType: string;
          legalBasis: string;
          targetUserId?: string;
          targetSpaceId?: string;
          preservationDays?: number;
          notes?: string;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        protocolNumber,
        requestingBody,
        authorityName,
        authorityContact,
        requestType,
        legalBasis,
        targetUserId,
        targetSpaceId,
        preservationDays,
        notes,
        justification,
      } = request.body || {};

      if (!protocolNumber || !requestingBody || !authorityName || !legalBasis || !justification) {
        return reply.code(400).send({
          error: 'protocolNumber, requestingBody, authorityName, legalBasis, and justification are mandatory',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const id = nextId();
      const now = Date.now();
      const preservationUntil = preservationDays
        ? now + preservationDays * 24 * 60 * 60 * 1000
        : null;

      db.insert(schema.authorityRequests)
        .values({
          id,
          protocolNumber,
          requestingBody,
          authorityName,
          authorityContact: authorityContact || '',
          requestType: requestType || 'preservation_order',
          legalBasis,
          targetUserId: targetUserId || null,
          targetSpaceId: targetSpaceId || null,
          status: 'received',
          preservationUntil,
          notes: notes || null,
          createdAdminId: request.userId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'register_authority_request',
        resourceType: 'authority_request',
        resourceId: id,
        justification: `Ofício/Processo: ${protocolNumber} - ${justification}`,
        ip: request.ip,
      });

      return reply.code(201).send({ success: true, id, protocolNumber });
    }
  );

  app.patch(
    '/api/admin/security/authorities/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          status?: AuthorityRequestStatus;
          notes?: string;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { status, notes, justification } = request.body || {};
      if (!justification) {
        return reply.code(400).send({ error: 'Justification is required', code: 'validation_failed', statusCode: 400 });
      }

      const db = getDb();
      const reqItem = db
        .select()
        .from(schema.authorityRequests)
        .where(eq(schema.authorityRequests.id, request.params.id))
        .get();

      if (!reqItem) {
        return reply.code(404).send({ error: 'Authority request not found', code: 'not_found', statusCode: 404 });
      }

      const updates: Record<string, any> = { updatedAt: Date.now() };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      db.update(schema.authorityRequests)
        .set(updates)
        .where(eq(schema.authorityRequests.id, reqItem.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: `update_authority_request:${status || reqItem.status}`,
        resourceType: 'authority_request',
        resourceId: reqItem.id,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, request: { ...reqItem, ...updates } });
    }
  );

  // ─── Evidence Vault ────────────────────────────────────────────────────────
  app.get(
    '/api/admin/security/evidence',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      // List metadata only - do NOT expose encrypted raw payload in the list
      const items = db
        .select({
          id: schema.evidenceVault.id,
          caseId: schema.evidenceVault.caseId,
          reportId: schema.evidenceVault.reportId,
          evidenceType: schema.evidenceVault.evidenceType,
          collectedBy: schema.evidenceVault.collectedBy,
          source: schema.evidenceVault.source,
          hashSha256: schema.evidenceVault.hashSha256,
          isExtremelySensitive: schema.evidenceVault.isExtremelySensitive,
          metadata: schema.evidenceVault.metadata,
          createdAt: schema.evidenceVault.createdAt,
        })
        .from(schema.evidenceVault)
        .orderBy(desc(schema.evidenceVault.createdAt))
        .all();

      return reply.code(200).send({ evidence: items });
    }
  );

  app.post(
    '/api/admin/security/evidence',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Body: {
          caseId?: string;
          reportId?: string;
          evidenceType: string;
          source: string;
          payload: string;
          metadata: string;
          isExtremelySensitive?: boolean;
          justification: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        caseId,
        reportId,
        evidenceType,
        source,
        payload,
        metadata,
        isExtremelySensitive = false,
        justification,
      } = request.body || {};

      if (!evidenceType || !payload || !justification) {
        return reply.code(400).send({
          error: 'evidenceType, payload and justification are required',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const id = nextId();
      const hashSha256 = computeSha256(payload);
      const now = Date.now();
      const initialCustody = JSON.stringify([
        {
          adminId: request.userId,
          action: 'deposit',
          timestamp: now,
          justification,
        },
      ]);

      db.insert(schema.evidenceVault)
        .values({
          id,
          caseId: caseId || null,
          reportId: reportId || null,
          evidenceType,
          collectedBy: request.userId,
          source: source || 'admin_vault_deposit',
          hashSha256,
          payloadEncrypted: payload,
          metadata: metadata || '{}',
          isExtremelySensitive: isExtremelySensitive ? 1 : 0,
          custodyLog: initialCustody,
          createdAt: now,
        })
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'deposit_evidence_vault',
        resourceType: 'evidence_vault',
        resourceId: id,
        caseId: caseId || null,
        justification,
        ip: request.ip,
      });

      return reply.code(201).send({ success: true, id, hashSha256 });
    }
  );

  app.get(
    '/api/admin/security/evidence/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { justification?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { justification } = request.query || {};
      if (!justification || justification.trim().length < 5) {
        return reply.code(400).send({
          error: 'Mandatory justification query param required to access vault evidence item',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const item = db
        .select()
        .from(schema.evidenceVault)
        .where(eq(schema.evidenceVault.id, request.params.id))
        .get();

      if (!item) {
        return reply.code(404).send({ error: 'Evidence not found', code: 'not_found', statusCode: 404 });
      }

      // Chain of custody logging
      let currentLog: any[] = [];
      try {
        currentLog = JSON.parse(item.custodyLog || '[]');
      } catch {
        currentLog = [];
      }
      currentLog.push({
        adminId: request.userId,
        action: 'access_read',
        timestamp: Date.now(),
        justification,
      });

      db.update(schema.evidenceVault)
        .set({ custodyLog: JSON.stringify(currentLog) })
        .where(eq(schema.evidenceVault.id, item.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'access_vault_evidence',
        resourceType: 'evidence_vault',
        resourceId: item.id,
        caseId: item.caseId || null,
        justification,
        ip: request.ip,
      });

      // Special handling for extremely sensitive content (ECA / CSAM):
      // The browser must never automatically display or render raw illegal media files.
      // We return the integrity hash and metadata with a safety flag.
      if (item.isExtremelySensitive === 1) {
        return reply.code(200).send({
          evidence: {
            id: item.id,
            caseId: item.caseId,
            reportId: item.reportId,
            evidenceType: item.evidenceType,
            hashSha256: item.hashSha256,
            metadata: item.metadata,
            isExtremelySensitive: true,
            restrictedNotice: 'Material restrito para proteção legal. Conteúdo retido em custódia judicial.',
            custodyLog: currentLog,
          },
        });
      }

      return reply.code(200).send({
        evidence: {
          ...item,
          custodyLog: currentLog,
        },
      });
    }
  );

  // ─── Behavioral Security Alerts ───────────────────────────────────────────
  app.get(
    '/api/admin/security/alerts',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{ Querystring: { status?: SecurityAlertStatus } }>,
      reply: FastifyReply
    ) => {
      const db = getDb();
      const { status } = request.query || {};

      let query = db.select().from(schema.securityAlerts);
      const alerts = status
        ? query.where(eq(schema.securityAlerts.status, status)).orderBy(desc(schema.securityAlerts.createdAt)).all()
        : query.orderBy(desc(schema.securityAlerts.createdAt)).all();

      return reply.code(200).send({ alerts });
    }
  );

  app.patch(
    '/api/admin/security/alerts/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { status: SecurityAlertStatus; justification: string };
      }>,
      reply: FastifyReply
    ) => {
      const { status, justification } = request.body || {};
      if (!status || !justification) {
        return reply.code(400).send({
          error: 'status and justification are required',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const alert = db
        .select()
        .from(schema.securityAlerts)
        .where(eq(schema.securityAlerts.id, request.params.id))
        .get();

      if (!alert) {
        return reply.code(404).send({ error: 'Alert not found', code: 'not_found', statusCode: 404 });
      }

      db.update(schema.securityAlerts)
        .set({ status })
        .where(eq(schema.securityAlerts.id, alert.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: `update_security_alert:${status}`,
        resourceType: 'security_alert',
        resourceId: alert.id,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, alert: { ...alert, status } });
    }
  );

  // ─── Security Audit Log Query ──────────────────────────────────────────────
  app.get(
    '/api/admin/security/audit',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
      reply: FastifyReply
    ) => {
      const db = getDb();
      const limit = Math.min(Number(request.query?.limit) || 50, 200);
      const offset = Number(request.query?.offset) || 0;

      const logs = db
        .select()
        .from(schema.securityAuditLogs)
        .orderBy(desc(schema.securityAuditLogs.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      const totalRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.securityAuditLogs)
        .get();

      return reply.code(200).send({ logs, total: totalRow?.count ?? 0 });
    }
  );

  // ─── User Moderation Actions (Suspension / Reactivation) ────────────────────
  app.get(
    '/api/admin/security/users',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      const users = db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          isDeleted: schema.users.isDeleted,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.isDeleted, 1))
        .orderBy(desc(schema.users.createdAt))
        .all();

      return reply.code(200).send({ users });
    }
  );

  app.post(
    '/api/admin/security/users/:id/suspend',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { justification: string; caseId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { justification, caseId } = request.body || {};
      if (!justification || justification.trim().length < 5) {
        return reply.code(400).send({
          error: 'Mandatory justification is required to suspend an account',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const user = db.select().from(schema.users).where(eq(schema.users.id, request.params.id)).get();
      if (!user) {
        return reply.code(404).send({ error: 'User not found', code: 'not_found', statusCode: 404 });
      }

      if (user.isAdmin === 1) {
        return reply.code(400).send({
          error: 'Cannot suspend an instance administrator account through this action',
          code: 'forbidden',
          statusCode: 400,
        });
      }

      db.update(schema.users)
        .set({ isDeleted: 1 })
        .where(eq(schema.users.id, user.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'suspend_user',
        resourceType: 'user',
        resourceId: user.id,
        caseId: caseId || null,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, userId: user.id, isSuspended: true });
    }
  );

  app.post(
    '/api/admin/security/users/:id/reactivate',
    { preHandler: [authenticate, requireAdmin] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { justification: string };
      }>,
      reply: FastifyReply
    ) => {
      const { justification } = request.body || {};
      if (!justification) {
        return reply.code(400).send({
          error: 'Justification is required to reactivate an account',
          code: 'validation_failed',
          statusCode: 400,
        });
      }

      const db = getDb();
      const user = db.select().from(schema.users).where(eq(schema.users.id, request.params.id)).get();
      if (!user) {
        return reply.code(404).send({ error: 'User not found', code: 'not_found', statusCode: 404 });
      }

      db.update(schema.users)
        .set({ isDeleted: 0 })
        .where(eq(schema.users.id, user.id))
        .run();

      recordSecurityAudit({
        adminId: request.userId,
        adminUsername: request.username,
        action: 'reactivate_user',
        resourceType: 'user',
        resourceId: user.id,
        justification,
        ip: request.ip,
      });

      return reply.code(200).send({ success: true, userId: user.id, isSuspended: false });
    }
  );

  // ─── Space Safety List ─────────────────────────────────────────────────────
  app.get(
    '/api/admin/security/spaces',
    { preHandler: [authenticate, requireAdmin] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const db = getDb();
      // List spaces that have associated reports
      const reportedSpaces = db
        .select({
          spaceId: schema.safetyReports.spaceId,
          reportCount: sql<number>`count(*)`,
        })
        .from(schema.safetyReports)
        .where(sql`${schema.safetyReports.spaceId} IS NOT NULL`)
        .groupBy(schema.safetyReports.spaceId)
        .all();

      const results = [];
      for (const item of reportedSpaces) {
        if (!item.spaceId) continue;
        const sp = db.select().from(schema.spaces).where(eq(schema.spaces.id, item.spaceId)).get();
        if (sp) {
          results.push({
            id: sp.id,
            name: sp.name,
            ownerId: sp.ownerId,
            type: sp.type,
            reportCount: item.reportCount,
          });
        }
      }

      return reply.code(200).send({ spaces: results });
    }
  );
}
