export type WinkCategory =
  | 'humor'
  | 'reactions'
  | 'fun'
  | 'emotions'
  | 'celebration'
  | 'romance'
  | 'love'
  | 'troll'
  | 'drama';

export type WinkStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed';

export interface OfficialWink {
  id: string;
  name: string;
  nameKey?: string;
  description: string;
  category: WinkCategory;
  durationMs: number;
  hasAudio: boolean;
  soundType?: string;
  previewEmoji: string;

  // Media properties for uploaded video winks
  originalFilename?: string | null;
  originalMime?: string | null;
  originalSize?: number | null;
  videoPath?: string | null;
  webmPath?: string | null;
  webmUrl?: string | null;
  mp4Path?: string | null;
  mp4Url?: string | null;
  alphaMp4Url?: string | null;
  contentBounds?: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  thumbnailPath?: string | null;
  thumbnailUrl?: string | null;
  hasAlpha?: boolean;
  audioCodec?: string | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  defaultVolume?: number | null; // 0.0 to 1.0
  status?: WinkStatus;
  errorMessage?: string | null;
  published?: boolean;
  version?: number;
  creatorId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  publishedAt?: number | null;
}

export interface WinkAdminMetrics {
  total: number;
  published: number;
  processing: number;
  drafts: number;
  failed: number;
}

export interface WinkMessagePayload {
  type: 'wink';
  winkId: string;
  senderName?: string;
}

export interface SendWinkRequest {
  winkId: string;
}
export type WinkMuteDuration = '1h' | '8h' | '24h' | 'indefinite';

export interface WinkContactMute {
  id: string;
  userId: string;
  targetUserId: string;
  muteType: 'temporary' | 'indefinite';
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
  targetUser?: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
}

export interface SetWinkMuteRequest {
  duration: WinkMuteDuration;
}

export interface WinkFavoritesResponse {
  favorites: string[];
}

export interface WinkRecentsResponse {
  recents: string[];
}

/**
 * The official Winks catalog of Nuvio.
 * Exclusively contains the 3 official animations created from MOV:
 * 1. Diabravinho
 * 2. Bolsogado
 * 3. Nikole
 */
export const OFFICIAL_WINKS: readonly OfficialWink[] = [
  {
    id: 'diabravinho',
    name: 'Diabravinho',
    description: 'Animação oficial Diabravinho',
    category: 'humor',
    durationMs: 2834,
    hasAudio: true,
    previewEmoji: '😈',
    hasAlpha: true,
    webmUrl: '/winks/diabravinho.webm',
    mp4Url: '/winks/diabravinho.mp4',
    alphaMp4Url: '/winks/diabravinho_alpha.mp4',
    contentBounds: { minX: 450, maxX: 1490, minY: 0, maxY: 1040, width: 1040, height: 1040 },
    thumbnailUrl: '/winks/diabravinho_thumb.webp',
    width: 1920,
    height: 1080,
    fps: 24,
    defaultVolume: 1.0,
    status: 'completed',
    published: true,
  },
  {
    id: 'bolsogado',
    name: 'Bolsogado',
    description: 'Animação oficial Bolsogado',
    category: 'humor',
    durationMs: 5958,
    hasAudio: true,
    previewEmoji: '🐂',
    hasAlpha: true,
    webmUrl: '/winks/bolsogado.webm',
    mp4Url: '/winks/bolsogado.mp4',
    alphaMp4Url: '/winks/bolsogado_alpha.mp4',
    contentBounds: { minX: 410, maxX: 1410, minY: 0, maxY: 1080, width: 1000, height: 1080 },
    thumbnailUrl: '/winks/bolsogado_thumb.webp',
    width: 1920,
    height: 1080,
    fps: 24,
    defaultVolume: 1.0,
    status: 'completed',
    published: true,
  },
  {
    id: 'nikole',
    name: 'Nikole',
    description: 'Animação oficial Nikole',
    category: 'humor',
    durationMs: 5667,
    hasAudio: true,
    previewEmoji: '👱‍♀️',
    hasAlpha: true,
    webmUrl: '/winks/nikole.webm',
    mp4Url: '/winks/nikole.mp4',
    alphaMp4Url: '/winks/nikole_alpha.mp4',
    contentBounds: { minX: 410, maxX: 1520, minY: 0, maxY: 1080, width: 1110, height: 1080 },
    thumbnailUrl: '/winks/nikole_thumb.webp',
    width: 1920,
    height: 1080,
    fps: 24,
    defaultVolume: 1.0,
    status: 'completed',
    published: true,
  },
] as const;

export const OFFICIAL_WINK_MAP = new Map<string, OfficialWink>(
  OFFICIAL_WINKS.map((w) => [w.id, w as OfficialWink]),
);

export function getOfficialWink(id: string): OfficialWink | undefined {
  return OFFICIAL_WINK_MAP.get(id);
}

export interface ResolvedWinkMediaUrls {
  webmUrl: string;
  mp4Url: string;
  alphaMp4Url?: string;
  thumbnailUrl: string;
}

/**
 * Centralized resolution of Wink media URLs.
 * For official catalog animations, prioritizes the static published assets under /winks/
 * avoiding reliance on dynamic or nonexistent /api/winks/media paths.
 */
export function resolveWinkMediaUrls(wink: {
  id: string;
  webmUrl?: string | null;
  mp4Url?: string | null;
  thumbnailUrl?: string | null;
}): ResolvedWinkMediaUrls {
  const isOfficial = OFFICIAL_WINK_MAP.has(wink.id);
  if (isOfficial) {
    return {
      webmUrl: `/winks/${wink.id}.webm`,
      mp4Url: `/winks/${wink.id}.mp4`,
      alphaMp4Url: `/winks/${wink.id}_alpha.mp4`,
      thumbnailUrl: `/winks/${wink.id}_thumb.webp`,
    };
  }
  return {
    webmUrl: wink.webmUrl || `/winks/${wink.id}.webm`,
    mp4Url: wink.mp4Url || `/winks/${wink.id}.mp4`,
    alphaMp4Url: `/winks/${wink.id}_alpha.mp4`,
    thumbnailUrl: wink.thumbnailUrl || `/winks/${wink.id}_thumb.webp`,
  };
}

export function isValidWinkId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

export function isWinkContent(content: string | null | undefined): { isWink: boolean; winkId: string | null } {
  if (!content) return { isWink: false, winkId: null };
  const trimmed = content.trim();
  if (trimmed.startsWith('wink:')) {
    const id = trimmed.slice(5).trim();
    if (id.length > 0) return { isWink: true, winkId: id };
  }
  if (trimmed.startsWith('[wink:') && trimmed.endsWith(']')) {
    const id = trimmed.slice(6, -1).trim();
    if (id.length > 0) return { isWink: true, winkId: id };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      (parsed.type === 'wink' || parsed.event === 'wink' || parsed._nuvio_wink === true) &&
      typeof parsed.winkId === 'string' &&
      parsed.winkId.trim().length > 0
    ) {
      return { isWink: true, winkId: parsed.winkId.trim() };
    }
  } catch {
    // not JSON
  }
  return { isWink: false, winkId: null };
}

export function formatWinkContent(winkId: string, senderName?: string): string {
  return JSON.stringify({ type: 'wink', winkId, senderName });
}
