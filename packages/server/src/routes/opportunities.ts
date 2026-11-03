import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { eq, and, desc, asc, like, or, inArray, sql, ne } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { connectionManager } from '../ws/handler.js';
import { config } from '../config.js';
import type {
  CreateOpportunityRequest,
  OpportunityFilters,
  ApplyOpportunityRequest,
  NegotiateOpportunityRequest,
  OpportunityReportRequest,
  OpportunityItem,
  ProfessionalProfile,
  OpportunityApplication,
  OpportunityNegotiation,
  OpportunityApplicationMessage,
} from '@concord/shared';

function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

function replyError(reply: FastifyReply, status: number, error: string, message?: string) {
  return reply.status(status).send({ error, message: message || error });
}

export async function opportunitiesRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // ─── 1. OPPORTUNITIES CATALOG & CRUD ────────────────────────────────────────

  // GET /api/opportunities - List published opportunities with search & filters
  app.get<{ Querystring: OpportunityFilters }>('/api/opportunities', async (request, reply) => {
    const {
      search,
      type,
      category,
      modality,
      contractType,
      experienceLevel,
      salaryMin,
      salaryMax,
      location,
      sort = 'recent',
      limit = 24,
      offset = 0,
    } = request.query;

    const lim = Math.min(Math.max(Number(limit) || 24, 1), 60);
    const off = Math.max(Number(offset) || 0, 0);

    const conditions = [
      eq(schema.opportunities.status, 'published'),
    ];

    if (type) {
      conditions.push(eq(schema.opportunities.type, type));
    }
    if (category && category !== 'all') {
      conditions.push(eq(schema.opportunities.category, category));
    }
    if (modality && modality !== 'negotiable') {
      conditions.push(eq(schema.opportunities.workModality, modality));
    }
    if (contractType) {
      conditions.push(eq(schema.opportunities.contractType, contractType));
    }
    if (experienceLevel && experienceLevel !== 'any') {
      conditions.push(eq(schema.opportunities.experienceLevel, experienceLevel));
    }
    if (salaryMin !== undefined && !isNaN(Number(salaryMin))) {
      conditions.push(sql`${schema.opportunities.salaryMin} >= ${Number(salaryMin)} OR ${schema.opportunities.budget} >= ${Number(salaryMin)}`);
    }
    if (salaryMax !== undefined && !isNaN(Number(salaryMax))) {
      conditions.push(sql`${schema.opportunities.salaryMax} <= ${Number(salaryMax)} OR (${schema.opportunities.salaryMax} IS NULL AND ${schema.opportunities.salaryMin} <= ${Number(salaryMax)})`);
    }
    if (location && location.trim()) {
      const locPattern = `%${location.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`lower(${schema.opportunities.locationCity})`, locPattern),
          like(sql`lower(${schema.opportunities.locationState})`, locPattern),
          like(sql`lower(${schema.opportunities.locationCountry})`, locPattern),
        )!
      );
    }
    if (search && search.trim()) {
      const sPattern = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`lower(${schema.opportunities.title})`, sPattern),
          like(sql`lower(${schema.opportunities.description})`, sPattern),
          like(sql`lower(${schema.opportunities.companyName})`, sPattern),
        )!
      );
    }

    let orderByClause = desc(schema.opportunities.createdAt);
    if (sort === 'salary_desc') {
      orderByClause = desc(schema.opportunities.salaryMax);
    } else if (sort === 'budget_desc') {
      orderByClause = desc(schema.opportunities.budget);
    } else if (sort === 'popularity') {
      orderByClause = desc(schema.opportunities.viewCount);
    }

    const rows = db
      .select({
        opp: schema.opportunities,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunities)
      .innerJoin(schema.users, eq(schema.opportunities.userId, schema.users.id))
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(lim)
      .offset(off)
      .all();

    const items: OpportunityItem[] = rows.map((r) => {
      const opp = r.opp;
      return {
        id: opp.id,
        userId: opp.userId,
        type: opp.type as any,
        title: opp.title,
        category: opp.category,
        description: opp.description,
        status: opp.status as any,
        companyName: opp.companyName,
        companyLogo: opp.companyLogo,
        creatorRole: opp.creatorRole as any,
        contractType: opp.contractType as any,
        responsibilities: opp.responsibilities,
        qualificationsMin: opp.qualificationsMin,
        qualificationsPref: opp.qualificationsPref,
        education: opp.education,
        experienceLevel: opp.experienceLevel as any,
        workSchedule: opp.workSchedule,
        remunerationType: opp.remunerationType as any,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        currency: opp.currency,
        benefits: safeJsonParse<string[]>(opp.benefits, []),
        vacanciesCount: opp.vacanciesCount,
        deadline: opp.deadline,
        questions: safeJsonParse(opp.questions, []),
        documentsRequired: safeJsonParse(opp.documentsRequired, []),
        externalLink: opp.externalLink,
        budget: opp.budget,
        budgetType: opp.budgetType as any,
        skills: safeJsonParse<string[]>(opp.skills, []),
        deliverables: opp.deliverables,
        complexity: opp.complexity as any,
        expectedDuration: opp.expectedDuration,
        coverImage: opp.coverImage,
        gallery: safeJsonParse<string[]>(opp.gallery, []),
        deliveryDays: opp.deliveryDays,
        revisionsCount: opp.revisionsCount,
        packages: safeJsonParse(opp.packages, null),
        servicesIncluded: opp.servicesIncluded,
        servicesExcluded: opp.servicesExcluded,
        faqs: safeJsonParse(opp.faqs, []),
        requirements: opp.requirements,
        workModality: opp.workModality as any,
        locationCountry: opp.locationCountry,
        locationState: opp.locationState,
        locationCity: opp.locationCity,
        language: opp.language,
        viewCount: opp.viewCount,
        author: {
          id: r.user.id,
          username: r.user.username,
          displayName: r.user.displayName,
          avatar: r.user.avatar,
        },
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
      };
    });

    return { opportunities: items, total: items.length, limit: lim, offset: off };
  });

  // GET /api/opportunities/my - Opportunities published or drafted by authenticated user
  app.get('/api/opportunities/my', { preHandler: authenticate }, async (request) => {
    const userId = request.userId;
    const rows = db
      .select()
      .from(schema.opportunities)
      .where(and(eq(schema.opportunities.userId, userId), ne(schema.opportunities.status, 'archived')))
      .orderBy(desc(schema.opportunities.createdAt))
      .all();

    const opportunities: OpportunityItem[] = rows.map((opp) => ({
      id: opp.id,
      userId: opp.userId,
      type: opp.type as any,
      title: opp.title,
      category: opp.category,
      description: opp.description,
      status: opp.status as any,
      companyName: opp.companyName,
      companyLogo: opp.companyLogo,
      creatorRole: opp.creatorRole as any,
      contractType: opp.contractType as any,
      responsibilities: opp.responsibilities,
      qualificationsMin: opp.qualificationsMin,
      qualificationsPref: opp.qualificationsPref,
      education: opp.education,
      experienceLevel: opp.experienceLevel as any,
      workSchedule: opp.workSchedule,
      remunerationType: opp.remunerationType as any,
      salaryMin: opp.salaryMin,
      salaryMax: opp.salaryMax,
      currency: opp.currency,
      benefits: safeJsonParse(opp.benefits, []),
      vacanciesCount: opp.vacanciesCount,
      deadline: opp.deadline,
      questions: safeJsonParse(opp.questions, []),
      documentsRequired: safeJsonParse(opp.documentsRequired, []),
      externalLink: opp.externalLink,
      budget: opp.budget,
      budgetType: opp.budgetType as any,
      skills: safeJsonParse(opp.skills, []),
      deliverables: opp.deliverables,
      complexity: opp.complexity as any,
      expectedDuration: opp.expectedDuration,
      coverImage: opp.coverImage,
      gallery: safeJsonParse(opp.gallery, []),
      deliveryDays: opp.deliveryDays,
      revisionsCount: opp.revisionsCount,
      packages: safeJsonParse(opp.packages, null),
      servicesIncluded: opp.servicesIncluded,
      servicesExcluded: opp.servicesExcluded,
      faqs: safeJsonParse(opp.faqs, []),
      requirements: opp.requirements,
      workModality: opp.workModality as any,
      locationCountry: opp.locationCountry,
      locationState: opp.locationState,
      locationCity: opp.locationCity,
      language: opp.language,
      viewCount: opp.viewCount,
      createdAt: opp.createdAt,
      updatedAt: opp.updatedAt,
    }));

    return { opportunities };
  });

  // GET /api/opportunities/favorites - User favorites
  app.get('/api/opportunities/favorites', { preHandler: authenticate }, async (request) => {
    const userId = request.userId;
    const favs = db
      .select({
        opp: schema.opportunities,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunityFavorites)
      .innerJoin(schema.opportunities, eq(schema.opportunityFavorites.opportunityId, schema.opportunities.id))
      .innerJoin(schema.users, eq(schema.opportunities.userId, schema.users.id))
      .where(eq(schema.opportunityFavorites.userId, userId))
      .orderBy(desc(schema.opportunityFavorites.createdAt))
      .all();

    const opportunities: OpportunityItem[] = favs.map((f) => ({
      id: f.opp.id,
      userId: f.opp.userId,
      type: f.opp.type as any,
      title: f.opp.title,
      category: f.opp.category,
      description: f.opp.description,
      status: f.opp.status as any,
      companyName: f.opp.companyName,
      companyLogo: f.opp.companyLogo,
      creatorRole: f.opp.creatorRole as any,
      contractType: f.opp.contractType as any,
      remunerationType: f.opp.remunerationType as any,
      salaryMin: f.opp.salaryMin,
      salaryMax: f.opp.salaryMax,
      budget: f.opp.budget,
      budgetType: f.opp.budgetType as any,
      coverImage: f.opp.coverImage,
      workModality: f.opp.workModality as any,
      locationCity: f.opp.locationCity,
      locationState: f.opp.locationState,
      isFavorite: true,
      author: f.user,
      createdAt: f.opp.createdAt,
      updatedAt: f.opp.updatedAt,
    }));

    return { opportunities };
  });

  // GET /api/opportunities/:id - Get single opportunity
  app.get<{ Params: { id: string } }>('/api/opportunities/:id', async (request, reply) => {
    const { id } = request.params;
    const row = db
      .select({
        opp: schema.opportunities,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunities)
      .innerJoin(schema.users, eq(schema.opportunities.userId, schema.users.id))
      .where(eq(schema.opportunities.id, id))
      .get();

    if (!row) {
      return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');
    }

    // Increment view count asynchronously
    try {
      db.update(schema.opportunities)
        .set({ viewCount: sql`${schema.opportunities.viewCount} + 1` })
        .where(eq(schema.opportunities.id, id))
        .run();
    } catch {}

    const opp = row.opp;
    const item: OpportunityItem = {
      id: opp.id,
      userId: opp.userId,
      type: opp.type as any,
      title: opp.title,
      category: opp.category,
      description: opp.description,
      status: opp.status as any,
      companyName: opp.companyName,
      companyLogo: opp.companyLogo,
      creatorRole: opp.creatorRole as any,
      contractType: opp.contractType as any,
      responsibilities: opp.responsibilities,
      qualificationsMin: opp.qualificationsMin,
      qualificationsPref: opp.qualificationsPref,
      education: opp.education,
      experienceLevel: opp.experienceLevel as any,
      workSchedule: opp.workSchedule,
      remunerationType: opp.remunerationType as any,
      salaryMin: opp.salaryMin,
      salaryMax: opp.salaryMax,
      currency: opp.currency,
      benefits: safeJsonParse(opp.benefits, []),
      vacanciesCount: opp.vacanciesCount,
      deadline: opp.deadline,
      questions: safeJsonParse(opp.questions, []),
      documentsRequired: safeJsonParse(opp.documentsRequired, []),
      externalLink: opp.externalLink,
      budget: opp.budget,
      budgetType: opp.budgetType as any,
      skills: safeJsonParse(opp.skills, []),
      deliverables: opp.deliverables,
      complexity: opp.complexity as any,
      expectedDuration: opp.expectedDuration,
      coverImage: opp.coverImage,
      gallery: safeJsonParse(opp.gallery, []),
      deliveryDays: opp.deliveryDays,
      revisionsCount: opp.revisionsCount,
      packages: safeJsonParse(opp.packages, null),
      servicesIncluded: opp.servicesIncluded,
      servicesExcluded: opp.servicesExcluded,
      faqs: safeJsonParse(opp.faqs, []),
      requirements: opp.requirements,
      workModality: opp.workModality as any,
      locationCountry: opp.locationCountry,
      locationState: opp.locationState,
      locationCity: opp.locationCity,
      language: opp.language,
      viewCount: opp.viewCount + 1,
      author: row.user,
      createdAt: opp.createdAt,
      updatedAt: opp.updatedAt,
    };

    return { opportunity: item };
  });

  // POST /api/opportunities - Create opportunity
  app.post<{ Body: CreateOpportunityRequest }>('/api/opportunities', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.userId;
    const body = request.body;

    if (!body.title || !body.title.trim()) {
      return replyError(reply, 400, 'title_required', 'Título é obrigatório');
    }
    if (!body.category || !body.category.trim()) {
      return replyError(reply, 400, 'category_required', 'Categoria é obrigatória');
    }
    if (!body.description || !body.description.trim()) {
      return replyError(reply, 400, 'description_required', 'Descrição é obrigatória');
    }
    if (!['job', 'freelance', 'gig'].includes(body.type)) {
      return replyError(reply, 400, 'invalid_opportunity_type', 'Tipo de oportunidade inválido');
    }

    const now = Date.now();
    const id = generateSnowflake();

    db.insert(schema.opportunities)
      .values({
        id,
        userId,
        type: body.type,
        title: body.title.trim(),
        category: body.category.trim(),
        description: body.description.trim(),
        status: body.status || 'published',
        companyName: body.companyName?.trim() || null,
        companyLogo: body.companyLogo || null,
        creatorRole: body.creatorRole || 'individual',
        contractType: body.contractType || null,
        responsibilities: body.responsibilities?.trim() || null,
        qualificationsMin: body.qualificationsMin?.trim() || null,
        qualificationsPref: body.qualificationsPref?.trim() || null,
        education: body.education || null,
        experienceLevel: body.experienceLevel || null,
        workSchedule: body.workSchedule || null,
        remunerationType: body.remunerationType || 'negotiable',
        salaryMin: body.salaryMin !== undefined ? Number(body.salaryMin) : null,
        salaryMax: body.salaryMax !== undefined ? Number(body.salaryMax) : null,
        currency: body.currency || 'BRL',
        benefits: JSON.stringify(body.benefits || []),
        vacanciesCount: body.vacanciesCount || 1,
        deadline: body.deadline || null,
        questions: JSON.stringify(body.questions || []),
        documentsRequired: JSON.stringify(body.documentsRequired || []),
        externalLink: body.externalLink?.trim() || null,
        budget: body.budget !== undefined ? Number(body.budget) : null,
        budgetType: body.budgetType || null,
        skills: JSON.stringify(body.skills || []),
        deliverables: body.deliverables?.trim() || null,
        complexity: body.complexity || null,
        expectedDuration: body.expectedDuration || null,
        coverImage: body.coverImage || null,
        gallery: JSON.stringify(body.gallery || []),
        deliveryDays: body.deliveryDays || null,
        revisionsCount: body.revisionsCount || null,
        packages: body.packages ? JSON.stringify(body.packages) : null,
        servicesIncluded: body.servicesIncluded?.trim() || null,
        servicesExcluded: body.servicesExcluded?.trim() || null,
        faqs: JSON.stringify(body.faqs || []),
        requirements: body.requirements?.trim() || null,
        workModality: body.workModality || 'remote',
        locationCountry: body.locationCountry || null,
        locationState: body.locationState || null,
        locationCity: body.locationCity || null,
        language: body.language || 'pt',
        viewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
    return reply.status(201).send({ opportunity: created });
  });

  // PUT /api/opportunities/:id - Update opportunity
  app.put<{ Params: { id: string }; Body: Partial<CreateOpportunityRequest> }>(
    '/api/opportunities/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.userId;
      const body = request.body;

      const existing = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
      if (!existing) {
        return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');
      }

      // Check ownership
      const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      const isAdmin = !!user?.isAdmin;
      if (existing.userId !== userId && !isAdmin) {
        return replyError(reply, 403, 'permission_denied', 'Permissão negada');
      }

      const updates: Record<string, any> = { updatedAt: Date.now() };

      if (body.title !== undefined) updates.title = body.title.trim();
      if (body.category !== undefined) updates.category = body.category.trim();
      if (body.description !== undefined) updates.description = body.description.trim();
      if (body.status !== undefined) updates.status = body.status;
      if (body.companyName !== undefined) updates.companyName = body.companyName.trim();
      if (body.companyLogo !== undefined) updates.companyLogo = body.companyLogo;
      if (body.creatorRole !== undefined) updates.creatorRole = body.creatorRole;
      if (body.contractType !== undefined) updates.contractType = body.contractType;
      if (body.responsibilities !== undefined) updates.responsibilities = body.responsibilities;
      if (body.qualificationsMin !== undefined) updates.qualificationsMin = body.qualificationsMin;
      if (body.qualificationsPref !== undefined) updates.qualificationsPref = body.qualificationsPref;
      if (body.remunerationType !== undefined) updates.remunerationType = body.remunerationType;
      if (body.salaryMin !== undefined) updates.salaryMin = body.salaryMin;
      if (body.salaryMax !== undefined) updates.salaryMax = body.salaryMax;
      if (body.budget !== undefined) updates.budget = body.budget;
      if (body.budgetType !== undefined) updates.budgetType = body.budgetType;
      if (body.skills !== undefined) updates.skills = JSON.stringify(body.skills);
      if (body.packages !== undefined) updates.packages = JSON.stringify(body.packages);
      if (body.coverImage !== undefined) updates.coverImage = body.coverImage;
      if (body.gallery !== undefined) updates.gallery = JSON.stringify(body.gallery);
      if (body.workModality !== undefined) updates.workModality = body.workModality;
      if (body.locationCity !== undefined) updates.locationCity = body.locationCity;
      if (body.locationState !== undefined) updates.locationState = body.locationState;
      if (body.locationCountry !== undefined) updates.locationCountry = body.locationCountry;

      db.update(schema.opportunities)
        .set(updates)
        .where(eq(schema.opportunities.id, id))
        .run();

      const updated = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
      return { opportunity: updated };
    }
  );

  // POST /api/opportunities/:id/pause - Toggle pause status
  app.post<{ Params: { id: string } }>('/api/opportunities/:id/pause', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const existing = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
    if (!existing) return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');
    if (existing.userId !== userId) return replyError(reply, 403, 'permission_denied', 'Permissão negada');

    const nextStatus = existing.status === 'paused' ? 'published' : 'paused';
    db.update(schema.opportunities)
      .set({ status: nextStatus, updatedAt: Date.now() })
      .where(eq(schema.opportunities.id, id))
      .run();

    return { success: true, status: nextStatus };
  });

  // POST /api/opportunities/:id/close - Close opportunity
  app.post<{ Params: { id: string } }>('/api/opportunities/:id/close', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const existing = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
    if (!existing) return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');
    if (existing.userId !== userId) return replyError(reply, 403, 'permission_denied', 'Permissão negada');

    db.update(schema.opportunities)
      .set({ status: 'closed', updatedAt: Date.now() })
      .where(eq(schema.opportunities.id, id))
      .run();

    return { success: true, status: 'closed' };
  });

  // DELETE /api/opportunities/:id - Archive opportunity
  app.delete<{ Params: { id: string } }>('/api/opportunities/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const existing = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
    if (!existing) return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');
    if (existing.userId !== userId) return replyError(reply, 403, 'permission_denied', 'Permissão negada');

    db.update(schema.opportunities)
      .set({ status: 'archived', updatedAt: Date.now() })
      .where(eq(schema.opportunities.id, id))
      .run();

    return { success: true };
  });

  // POST /api/opportunities/:id/favorite - Toggle favorite
  app.post<{ Params: { id: string } }>('/api/opportunities/:id/favorite', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const existingFav = db
      .select()
      .from(schema.opportunityFavorites)
      .where(and(eq(schema.opportunityFavorites.userId, userId), eq(schema.opportunityFavorites.opportunityId, id)))
      .get();

    if (existingFav) {
      db.delete(schema.opportunityFavorites)
        .where(eq(schema.opportunityFavorites.id, existingFav.id))
        .run();
      return { isFavorite: false };
    } else {
      db.insert(schema.opportunityFavorites)
        .values({
          id: crypto.randomUUID(),
          userId,
          opportunityId: id,
          createdAt: Date.now(),
        })
        .run();
      return { isFavorite: true };
    }
  });

  // ─── 2. PROFESSIONAL PROFILES ───────────────────────────────────────────────

  // GET /api/opportunities/profile/me - Get current user's profile
  app.get('/api/opportunities/profile/me', { preHandler: authenticate }, async (request) => {
    const userId = request.userId;
    const prof = db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.userId, userId)).get();
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();

    if (!prof) {
      return {
        profile: {
          userId,
          roles: ['job_seeker'],
          skills: [],
          experiences: [],
          education: [],
          portfolio: [],
          languages: [],
          workPreference: 'any',
          isPublic: true,
          hideContactInfo: true,
          user: user ? sanitizeUser(user) : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
    }

    const profile: ProfessionalProfile = {
      userId: prof.userId,
      headline: prof.headline,
      bio: prof.bio,
      roles: safeJsonParse(prof.roles, ['job_seeker']),
      skills: safeJsonParse(prof.skills, []),
      experiences: safeJsonParse(prof.experiences, []),
      education: safeJsonParse(prof.education, []),
      portfolio: safeJsonParse(prof.portfolio, []),
      languages: safeJsonParse(prof.languages, []),
      location: prof.location,
      workPreference: prof.workPreference as any,
      expectedSalary: prof.expectedSalary,
      resumeUrl: prof.resumeUrl,
      resumeName: prof.resumeName,
      isPublic: Boolean(prof.isPublic),
      hideContactInfo: Boolean(prof.hideContactInfo),
      user: user ? sanitizeUser(user) : undefined,
      createdAt: prof.createdAt,
      updatedAt: prof.updatedAt,
    };

    return { profile };
  });

  // PUT /api/opportunities/profile/me - Update current user's profile
  app.put<{ Body: Partial<ProfessionalProfile> }>(
    '/api/opportunities/profile/me',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.userId;
      const b = request.body;
      const now = Date.now();

      const existing = db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.userId, userId)).get();

      const values = {
        userId,
        headline: b.headline !== undefined ? b.headline : (existing?.headline || null),
        bio: b.bio !== undefined ? b.bio : (existing?.bio || null),
        roles: b.roles ? JSON.stringify(b.roles) : (existing?.roles || '["job_seeker"]'),
        skills: b.skills ? JSON.stringify(b.skills) : (existing?.skills || '[]'),
        experiences: b.experiences ? JSON.stringify(b.experiences) : (existing?.experiences || '[]'),
        education: b.education ? JSON.stringify(b.education) : (existing?.education || '[]'),
        portfolio: b.portfolio ? JSON.stringify(b.portfolio) : (existing?.portfolio || '[]'),
        languages: b.languages ? JSON.stringify(b.languages) : (existing?.languages || '[]'),
        location: b.location !== undefined ? b.location : (existing?.location || null),
        workPreference: b.workPreference || existing?.workPreference || 'any',
        expectedSalary: b.expectedSalary !== undefined ? b.expectedSalary : (existing?.expectedSalary || null),
        resumeUrl: b.resumeUrl !== undefined ? b.resumeUrl : (existing?.resumeUrl || null),
        resumeName: b.resumeName !== undefined ? b.resumeName : (existing?.resumeName || null),
        isPublic: b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : (existing?.isPublic ?? 1),
        hideContactInfo: b.hideContactInfo !== undefined ? (b.hideContactInfo ? 1 : 0) : (existing?.hideContactInfo ?? 1),
        updatedAt: now,
      };

      if (existing) {
        db.update(schema.professionalProfiles)
          .set(values)
          .where(eq(schema.professionalProfiles.userId, userId))
          .run();
      } else {
        db.insert(schema.professionalProfiles)
          .values({ ...values, createdAt: now })
          .run();
      }

      const updated = db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.userId, userId)).get();
      const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();

      return {
        profile: {
          ...updated,
          roles: safeJsonParse(updated!.roles, ['job_seeker']),
          skills: safeJsonParse(updated!.skills, []),
          experiences: safeJsonParse(updated!.experiences, []),
          education: safeJsonParse(updated!.education, []),
          portfolio: safeJsonParse(updated!.portfolio, []),
          languages: safeJsonParse(updated!.languages, []),
          isPublic: Boolean(updated!.isPublic),
          hideContactInfo: Boolean(updated!.hideContactInfo),
          user: user ? sanitizeUser(user) : undefined,
        },
      };
    }
  );

  // GET /api/opportunities/profile/:userId - Get public profile
  app.get<{ Params: { userId: string } }>('/api/opportunities/profile/:userId', async (request, reply) => {
    const { userId } = request.params;
    const prof = db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.userId, userId)).get();
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();

    if (!user) {
      return replyError(reply, 404, 'user_not_found', 'Usuário não encontrado');
    }

    if (!prof || !prof.isPublic) {
      return {
        profile: {
          userId,
          roles: ['job_seeker'],
          skills: [],
          experiences: [],
          education: [],
          portfolio: [],
          languages: [],
          workPreference: 'any',
          isPublic: false,
          hideContactInfo: true,
          user: sanitizeUser(user),
          createdAt: user.createdAt,
          updatedAt: user.createdAt,
        },
      };
    }

    return {
      profile: {
        userId: prof.userId,
        headline: prof.headline,
        bio: prof.bio,
        roles: safeJsonParse(prof.roles, ['job_seeker']),
        skills: safeJsonParse(prof.skills, []),
        experiences: safeJsonParse(prof.experiences, []),
        education: safeJsonParse(prof.education, []),
        portfolio: safeJsonParse(prof.portfolio, []),
        languages: safeJsonParse(prof.languages, []),
        location: prof.location,
        workPreference: prof.workPreference,
        expectedSalary: prof.expectedSalary,
        resumeUrl: prof.hideContactInfo ? null : prof.resumeUrl,
        resumeName: prof.hideContactInfo ? null : prof.resumeName,
        isPublic: Boolean(prof.isPublic),
        hideContactInfo: Boolean(prof.hideContactInfo),
        user: sanitizeUser(user),
        createdAt: prof.createdAt,
        updatedAt: prof.updatedAt,
      },
    };
  });

  // ─── 3. APPLICATIONS, PROPOSALS & GIG ORDERS ────────────────────────────────

  // POST /api/opportunities/:id/apply - Apply or submit proposal
  app.post<{ Params: { id: string }; Body: ApplyOpportunityRequest }>(
    '/api/opportunities/:id/apply',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const applicantId = request.userId;
      const body = request.body;

      const opp = db.select().from(schema.opportunities).where(eq(schema.opportunities.id, id)).get();
      if (!opp) return replyError(reply, 404, 'opportunity_not_found', 'Oportunidade não encontrada');

      if (opp.userId === applicantId) {
        return replyError(reply, 400, 'cannot_apply_to_own_opportunity', 'Você não pode enviar uma candidatura ou proposta para sua própria publicação.');
      }

      // Check if there is already an active application
      const existingApp = db
        .select()
        .from(schema.opportunityApplications)
        .where(
          and(
            eq(schema.opportunityApplications.opportunityId, id),
            eq(schema.opportunityApplications.applicantId, applicantId),
            inArray(schema.opportunityApplications.status, ['submitted', 'viewed', 'under_review', 'chat_unlocked'])
          )
        )
        .get();

      if (existingApp) {
        return replyError(reply, 400, 'application_already_exists', 'Você já possui uma candidatura ou proposta ativa para esta oportunidade.');
      }

      let appType = 'job_application';
      if (opp.type === 'freelance') appType = 'freelance_proposal';
      else if (opp.type === 'gig') appType = 'gig_order';

      const applicationId = generateSnowflake();
      const now = Date.now();

      db.insert(schema.opportunityApplications)
        .values({
          id: applicationId,
          opportunityId: id,
          applicantId,
          targetUserId: opp.userId,
          type: appType,
          status: 'submitted',
          message: (body.message || '').trim(),
          proposedPrice: body.proposedPrice !== undefined ? Number(body.proposedPrice) : null,
          proposedDuration: body.proposedDuration || null,
          deliverables: body.deliverables || null,
          packageTier: body.packageTier || null,
          resumeUrl: body.resumeUrl || null,
          resumeName: body.resumeName || null,
          portfolioUrls: JSON.stringify(body.portfolioUrls || []),
          answers: JSON.stringify(body.answers || []),
          attachments: JSON.stringify(body.attachments || []),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Record initial presentation message into application messages thread
      const messageId = generateSnowflake();
      db.insert(schema.opportunityApplicationMessages)
        .values({
          id: messageId,
          applicationId,
          senderId: applicantId,
          content: (body.message || '').trim(),
          messageType: 'text',
          attachments: JSON.stringify(body.attachments || []),
          createdAt: now,
        })
        .run();

      // Notify target user via WebSocket
      connectionManager.sendToUser(opp.userId, {
        type: 'opportunity_application_created',
        applicationId,
        opportunityId: id,
        opportunityTitle: opp.title,
        applicantId,
        createdAt: now,
      });

      const created = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, applicationId)).get();
      return reply.status(201).send({ application: created });
    }
  );

  // GET /api/opportunities/applications - List sent or received applications
  app.get<{ Querystring: { as?: 'applicant' | 'recipient'; status?: string; type?: string } }>(
    '/api/opportunities/applications',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.userId;
      const { as = 'recipient', status, type } = request.query;

      const isRecipient = as === 'recipient';
      const userCondition = isRecipient
        ? eq(schema.opportunityApplications.targetUserId, userId)
        : eq(schema.opportunityApplications.applicantId, userId);

      const conditions = [userCondition];
      if (status && status !== 'all') {
        conditions.push(eq(schema.opportunityApplications.status, status));
      }
      if (type && type !== 'all') {
        conditions.push(eq(schema.opportunityApplications.type, type));
      }

      const rows = db
        .select({
          app: schema.opportunityApplications,
          opp: {
            id: schema.opportunities.id,
            title: schema.opportunities.title,
            type: schema.opportunities.type,
            category: schema.opportunities.category,
            companyName: schema.opportunities.companyName,
          },
          applicant: {
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatar: schema.users.avatar,
          },
        })
        .from(schema.opportunityApplications)
        .innerJoin(schema.opportunities, eq(schema.opportunityApplications.opportunityId, schema.opportunities.id))
        .innerJoin(schema.users, eq(schema.opportunityApplications.applicantId, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.opportunityApplications.createdAt))
        .all();

      // Count stats for user inbox
      const receivedCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.opportunityApplications)
        .where(eq(schema.opportunityApplications.targetUserId, userId))
        .get()?.count || 0;

      const sentCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.opportunityApplications)
        .where(eq(schema.opportunityApplications.applicantId, userId))
        .get()?.count || 0;

      const pendingReceived = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.opportunityApplications)
        .where(
          and(
            eq(schema.opportunityApplications.targetUserId, userId),
            inArray(schema.opportunityApplications.status, ['submitted', 'viewed'])
          )
        )
        .get()?.count || 0;

      const unlockedCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.opportunityApplications)
        .where(
          and(
            or(
              eq(schema.opportunityApplications.targetUserId, userId),
              eq(schema.opportunityApplications.applicantId, userId)
            ),
            eq(schema.opportunityApplications.status, 'chat_unlocked')
          )
        )
        .get()?.count || 0;

      const applications: OpportunityApplication[] = rows.map((r) => ({
        id: r.app.id,
        opportunityId: r.app.opportunityId,
        applicantId: r.app.applicantId,
        targetUserId: r.app.targetUserId,
        type: r.app.type as any,
        status: r.app.status as any,
        message: r.app.message,
        proposedPrice: r.app.proposedPrice,
        proposedDuration: r.app.proposedDuration,
        deliverables: r.app.deliverables,
        packageTier: r.app.packageTier as any,
        resumeUrl: r.app.resumeUrl,
        resumeName: r.app.resumeName,
        portfolioUrls: safeJsonParse(r.app.portfolioUrls, []),
        answers: safeJsonParse(r.app.answers, []),
        attachments: safeJsonParse(r.app.attachments, []),
        opportunity: r.opp as any,
        applicant: r.applicant,
        reviewedAt: r.app.reviewedAt,
        unlockedAt: r.app.unlockedAt,
        rejectedAt: r.app.rejectedAt,
        withdrawnAt: r.app.withdrawnAt,
        createdAt: r.app.createdAt,
        updatedAt: r.app.updatedAt,
      }));

      return {
        applications,
        counts: {
          received: receivedCount,
          sent: sentCount,
          pending: pendingReceived,
          unlocked: unlockedCount,
        },
      };
    }
  );

  // GET /api/opportunities/applications/:id - View single proposal details
  app.get<{ Params: { id: string } }>('/api/opportunities/applications/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const appRow = db
      .select({
        app: schema.opportunityApplications,
        opp: schema.opportunities,
        applicant: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunityApplications)
      .innerJoin(schema.opportunities, eq(schema.opportunityApplications.opportunityId, schema.opportunities.id))
      .innerJoin(schema.users, eq(schema.opportunityApplications.applicantId, schema.users.id))
      .where(eq(schema.opportunityApplications.id, id))
      .get();

    if (!appRow) {
      return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');
    }

    const { app: application, opp, applicant } = appRow;

    // Must be participant or admin
    if (application.applicantId !== userId && application.targetUserId !== userId) {
      const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      if (!user?.isAdmin) {
        return replyError(reply, 403, 'permission_denied', 'Permissão negada');
      }
    }

    // If recipient is viewing for the first time while submitted, transition to 'viewed'
    if (application.targetUserId === userId && application.status === 'submitted') {
      db.update(schema.opportunityApplications)
        .set({ status: 'viewed', reviewedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(schema.opportunityApplications.id, id))
        .run();
      application.status = 'viewed';
    }

    // Fetch messages in thread
    const msgRows = db
      .select({
        msg: schema.opportunityApplicationMessages,
        sender: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunityApplicationMessages)
      .innerJoin(schema.users, eq(schema.opportunityApplicationMessages.senderId, schema.users.id))
      .where(eq(schema.opportunityApplicationMessages.applicationId, id))
      .orderBy(asc(schema.opportunityApplicationMessages.createdAt))
      .all();

    const messages: OpportunityApplicationMessage[] = msgRows.map((m) => ({
      id: m.msg.id,
      applicationId: m.msg.applicationId,
      senderId: m.msg.senderId,
      content: m.msg.content,
      messageType: m.msg.messageType as any,
      attachments: safeJsonParse(m.msg.attachments, []),
      sender: m.sender,
      createdAt: m.msg.createdAt,
    }));

    // Fetch negotiations
    const negotiations = db
      .select()
      .from(schema.opportunityNegotiations)
      .where(eq(schema.opportunityNegotiations.applicationId, id))
      .orderBy(desc(schema.opportunityNegotiations.createdAt))
      .all();

    // Fetch applicant professional profile
    const applicantProfile = db
      .select()
      .from(schema.professionalProfiles)
      .where(eq(schema.professionalProfiles.userId, application.applicantId))
      .get();

    return {
      application: {
        ...application,
        portfolioUrls: safeJsonParse(application.portfolioUrls, []),
        answers: safeJsonParse(application.answers, []),
        attachments: safeJsonParse(application.attachments, []),
      },
      opportunity: opp,
      applicant,
      applicantProfile: applicantProfile
        ? {
            headline: applicantProfile.headline,
            bio: applicantProfile.bio,
            skills: safeJsonParse(applicantProfile.skills, []),
            experiences: safeJsonParse(applicantProfile.experiences, []),
            portfolio: safeJsonParse(applicantProfile.portfolio, []),
            education: safeJsonParse(applicantProfile.education, []),
          }
        : null,
      messages,
      negotiations,
    };
  });

  // POST /api/opportunities/applications/:id/accept - Recipient accepts proposal -> UNLOCKS CHAT
  app.post<{ Params: { id: string } }>('/api/opportunities/applications/:id/accept', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

    if (application.targetUserId !== userId) {
      return replyError(reply, 403, 'only_recipient_can_accept_proposal', 'Apenas o destinatário pode aceitar a proposta');
    }

    if (application.status === 'chat_unlocked') {
      return { success: true, application, message: 'Chat already unlocked' };
    }

    const now = Date.now();
    db.update(schema.opportunityApplications)
      .set({
        status: 'chat_unlocked',
        unlockedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.opportunityApplications.id, id))
      .run();

    // Add unlock system message into thread
    const sysMsgId = generateSnowflake();
    db.insert(schema.opportunityApplicationMessages)
      .values({
        id: sysMsgId,
        applicationId: id,
        senderId: userId,
        content: 'A proposta foi aceita! O chat profissional está desbloqueado para ambas as partes.',
        messageType: 'system',
        attachments: '[]',
        createdAt: now,
      })
      .run();

    // Notify applicant via WebSocket
    connectionManager.sendToUser(application.applicantId, {
      type: 'opportunity_chat_unlocked',
      applicationId: id,
      unlockedAt: now,
    });

    const updated = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    return { success: true, application: updated };
  });

  // POST /api/opportunities/applications/:id/reject - Recipient rejects proposal
  app.post<{ Params: { id: string } }>('/api/opportunities/applications/:id/reject', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

    if (application.targetUserId !== userId) {
      return replyError(reply, 403, 'only_recipient_can_reject_proposal', 'Apenas o destinatário pode recusar a proposta');
    }

    const now = Date.now();
    db.update(schema.opportunityApplications)
      .set({
        status: 'rejected',
        rejectedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.opportunityApplications.id, id))
      .run();

    // Add system message
    const sysMsgId = generateSnowflake();
    db.insert(schema.opportunityApplicationMessages)
      .values({
        id: sysMsgId,
        applicationId: id,
        senderId: userId,
        content: 'A solicitação foi recusada pelo destinatário.',
        messageType: 'system',
        attachments: '[]',
        createdAt: now,
      })
      .run();

    // Notify applicant
    connectionManager.sendToUser(application.applicantId, {
      type: 'opportunity_application_updated',
      applicationId: id,
      status: 'rejected',
      rejectedAt: now,
    });

    const updated = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    return { success: true, application: updated };
  });

  // POST /api/opportunities/applications/:id/withdraw - Applicant withdraws
  app.post<{ Params: { id: string } }>('/api/opportunities/applications/:id/withdraw', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

    if (application.applicantId !== userId) {
      return replyError(reply, 403, 'only_applicant_can_withdraw', 'Apenas o autor pode retirar sua candidatura');
    }

    const now = Date.now();
    db.update(schema.opportunityApplications)
      .set({
        status: 'withdrawn',
        withdrawnAt: now,
        updatedAt: now,
      })
      .where(eq(schema.opportunityApplications.id, id))
      .run();

    return { success: true };
  });

  // ─── 4. GATED CHAT IN PROPOSAL THREAD ───────────────────────────────────────

  // GET /api/opportunities/applications/:id/messages
  app.get<{ Params: { id: string } }>('/api/opportunities/applications/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
    if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

    if (application.applicantId !== userId && application.targetUserId !== userId) {
      return replyError(reply, 403, 'permission_denied', 'Permissão negada');
    }

    const rows = db
      .select({
        msg: schema.opportunityApplicationMessages,
        sender: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.opportunityApplicationMessages)
      .innerJoin(schema.users, eq(schema.opportunityApplicationMessages.senderId, schema.users.id))
      .where(eq(schema.opportunityApplicationMessages.applicationId, id))
      .orderBy(asc(schema.opportunityApplicationMessages.createdAt))
      .all();

    const messages: OpportunityApplicationMessage[] = rows.map((m) => ({
      id: m.msg.id,
      applicationId: m.msg.applicationId,
      senderId: m.msg.senderId,
      content: m.msg.content,
      messageType: m.msg.messageType as any,
      attachments: safeJsonParse(m.msg.attachments, []),
      sender: m.sender,
      createdAt: m.msg.createdAt,
    }));

    return { messages };
  });

  // POST /api/opportunities/applications/:id/messages - Send message in thread
  // **CRITICAL BACKEND SECURITY ENFORCEMENT**: Chat is strictly locked until recipient accepts!
  app.post<{ Params: { id: string }; Body: { content: string; messageType?: string; attachments?: any[] } }>(
    '/api/opportunities/applications/:id/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.userId;
      const { content, messageType = 'text', attachments = [] } = request.body;

      const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
      if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

      if (application.applicantId !== userId && application.targetUserId !== userId) {
        return replyError(reply, 403, 'permission_denied', 'Permissão negada');
      }

      // STRICT BACKEND LOCK: Chat MUST be accepted before regular messages/files can be sent!
      if (application.status !== 'chat_unlocked') {
        return reply.status(403).send({
          error: 'chat_locked_pending_approval',
          message: 'O chat está bloqueado até que o destinatário aprove a proposta.',
        });
      }

      if (!content || !content.trim()) {
        return replyError(reply, 400, 'message_content_required', 'Conteúdo da mensagem é obrigatório');
      }

      const msgId = generateSnowflake();
      const now = Date.now();
      const resolvedMessageType = (['text', 'system', 'proposal_terms', 'audio', 'file'].includes(messageType) ? messageType : 'text') as any;

      db.insert(schema.opportunityApplicationMessages)
        .values({
          id: msgId,
          applicationId: id,
          senderId: userId,
          content: content.trim(),
          messageType: resolvedMessageType,
          attachments: JSON.stringify(attachments),
          createdAt: now,
        })
        .run();

      const sender = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      const recipientId = application.applicantId === userId ? application.targetUserId : application.applicantId;

      // Broadcast message event to recipient
      connectionManager.sendToUser(recipientId, {
        type: 'opportunity_application_message_created',
        message: {
          id: msgId,
          applicationId: id,
          senderId: userId,
          content: content.trim(),
          messageType: resolvedMessageType,
          attachments,
          sender: sender ? sanitizeUser(sender) : undefined,
          createdAt: now,
        },
      });

      return reply.status(201).send({
        message: {
          id: msgId,
          applicationId: id,
          senderId: userId,
          content: content.trim(),
          messageType: resolvedMessageType,
          attachments,
          sender: sender ? sanitizeUser(sender) : undefined,
          createdAt: now,
        },
      });
    }
  );

  // ─── 5. NEGOTIATION & COUNTER-PROPOSALS ─────────────────────────────────────

  // POST /api/opportunities/applications/:id/negotiate - Propose terms or counter-offer
  app.post<{ Params: { id: string }; Body: NegotiateOpportunityRequest }>(
    '/api/opportunities/applications/:id/negotiate',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const senderId = request.userId;
      const body = request.body;

      const application = db.select().from(schema.opportunityApplications).where(eq(schema.opportunityApplications.id, id)).get();
      if (!application) return replyError(reply, 404, 'application_not_found', 'Candidatura ou proposta não encontrada');

      if (application.applicantId !== senderId && application.targetUserId !== senderId) {
        return replyError(reply, 403, 'permission_denied', 'Permissão negada');
      }

      if (application.status !== 'chat_unlocked') {
        return reply.status(403).send({
          error: 'chat_locked_pending_approval',
          message: 'Negociações só podem ser enviadas após a liberação do chat.',
        });
      }

      const receiverId = application.applicantId === senderId ? application.targetUserId : application.applicantId;

      // Find highest previous version
      const latestNeg = db
        .select()
        .from(schema.opportunityNegotiations)
        .where(eq(schema.opportunityNegotiations.applicationId, id))
        .orderBy(desc(schema.opportunityNegotiations.version))
        .get();

      const version = (latestNeg?.version || 0) + 1;
      const negId = generateSnowflake();
      const now = Date.now();

      db.insert(schema.opportunityNegotiations)
        .values({
          id: negId,
          applicationId: id,
          senderId,
          receiverId,
          status: 'pending',
          price: body.price !== undefined ? Number(body.price) : null,
          deadline: body.deadline || null,
          scope: body.scope || null,
          deliverables: body.deliverables || null,
          revisions: body.revisions !== undefined ? Number(body.revisions) : null,
          notes: body.notes || null,
          version,
          parentNegotiationId: latestNeg?.id || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Post proposal terms notification message in thread
      const msgId = generateSnowflake();
      db.insert(schema.opportunityApplicationMessages)
        .values({
          id: msgId,
          applicationId: id,
          senderId,
          content: `Proposta de termos enviada (versão #${version}).`,
          messageType: 'proposal_terms',
          attachments: JSON.stringify([{ type: 'negotiation', id: negId, version, price: body.price }]),
          createdAt: now,
        })
        .run();

      // Notify receiver
      connectionManager.sendToUser(receiverId, {
        type: 'opportunity_negotiation_updated',
        negotiationId: negId,
        applicationId: id,
        status: 'pending',
        version,
      });

      const created = db.select().from(schema.opportunityNegotiations).where(eq(schema.opportunityNegotiations.id, negId)).get();
      return reply.status(201).send({ negotiation: created });
    }
  );

  // POST /api/opportunities/negotiations/:id/accept - Accept negotiation
  app.post<{ Params: { id: string } }>('/api/opportunities/negotiations/:id/accept', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const neg = db.select().from(schema.opportunityNegotiations).where(eq(schema.opportunityNegotiations.id, id)).get();
    if (!neg) return replyError(reply, 404, 'negotiation_not_found', 'Negociação não encontrada');

    if (neg.receiverId !== userId) {
      return replyError(reply, 403, 'only_counterpart_can_accept_terms', 'Apenas a contraparte pode aceitar os termos');
    }

    const now = Date.now();
    db.update(schema.opportunityNegotiations)
      .set({ status: 'accepted', updatedAt: now })
      .where(eq(schema.opportunityNegotiations.id, id))
      .run();

    // Insert system message
    const msgId = generateSnowflake();
    db.insert(schema.opportunityApplicationMessages)
      .values({
        id: msgId,
        applicationId: neg.applicationId,
        senderId: userId,
        content: `Condições acordadas aceitas por ambas as partes (versão #${neg.version}).`,
        messageType: 'system',
        attachments: '[]',
        createdAt: now,
      })
      .run();

    connectionManager.sendToUser(neg.senderId, {
      type: 'opportunity_negotiation_updated',
      negotiationId: id,
      applicationId: neg.applicationId,
      status: 'accepted',
    });

    const updated = db.select().from(schema.opportunityNegotiations).where(eq(schema.opportunityNegotiations.id, id)).get();
    return { success: true, negotiation: updated };
  });

  // POST /api/opportunities/negotiations/:id/decline - Decline negotiation
  app.post<{ Params: { id: string } }>('/api/opportunities/negotiations/:id/decline', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    const neg = db.select().from(schema.opportunityNegotiations).where(eq(schema.opportunityNegotiations.id, id)).get();
    if (!neg) return replyError(reply, 404, 'negotiation_not_found', 'Negociação não encontrada');

    if (neg.receiverId !== userId) {
      return replyError(reply, 403, 'only_counterpart_can_decline_terms', 'Apenas a contraparte pode recusar os termos');
    }

    const now = Date.now();
    db.update(schema.opportunityNegotiations)
      .set({ status: 'declined', updatedAt: now })
      .where(eq(schema.opportunityNegotiations.id, id))
      .run();

    // Insert system message
    const msgId = generateSnowflake();
    db.insert(schema.opportunityApplicationMessages)
      .values({
        id: msgId,
        applicationId: neg.applicationId,
        senderId: userId,
        content: `Os termos propostos (versão #${neg.version}) foram recusados.`,
        messageType: 'system',
        attachments: '[]',
        createdAt: now,
      })
      .run();

    connectionManager.sendToUser(neg.senderId, {
      type: 'opportunity_negotiation_updated',
      negotiationId: id,
      applicationId: neg.applicationId,
      status: 'declined',
    });

    const updated = db.select().from(schema.opportunityNegotiations).where(eq(schema.opportunityNegotiations.id, id)).get();
    return { success: true, negotiation: updated };
  });

  // ─── 6. REPORTING & MODERATION ──────────────────────────────────────────────

  // POST /api/opportunities/report - Report suspicious listing or proposal
  app.post<{ Body: OpportunityReportRequest }>('/api/opportunities/report', { preHandler: authenticate }, async (request, reply) => {
    const reporterId = request.userId;
    const { targetType, targetId, reason, details } = request.body;

    if (!targetType || !targetId || !reason) {
      return replyError(reply, 400, 'missing_required_report_fields', 'Campos obrigatórios de denúncia ausentes');
    }

    db.insert(schema.opportunityReports)
      .values({
        id: crypto.randomUUID(),
        reporterId,
        targetType,
        targetId,
        reason,
        details: details || null,
        status: 'pending',
        createdAt: Date.now(),
      })
      .run();

    return reply.status(201).send({ success: true, message: 'Denúncia registrada para análise pela moderação.' });
  });

  // GET /api/opportunities/admin/reports - Admin moderation list
  app.get('/api/opportunities/admin/reports', { preHandler: [authenticate, requireAdmin] }, async () => {
    const reports = db
      .select({
        rep: schema.opportunityReports,
        reporter: {
          id: schema.users.id,
          username: schema.users.username,
        },
      })
      .from(schema.opportunityReports)
      .innerJoin(schema.users, eq(schema.opportunityReports.reporterId, schema.users.id))
      .orderBy(desc(schema.opportunityReports.createdAt))
      .all();

    return { reports };
  });

  // ─── 7. FILE UPLOADS (RESUME, PORTFOLIO, ATTACHMENTS) ────────────────────────

  app.post('/api/opportunities/upload', { preHandler: authenticate }, async (request, reply) => {
    const isMultipart = typeof request.isMultipart === 'function' ? request.isMultipart() : false;
    if (!isMultipart) {
      return replyError(reply, 400, 'multipart_required', 'Formato multipart obrigatório');
    }

    const parts = request.parts();
    let savedFile: { url: string; filename: string; size: number; originalName: string; mimetype: string } | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        const originalName = part.filename;
        const ext = path.extname(originalName).toLowerCase();
        const allowedExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.txt'];

        if (!allowedExts.includes(ext)) {
          return replyError(reply, 400, 'invalid_file_type', `Extensão não permitida: ${ext}. Use PDF, DOC, DOCX, imagens ou ZIP.`);
        }

        const safeFilename = `opp_${crypto.randomBytes(12).toString('hex')}${ext}`;
        const savePath = path.join(config.uploadDir, safeFilename);

        const writeStream = fs.createWriteStream(savePath);
        await pipeline(part.file, writeStream);

        const stat = fs.statSync(savePath);
        savedFile = {
          url: `/api/uploads/${safeFilename}`,
          filename: safeFilename,
          size: stat.size,
          originalName,
          mimetype: part.mimetype,
        };
        break;
      }
    }

    if (!savedFile) {
      return replyError(reply, 400, 'no_file_uploaded', 'Nenhum arquivo enviado');
    }

    return reply.status(201).send(savedFile);
  });
}
