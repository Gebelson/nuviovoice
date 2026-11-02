import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { isSpaceOwner, computePermissions, PermissionBits } from '../utils/permissions.js';
import { sanitizeUser } from '../utils/sanitize.js';
import type {
  VerificationCategory,
  VerificationRequestData,
  VerificationMetrics,
} from '@concord/shared';

function nextId(): string {
  try {
    return generateSnowflake();
  } catch {
    return randomUUID();
  }
}

interface CreateUserRequestBody {
  category: 'personal' | 'creator' | 'organization';
  publicName: string;
  activityDescription?: string;
  officialWebsite?: string;
  socialLinks?: string[];
  professionalLinks?: string[];
  domainToVerify?: string;
  evidenceNotes?: string;
}

interface CreateSpaceRequestBody {
  publicName: string;
  activityDescription?: string;
  officialWebsite?: string;
  socialLinks?: string[];
  professionalLinks?: string[];
  domainToVerify?: string;
  evidenceNotes?: string;
}

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /api/verifications/me ─────────────────────────────────────────────
  app.get('/api/verifications/me', { preHandler: [authenticate] }, async (request, reply) => {
    const db = getDb();
    const userId = request.userId;

    const userRow = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!userRow) {
      return reply.code(404).send({ error: 'user_not_found' });
    }

    const activeRequest = db
      .select()
      .from(schema.verificationRequests)
      .where(
        and(
          eq(schema.verificationRequests.targetType, 'user'),
          eq(schema.verificationRequests.targetId, userId)
        )
      )
      .orderBy(desc(schema.verificationRequests.createdAt))
      .get();

    const activeVerification = db
      .select()
      .from(schema.entityVerifications)
      .where(
        and(
          eq(schema.entityVerifications.targetType, 'user'),
          eq(schema.entityVerifications.targetId, userId)
        )
      )
      .orderBy(desc(schema.entityVerifications.createdAt))
      .get();

    return reply.code(200).send({
      verificationStatus: userRow.verificationStatus || 'none',
      verificationCategory: userRow.verificationCategory || null,
      verification: activeVerification
        ? {
            category: activeVerification.category,
            status: activeVerification.status,
            verifiedAt: activeVerification.approvedAt,
            publicLabel: activeVerification.publicLabel,
            revokedAt: activeVerification.revokedAt,
            revokedReason: activeVerification.revokedReason,
          }
        : null,
      activeRequest: activeRequest
        ? {
            id: activeRequest.id,
            category: activeRequest.category,
            status: activeRequest.status,
            publicName: activeRequest.publicName,
            activityDescription: activeRequest.activityDescription,
            officialWebsite: activeRequest.officialWebsite,
            socialLinks: activeRequest.socialLinks ? JSON.parse(activeRequest.socialLinks) : [],
            professionalLinks: activeRequest.professionalLinks ? JSON.parse(activeRequest.professionalLinks) : [],
            domainToVerify: activeRequest.domainToVerify,
            domainToken: activeRequest.domainToken,
            domainVerified: activeRequest.domainVerified === 1,
            rejectionReason: activeRequest.rejectionReason,
            infoRequestNotes: activeRequest.infoRequestNotes,
            createdAt: activeRequest.createdAt,
            updatedAt: activeRequest.updatedAt,
          }
        : null,
    });
  });

  // ─── POST /api/verifications/requests ──────────────────────────────────────
  app.post<{ Body: CreateUserRequestBody }>(
    '/api/verifications/requests',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const db = getDb();
      const userId = request.userId;
      const {
        category,
        publicName,
        activityDescription,
        officialWebsite,
        socialLinks = [],
        professionalLinks = [],
        domainToVerify,
        evidenceNotes,
      } = request.body || {};

      const allowedCategories: VerificationCategory[] = ['personal', 'creator', 'organization'];
      if (!category || !allowedCategories.includes(category)) {
        return reply.code(400).send({ error: 'invalid_category', message: 'Categoria de solicitação inválida' });
      }

      const trimmedName = (publicName || '').trim();
      if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
        return reply.code(400).send({ error: 'invalid_name', message: 'Nome público deve conter entre 2 e 80 caracteres' });
      }

      // Check for existing pending request
      const existing = db
        .select()
        .from(schema.verificationRequests)
        .where(
          and(
            eq(schema.verificationRequests.targetType, 'user'),
            eq(schema.verificationRequests.targetId, userId),
            sql`${schema.verificationRequests.status} IN ('pending', 'under_review', 'info_requested')`
          )
        )
        .get();

      if (existing) {
        return reply.code(409).send({
          error: 'request_already_pending',
          message: 'Você já possui uma solicitação de verificação em andamento',
          requestId: existing.id,
        });
      }

      const now = Date.now();
      const reqId = nextId();
      const domainToken = domainToVerify ? `nuvio-verify-${randomBytes(12).toString('hex')}` : null;

      db.insert(schema.verificationRequests)
        .values({
          id: reqId,
          requesterUserId: userId,
          targetType: 'user',
          targetId: userId,
          category,
          status: 'pending',
          publicName: trimmedName,
          activityDescription: (activityDescription || '').trim() || null,
          officialWebsite: (officialWebsite || '').trim() || null,
          socialLinks: JSON.stringify(Array.isArray(socialLinks) ? socialLinks.slice(0, 10) : []),
          professionalLinks: JSON.stringify(Array.isArray(professionalLinks) ? professionalLinks.slice(0, 10) : []),
          domainToVerify: (domainToVerify || '').trim() || null,
          domainToken,
          domainVerified: 0,
          evidenceNotes: (evidenceNotes || '').trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Audit log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'request_created',
          adminId: userId,
          targetType: 'user',
          targetId: userId,
          requestId: reqId,
          category,
          justification: 'Solicitação de verificação de conta submetida pelo usuário',
          metadata: JSON.stringify({ publicName: trimmedName, category }),
          createdAt: now,
        })
        .run();

      return reply.code(201).send({
        id: reqId,
        category,
        status: 'pending',
        publicName: trimmedName,
        domainToken,
        createdAt: now,
      });
    }
  );

  // ─── POST /api/verifications/verify-domain ─────────────────────────────────
  app.post<{ Body: { requestId: string } }>(
    '/api/verifications/verify-domain',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { requestId } = request.body || {};
      if (!requestId) {
        return reply.code(400).send({ error: 'request_id_required' });
      }

      const db = getDb();
      const req = db
        .select()
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.id, requestId))
        .get();

      if (!req) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      // Must be owner of request or admin
      const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
      const isAdmin = user?.isAdmin === 1;
      if (req.requesterUserId !== request.userId && !isAdmin) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      if (!req.domainToVerify || !req.domainToken) {
        return reply.code(400).send({ error: 'no_domain_associated', message: 'Nenhum domínio configurado para este pedido' });
      }

      let cleanDomain = (req.domainToVerify.replace(/^https?:\/\//i, '').split('/')[0] || '').trim();
      let verified = false;
      let methodUsed: 'dns' | 'http' | null = null;

      // 1. Try DNS TXT record check: _nuvio-challenge.<domain>
      try {
        const records = await dns.resolveTxt(`_nuvio-challenge.${cleanDomain}`);
        for (const r of records) {
          const txtVal = Array.isArray(r) ? r.join('') : String(r);
          if (txtVal.includes(req.domainToken)) {
            verified = true;
            methodUsed = 'dns';
            break;
          }
        }
      } catch {
        // DNS lookup failed or no TXT record
      }

      // 2. Try HTTP well-known token check: https://<domain>/.well-known/nuvio-verification.json
      if (!verified) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(`https://${cleanDomain}/.well-known/nuvio-verification.json`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Nuvio-Verification-Bot/1.0' },
          });
          clearTimeout(timeout);
          if (res.ok) {
            const body = (await res.json().catch(() => null)) as Record<string, any> | null;
            if (body && (body.token === req.domainToken || body.nuvioToken === req.domainToken)) {
              verified = true;
              methodUsed = 'http';
            }
          }
        } catch {
          // HTTP fetch failed
        }
      }

      if (verified) {
        db.update(schema.verificationRequests)
          .set({ domainVerified: 1, updatedAt: Date.now() })
          .where(eq(schema.verificationRequests.id, requestId))
          .run();
        return reply.code(200).send({ verified: true, method: methodUsed, message: 'Domínio comprovado com sucesso!' });
      }

      return reply.code(200).send({
        verified: false,
        message: 'Não foi possível encontrar o token TXT ou o arquivo de verificação no domínio.',
      });
    }
  );

  // ─── GET /api/verifications/spaces/:spaceId ────────────────────────────────
  app.get<{ Params: { spaceId: string } }>(
    '/api/verifications/spaces/:spaceId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      const db = getDb();

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return reply.code(404).send({ error: 'space_not_found' });
      }

      const activeReq = db
        .select()
        .from(schema.verificationRequests)
        .where(
          and(
            eq(schema.verificationRequests.targetType, 'space'),
            eq(schema.verificationRequests.targetId, spaceId)
          )
        )
        .orderBy(desc(schema.verificationRequests.createdAt))
        .get();

      const activeVerification = db
        .select()
        .from(schema.entityVerifications)
        .where(
          and(
            eq(schema.entityVerifications.targetType, 'space'),
            eq(schema.entityVerifications.targetId, spaceId)
          )
        )
        .orderBy(desc(schema.entityVerifications.createdAt))
        .get();

      return reply.code(200).send({
        spaceId,
        verificationStatus: space.verificationStatus || 'none',
        verificationCategory: space.verificationCategory || null,
        verification: activeVerification
          ? {
              category: activeVerification.category,
              status: activeVerification.status,
              verifiedAt: activeVerification.approvedAt,
              publicLabel: activeVerification.publicLabel,
              revokedAt: activeVerification.revokedAt,
              revokedReason: activeVerification.revokedReason,
            }
          : null,
        activeRequest: activeReq
          ? {
              id: activeReq.id,
              status: activeReq.status,
              publicName: activeReq.publicName,
              activityDescription: activeReq.activityDescription,
              officialWebsite: activeReq.officialWebsite,
              socialLinks: activeReq.socialLinks ? JSON.parse(activeReq.socialLinks) : [],
              professionalLinks: activeReq.professionalLinks ? JSON.parse(activeReq.professionalLinks) : [],
              domainToVerify: activeReq.domainToVerify,
              domainToken: activeReq.domainToken,
              domainVerified: activeReq.domainVerified === 1,
              rejectionReason: activeReq.rejectionReason,
              infoRequestNotes: activeReq.infoRequestNotes,
              createdAt: activeReq.createdAt,
            }
          : null,
      });
    }
  );

  // ─── POST /api/verifications/spaces/:spaceId/requests ──────────────────────
  app.post<{ Params: { spaceId: string }; Body: CreateSpaceRequestBody }>(
    '/api/verifications/spaces/:spaceId/requests',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      const db = getDb();
      const userId = request.userId;

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return reply.code(404).send({ error: 'space_not_found' });
      }

      // Must be owner or have MANAGE_SPACE
      const isOwner = isSpaceOwner(userId, spaceId);
      const perms = computePermissions(userId, spaceId);
      const canManage = (perms & PermissionBits.MANAGE_SPACE) !== 0n || (perms & PermissionBits.ADMINISTRATOR) !== 0n;

      if (!isOwner && !canManage) {
        return reply.code(403).send({ error: 'forbidden', message: 'Apenas proprietários ou administradores do espaço podem solicitar verificação' });
      }

      if (space.type === 'private' && space.visibility === 'private') {
        return reply.code(400).send({
          error: 'space_not_public',
          message: 'Espaços privados comuns não são elegíveis à verificação pública do Explorar.',
        });
      }

      const {
        publicName,
        activityDescription,
        officialWebsite,
        socialLinks = [],
        professionalLinks = [],
        domainToVerify,
        evidenceNotes,
      } = request.body || {};

      const trimmedName = (publicName || space.name || '').trim();
      if (!trimmedName) {
        return reply.code(400).send({ error: 'name_required' });
      }

      const existing = db
        .select()
        .from(schema.verificationRequests)
        .where(
          and(
            eq(schema.verificationRequests.targetType, 'space'),
            eq(schema.verificationRequests.targetId, spaceId),
            sql`${schema.verificationRequests.status} IN ('pending', 'under_review', 'info_requested')`
          )
        )
        .get();

      if (existing) {
        return reply.code(409).send({ error: 'request_already_pending', message: 'Já existe solicitação pendente para este espaço' });
      }

      const now = Date.now();
      const reqId = nextId();
      const domainToken = domainToVerify ? `nuvio-verify-${randomBytes(12).toString('hex')}` : null;

      db.insert(schema.verificationRequests)
        .values({
          id: reqId,
          requesterUserId: userId,
          targetType: 'space',
          targetId: spaceId,
          category: 'space',
          status: 'pending',
          publicName: trimmedName,
          activityDescription: (activityDescription || space.description || '').trim() || null,
          officialWebsite: (officialWebsite || '').trim() || null,
          socialLinks: JSON.stringify(Array.isArray(socialLinks) ? socialLinks.slice(0, 10) : []),
          professionalLinks: JSON.stringify(Array.isArray(professionalLinks) ? professionalLinks.slice(0, 10) : []),
          domainToVerify: (domainToVerify || '').trim() || null,
          domainToken,
          domainVerified: 0,
          evidenceNotes: (evidenceNotes || '').trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'request_created',
          adminId: userId,
          targetType: 'space',
          targetId: spaceId,
          requestId: reqId,
          category: 'space',
          justification: 'Solicitação de verificação de espaço público submetida pelo responsável',
          metadata: JSON.stringify({ spaceName: trimmedName, spaceId }),
          createdAt: now,
        })
        .run();

      return reply.code(201).send({
        id: reqId,
        category: 'space',
        status: 'pending',
        publicName: trimmedName,
        createdAt: now,
      });
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── ADMIN ENDPOINTS (Restricted to platform administrators) ───────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/admin/verifications/metrics ──────────────────────────────────
  app.get(
    '/api/admin/verifications/metrics',
    { preHandler: [authenticate, requireAdmin] },
    async (_request, reply) => {
      const db = getDb();

      const totalVerifiedRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(eq(schema.entityVerifications.status, 'verified'))
        .get();

      const verifiedAccountsRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(
          and(
            eq(schema.entityVerifications.targetType, 'user'),
            eq(schema.entityVerifications.status, 'verified'),
            sql`${schema.entityVerifications.category} IN ('personal', 'creator', 'official')`
          )
        )
        .get();

      const verifiedOrgsRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(
          and(
            eq(schema.entityVerifications.targetType, 'user'),
            eq(schema.entityVerifications.status, 'verified'),
            eq(schema.entityVerifications.category, 'organization')
          )
        )
        .get();

      const verifiedSpacesRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(
          and(
            eq(schema.entityVerifications.targetType, 'space'),
            eq(schema.entityVerifications.status, 'verified')
          )
        )
        .get();

      const pendingRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.verificationRequests)
        .where(sql`${schema.verificationRequests.status} IN ('pending', 'under_review')`)
        .get();

      const rejectedRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.status, 'rejected'))
        .get();

      const revokedRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(eq(schema.entityVerifications.status, 'revoked'))
        .get();

      const infoReqRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.status, 'info_requested'))
        .get();

      const metrics: VerificationMetrics = {
        totalVerified: totalVerifiedRow?.count || 0,
        verifiedAccounts: verifiedAccountsRow?.count || 0,
        verifiedOrganizations: verifiedOrgsRow?.count || 0,
        verifiedSpaces: verifiedSpacesRow?.count || 0,
        pendingRequests: pendingRow?.count || 0,
        rejectedRequests: rejectedRow?.count || 0,
        revokedVerifications: revokedRow?.count || 0,
        infoRequested: infoReqRow?.count || 0,
      };

      return reply.code(200).send(metrics);
    }
  );

  // ─── GET /api/admin/verifications/requests ─────────────────────────────────
  app.get<{
    Querystring: {
      status?: string;
      category?: string;
      targetType?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/api/admin/verifications/requests',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const db = getDb();
      const { status, category, targetType, limit = '50', offset = '0' } = request.query;

      const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const skip = Math.max(parseInt(offset, 10) || 0, 0);

      const conditions: any[] = [];
      if (status && status !== 'all') {
        conditions.push(eq(schema.verificationRequests.status, status));
      }
      if (category && category !== 'all') {
        conditions.push(eq(schema.verificationRequests.category, category));
      }
      if (targetType && targetType !== 'all') {
        conditions.push(eq(schema.verificationRequests.targetType, targetType));
      }

      const rows = db
        .select({
          req: schema.verificationRequests,
          requester: {
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.users.displayName,
          },
        })
        .from(schema.verificationRequests)
        .leftJoin(schema.users, eq(schema.verificationRequests.requesterUserId, schema.users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.verificationRequests.createdAt))
        .limit(take)
        .offset(skip)
        .all();

      const totalRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.verificationRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .get();

      const items = rows.map((r) => ({
        id: r.req.id,
        requesterUserId: r.req.requesterUserId,
        requesterUsername: r.requester?.username,
        targetType: r.req.targetType,
        targetId: r.req.targetId,
        category: r.req.category,
        status: r.req.status,
        publicName: r.req.publicName,
        activityDescription: r.req.activityDescription,
        officialWebsite: r.req.officialWebsite,
        socialLinks: r.req.socialLinks ? JSON.parse(r.req.socialLinks) : [],
        professionalLinks: r.req.professionalLinks ? JSON.parse(r.req.professionalLinks) : [],
        domainToVerify: r.req.domainToVerify,
        domainVerified: r.req.domainVerified === 1,
        rejectionReason: r.req.rejectionReason,
        infoRequestNotes: r.req.infoRequestNotes,
        createdAt: r.req.createdAt,
        updatedAt: r.req.updatedAt,
      }));

      return reply.code(200).send({ items, total: totalRow?.count || 0 });
    }
  );

  // ─── GET /api/admin/verifications/requests/:id ─────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/api/admin/verifications/requests/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const row = db
        .select({
          req: schema.verificationRequests,
          requester: {
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatar: schema.users.avatar,
          },
        })
        .from(schema.verificationRequests)
        .leftJoin(schema.users, eq(schema.verificationRequests.requesterUserId, schema.users.id))
        .where(eq(schema.verificationRequests.id, id))
        .get();

      if (!row) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      return reply.code(200).send({
        ...row.req,
        socialLinks: row.req.socialLinks ? JSON.parse(row.req.socialLinks) : [],
        professionalLinks: row.req.professionalLinks ? JSON.parse(row.req.professionalLinks) : [],
        requester: row.requester,
      });
    }
  );

  // ─── POST /api/admin/verifications/requests/:id/approve ────────────────────
  app.post<{ Params: { id: string }; Body: { justification: string } }>(
    '/api/admin/verifications/requests/:id/approve',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { justification } = request.body || {};
      const adminId = request.userId;
      const db = getDb();

      const trimmedJust = (justification || '').trim();
      if (!trimmedJust) {
        return reply.code(400).send({ error: 'justification_required', message: 'Justificativa administrativa é obrigatória' });
      }

      const reqRow = db
        .select()
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.id, id))
        .get();

      if (!reqRow) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      const adminUser = db.select().from(schema.users).where(eq(schema.users.id, adminId)).get();
      const now = Date.now();
      const verificationId = nextId();

      // 1. Update request status to 'approved'
      db.update(schema.verificationRequests)
        .set({
          status: 'approved',
          reviewedByAdminId: adminId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.verificationRequests.id, id))
        .run();

      // 2. Create entity_verifications record
      db.insert(schema.entityVerifications)
        .values({
          id: verificationId,
          targetType: reqRow.targetType,
          targetId: reqRow.targetId,
          category: reqRow.category,
          status: 'verified',
          method: reqRow.domainVerified === 1 ? 'domain_dns' : 'manual_review',
          publicLabel: reqRow.publicName,
          approvedByAdminId: adminId,
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // 3. Update target table (users or spaces)
      if (reqRow.targetType === 'user') {
        db.update(schema.users)
          .set({
            verificationStatus: 'verified',
            verificationCategory: reqRow.category,
          })
          .where(eq(schema.users.id, reqRow.targetId))
          .run();
      } else if (reqRow.targetType === 'space') {
        db.update(schema.spaces)
          .set({
            verificationStatus: 'verified',
            verificationCategory: 'space',
          })
          .where(eq(schema.spaces.id, reqRow.targetId))
          .run();
      }

      // 4. Audit Log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'approved',
          adminId,
          adminUsername: adminUser?.username || 'admin',
          targetType: reqRow.targetType,
          targetId: reqRow.targetId,
          requestId: reqRow.id,
          category: reqRow.category,
          justification: trimmedJust,
          metadata: JSON.stringify({ publicName: reqRow.publicName, verificationId }),
          createdAt: now,
        })
        .run();

      return reply.code(200).send({ success: true, verified: true, verificationId });
    }
  );

  // ─── POST /api/admin/verifications/requests/:id/reject ─────────────────────
  app.post<{ Params: { id: string }; Body: { reason: string; justification?: string } }>(
    '/api/admin/verifications/requests/:id/reject',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { reason, justification } = request.body || {};
      const adminId = request.userId;
      const db = getDb();

      const trimmedReason = (reason || '').trim();
      if (!trimmedReason) {
        return reply.code(400).send({ error: 'reason_required', message: 'Motivo da recusa é obrigatório' });
      }

      const reqRow = db
        .select()
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.id, id))
        .get();

      if (!reqRow) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      const adminUser = db.select().from(schema.users).where(eq(schema.users.id, adminId)).get();
      const now = Date.now();

      db.update(schema.verificationRequests)
        .set({
          status: 'rejected',
          rejectionReason: trimmedReason,
          reviewedByAdminId: adminId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.verificationRequests.id, id))
        .run();

      // Audit Log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'rejected',
          adminId,
          adminUsername: adminUser?.username || 'admin',
          targetType: reqRow.targetType,
          targetId: reqRow.targetId,
          requestId: reqRow.id,
          category: reqRow.category,
          justification: (justification || trimmedReason).trim(),
          metadata: JSON.stringify({ publicName: reqRow.publicName, reason: trimmedReason }),
          createdAt: now,
        })
        .run();

      return reply.code(200).send({ success: true, status: 'rejected' });
    }
  );

  // ─── POST /api/admin/verifications/requests/:id/request-info ───────────────
  app.post<{ Params: { id: string }; Body: { notes: string } }>(
    '/api/admin/verifications/requests/:id/request-info',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body || {};
      const adminId = request.userId;
      const db = getDb();

      const trimmedNotes = (notes || '').trim();
      if (!trimmedNotes) {
        return reply.code(400).send({ error: 'notes_required', message: 'Orientações sobre dados complementares são obrigatórias' });
      }

      const reqRow = db
        .select()
        .from(schema.verificationRequests)
        .where(eq(schema.verificationRequests.id, id))
        .get();

      if (!reqRow) {
        return reply.code(404).send({ error: 'request_not_found' });
      }

      const adminUser = db.select().from(schema.users).where(eq(schema.users.id, adminId)).get();
      const now = Date.now();

      db.update(schema.verificationRequests)
        .set({
          status: 'info_requested',
          infoRequestNotes: trimmedNotes,
          reviewedByAdminId: adminId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.verificationRequests.id, id))
        .run();

      // Audit Log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'info_requested',
          adminId,
          adminUsername: adminUser?.username || 'admin',
          targetType: reqRow.targetType,
          targetId: reqRow.targetId,
          requestId: reqRow.id,
          category: reqRow.category,
          justification: `Informações adicionais solicitadas: ${trimmedNotes}`,
          metadata: JSON.stringify({ notes: trimmedNotes }),
          createdAt: now,
        })
        .run();

      return reply.code(200).send({ success: true, status: 'info_requested' });
    }
  );

  // ─── POST /api/admin/verifications/entities/:targetType/:targetId/revoke ──
  app.post<{
    Params: { targetType: 'user' | 'space'; targetId: string };
    Body: { justification: string };
  }>(
    '/api/admin/verifications/entities/:targetType/:targetId/revoke',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { targetType, targetId } = request.params;
      const { justification } = request.body || {};
      const adminId = request.userId;
      const db = getDb();

      const trimmedJust = (justification || '').trim();
      if (!trimmedJust) {
        return reply.code(400).send({ error: 'justification_required', message: 'Justificativa de revogação é obrigatória' });
      }

      const adminUser = db.select().from(schema.users).where(eq(schema.users.id, adminId)).get();
      const now = Date.now();

      // Update entity_verifications
      db.update(schema.entityVerifications)
        .set({
          status: 'revoked',
          revokedByAdminId: adminId,
          revokedAt: now,
          revokedReason: trimmedJust,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.entityVerifications.targetType, targetType),
            eq(schema.entityVerifications.targetId, targetId),
            eq(schema.entityVerifications.status, 'verified')
          )
        )
        .run();

      // Update target table
      if (targetType === 'user') {
        db.update(schema.users)
          .set({ verificationStatus: 'revoked' })
          .where(eq(schema.users.id, targetId))
          .run();
      } else if (targetType === 'space') {
        db.update(schema.spaces)
          .set({ verificationStatus: 'revoked' })
          .where(eq(schema.spaces.id, targetId))
          .run();
      }

      // Audit Log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'revoked',
          adminId,
          adminUsername: adminUser?.username || 'admin',
          targetType,
          targetId,
          category: 'personal',
          justification: trimmedJust,
          metadata: JSON.stringify({ reason: trimmedJust }),
          createdAt: now,
        })
        .run();

      return reply.code(200).send({ success: true, revoked: true });
    }
  );

  // ─── POST /api/admin/verifications/official/grant ──────────────────────────
  app.post<{ Body: { userId: string; justification: string } }>(
    '/api/admin/verifications/official/grant',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { userId, justification } = request.body || {};
      const adminId = request.userId;
      const db = getDb();

      const trimmedJust = (justification || '').trim();
      if (!trimmedJust) {
        return reply.code(400).send({ error: 'justification_required', message: 'Justificativa administrativa é obrigatória' });
      }

      if (!userId) {
        return reply.code(400).send({ error: 'user_id_required' });
      }

      const targetUser = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      if (!targetUser) {
        return reply.code(404).send({ error: 'user_not_found', message: 'Usuário alvo não encontrado' });
      }

      if (targetUser.homeInstance) {
        return reply.code(400).send({
          error: 'federated_user_unsupported',
          message: 'Selos de equipe oficial Nuvio são exclusivos para contas locais verificadas',
        });
      }

      const adminUser = db.select().from(schema.users).where(eq(schema.users.id, adminId)).get();
      const now = Date.now();
      const verifId = nextId();

      // Revoke any previous verified rows for target
      db.update(schema.entityVerifications)
        .set({ status: 'revoked', revokedAt: now, revokedReason: 'Substituído por concessão de equipe oficial' })
        .where(
          and(
            eq(schema.entityVerifications.targetType, 'user'),
            eq(schema.entityVerifications.targetId, userId),
            eq(schema.entityVerifications.status, 'verified')
          )
        )
        .run();

      // Insert official grant
      db.insert(schema.entityVerifications)
        .values({
          id: verifId,
          targetType: 'user',
          targetId: userId,
          category: 'official',
          status: 'verified',
          method: 'official_grant',
          publicLabel: targetUser.displayName || targetUser.username,
          approvedByAdminId: adminId,
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Update user
      db.update(schema.users)
        .set({
          verificationStatus: 'verified',
          verificationCategory: 'official',
        })
        .where(eq(schema.users.id, userId))
        .run();

      // Audit Log
      db.insert(schema.verificationAuditLogs)
        .values({
          id: nextId(),
          action: 'official_granted',
          adminId,
          adminUsername: adminUser?.username || 'admin',
          targetType: 'user',
          targetId: userId,
          category: 'official',
          justification: trimmedJust,
          metadata: JSON.stringify({ grantedTo: targetUser.username, displayName: targetUser.displayName }),
          createdAt: now,
        })
        .run();

      const updatedUser = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();

      return reply.code(200).send({
        success: true,
        user: updatedUser ? sanitizeUser(updatedUser) : null,
      });
    }
  );

  // ─── GET /api/admin/verifications/audit ────────────────────────────────────
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/admin/verifications/audit',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const db = getDb();
      const limit = Math.min(Math.max(parseInt(request.query.limit || '50', 10) || 50, 1), 100);
      const offset = Math.max(parseInt(request.query.offset || '0', 10) || 0, 0);

      const items = db
        .select()
        .from(schema.verificationAuditLogs)
        .orderBy(desc(schema.verificationAuditLogs.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      const totalRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.verificationAuditLogs)
        .get();

      return reply.code(200).send({ items, total: totalRow?.count || 0 });
    }
  );

  // ─── GET /api/admin/verifications/verified ─────────────────────────────────
  app.get<{
    Querystring: {
      category?: string;
      targetType?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/api/admin/verifications/verified',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const db = getDb();
      const { category, targetType, limit = '50', offset = '0' } = request.query;

      const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const skip = Math.max(parseInt(offset, 10) || 0, 0);

      const conditions = [eq(schema.entityVerifications.status, 'verified')];
      if (category && category !== 'all') {
        conditions.push(eq(schema.entityVerifications.category, category));
      }
      if (targetType && targetType !== 'all') {
        conditions.push(eq(schema.entityVerifications.targetType, targetType));
      }

      const rows = db
        .select()
        .from(schema.entityVerifications)
        .where(and(...conditions))
        .orderBy(desc(schema.entityVerifications.approvedAt))
        .limit(take)
        .offset(skip)
        .all();

      const totalRow = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.entityVerifications)
        .where(and(...conditions))
        .get();

      return reply.code(200).send({ items: rows, total: totalRow?.count || 0 });
    }
  );
}
