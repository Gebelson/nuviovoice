import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { getChannelSpaceId, hasPermission, PermissionBits } from '../utils/permissions.js';

export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  // Create Webhook for a channel
  app.post<{
    Params: { channelId: string };
    Body: { name: string; avatar?: string };
  }>('/api/webhooks/channel/:channelId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { channelId } = request.params;
    const { name, avatar } = request.body || {};

    if (!name || name.trim().length === 0) {
      return sendError(reply, 400, 'validation_failed');
    }

    const spaceId = getChannelSpaceId(channelId);
    if (!spaceId) {
      return sendError(reply, 404, 'channel_not_found');
    }

    // Require MANAGE_WEBHOOKS or Administrator
    const canManage = hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
      hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

    if (!canManage) {
      return sendError(reply, 403, 'missing_permission');
    }

    const db = getDb();
    const webhookId = randomUUID();
    const token = randomBytes(32).toString('hex');
    const now = Date.now();

    const webhookRow = {
      id: webhookId,
      channelId,
      spaceId,
      name: name.trim().slice(0, 40),
      avatar: avatar || null,
      token,
      callbackUrl: null,
      callbackSecret: null,
      subscribedEvents: '*',
      createdBy: request.userId,
      createdAt: now,
    };

    db.insert(schema.webhooks).values(webhookRow).run();

    return reply.code(201).send({ webhook: webhookRow });
  });

  // List webhooks in channel
  app.get<{ Params: { channelId: string } }>('/api/webhooks/channel/:channelId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { channelId } = request.params;
    const spaceId = getChannelSpaceId(channelId);
    if (!spaceId) {
      return sendError(reply, 404, 'channel_not_found');
    }

    const canManage = hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
      hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

    if (!canManage) {
      return sendError(reply, 403, 'missing_permission');
    }

    const db = getDb();
    const list = db.select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.channelId, channelId))
      .all();

    return reply.send({ webhooks: list });
  });

  // Delete webhook
  app.delete<{ Params: { webhookId: string } }>('/api/webhooks/:webhookId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { webhookId } = request.params;
    const db = getDb();

    const hook = db.select().from(schema.webhooks).where(eq(schema.webhooks.id, webhookId)).get();
    if (!hook) {
      return sendError(reply, 404, 'not_found');
    }

    const canManage = hook.createdBy === request.userId ||
      hasPermission(request.userId, hook.spaceId, PermissionBits.MANAGE_SPACE) ||
      hasPermission(request.userId, hook.spaceId, PermissionBits.ADMINISTRATOR);

    if (!canManage) {
      return sendError(reply, 403, 'missing_permission');
    }

    db.delete(schema.webhooks).where(eq(schema.webhooks.id, webhookId)).run();

    return reply.send({ success: true, webhookId });
  });

  // Execute incoming webhook message
  app.post<{
    Params: { webhookId: string; token: string };
    Body: { content: string; username?: string; avatarUrl?: string };
  }>('/api/webhooks/incoming/:webhookId/:token', async (request, reply) => {
    const { webhookId, token } = request.params;
    const { content, username, avatarUrl } = request.body || {};

    if (!content || content.trim().length === 0) {
      return sendError(reply, 400, 'validation_failed');
    }

    const db = getDb();
    const hook = db.select().from(schema.webhooks).where(eq(schema.webhooks.id, webhookId)).get();
    if (!hook || hook.token !== token) {
      return sendError(reply, 401, 'unauthorized');
    }

    const messageId = randomUUID();
    const now = Date.now();
    const senderName = username?.trim().slice(0, 32) || hook.name;

    // Post to space messages table
    const msg = {
      id: messageId,
      channelId: hook.channelId,
      userId: hook.createdBy, // attributed to webhook creator
      content: content.slice(0, 4000),
      createdAt: now,
    };

    db.insert(schema.messages).values(msg).run();

    return reply.code(201).send({
      success: true,
      messageId,
      senderName,
      createdAt: now,
    });
  });

  // List bot commands
  app.get<{ Params: { spaceId: string } }>('/api/bot/commands/space/:spaceId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const db = getDb();

    const commands = db.select()
      .from(schema.botCommands)
      .where(eq(schema.botCommands.spaceId, spaceId))
      .all();

    return reply.send({ commands });
  });

  // Register bot slash command
  app.post<{
    Params: { spaceId: string };
    Body: { command: string; description?: string; webhookId?: string };
  }>('/api/bot/commands/space/:spaceId', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { spaceId } = request.params;
    const { command, description = '', webhookId } = request.body || {};

    if (!command || !command.startsWith('/')) {
      return sendError(reply, 400, 'validation_failed');
    }

    const canManage = hasPermission(request.userId, spaceId, PermissionBits.MANAGE_SPACE) ||
      hasPermission(request.userId, spaceId, PermissionBits.ADMINISTRATOR);

    if (!canManage) {
      return sendError(reply, 403, 'missing_permission');
    }

    const db = getDb();
    const cmdId = randomUUID();
    const cleanCmd = command.trim().toLowerCase().slice(0, 32);

    const row = {
      id: cmdId,
      spaceId,
      webhookId: webhookId || null,
      command: cleanCmd,
      description: description.slice(0, 100),
      createdAt: Date.now(),
    };

    db.insert(schema.botCommands).values(row).run();

    return reply.code(201).send({ command: row });
  });
}
