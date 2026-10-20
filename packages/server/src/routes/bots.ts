import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { eq, and, desc, asc, like, or, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { connectionManager } from '../ws/handler.js';
import { generateSnowflake } from '../utils/snowflake.js';
import {
  isMember,
  isSpaceOwner,
  hasPermission,
  PermissionBits,
  getChannelSpaceId,
} from '../utils/permissions.js';
import { buildMessageWithUser } from './messages.js';
import type {
  Bot,
  BotCommand,
  BotInstallation,
  BotReview,
  BotStatus,
  MemberWithUser,
} from '@concord/shared';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function formatBot(
  row: typeof schema.bots.$inferSelect,
  developerUser?: typeof schema.users.$inferSelect | null,
  includeSecret = false
): Bot & { botToken?: string; webhookSecret?: string } {
  let commands: BotCommand[] = [];
  try {
    commands = JSON.parse(row.commands || '[]');
  } catch {
    commands = [];
  }

  let requiredPermissions: string[] = [];
  try {
    requiredPermissions = JSON.parse(row.requiredPermissions || '[]');
  } catch {
    requiredPermissions = [];
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }

  let categories: string[] = [];
  try {
    categories = JSON.parse(row.categories || '[]');
  } catch {
    categories = [];
  }

  let layoutData: any[] = [];
  try {
    layoutData = JSON.parse(row.layoutData || '[]');
  } catch {
    layoutData = [];
  }

  const bot: any = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description || '',
    avatar: row.avatar,
    banner: row.banner,
    developerId: row.developerId,
    developer: developerUser
      ? {
          id: developerUser.id,
          username: developerUser.username,
          displayName: developerUser.displayName,
          avatar: developerUser.avatar,
        }
      : null,
    botUserId: row.botUserId,
    status: row.status as BotStatus,
    isVerified: row.isVerified === 1,
    isOfficial: row.isOfficial === 1,
    prefix: row.prefix || '/',
    websiteUrl: row.websiteUrl,
    supportUrl: row.supportUrl,
    privacyPolicyUrl: row.privacyPolicyUrl,
    webhookUrl: row.webhookUrl,
    requiredPermissions,
    tags,
    categories,
    commands,
    layoutData,
    customCss: row.customCss || '',
    installCount: row.installCount || 0,
    ratingAverage: row.ratingAverage || 5.0,
    ratingCount: row.ratingCount || 0,
    version: row.version || '1.0.0',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (includeSecret) {
    bot.botToken = row.botToken ?? undefined;
    bot.webhookSecret = row.webhookSecret ?? undefined;
  }

  return bot;
}

export async function botsRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // ─── PUBLIC: CATEGORIES ──────────────────────────────────────────────────
  app.get('/api/bots/categories', async () => {
    const categories = db
      .select()
      .from(schema.botCategories)
      .orderBy(asc(schema.botCategories.sortOrder))
      .all();
    return { categories };
  });

  // ─── PUBLIC: CATALOG SEARCH & LISTING ────────────────────────────────────
  app.get<{
    Querystring: {
      search?: string;
      category?: string;
      sort?: 'featured' | 'popular' | 'newest' | 'top_rated';
      limit?: string;
      offset?: string;
    };
  }>('/api/bots', async (request) => {
    const { search, category, sort = 'featured', limit = '24', offset = '0' } = request.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 60);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    let query = db
      .select({
        bot: schema.bots,
        developer: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.bots)
      .leftJoin(schema.users, eq(schema.bots.developerId, schema.users.id));

    const conditions: any[] = [
      or(eq(schema.bots.status, 'published'), eq(schema.bots.status, 'approved')),
    ];

    if (category && category !== 'all') {
      conditions.push(like(schema.bots.categories, `%"${category}"%`));
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${schema.bots.name})`, q),
          like(sql`LOWER(${schema.bots.tagline})`, q),
          like(sql`LOWER(${schema.bots.description})`, q),
          like(sql`LOWER(${schema.bots.tags})`, q),
          like(sql`LOWER(${schema.bots.commands})`, q)
        )
      );
    }

    const whereClause = and(...conditions);

    let orderByClause;
    switch (sort) {
      case 'popular':
        orderByClause = desc(schema.bots.installCount);
        break;
      case 'newest':
        orderByClause = desc(schema.bots.createdAt);
        break;
      case 'top_rated':
        orderByClause = desc(schema.bots.ratingAverage);
        break;
      case 'featured':
      default:
        orderByClause = desc(schema.bots.isVerified);
        break;
    }

    const rows = query
      .where(whereClause)
      .orderBy(orderByClause, desc(schema.bots.installCount))
      .limit(lim)
      .offset(off)
      .all();

    const countRow = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bots)
      .where(whereClause)
      .get();

    const bots = rows.map((r) => formatBot(r.bot, r.developer as any, false));

    return {
      bots,
      total: countRow?.count ?? bots.length,
      limit: lim,
      offset: off,
    };
  });

  // ─── PUBLIC: BOT DETAIL BY SLUG OR ID ───────────────────────────────────
  app.get<{
    Params: { slugOrId: string };
  }>('/api/bots/:slugOrId', async (request, reply) => {
    const { slugOrId } = request.params;

    const row = db
      .select({
        bot: schema.bots,
        developer: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.bots)
      .leftJoin(schema.users, eq(schema.bots.developerId, schema.users.id))
      .where(or(eq(schema.bots.id, slugOrId), eq(schema.bots.slug, slugOrId)))
      .get();

    if (!row) {
      return sendError(reply, 404, 'not_found');
    }

    const bot = formatBot(row.bot, row.developer as any, false);
    return { bot };
  });

  // ─── PUBLIC: BOT REVIEWS ────────────────────────────────────────────────
  app.get<{
    Params: { id: string };
  }>('/api/bots/:id/reviews', async (request) => {
    const { id } = request.params;

    const reviews = db
      .select({
        review: schema.botReviews,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.botReviews)
      .leftJoin(schema.users, eq(schema.botReviews.userId, schema.users.id))
      .where(eq(schema.botReviews.botId, id))
      .orderBy(desc(schema.botReviews.createdAt))
      .all();

    return {
      reviews: reviews.map((r) => ({
        ...r.review,
        user: r.user,
      })),
    };
  });

  // ─── AUTHENTICATED: POST BOT REVIEW ─────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { rating: number; comment?: string };
  }>(
    '/api/bots/:id/reviews',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { rating, comment = '' } = request.body || {};

      if (!rating || rating < 1 || rating > 5) {
        return sendError(reply, 400, 'validation_failed');
      }

      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();
      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      // Check if user has installed this bot or is in a space where it is installed
      const installation = db
        .select()
        .from(schema.botInstallations)
        .where(
          and(
            eq(schema.botInstallations.botId, id),
            eq(schema.botInstallations.installedBy, request.userId)
          )
        )
        .get();

      if (!installation) {
        // Also check if member of any space where bot is installed
        const userSpaces = db
          .select({ spaceId: schema.spaceMembers.spaceId })
          .from(schema.spaceMembers)
          .where(eq(schema.spaceMembers.userId, request.userId))
          .all()
          .map((s) => s.spaceId);

        const spaceInstalled = userSpaces.length > 0
          ? db
              .select({ id: schema.botInstallations.id })
              .from(schema.botInstallations)
              .where(
                and(
                  eq(schema.botInstallations.botId, id),
                  inArray(schema.botInstallations.spaceId, userSpaces)
                )
              )
              .get()
          : null;

        if (!spaceInstalled) {
          return reply.code(403).send({
            error: 'Você só pode avaliar bots instalados em espaços que você participa.',
            code: 'forbidden',
            statusCode: 403,
          });
        }
      }

      const existingReview = db
        .select()
        .from(schema.botReviews)
        .where(
          and(
            eq(schema.botReviews.botId, id),
            eq(schema.botReviews.userId, request.userId)
          )
        )
        .get();

      const now = Date.now();
      if (existingReview) {
        db.update(schema.botReviews)
          .set({
            rating: Math.round(rating),
            comment: (comment || '').trim(),
            updatedAt: now,
          })
          .where(eq(schema.botReviews.id, existingReview.id))
          .run();
      } else {
        const reviewId = `rev_${generateSnowflake()}`;
        db.insert(schema.botReviews)
          .values({
            id: reviewId,
            botId: id,
            userId: request.userId,
            rating: Math.round(rating),
            comment: (comment || '').trim(),
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      // Recalculate average rating
      const allBotReviews = db
        .select({ rating: schema.botReviews.rating })
        .from(schema.botReviews)
        .where(eq(schema.botReviews.botId, id))
        .all();

      const ratingCount = allBotReviews.length;
      const ratingAverage =
        ratingCount > 0
          ? Number(
              (
                allBotReviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount
              ).toFixed(1)
            )
          : 5.0;

      db.update(schema.bots)
        .set({ ratingAverage, ratingCount, updatedAt: now })
        .where(eq(schema.bots.id, id))
        .run();

      return { success: true, ratingAverage, ratingCount };
    }
  );

  // ─── AUTHENTICATED: LIST BOTS INSTALLED IN A SPACE ──────────────────────
  app.get<{
    Params: { spaceId: string };
  }>(
    '/api/spaces/:spaceId/bots',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (!isMember(spaceId, request.userId)) {
        return sendError(reply, 403, 'forbidden');
      }

      const installations = db
        .select({
          installation: schema.botInstallations,
          bot: schema.bots,
          developer: {
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatar: schema.users.avatar,
          },
        })
        .from(schema.botInstallations)
        .innerJoin(schema.bots, eq(schema.botInstallations.botId, schema.bots.id))
        .leftJoin(schema.users, eq(schema.bots.developerId, schema.users.id))
        .where(eq(schema.botInstallations.spaceId, spaceId))
        .all();

      const list = installations.map((r) => {
        let grantedPermissions: string[] = [];
        try {
          grantedPermissions = JSON.parse(r.installation.grantedPermissions || '[]');
        } catch {
          grantedPermissions = [];
        }

        return {
          ...r.installation,
          grantedPermissions,
          bot: formatBot(r.bot, r.developer as any, false),
        };
      });

      return { bots: list };
    }
  );

  // ─── AUTHENTICATED: INSTALL BOT IN A SPACE ──────────────────────────────
  app.post<{
    Params: { spaceId: string; botId: string };
    Body: { grantedPermissions?: string[] };
  }>(
    '/api/spaces/:spaceId/bots/:botId/install',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId, botId } = request.params;
      const { grantedPermissions = [] } = request.body || {};

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return sendError(reply, 404, 'not_found');
      }

      // Check permission: Owner or MANAGE_SPACE or ADMINISTRATOR
      const canManage =
        space.ownerId === request.userId ||
        hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
        hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

      if (!canManage) {
        return sendError(reply, 403, 'forbidden');
      }

      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      if (bot.status === 'suspended') {
        return reply.code(400).send({
          error: 'Este bot está temporariamente suspenso pela administração.',
          code: 'bot_suspended',
          statusCode: 400,
        });
      }

      const now = Date.now();
      const existingInstall = db
        .select()
        .from(schema.botInstallations)
        .where(
          and(
            eq(schema.botInstallations.spaceId, spaceId),
            eq(schema.botInstallations.botId, botId)
          )
        )
        .get();

      let installationId = existingInstall?.id;

      if (existingInstall) {
        // Update permissions & reactivate
        db.update(schema.botInstallations)
          .set({
            grantedPermissions: JSON.stringify(grantedPermissions),
            status: 'active',
            updatedAt: now,
          })
          .where(eq(schema.botInstallations.id, existingInstall.id))
          .run();
      } else {
        installationId = `binst_${generateSnowflake()}`;
        db.insert(schema.botInstallations)
          .values({
            id: installationId,
            botId,
            spaceId,
            installedBy: request.userId,
            grantedPermissions: JSON.stringify(grantedPermissions),
            status: 'active',
            installedAt: now,
            updatedAt: now,
          })
          .run();

        // Increment install count
        db.update(schema.bots)
          .set({
            installCount: sql`${schema.bots.installCount} + 1`,
            updatedAt: now,
          })
          .where(eq(schema.bots.id, botId))
          .run();
      }

      // If bot has an associated user, ensure it is added to space_members
      if (bot.botUserId) {
        const botUser = db.select().from(schema.users).where(eq(schema.users.id, bot.botUserId)).get();
        if (botUser) {
          const isAlreadyMember = db
            .select()
            .from(schema.spaceMembers)
            .where(
              and(
                eq(schema.spaceMembers.spaceId, spaceId),
                eq(schema.spaceMembers.userId, bot.botUserId)
              )
            )
            .get();

          if (!isAlreadyMember) {
            db.insert(schema.spaceMembers)
              .values({
                spaceId,
                userId: bot.botUserId,
                joinedAt: now,
              })
              .run();

            connectionManager.addUserSpace(bot.botUserId, spaceId);

            const memberPayload: MemberWithUser = {
              spaceId,
              userId: bot.botUserId,
              nickname: null,
              joinedAt: now,
              user: sanitizeUser(botUser),
              roles: [],
            };

            connectionManager.sendToSpace(spaceId, {
              type: 'member_joined',
              spaceId,
              member: memberPayload,
            });
          }
        }
      }

      const formattedBot = formatBot(bot, null, false);

      // Broadcast bot_installed event
      connectionManager.sendToSpace(spaceId, {
        type: 'bot_installed',
        spaceId,
        botId,
        bot: formattedBot,
      });

      // Audit log entry
      const auditLogId = `audit_${generateSnowflake()}`;
      db.insert(schema.auditLogs)
        .values({
          id: auditLogId,
          spaceId,
          actorId: request.userId,
          targetId: botId,
          action: 'bot_installed',
          reason: `Bot ${bot.name} instalado`,
          details: JSON.stringify({ botId, botName: bot.name, permissions: grantedPermissions }),
          createdAt: now,
        })
        .run();

      return {
        success: true,
        installationId,
        bot: formattedBot,
      };
    }
  );

  // ─── AUTHENTICATED: UNINSTALL BOT FROM A SPACE ──────────────────────────
  app.delete<{
    Params: { spaceId: string; botId: string };
  }>(
    '/api/spaces/:spaceId/bots/:botId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId, botId } = request.params;

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return sendError(reply, 404, 'not_found');
      }

      const canManage =
        space.ownerId === request.userId ||
        hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
        hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

      if (!canManage) {
        return sendError(reply, 403, 'forbidden');
      }

      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      db.delete(schema.botInstallations)
        .where(
          and(
            eq(schema.botInstallations.spaceId, spaceId),
            eq(schema.botInstallations.botId, botId)
          )
        )
        .run();

      // Decrement install count
      db.update(schema.bots)
        .set({
          installCount: sql`MAX(0, ${schema.bots.installCount} - 1)`,
          updatedAt: Date.now(),
        })
        .where(eq(schema.bots.id, botId))
        .run();

      // Remove bot user from space members
      if (bot.botUserId) {
        db.delete(schema.spaceMembers)
          .where(
            and(
              eq(schema.spaceMembers.spaceId, spaceId),
              eq(schema.spaceMembers.userId, bot.botUserId)
            )
          )
          .run();

        connectionManager.sendToSpace(spaceId, {
          type: 'member_left',
          spaceId,
          userId: bot.botUserId,
        });
      }

      connectionManager.sendToSpace(spaceId, {
        type: 'bot_uninstalled',
        spaceId,
        botId,
      });

      // Audit log
      const auditLogId = `audit_${generateSnowflake()}`;
      db.insert(schema.auditLogs)
        .values({
          id: auditLogId,
          spaceId,
          actorId: request.userId,
          targetId: botId,
          action: 'bot_uninstalled',
          reason: `Bot ${bot.name} removido do espaço`,
          details: JSON.stringify({ botId, botName: bot.name }),
          createdAt: Date.now(),
        })
        .run();

      return { success: true };
    }
  );

  // ─── AUTHENTICATED: UPDATE BOT PERMISSIONS IN A SPACE ───────────────────
  app.patch<{
    Params: { spaceId: string; botId: string };
    Body: { grantedPermissions: string[] };
  }>(
    '/api/spaces/:spaceId/bots/:botId/permissions',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { spaceId, botId } = request.params;
      const { grantedPermissions } = request.body || {};

      const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
      if (!space) {
        return sendError(reply, 404, 'not_found');
      }

      const canManage =
        space.ownerId === request.userId ||
        hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
        hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

      if (!canManage) {
        return sendError(reply, 403, 'forbidden');
      }

      db.update(schema.botInstallations)
        .set({
          grantedPermissions: JSON.stringify(grantedPermissions || []),
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(schema.botInstallations.spaceId, spaceId),
            eq(schema.botInstallations.botId, botId)
          )
        )
        .run();

      return { success: true };
    }
  );

  // ─── DEVELOPER PORTAL: GET MY BOTS ───────────────────────────────────────
  app.get(
    '/api/developers/bots',
    { preHandler: [authenticate] },
    async (request) => {
      const myBots = db
        .select()
        .from(schema.bots)
        .where(eq(schema.bots.developerId, request.userId))
        .orderBy(desc(schema.bots.createdAt))
        .all();

      const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
      return {
        bots: myBots.map((b) => formatBot(b, user, true)),
      };
    }
  );

  // ─── DEVELOPER PORTAL: CREATE NEW BOT ────────────────────────────────────
  app.post<{
    Body: {
      name: string;
      tagline?: string;
      description?: string;
      avatar?: string;
      banner?: string;
      prefix?: string;
      websiteUrl?: string;
      supportUrl?: string;
      privacyPolicyUrl?: string;
      webhookUrl?: string;
      tags?: string[];
      categories?: string[];
      commands?: BotCommand[];
      layoutData?: any[];
      customCss?: string;
    };
  }>(
    '/api/developers/bots',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const {
        name,
        tagline = '',
        description = '',
        avatar = null,
        banner = null,
        prefix = '/',
        websiteUrl = null,
        supportUrl = null,
        privacyPolicyUrl = null,
        webhookUrl = null,
        tags = [],
        categories = ['utilidades'],
        commands = [],
        layoutData = [],
        customCss = '',
      } = request.body || {};

      if (!name || !name.trim()) {
        return sendError(reply, 400, 'validation_failed');
      }

      const botId = `bot_${generateSnowflake()}`;
      let baseSlug = slugify(name);
      if (!baseSlug) baseSlug = `bot-${botId.slice(-6)}`;

      let slug = baseSlug;
      let counter = 1;
      while (db.select().from(schema.bots).where(eq(schema.bots.slug, slug)).get()) {
        slug = `${baseSlug}-${counter++}`;
      }

      // Create an internal bot user so it can participate in spaces and chat
      const botUserId = `user_bot_${generateSnowflake()}`;
      const now = Date.now();
      const botToken = `nbot_${crypto.randomBytes(32).toString('hex')}`;
      const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

      db.insert(schema.users)
        .values({
          id: botUserId,
          username: `${baseSlug.slice(0, 20)}_bot`,
          displayName: name.trim(),
          avatar: avatar || null,
          banner: banner || null,
          passwordHash: 'bot_auth_managed',
          status: 'online',
          isBot: 1,
          createdAt: now,
        })
        .run();

      db.insert(schema.bots)
        .values({
          id: botId,
          slug,
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          avatar,
          banner,
          developerId: request.userId,
          botUserId,
          status: 'draft',
          isVerified: 0,
          isOfficial: 0,
          prefix: prefix || '/',
          websiteUrl,
          supportUrl,
          privacyPolicyUrl,
          webhookUrl,
          webhookSecret,
          botToken,
          requiredPermissions: JSON.stringify([]),
          tags: JSON.stringify(tags),
          categories: JSON.stringify(categories),
          commands: JSON.stringify(commands),
          layoutData: JSON.stringify(layoutData),
          customCss,
          installCount: 0,
          ratingAverage: 5.0,
          ratingCount: 0,
          version: '1.0.0',
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const created = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
      const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();

      return {
        bot: formatBot(created!, user, true),
      };
    }
  );

  // ─── DEVELOPER PORTAL: UPDATE BOT METADATA / EDITOR ──────────────────────
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      tagline: string;
      description: string;
      avatar: string | null;
      banner: string | null;
      prefix: string;
      websiteUrl: string | null;
      supportUrl: string | null;
      privacyPolicyUrl: string | null;
      webhookUrl: string | null;
      tags: string[];
      categories: string[];
      commands: BotCommand[];
      layoutData: any[];
      customCss: string;
      version: string;
    }>;
  }>(
    '/api/developers/bots/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();

      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      const currentUser = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
      const isOwner = bot.developerId === request.userId;
      const isAdmin = currentUser?.isAdmin === 1;

      if (!isOwner && !isAdmin) {
        return sendError(reply, 403, 'forbidden');
      }

      const body = request.body || {};
      const updates: any = {
        updatedAt: Date.now(),
      };

      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.tagline !== undefined) updates.tagline = body.tagline.trim();
      if (body.description !== undefined) updates.description = body.description.trim();
      if (body.avatar !== undefined) updates.avatar = body.avatar;
      if (body.banner !== undefined) updates.banner = body.banner;
      if (body.prefix !== undefined) updates.prefix = body.prefix;
      if (body.websiteUrl !== undefined) updates.websiteUrl = body.websiteUrl;
      if (body.supportUrl !== undefined) updates.supportUrl = body.supportUrl;
      if (body.privacyPolicyUrl !== undefined) updates.privacyPolicyUrl = body.privacyPolicyUrl;
      if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;
      if (body.customCss !== undefined) updates.customCss = body.customCss;
      if (body.version !== undefined) updates.version = body.version;

      if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
      if (body.categories !== undefined) updates.categories = JSON.stringify(body.categories);
      if (body.commands !== undefined) updates.commands = JSON.stringify(body.commands);
      if (body.layoutData !== undefined) updates.layoutData = JSON.stringify(body.layoutData);

      db.update(schema.bots).set(updates).where(eq(schema.bots.id, id)).run();

      // Sync avatar / display name to botUser if changed
      if (bot.botUserId && (body.name || body.avatar !== undefined || body.banner !== undefined)) {
        const userUpdates: any = { profileUpdatedAt: Date.now() };
        if (body.name) userUpdates.displayName = body.name.trim();
        if (body.avatar !== undefined) userUpdates.avatar = body.avatar;
        if (body.banner !== undefined) userUpdates.banner = body.banner;
        db.update(schema.users).set(userUpdates).where(eq(schema.users.id, bot.botUserId)).run();
      }

      const updated = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();
      return { bot: formatBot(updated!, currentUser, true) };
    }
  );

  // ─── DEVELOPER PORTAL: REGENERATE BOT TOKEN ──────────────────────────────
  app.post<{
    Params: { id: string };
  }>(
    '/api/developers/bots/:id/regenerate-token',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();

      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      if (bot.developerId !== request.userId) {
        return sendError(reply, 403, 'forbidden');
      }

      const newToken = `nbot_${crypto.randomBytes(32).toString('hex')}`;
      db.update(schema.bots)
        .set({ botToken: newToken, updatedAt: Date.now() })
        .where(eq(schema.bots.id, id))
        .run();

      return { botToken: newToken };
    }
  );

  // ─── DEVELOPER PORTAL: SUBMIT FOR REVIEW ─────────────────────────────────
  app.post<{
    Params: { id: string };
  }>(
    '/api/developers/bots/:id/submit',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();

      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      if (bot.developerId !== request.userId) {
        return sendError(reply, 403, 'forbidden');
      }

      db.update(schema.bots)
        .set({ status: 'pending_review', updatedAt: Date.now() })
        .where(eq(schema.bots.id, id))
        .run();

      return { success: true, status: 'pending_review' };
    }
  );

  // ─── DEVELOPER PORTAL: BOT STATS ─────────────────────────────────────────
  app.get<{
    Params: { id: string };
  }>(
    '/api/developers/bots/:id/stats',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();

      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      if (bot.developerId !== request.userId) {
        return sendError(reply, 403, 'forbidden');
      }

      const activeInstalls = db
        .select({
          spaceId: schema.botInstallations.spaceId,
          installedAt: schema.botInstallations.installedAt,
          spaceName: schema.spaces.name,
          spaceIcon: schema.spaces.icon,
        })
        .from(schema.botInstallations)
        .innerJoin(schema.spaces, eq(schema.botInstallations.spaceId, schema.spaces.id))
        .where(eq(schema.botInstallations.botId, id))
        .all();

      return {
        installCount: bot.installCount,
        ratingAverage: bot.ratingAverage,
        ratingCount: bot.ratingCount,
        activeInstallations: activeInstalls,
      };
    }
  );

  // ─── ADMIN: REVIEW QUEUE ────────────────────────────────────────────────
  app.get<{
    Querystring: { status?: string };
  }>(
    '/api/admin/bots',
    { preHandler: [authenticate, requireAdmin] },
    async (request) => {
      const { status } = request.query;

      let query = db
        .select({
          bot: schema.bots,
          developer: {
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatar: schema.users.avatar,
          },
        })
        .from(schema.bots)
        .leftJoin(schema.users, eq(schema.bots.developerId, schema.users.id));

      if (status) {
        query = query.where(eq(schema.bots.status, status)) as any;
      }

      const rows = query.orderBy(desc(schema.bots.updatedAt)).all();
      return {
        bots: rows.map((r) => formatBot(r.bot, r.developer as any, false)),
      };
    }
  );

  // ─── ADMIN: REVIEW ACTION (APPROVE / REJECT) ─────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { status: 'approved' | 'published' | 'rejected' | 'changes_requested' };
  }>(
    '/api/admin/bots/:id/review',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body || {};

      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();
      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      db.update(schema.bots)
        .set({ status, updatedAt: Date.now() })
        .where(eq(schema.bots.id, id))
        .run();

      return { success: true, status };
    }
  );

  // ─── ADMIN: TOGGLE VERIFIED BADGE ────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { isVerified: boolean };
  }>(
    '/api/admin/bots/:id/verify',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { isVerified } = request.body || {};

      const bot = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get();
      if (!bot) {
        return sendError(reply, 404, 'not_found');
      }

      db.update(schema.bots)
        .set({ isVerified: isVerified ? 1 : 0, updatedAt: Date.now() })
        .where(eq(schema.bots.id, id))
        .run();

      return { success: true, isVerified: Boolean(isVerified) };
    }
  );

  // ─── EXECUTE SLASH COMMAND IN A CHANNEL ──────────────────────────────────
  app.post<{
    Params: { channelId: string };
    Body: { command: string; args?: string };
  }>(
    '/api/channels/:channelId/commands/execute',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { channelId } = request.params;
      let { command, args = '' } = request.body || {};

      if (!command) {
        return sendError(reply, 400, 'validation_failed');
      }

      command = command.trim().replace(/^\//, '').toLowerCase();

      const spaceId = getChannelSpaceId(channelId);
      if (!spaceId) {
        return sendError(reply, 404, 'not_found');
      }

      if (!isMember(spaceId, request.userId)) {
        return sendError(reply, 403, 'forbidden');
      }

      // Find installed bots in this space
      const installedBots = db
        .select({
          installation: schema.botInstallations,
          bot: schema.bots,
        })
        .from(schema.botInstallations)
        .innerJoin(schema.bots, eq(schema.botInstallations.botId, schema.bots.id))
        .where(
          and(
            eq(schema.botInstallations.spaceId, spaceId),
            eq(schema.botInstallations.status, 'active')
          )
        )
        .all();

      if (installedBots.length === 0) {
        return reply.code(400).send({
          error: 'Nenhum bot instalado neste espaço.',
          code: 'no_bots_installed',
          statusCode: 400,
        });
      }

      // Check if command is help / ajuda
      if (command === 'ajuda' || command === 'help') {
        const firstBotWithUser = installedBots.find((b) => b.bot.botUserId);
        const botUser = firstBotWithUser
          ? db.select().from(schema.users).where(eq(schema.users.id, firstBotWithUser.bot.botUserId!)).get()
          : null;

        if (!botUser) {
          return sendError(reply, 500, 'internal_error');
        }

        let helpText = `🤖 **Comandos dos Bots instalados neste Espaço**\n\n`;
        for (const item of installedBots) {
          let cmds: BotCommand[] = [];
          try {
            cmds = JSON.parse(item.bot.commands || '[]');
          } catch {
            cmds = [];
          }
          helpText += `**${item.bot.name}**:\n`;
          if (cmds.length === 0) {
            helpText += `• *(Nenhum comando configurado)*\n`;
          } else {
            for (const c of cmds) {
              helpText += `• \`/${c.name}\` — ${c.description}\n`;
            }
          }
          helpText += `\n`;
        }

        const now = Date.now();
        const msgId = `msg_${generateSnowflake()}`;
        db.insert(schema.messages)
          .values({
            id: msgId,
            channelId,
            userId: botUser.id,
            content: helpText,
            createdAt: now,
          })
          .run();

        const createdMsg = db.select().from(schema.messages).where(eq(schema.messages.id, msgId)).get()!;
        const messageWithUser = buildMessageWithUser(createdMsg, botUser, [], [], null);

        connectionManager.sendToChannel(spaceId, channelId, {
          type: 'message_created',
          message: messageWithUser,
        });

        return { success: true, message: messageWithUser };
      }

      // Find which bot handles this command
      let targetBot: (typeof installedBots)[0] | null = null;
      let matchedCmd: BotCommand | null = null;

      for (const item of installedBots) {
        let cmds: BotCommand[] = [];
        try {
          cmds = JSON.parse(item.bot.commands || '[]');
        } catch {
          cmds = [];
        }
        const found = cmds.find((c) => c.name.toLowerCase() === command);
        if (found) {
          targetBot = item;
          matchedCmd = found;
          break;
        }
      }

      if (!targetBot || !targetBot.bot.botUserId) {
        return reply.code(404).send({
          error: `Comando \`/${command}\` não reconhecido em nenhum bot instalado neste espaço. Digite \`/ajuda\` para ver a lista.`,
          code: 'command_not_found',
          statusCode: 404,
        });
      }

      const botUser = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, targetBot.bot.botUserId))
        .get();

      if (!botUser) {
        return sendError(reply, 500, 'internal_error');
      }

      const callerUser = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, request.userId))
        .get();

      // Built-in responses for official starter bots
      let responseContent = '';

      if (command === 'limpar' || command === 'purge') {
        const canManageMessages =
          isSpaceOwner(spaceId, request.userId) ||
          hasPermission(request.userId, spaceId, PermissionBits.MANAGE_MESSAGES);
        if (!canManageMessages) {
          return reply.code(403).send({
            error: 'Você não tem permissão para gerenciar mensagens.',
            code: 'missing_permissions',
            statusCode: 403,
          });
        }
        const count = Math.min(Math.max(parseInt(args, 10) || 5, 1), 50);
        // Find recent user messages in this channel
        const msgs = db
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(eq(schema.messages.channelId, channelId))
          .orderBy(desc(schema.messages.createdAt))
          .limit(count)
          .all();

        for (const m of msgs) {
          db.delete(schema.messages).where(eq(schema.messages.id, m.id)).run();
          connectionManager.sendToChannel(spaceId, channelId, {
            type: 'message_deleted',
            messageId: m.id,
            channelId,
          });
        }

        responseContent = `🛡️ **Sentinel:** ${msgs.length} mensagem(ns) foram limpas do canal com sucesso.`;
      } else if (command === 'enquete' || command === 'poll') {
        const question = args.trim() || 'Qual é a sua opinião?';
        responseContent = `📊 **ENQUETE: ${question}**\n\nReaja abaixo com ✅ para Sim ou ❌ para Não!`;
      } else if (command === 'boas-vindas' || command === 'welcome') {
        const spaceRow = db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId)).get();
        responseContent = `👋 **Bem-vindo ao ${spaceRow?.name ?? 'nosso espaço'}!**\n\nFique à vontade para explorar os canais de texto e voz. Respeite as regras e aproveite a comunidade! 🎉`;
      } else if (command === 'ticket') {
        responseContent = `🎫 **Ticket de Suporte aberto por @${callerUser?.username}**\n\nNossa equipe de moderação e suporte atenderá sua solicitação em breve. Descreva seu problema detalhadamente.`;
      } else if (command === 'rank' || command === 'level') {
        // Calculate user level based on message count in this space
        const userMsgCount = db
          .select({ count: sql<number>`count(*)` })
          .from(schema.messages)
          .innerJoin(schema.channels, eq(schema.messages.channelId, schema.channels.id))
          .where(
            and(
              eq(schema.channels.spaceId, spaceId),
              eq(schema.messages.userId, request.userId)
            )
          )
          .get()?.count ?? 1;

        const level = Math.floor(Math.sqrt(userMsgCount)) || 1;
        const xp = userMsgCount * 25;
        responseContent = `⭐ **Nível de @${callerUser?.displayName || callerUser?.username}**\n\n🏆 **Nível:** ${level}\n✨ **XP Total:** ${xp} XP\n💬 **Mensagens no espaço:** ${userMsgCount}`;
      } else if (command === 'seguranca') {
        responseContent = `🛡️ **Painel de Segurança do Espaço**\n\n• **Status da Proteção:** Ativa ✅\n• **Bots Conectados:** ${installedBots.length}\n• **Verificação de Spam:** Operacional\n• **Anti-Raid:** Ativado`;
      } else {
        responseContent = `🤖 **${targetBot.bot.name}**: Comando \`/${command}\` executado por @${callerUser?.username}${args ? ` com argumentos: *${args}*` : ''}.`;
      }

      const now = Date.now();
      const msgId = `msg_${generateSnowflake()}`;
      db.insert(schema.messages)
        .values({
          id: msgId,
          channelId,
          userId: botUser.id,
          content: responseContent,
          createdAt: now,
        })
        .run();

      const createdMsg = db.select().from(schema.messages).where(eq(schema.messages.id, msgId)).get()!;
      const messageWithUser = buildMessageWithUser(createdMsg, botUser, [], [], null);

      connectionManager.sendToChannel(spaceId, channelId, {
        type: 'message_created',
        message: messageWithUser,
      });

      return { success: true, message: messageWithUser };
    }
  );

  // ─── BOT API: POST MESSAGE USING BOT TOKEN ──────────────────────────────
  app.post<{
    Params: { channelId: string };
    Body: { content: string };
  }>('/api/bot/channels/:channelId/messages', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bot ')) {
      return reply.code(401).send({ error: 'Authorization: Bot <token> required', code: 'unauthorized', statusCode: 401 });
    }

    const token = authHeader.slice(4).trim();
    const bot = db.select().from(schema.bots).where(eq(schema.bots.botToken, token)).get();
    if (!bot || !bot.botUserId) {
      return reply.code(401).send({ error: 'Token de bot inválido', code: 'unauthorized', statusCode: 401 });
    }

    const { channelId } = request.params;
    const { content } = request.body || {};

    if (!content || !content.trim()) {
      return sendError(reply, 400, 'validation_failed');
    }

    const spaceId = getChannelSpaceId(channelId);
    if (!spaceId) {
      return sendError(reply, 404, 'not_found');
    }

    // Verify bot is installed in this space
    const install = db
      .select()
      .from(schema.botInstallations)
      .where(
        and(
          eq(schema.botInstallations.spaceId, spaceId),
          eq(schema.botInstallations.botId, bot.id),
          eq(schema.botInstallations.status, 'active')
        )
      )
      .get();

    if (!install) {
      return reply.code(403).send({
        error: 'O bot não está instalado ou ativo neste espaço',
        code: 'bot_not_installed',
        statusCode: 403,
      });
    }

    const botUser = db.select().from(schema.users).where(eq(schema.users.id, bot.botUserId)).get();
    if (!botUser) {
      return sendError(reply, 500, 'internal_error');
    }

    const now = Date.now();
    const msgId = `msg_${generateSnowflake()}`;
    db.insert(schema.messages)
      .values({
        id: msgId,
        channelId,
        userId: botUser.id,
        content: content.trim(),
        createdAt: now,
      })
      .run();

    const createdMsg = db.select().from(schema.messages).where(eq(schema.messages.id, msgId)).get()!;
    const messageWithUser = buildMessageWithUser(createdMsg, botUser, [], [], null);

    connectionManager.sendToChannel(spaceId, channelId, {
      type: 'message_created',
      message: messageWithUser,
    });

    return { message: messageWithUser };
  });
}
