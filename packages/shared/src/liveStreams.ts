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

  const ytCustomMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|user\/)?([a-zA-Z0-9_\-\.]{3,35})/i);
  if (ytCustomMatch && ytCustomMatch[1] && !['watch', 'live', 'feed', 'gaming'].includes(ytCustomMatch[1].toLowerCase())) {
    const name = ytCustomMatch[1].replace(/^@/, '');
    return {
      platform: 'youtube',
      channelName: name,
      cleanUrl: `https://www.youtube.com/@${name}`,
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
 * Validates channel input with comprehensive checks for platform rules and mismatches.
 */
export function validateChannelInput(
  input: string,
  platformHint?: StreamPlatform
): {
  valid: boolean;
  error?: string;
  parsed?: { platform: StreamPlatform; channelName: string; cleanUrl: string };
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: 'Insira o link ou o identificador do canal de transmissão.' };
  }

  // 1. Detect if the input contains a URL of a conflicting platform
  let detectedPlatform: StreamPlatform | null = null;
  if (/twitch\.tv/i.test(trimmed)) detectedPlatform = 'twitch';
  else if (/kick\.com/i.test(trimmed)) detectedPlatform = 'kick';
  else if (/youtube\.com/i.test(trimmed) || /youtu\.be/i.test(trimmed)) detectedPlatform = 'youtube';

  if (platformHint && detectedPlatform && platformHint !== detectedPlatform) {
    const platformNames: Record<StreamPlatform, string> = {
      twitch: 'Twitch',
      kick: 'Kick',
      youtube: 'YouTube',
    };
    return {
      valid: false,
      error: `Você selecionou a plataforma ${platformNames[platformHint]}, mas inseriu um link da ${platformNames[detectedPlatform]}. Ajuste a plataforma selecionada ou corrija o link informado.`,
    };
  }

  const parsed = parseChannelInput(trimmed, platformHint);
  if (!parsed) {
    return {
      valid: false,
      error: 'Formato de canal inválido. Forneça o link completo ou o nome de usuário da Twitch, Kick ou YouTube.',
    };
  }

  // Validate format and length rules per platform
  if (parsed.platform === 'twitch') {
    if (!/^[a-zA-Z0-9_]{3,25}$/.test(parsed.channelName)) {
      return {
        valid: false,
        error: 'Nome de canal da Twitch inválido. Deve ter entre 3 e 25 caracteres (letras, números ou sublinhados, sem espaços).',
      };
    }
  } else if (parsed.platform === 'kick') {
    if (!/^[a-zA-Z0-9_\-]{3,30}$/.test(parsed.channelName)) {
      return {
        valid: false,
        error: 'Nome de canal da Kick inválido. Deve ter entre 3 e 30 caracteres (letras, números, hifens ou sublinhados).',
      };
    }
  } else if (parsed.platform === 'youtube') {
    const isChannelId = /^UC[a-zA-Z0-9_\-]{20,24}$/.test(parsed.channelName);
    const isHandle = /^[a-zA-Z0-9_\-\.]{3,35}$/.test(parsed.channelName);
    if (!isChannelId && !isHandle) {
      return {
        valid: false,
        error: 'Identificador do YouTube inválido. Forneça o @identificador do canal ou o link completo do canal.',
      };
    }
  }

  return { valid: true, parsed };
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
