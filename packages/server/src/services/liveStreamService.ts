import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { generateSnowflake } from '../utils/snowflake.js';
import { connectionManager } from '../ws/handler.js';
import {
  type StreamPlatform,
  type LiveStreamInfo,
  type StreamerChannel,
  getStreamEmbedUrl,
  getStreamExternalUrl,
  parseChannelInput,
} from '@concord/shared';

export interface PlatformProbeResult {
  isLive: boolean;
  channelId?: string;
  channelName?: string;
  streamTitle?: string | null;
  streamGame?: string | null;
  streamThumbnail?: string | null;
  viewerCount?: number;
  startedAt?: number | null;
  metadata?: Record<string, unknown>;
}

// ─── Platform Probes ──────────────────────────────────────────────────────────

/**
 * Checks Twitch live status.
 * Uses Twitch Helix API if TWITCH_CLIENT_ID & TWITCH_CLIENT_SECRET or TWITCH_APP_TOKEN is configured.
 * Otherwise uses the public GQL probe used by standard web players.
 */
export async function probeTwitchStream(channelName: string): Promise<PlatformProbeResult> {
  const cleanName = channelName.toLowerCase().trim();
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
      // 1. Fetch OAuth app token
      const tokenRes = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
      );
      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        if (tokenData.access_token) {
          const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${cleanName}`, {
            headers: {
              'Client-Id': clientId,
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          });
          if (streamRes.ok) {
            const streamData = (await streamRes.json()) as {
              data?: Array<{
                user_id: string;
                user_login: string;
                title: string;
                game_name: string;
                viewer_count: number;
                thumbnail_url: string;
                started_at: string;
              }>;
            };
            const stream = streamData.data?.[0];
            if (stream) {
              return {
                isLive: true,
                channelId: stream.user_id,
                channelName: stream.user_login,
                streamTitle: stream.title,
                streamGame: stream.game_name,
                streamThumbnail: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
                viewerCount: stream.viewer_count,
                startedAt: new Date(stream.started_at).getTime(),
              };
            }
            return { isLive: false, channelName: cleanName };
          }
        }
      }
    } catch {
      // fallback to GQL probe below
    }
  }

  // Public GQL probe (no credentials required, real-time status)
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query {
          user(login: "${cleanName}") {
            id
            login
            stream {
              id
              title
              viewersCount
              createdAt
              game {
                name
              }
              previewImageURL(width: 640, height: 360)
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data?: {
          user?: {
            id: string;
            login: string;
            stream?: {
              id: string;
              title: string;
              viewersCount: number;
              createdAt: string;
              game?: { name: string };
              previewImageURL: string;
            } | null;
          } | null;
        };
      };

      const user = json.data?.user;
      if (!user) {
        return { isLive: false, channelName: cleanName };
      }

      if (user.stream) {
        return {
          isLive: true,
          channelId: user.id,
          channelName: user.login,
          streamTitle: user.stream.title || null,
          streamGame: user.stream.game?.name || null,
          streamThumbnail: user.stream.previewImageURL || null,
          viewerCount: user.stream.viewersCount || 0,
          startedAt: user.stream.createdAt ? new Date(user.stream.createdAt).getTime() : Date.now(),
        };
      }
    }
  } catch {
    // Network / timeout
  }

  return { isLive: false, channelName: cleanName };
}

/**
 * Checks Kick live status via Kick's public API.
 */
export async function probeKickStream(channelName: string): Promise<PlatformProbeResult> {
  const cleanName = channelName.toLowerCase().trim();
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${cleanName}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NuvioStreamDetector/1.0',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        id?: number;
        user_id?: number;
        slug?: string;
        livestream?: {
          id: number;
          session_title: string;
          viewer_count: number;
          thumbnail?: { url: string };
          start_time?: string;
          categories?: Array<{ name: string }>;
        } | null;
      };

      if (data.livestream) {
        return {
          isLive: true,
          channelId: String(data.user_id || data.id || cleanName),
          channelName: data.slug || cleanName,
          streamTitle: data.livestream.session_title || null,
          streamGame: data.livestream.categories?.[0]?.name || null,
          streamThumbnail: data.livestream.thumbnail?.url || null,
          viewerCount: data.livestream.viewer_count || 0,
          startedAt: data.livestream.start_time ? new Date(data.livestream.start_time).getTime() : Date.now(),
        };
      }
      return {
        isLive: false,
        channelId: String(data.user_id || data.id || cleanName),
        channelName: data.slug || cleanName,
      };
    }
  } catch {
    // Network / timeout
  }

  return { isLive: false, channelName: cleanName };
}

/**
 * Checks YouTube live status.
 */
export async function probeYouTubeStream(channelIdentifier: string): Promise<PlatformProbeResult> {
  const clean = channelIdentifier.trim();
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    try {
      const channelParam = clean.startsWith('UC') ? `channelId=${clean}` : '';
      if (channelParam) {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&${channelParam}&eventType=live&type=video&key=${apiKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            items?: Array<{
              id?: { videoId?: string };
              snippet?: {
                title?: string;
                thumbnails?: { high?: { url?: string } };
                publishedAt?: string;
              };
            }>;
          };
          const item = data.items?.[0];
          if (item?.id?.videoId) {
            return {
              isLive: true,
              channelId: clean,
              channelName: clean,
              streamTitle: item.snippet?.title || null,
              streamThumbnail: item.snippet?.thumbnails?.high?.url || null,
              viewerCount: 0,
              startedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).getTime() : Date.now(),
              metadata: { videoId: item.id.videoId },
            };
          }
        }
      }
    } catch {
      // fallback to live redirect probe
    }
  }

  // Live URL inspection: https://www.youtube.com/@handle/live or /channel/id/live
  try {
    const liveUrl = clean.startsWith('UC')
      ? `https://www.youtube.com/channel/${clean}/live`
      : `https://www.youtube.com/@${clean.replace(/^@/, '')}/live`;

    const res = await fetch(liveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NuvioStreamDetector/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });

    const finalUrl = res.url || '';
    const videoIdMatch = finalUrl.match(/[?&]v=([a-zA-Z0-9_\-]{11})/);
    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1];
      const html = await res.text();
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
      const title = titleMatch ? titleMatch[1] : null;

      return {
        isLive: true,
        channelId: clean,
        channelName: clean,
        streamTitle: title,
        streamThumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        viewerCount: 0,
        startedAt: Date.now(),
        metadata: { videoId },
      };
    }
  } catch {
    // Network / timeout
  }

  return { isLive: false, channelName: clean };
}

export async function probeStream(platform: StreamPlatform, channelName: string): Promise<PlatformProbeResult> {
  switch (platform) {
    case 'twitch':
      return probeTwitchStream(channelName);
    case 'kick':
      return probeKickStream(channelName);
    case 'youtube':
      return probeYouTubeStream(channelName);
  }
}

// ─── Helper Builders ────────────────────────────────────────────────────────

export function buildLiveStreamInfo(
  channel: typeof schema.streamerChannels.$inferSelect,
  user: typeof schema.users.$inferSelect,
  space?: typeof schema.spaces.$inferSelect | null
): LiveStreamInfo {
  let meta: Record<string, unknown> | null = null;
  if (channel.metadata) {
    try {
      meta = JSON.parse(channel.metadata);
    } catch {
      meta = null;
    }
  }

  const platform = channel.platform as StreamPlatform;
  const embedUrl = getStreamEmbedUrl(platform, channel.channelName, meta);

  return {
    id: channel.id,
    userId: channel.userId,
    platform,
    channelId: channel.channelId,
    channelName: channel.channelName,
    channelUrl: channel.channelUrl,
    isLive: channel.isLive === 1,
    streamTitle: channel.streamTitle,
    streamGame: channel.streamGame,
    streamThumbnail: channel.streamThumbnail,
    viewerCount: channel.viewerCount,
    startedAt: channel.startedAt,
    embedUrl,
    streamer: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      avatarColor: user.avatarColor,
      verification: user.verificationStatus === 'verified' ? {
        status: 'verified',
        category: (user.verificationCategory as any) || 'personal',
      } : null,
    },
    linkedSpace: space ? {
      id: space.id,
      name: space.name,
      icon: space.icon,
      avatarColor: space.avatarColor,
      description: space.description,
    } : null,
    metadata: meta,
  };
}

// ─── Poller & Status Synchronizer ───────────────────────────────────────────

export async function pollSingleChannel(
  channelId: string
): Promise<{ channel: typeof schema.streamerChannels.$inferSelect; changed: boolean }> {
  const db = getDb();
  const channel = db.select().from(schema.streamerChannels).where(eq(schema.streamerChannels.id, channelId)).get();
  if (!channel) throw new Error('Channel not found');

  const probe = await probeStream(channel.platform as StreamPlatform, channel.channelName);
  const now = Date.now();
  const newIsLive = probe.isLive ? 1 : 0;
  const wasLive = channel.isLive === 1;

  const metadataJson = probe.metadata
    ? JSON.stringify({ ...(channel.metadata ? JSON.parse(channel.metadata) : {}), ...probe.metadata })
    : channel.metadata;

  db.update(schema.streamerChannels)
    .set({
      isLive: newIsLive,
      streamTitle: probe.isLive ? (probe.streamTitle ?? channel.streamTitle) : null,
      streamGame: probe.isLive ? (probe.streamGame ?? channel.streamGame) : null,
      streamThumbnail: probe.isLive ? (probe.streamThumbnail ?? channel.streamThumbnail) : null,
      viewerCount: probe.isLive ? (probe.viewerCount ?? channel.viewerCount) : 0,
      startedAt: probe.isLive ? (channel.startedAt ?? probe.startedAt ?? now) : null,
      lastCheckedAt: now,
      metadata: metadataJson,
      updatedAt: now,
    })
    .where(eq(schema.streamerChannels.id, channel.id))
    .run();

  const updated = db.select().from(schema.streamerChannels).where(eq(schema.streamerChannels.id, channel.id)).get()!;
  const changed = wasLive !== (newIsLive === 1);

  if (changed || newIsLive === 1) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, updated.userId)).get();
    const space = updated.linkedSpaceId
      ? db.select().from(schema.spaces).where(eq(schema.spaces.id, updated.linkedSpaceId)).get()
      : null;

    if (user) {
      const streamInfo = buildLiveStreamInfo(updated, user, space);
      if (changed && newIsLive === 1) {
        connectionManager.sendToAll({ type: 'live_stream_started', stream: streamInfo });
      } else if (newIsLive === 1) {
        connectionManager.sendToAll({ type: 'live_stream_updated', stream: streamInfo });
      } else if (changed && newIsLive === 0) {
        connectionManager.sendToAll({
          type: 'live_stream_ended',
          channelId: updated.id,
          userId: updated.userId,
        });
      }
    }
  }

  return { channel: updated, changed };
}

export async function pollAllRegisteredChannels(): Promise<void> {
  const db = getDb();
  const channels = db.select().from(schema.streamerChannels).all();
  for (const ch of channels) {
    try {
      await pollSingleChannel(ch.id);
    } catch {
      // Continue polling remaining channels
    }
  }
}
