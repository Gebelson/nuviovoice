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
    webmUrl: '/api/winks/media/diabravinho.webm',
    mp4Url: '/api/winks/media/diabravinho.mp4',
    thumbnailUrl: '/api/winks/media/diabravinho_thumb.webp',
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
    webmUrl: '/api/winks/media/bolsogado.webm',
    mp4Url: '/api/winks/media/bolsogado.mp4',
    thumbnailUrl: '/api/winks/media/bolsogado_thumb.webp',
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
    webmUrl: '/api/winks/media/nikole.webm',
    mp4Url: '/api/winks/media/nikole.mp4',
    thumbnailUrl: '/api/winks/media/nikole_thumb.webp',
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
