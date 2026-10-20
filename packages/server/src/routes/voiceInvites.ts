import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { hasPermission, PermissionBits } from '../utils/permissions.js';
import { connectionManager } from '../ws/handler.js';
import { dmSystemContent } from '../utils/dmSystemMessages.js';
import { ensureOneOnOneDmChannel, getDmMessageWithUser, broadcastDmMessage } from './dm.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { queueDmRelay } from '../utils/federationOutbox.js';
import { sanitizeUser } from '../utils/sanitize.js';
import type { AvatarColor, SpaceVisibility, VoiceInvitePreview, VoiceInviteSystemPayload } from '@concord/shared';

export async function voiceInviteRoutes(app: FastifyInstance): Promise<void> {
  // 1. POST /api/channels/:channelId/voice-invites — Create a direct voice channel invite
  app.post<{
    Params: { channelId: string };
    Body: { expiresInSeconds?: number | null; maxUses?: number | null };
  }>('/api/channels/:channelId/voice-invites', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { channelId } = request.params;
    const { expiresInSeconds, maxUses } = request.body || {};
    const db = getDb();

    const channel = db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).get();
    if (!channel) {
      return sendError(reply, 404, 'channel_not_found');
    }
    if (channel.type !== 'voice') {
      return sendError(reply, 400, 'channel_type_invalid');
    }

    if (!hasPermission(request.userId, channel.spaceId, PermissionBits.CREATE_INVITE, channel.id)) {
      return sendError(reply, 403, 'missing_permission');
    }

    const token = crypto.randomBytes(16).toString('base64url');
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const expiresAt = typeof expiresInSeconds === 'number' && expiresInSeconds > 0
      ? createdAt + (expiresInSeconds * 1000)
      : null;
    const finalMaxUses = typeof maxUses === 'number' && maxUses > 0 ? maxUses : null;

    db.insert(schema.voiceInvites).values({
      id,
      token,
      spaceId: channel.spaceId,
      channelId: channel.id,
      createdBy: request.userId,
      createdAt,
      expiresAt,
      maxUses: finalMaxUses,
      usedCount: 0,
      revokedAt: null,
    }).run();

    const inviteUrl = `https://nuviovoice.vercel.app/voice/invite/${token}`;

    return reply.code(201).send({
      id,
      token,
      inviteUrl,
      channelId: channel.id,
      spaceId: channel.spaceId,
      expiresAt,
      maxUses: finalMaxUses,
      createdAt,
    });
  });

  // 2. GET /api/voice-invites/:token/preview — Public preview of a voice invite
  app.get<{ Params: { token: string } }>('/api/voice-invites/:token/preview', async (request, reply) => {
    const { token } = request.params;
    const db = getDb();

    const invite = db.select().from(schema.voiceInvites).where(eq(schema.voiceInvites.token, token)).get();
    if (!invite) {
      return sendError(reply, 404, 'invite_invalid');
    }

    if (invite.revokedAt !== null || (invite.expiresAt !== null && invite.expiresAt <= Date.now()) || (invite.maxUses !== null && invite.usedCount >= invite.maxUses)) {
      return sendError(reply, 410, 'invite_invalid');
    }

    const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, invite.spaceId)).get();
    const channel = db.select().from(schema.channels).where(eq(schema.channels.id, invite.channelId)).get();

    if (!space || !channel) {
      return sendError(reply, 404, 'channel_not_found');
    }

    const inviter = db.select().from(schema.users).where(eq(schema.users.id, invite.createdBy)).get();

    const memberCount = db.select().from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.spaceId, space.id)).all().length;

    const room = connectionManager.getRoom(channel.id);
    const participantCount = room ? room.participants.size : 0;

    const preview: VoiceInvitePreview = {
      token: invite.token,
      space: {
        id: space.id,
        name: space.name,
        description: space.description ?? null,
        icon: space.icon ?? null,
        banner: space.banner ?? null,
        avatarColor: (space.avatarColor as AvatarColor | null) ?? null,
        memberCount,
        visibility: (space.visibility ?? 'private') as SpaceVisibility,
      },
      channel: {
        id: channel.id,
        name: channel.name,
        type: 'voice',
        participantCount,
      },
      inviter: {
        id: inviter?.id ?? '',
        username: inviter?.username ?? 'Usuário',
        displayName: inviter?.displayName ?? null,
        avatar: inviter?.avatar ?? null,
      },
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
    };

    return reply.code(200).send(preview);
  });

  // 3. POST /api/voice-invites/:token/join — Validate voice invite, ensure space membership and join
  app.post<{ Params: { token: string } }>('/api/voice-invites/:token/join', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { token } = request.params;
    const db = getDb();

    const invite = db.select().from(schema.voiceInvites).where(eq(schema.voiceInvites.token, token)).get();
    if (!invite) {
      return sendError(reply, 404, 'invite_invalid');
    }

    if (invite.revokedAt !== null || (invite.expiresAt !== null && invite.expiresAt <= Date.now()) || (invite.maxUses !== null && invite.usedCount >= invite.maxUses)) {
      return sendError(reply, 410, 'invite_invalid');
    }

    const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, invite.spaceId)).get();
    const channel = db.select().from(schema.channels).where(eq(schema.channels.id, invite.channelId)).get();

    if (!space || !channel) {
      return sendError(reply, 404, 'channel_not_found');
    }

    // Check if user is banned
    const ban = db.select().from(schema.bans).where(
      and(eq(schema.bans.spaceId, space.id), eq(schema.bans.userId, request.userId))
    ).get();
    if (ban) {
      return sendError(reply, 403, 'user_banned');
    }

    const existingMember = db.select().from(schema.spaceMembers).where(
      and(eq(schema.spaceMembers.spaceId, space.id), eq(schema.spaceMembers.userId, request.userId))
    ).get();

    const now = Date.now();
    db.transaction((tx) => {
      if (!existingMember) {
        tx.insert(schema.spaceMembers).values({
          spaceId: space.id,
          userId: request.userId,
          joinedAt: now,
        }).run();
      }

      tx.update(schema.voiceInvites)
        .set({ usedCount: invite.usedCount + 1 })
        .where(eq(schema.voiceInvites.id, invite.id))
        .run();
    });

    if (!existingMember) {
      connectionManager.addUserSpace(request.userId, space.id);

      // Broadcast member join event to space sockets
      const joiningUser = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
      if (joiningUser) {
        connectionManager.sendToSpace(space.id, {
          type: 'member_joined',
          spaceId: space.id,
          member: {
            spaceId: space.id,
            userId: request.userId,
            nickname: null,
            joinedAt: now,
            user: sanitizeUser(joiningUser),
            roles: [],
          },
        });
      }
    }

    // Check CONNECT permission
    if (!hasPermission(request.userId, space.id, PermissionBits.CONNECT, channel.id)) {
      return sendError(reply, 403, 'forbidden');
    }

    return reply.code(200).send({
      space: {
        id: space.id,
        name: space.name,
      },
      channel: {
        id: channel.id,
        name: channel.name,
        type: 'voice',
      },
    });
  });

  // 4. GET /api/channels/:channelId/voice-invites — List active invites for a voice channel
  app.get<{ Params: { channelId: string } }>('/api/channels/:channelId/voice-invites', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { channelId } = request.params;
    const db = getDb();

    const channel = db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).get();
    if (!channel) {
      return sendError(reply, 404, 'channel_not_found');
    }

    if (!hasPermission(request.userId, channel.spaceId, PermissionBits.CREATE_INVITE, channel.id)) {
      return sendError(reply, 403, 'missing_permission');
    }

    const invites = db.select().from(schema.voiceInvites)
      .where(and(
        eq(schema.voiceInvites.channelId, channelId),
        isNull(schema.voiceInvites.revokedAt)
      ))
      .all();

    return reply.code(200).send({ invites });
  });

  // 5. DELETE /api/voice-invites/:id — Revoke a voice invite
  app.delete<{ Params: { id: string } }>('/api/voice-invites/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const invite = db.select().from(schema.voiceInvites).where(eq(schema.voiceInvites.id, id)).get();
    if (!invite) {
      return sendError(reply, 404, 'invite_invalid');
    }

    const isCreator = invite.createdBy === request.userId;
    const canManage = hasPermission(request.userId, invite.spaceId, PermissionBits.MANAGE_CHANNELS, invite.channelId);

    if (!isCreator && !canManage) {
      return sendError(reply, 403, 'missing_permission');
    }

    db.update(schema.voiceInvites)
      .set({ revokedAt: Date.now() })
      .where(eq(schema.voiceInvites.id, id))
      .run();

    return reply.code(200).send({ success: true });
  });

  // 6. POST /api/dm/voice-invite — Share voice invite directly with a friend in DM
  app.post<{
    Body: {
      targetUserId: string;
      token: string;
    };
  }>('/api/dm/voice-invite', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { targetUserId, token } = request.body || {};
    if (!targetUserId || !token) {
      return sendError(reply, 400, 'validation_failed');
    }
    if (targetUserId === request.userId) {
      return sendError(reply, 400, 'cannot_friend_self');
    }

    const db = getDb();
    const targetUser = db.select().from(schema.users).where(eq(schema.users.id, targetUserId)).get();
    if (!targetUser) {
      return sendError(reply, 404, 'user_not_found');
    }

    const invite = db.select().from(schema.voiceInvites).where(eq(schema.voiceInvites.token, token)).get();
    if (!invite || invite.revokedAt !== null || (invite.expiresAt !== null && invite.expiresAt <= Date.now())) {
      return sendError(reply, 400, 'invite_invalid');
    }

    const space = db.select().from(schema.spaces).where(eq(schema.spaces.id, invite.spaceId)).get();
    const channel = db.select().from(schema.channels).where(eq(schema.channels.id, invite.channelId)).get();
    if (!space || !channel) {
      return sendError(reply, 400, 'invite_invalid');
    }

    const memberCount = db.select().from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.spaceId, space.id)).all().length;

    const dmChannelId = ensureOneOnOneDmChannel(request.userId, targetUser, db);

    const payload: VoiceInviteSystemPayload = {
      event: 'voice_invite',
      token: invite.token,
      spaceId: space.id,
      channelId: channel.id,
      channelName: channel.name,
      spaceInstanceOrigin: '',
      snapshot: {
        spaceName: space.name,
        icon: space.icon ?? null,
        avatarColor: (space.avatarColor as AvatarColor | null) ?? null,
        memberCount,
        description: space.description ?? null,
        instanceName: 'Nuvio',
      },
      expiresAt: invite.expiresAt,
    };

    const now = Date.now();
    const messageId = generateSnowflake();
    const content = dmSystemContent(payload);

    db.insert(schema.dmMessages).values({
      id: messageId,
      dmChannelId,
      userId: request.userId,
      content,
      type: 'system',
      createdAt: now,
    }).run();

    const message = getDmMessageWithUser(messageId);
    if (!message) {
      return sendError(reply, 500, 'validation_failed');
    }

    broadcastDmMessage(dmChannelId, message);
    queueDmRelay(message, dmChannelId, 'create');

    return reply.code(201).send({ success: true, messageId });
  });
}
