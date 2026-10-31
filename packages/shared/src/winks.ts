export type WinkCategory = 'romance' | 'fun' | 'emotions' | 'celebration';

export interface OfficialWink {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  category: WinkCategory;
  durationMs: number;
  hasAudio: boolean;
  soundType: string;
  previewEmoji: string;
}

export interface WinkMessagePayload {
  type: 'wink';
  winkId: string;
  senderName?: string;
}

export interface SendWinkRequest {
  winkId: string;
}

export const OFFICIAL_WINKS: readonly OfficialWink[] = [
  {
    id: 'kiss',
    name: 'Beijo animado',
    nameKey: 'winks.kiss',
    description: 'Um beijo carinhoso com marcas de batom e corações flutuantes',
    category: 'romance',
    durationMs: 4000,
    hasAudio: true,
    soundType: 'kiss',
    previewEmoji: '💋',
  },
  {
    id: 'giant-heart',
    name: 'Coração gigante',
    nameKey: 'winks.giantHeart',
    description: 'Um coração enorme pulsando forte sobre a tela',
    category: 'romance',
    durationMs: 4200,
    hasAudio: true,
    soundType: 'heartbeat',
    previewEmoji: '💖',
  },
  {
    id: 'heart-rain',
    name: 'Chuva de corações',
    nameKey: 'winks.heartRain',
    description: 'Uma doce cascata de corações multicoloridos caindo pelo chat',
    category: 'romance',
    durationMs: 4500,
    hasAudio: true,
    soundType: 'sparkle',
    previewEmoji: '🌧️',
  },
  {
    id: 'confetti',
    name: 'Confetes',
    nameKey: 'winks.confetti',
    description: 'Chuva vibrante de confetes e serpentinas festivas',
    category: 'celebration',
    durationMs: 4000,
    hasAudio: true,
    soundType: 'party',
    previewEmoji: '🎉',
  },
  {
    id: 'popping-balloon',
    name: 'Balão explodindo',
    nameKey: 'winks.poppingBalloon',
    description: 'Um balão que infla rapidamente até estourar em partículas',
    category: 'fun',
    durationMs: 4000,
    hasAudio: true,
    soundType: 'pop',
    previewEmoji: '🎈',
  },
  {
    id: 'laughing-face',
    name: 'Personagem dando risada',
    nameKey: 'winks.laughingFace',
    description: 'Gargalhadas incontroláveis com lágrimas de tanto rir',
    category: 'emotions',
    durationMs: 4200,
    hasAudio: true,
    soundType: 'laugh',
    previewEmoji: '😂',
  },
  {
    id: 'crying-face',
    name: 'Personagem chorando',
    nameKey: 'winks.cryingFace',
    description: 'Um choro dramático e cômico com jatos d’água',
    category: 'emotions',
    durationMs: 4200,
    hasAudio: true,
    soundType: 'cry',
    previewEmoji: '😭',
  },
  {
    id: 'angry-face',
    name: 'Personagem bravo',
    nameKey: 'winks.angryFace',
    description: 'Rosto vermelho saindo fumaça e faíscas de irritação',
    category: 'emotions',
    durationMs: 3800,
    hasAudio: true,
    soundType: 'angry',
    previewEmoji: '😡',
  },
  {
    id: 'shooting-stars',
    name: 'Estrelas caindo',
    nameKey: 'winks.shootingStars',
    description: 'Estrelas cadentes brilhantes cruzando o céu noturno do chat',
    category: 'fun',
    durationMs: 4500,
    hasAudio: true,
    soundType: 'chime',
    previewEmoji: '🌠',
  },
  {
    id: 'blooming-flower',
    name: 'Flor desabrochando',
    nameKey: 'winks.bloomingFlower',
    description: 'Uma flor graciosa se abrindo com pétalas e borboletas',
    category: 'romance',
    durationMs: 4200,
    hasAudio: true,
    soundType: 'bloom',
    previewEmoji: '🌸',
  },
  {
    id: 'warm-hug',
    name: 'Abraço animado',
    nameKey: 'winks.warmHug',
    description: 'Braços carinhosos que abraçam a conversa com aconchego',
    category: 'emotions',
    durationMs: 4000,
    hasAudio: true,
    soundType: 'hug',
    previewEmoji: '🤗',
  },
  {
    id: 'funky-dance',
    name: 'Dança engraçada',
    nameKey: 'winks.funkyDance',
    description: 'Passinhos de discoteca hilários com luzes e ritmo contagiante',
    category: 'fun',
    durationMs: 4800,
    hasAudio: true,
    soundType: 'dance',
    previewEmoji: '🕺',
  },
  {
    id: 'fireworks',
    name: 'Fogos de artifício',
    nameKey: 'winks.fireworks',
    description: 'Espetáculo grandioso de explosões multicoloridas com brilho',
    category: 'celebration',
    durationMs: 4800,
    hasAudio: true,
    soundType: 'fireworks',
    previewEmoji: '🎆',
  },
  {
    id: 'in-love',
    name: 'Carinha apaixonada',
    nameKey: 'winks.inLove',
    description: 'Olhos de coração pulsando de amor flutuante',
    category: 'romance',
    durationMs: 4000,
    hasAudio: true,
    soundType: 'love',
    previewEmoji: '😍',
  },
  {
    id: 'knocking-screen',
    name: 'Personagem batendo na tela',
    nameKey: 'winks.knockingScreen',
    description: 'Batidas fortes na tela fazendo a conversa vibrar como no MSN!',
    category: 'fun',
    durationMs: 4500,
    hasAudio: true,
    soundType: 'knock',
    previewEmoji: '✊',
  },
  {
    id: 'surprise-gift',
    name: 'Presente surpresa',
    nameKey: 'winks.surpriseGift',
    description: 'Uma caixa de presente que se abre revelando festa e alegria',
    category: 'celebration',
    durationMs: 4200,
    hasAudio: true,
    soundType: 'gift',
    previewEmoji: '🎁',
  },
] as const;

export const OFFICIAL_WINK_MAP = new Map<string, OfficialWink>(
  OFFICIAL_WINKS.map((w) => [w.id, w]),
);

export function getOfficialWink(id: string): OfficialWink | undefined {
  return OFFICIAL_WINK_MAP.get(id);
}

export function isValidWinkId(id: unknown): id is string {
  return typeof id === 'string' && OFFICIAL_WINK_MAP.has(id);
}

export function isWinkContent(content: string | null | undefined): { isWink: boolean; winkId: string | null } {
  if (!content) return { isWink: false, winkId: null };
  const trimmed = content.trim();
  if (trimmed.startsWith('wink:')) {
    const id = trimmed.slice(5).trim();
    if (isValidWinkId(id)) return { isWink: true, winkId: id };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      (parsed.type === 'wink' || parsed.event === 'wink' || parsed._nuvio_wink === true) &&
      typeof parsed.winkId === 'string' &&
      isValidWinkId(parsed.winkId)
    ) {
      return { isWink: true, winkId: parsed.winkId };
    }
  } catch {
    // not JSON
  }
  return { isWink: false, winkId: null };
}

export function formatWinkContent(winkId: string, senderName?: string): string {
  return JSON.stringify({ type: 'wink', winkId, senderName });
}
