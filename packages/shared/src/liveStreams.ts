import type { VerificationCategory, VerificationStatus } from './verifications.js';

export type StreamPlatform = 'twitch' | 'kick' | 'youtube';

export interface StreamerChannel {
  id: string;
  userId: string;
  platform: StreamPlatform;
  channelId: string;
  channelName: string;
  channelUrl: string;
  linkedSpaceId: string | null;
  isLive: boolean;
  streamTitle: string | null;
  streamGame: string | null;
  streamThumbnail: string | null;
  viewerCount: number;
  startedAt: number | null;
  lastCheckedAt: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface LiveStreamerProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  avatarColor: string | null;
  verification?: {
    status: VerificationStatus;
    category: VerificationCategory;
  } | null;
}

export interface LiveStreamLinkedSpace {
  id: string;
  name: string;
  icon: string | null;
  avatarColor: string | null;
  description: string | null;
  memberCount?: number;
  isJoined?: boolean;
}

export interface LiveStreamInfo {
  id: string; // channel id
  userId: string;
  platform: StreamPlatform;
  channelId: string;
  channelName: string;
  channelUrl: string;
  isLive: boolean;
  streamTitle: string | null;
  streamGame: string | null;
  streamThumbnail: string | null;
  viewerCount: number;
  startedAt: number | null;
  embedUrl: string;
  streamer: LiveStreamerProfile;
  linkedSpace?: LiveStreamLinkedSpace | null;
  metadata?: Record<string, unknown> | null;
}

export interface LinkChannelInput {
  platform?: StreamPlatform;
  channelInput: string; // can be URL or handle/username
  linkedSpaceId?: string | null;
}

/**
 * Parses user input (URL or plain username/handle) into platform and channel identifier.
 */
export function parseChannelInput(input: string, platformHint?: StreamPlatform): {
  platform: StreamPlatform;
  channelName: string;
  cleanUrl: string;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Twitch URL or handle
  const twitchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})/i);
  if (twitchMatch && twitchMatch[1]) {
    const slug = twitchMatch[1].toLowerCase();
    return {
      platform: 'twitch',
      channelName: slug,
      cleanUrl: `https://twitch.tv/${slug}`,
    };
  }

  // 2. Kick URL or handle
  const kickMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?kick\.com\/([a-zA-Z0-9_\-]{3,30})/i);
  if (kickMatch && kickMatch[1]) {
    const slug = kickMatch[1].toLowerCase();
    return {
      platform: 'kick',
      channelName: slug,
      cleanUrl: `https://kick.com/${slug}`,
    };
  }

  // 3. YouTube URL
  const ytHandleMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_\-\.]{3,35})/i);
  if (ytHandleMatch && ytHandleMatch[1]) {
    const handle = ytHandleMatch[1];
    return {
      platform: 'youtube',
      channelName: handle,
      cleanUrl: `https://www.youtube.com/@${handle}`,
    };
  }

  const ytChannelMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/(UC[a-zA-Z0-9_\-]{20,24})/i);
  if (ytChannelMatch && ytChannelMatch[1]) {
    const cid = ytChannelMatch[1];
    return {
      platform: 'youtube',
      channelName: cid,
      cleanUrl: `https://www.youtube.com/channel/${cid}`,
    };
  }

  // Fallback if platform is passed as hint
  if (platformHint) {
    const cleanSlug = trimmed.replace(/^@/, '').toLowerCase().trim();
    if (!cleanSlug) return null;
    let cleanUrl = '';
    if (platformHint === 'twitch') cleanUrl = `https://twitch.tv/${cleanSlug}`;
    else if (platformHint === 'kick') cleanUrl = `https://kick.com/${cleanSlug}`;
    else if (platformHint === 'youtube') cleanUrl = `https://www.youtube.com/@${cleanSlug}`;

    return {
      platform: platformHint,
      channelName: cleanSlug,
      cleanUrl,
    };
  }

  return null;
}

/**
 * Returns the official embed URL for the live stream.
 */
export function getStreamEmbedUrl(
  platform: StreamPlatform,
  channelName: string,
  metadata?: Record<string, unknown> | null,
  parentHostname = 'localhost'
): string {
  const host = parentHostname.replace(/:\d+$/, ''); // strip port for Twitch parent

  switch (platform) {
    case 'twitch': {
      // Twitch official interactive player embed
      const parentParam = host ? `&parent=${encodeURIComponent(host)}` : '';
      return `https://player.twitch.tv/?channel=${encodeURIComponent(channelName)}${parentParam}&autoplay=true&muted=false`;
    }
    case 'kick': {
      // Kick official player embed
      return `https://player.kick.com/${encodeURIComponent(channelName)}?autoplay=true&muted=false`;
    }
    case 'youtube': {
      // YouTube embed: if we have a live videoId, use video embed, otherwise live stream channel embed
      const videoId = typeof metadata?.videoId === 'string' ? metadata.videoId : null;
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&enablejsapi=1`;
      }
      return `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(channelName)}&autoplay=1`;
    }
  }
}

/**
 * Returns the official external destination URL for the stream.
 */
export function getStreamExternalUrl(
  platform: StreamPlatform,
  channelName: string,
  cleanUrl?: string
): string {
  if (cleanUrl) return cleanUrl;
  switch (platform) {
    case 'twitch':
      return `https://twitch.tv/${channelName}`;
    case 'kick':
      return `https://kick.com/${channelName}`;
    case 'youtube':
      return channelName.startsWith('UC')
        ? `https://www.youtube.com/channel/${channelName}`
        : `https://www.youtube.com/@${channelName}`;
  }
}
