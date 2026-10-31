import { create } from 'zustand';
import { Track } from 'livekit-client';
import { api } from '../api/client';
import { AudioManager } from '../audio/AudioManager';
import { useVoiceStore } from './voiceStore';
import { useSpaceStore, getChannelOrigin, getMyUserIdForOrigin } from './spaceStore';
import { getActiveRoom } from '../hooks/useLiveKit';
import type { SoundpadSound, SoundpadCategory, SoundScope } from '@concord/shared';

export interface SoundpadState {
  sounds: SoundpadSound[];
  categories: SoundpadCategory[];
  favorites: Set<string>;
  isLoading: boolean;
  error: string | null;
  playingSoundId: string | null;
  currentStopFn: (() => void) | null;
  searchQuery: string;
  activeCategory: string;
  expandedSections: {
    recent: boolean;
    personal: boolean;
    official: boolean;
    space: boolean;
  };

  loadSounds: (spaceId?: string | null) => Promise<void>;
  playSound: (
    sound: SoundpadSound,
    spaceId?: string | null,
    channelId?: string | null,
    options?: { volume?: number }
  ) => Promise<void>;
  stopCurrentSound: () => void;
  toggleFavorite: (soundId: string) => Promise<void>;
  createSound: (data: {
    name: string;
    audioBase64: string;
    format?: string;
    scope?: SoundScope;
    spaceId?: string | null;
    category?: string;
    emoji?: string | null;
    tags?: string[];
    defaultVolume?: number;
    durationMs?: number;
  }) => Promise<SoundpadSound | null>;
  deleteSound: (soundId: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  toggleSection: (sectionKey: 'recent' | 'personal' | 'official' | 'space') => void;
}

// 16 default official preset sounds
export const DEFAULT_OFFICIAL_SOUNDS: SoundpadSound[] = [
  { id: 'official-airhorn', name: 'Airhorn', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/airhorn.wav', builtinSoundId: 'airhorn', durationMs: 1300, defaultVolume: 0.85, emoji: '📢', tags: ['airhorn', 'buzina', 'hype', 'loud'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-crickets', name: 'Crickets', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/crickets.wav', builtinSoundId: 'crickets', durationMs: 1800, defaultVolume: 0.85, emoji: '🦗', tags: ['crickets', 'grilos', 'silence', 'awkward'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-sad-violin', name: 'Sad Violin', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/sad_violin.wav', builtinSoundId: 'sad_violin', durationMs: 2400, defaultVolume: 0.85, emoji: '🎻', tags: ['violin', 'triste', 'sad', 'drama'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-womp-womp', name: 'Womp Womp', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/womp_womp.wav', builtinSoundId: 'womp_womp', durationMs: 1400, defaultVolume: 0.85, emoji: '🎺', tags: ['womp', 'fail', 'trompete', 'derrota'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-rimshot', name: 'Rimshot', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/rimshot.wav', builtinSoundId: 'rimshot', durationMs: 600, defaultVolume: 0.85, emoji: '🥁', tags: ['rimshot', 'ba dum tss', 'piada', 'bateria'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-sad-trombone', name: 'Sad Trombone', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/sad_trombone.wav', builtinSoundId: 'sad_trombone', durationMs: 2200, defaultVolume: 0.85, emoji: '📯', tags: ['trombone', 'fail', 'wah wah'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-dun-dun-dun', name: 'DUN DUN DUN', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/dun_dun_dun.wav', builtinSoundId: 'dun_dun_dun', durationMs: 2000, defaultVolume: 0.85, emoji: '⚡', tags: ['dun', 'dramatico', 'suspense', 'choque'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-vine-boom', name: 'Vine Boom', scope: 'official', ownerId: null, spaceId: null, category: 'Clássicos', audioUrl: '/sounds/soundpad/vine_boom.wav', builtinSoundId: 'vine_boom', durationMs: 1500, defaultVolume: 0.85, emoji: '💥', tags: ['boom', 'bass', 'meme', 'impacto'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-bruh', name: 'Bruh', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/bruh.wav', builtinSoundId: 'bruh', durationMs: 700, defaultVolume: 0.85, emoji: '🗿', tags: ['bruh', 'meme', 'facepalm', 'moai'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-oh-no', name: 'Oh No', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/oh_no.wav', builtinSoundId: 'oh_no', durationMs: 900, defaultVolume: 0.85, emoji: '😱', tags: ['oh no', 'desastre', 'meme', 'panico'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-sheesh', name: 'Sheesh', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/sheesh.wav', builtinSoundId: 'sheesh', durationMs: 1000, defaultVolume: 0.85, emoji: '🥶', tags: ['sheesh', 'hiss', 'apito', 'gelo'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-bonk', name: 'Bonk', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/bonk.wav', builtinSoundId: 'bonk', durationMs: 500, defaultVolume: 0.85, emoji: '🔨', tags: ['bonk', 'martelo', 'pancada', 'meme'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-noice', name: 'Noice', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/noice.wav', builtinSoundId: 'noice', durationMs: 700, defaultVolume: 0.85, emoji: '👌', tags: ['noice', 'nice', 'estalo', 'perfeito'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-sus', name: 'Sus', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/sus.wav', builtinSoundId: 'sus', durationMs: 1300, defaultVolume: 0.85, emoji: '👁️', tags: ['sus', 'among us', 'impostor', 'estranho'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-wilhelm', name: 'Wilhelm', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/wilhelm.wav', builtinSoundId: 'wilhelm', durationMs: 1200, defaultVolume: 0.85, emoji: '🗣️', tags: ['wilhelm', 'grito', 'scream', 'filme'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
  { id: 'official-toot', name: 'Toot', scope: 'official', ownerId: null, spaceId: null, category: 'Diversão', audioUrl: '/sounds/soundpad/toot.wav', builtinSoundId: 'toot', durationMs: 650, defaultVolume: 0.85, emoji: '🎉', tags: ['toot', 'festa', 'buzina', 'alegria'], isFavorite: false, playCount: 0, createdAt: new Date().toISOString() },
];

let _restoreMuteTimer: any = null;

export const useSoundpadStore = create<SoundpadState>((set, get) => ({
  sounds: DEFAULT_OFFICIAL_SOUNDS,
  categories: [
    { id: 'clássicos', name: 'Clássicos', count: 8 },
    { id: 'diversão', name: 'Diversão', count: 8 },
  ],
  favorites: new Set(),
  isLoading: false,
  error: null,
  playingSoundId: null,
  currentStopFn: null,
  searchQuery: '',
  activeCategory: 'all',
  expandedSections: {
    recent: true,
    personal: true,
    official: true,
    space: true,
  },

  loadSounds: async (spaceId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.soundpad.getSounds({
        spaceId: spaceId || undefined,
      });
      const favs = new Set(res.sounds.filter((s) => s.isFavorite).map((s) => s.id));
      set({
        sounds: res.sounds && res.sounds.length > 0 ? res.sounds : DEFAULT_OFFICIAL_SOUNDS,
        categories: res.categories || [],
        favorites: favs,
        isLoading: false,
      });
    } catch (err: any) {
      console.warn('[useSoundpadStore] Failed to load soundpad sounds from API, using fallback:', err);
      set({
        sounds: DEFAULT_OFFICIAL_SOUNDS,
        isLoading: false,
      });
    }
  },

  playSound: async (sound, spaceId, channelId, options) => {
    const { playingSoundId, stopCurrentSound } = get();

    // If this sound is currently playing, clicking it stops it
    if (playingSoundId === sound.id) {
      stopCurrentSound();
      return;
    }

    // Stop any previous sound before starting new one (Section 15: 1 sound per user)
    stopCurrentSound();

    const audioManager = AudioManager.getInstance();
    const soundpadMasterVolume = useVoiceStore.getState().soundpadVolume / 100;
    const effectiveVolume = (options?.volume ?? sound.defaultVolume ?? 1.0) * soundpadMasterVolume;

    set({ playingSoundId: sound.id });

    // Inform voiceStore about local active soundpad effect for UI badges/pulses
    useVoiceStore.getState().setActiveSoundpadEffect({
      soundId: sound.id,
      soundName: sound.name,
      emoji: sound.emoji || '🎵',
      userId: 'local',
      timestamp: Date.now(),
    });

    // Handle LiveKit transmission & mute unmute in room
    const activeRoom = getActiveRoom();
    let wasMutedBeforeSound = false;

    if (activeRoom) {
      try {
        const micPub = activeRoom.localParticipant.getTrackPublications()
          .find((p) => p.source === Track.Source.Microphone);

        if (micPub?.isMuted) {
          wasMutedBeforeSound = true;
          // Unmute track in LiveKit so WebRTC sends audio packets,
          // while micMuteGain keeps physical mic at 0
          await activeRoom.localParticipant.setMicrophoneEnabled(true);
        } else if (!micPub) {
          const freshTrack = audioManager.getFreshTrack();
          if (freshTrack) {
            await activeRoom.localParticipant.publishTrack(freshTrack, {
              name: 'microphone',
              source: Track.Source.Microphone,
            });
            wasMutedBeforeSound = true;
          }
        }

        // Broadcast soundpad_play to all remote peers
        const payload = JSON.stringify({
          type: 'soundpad_play',
          soundId: sound.id,
          soundName: sound.name,
          emoji: sound.emoji || '🎵',
          userId: activeRoom.localParticipant.identity,
          volume: effectiveVolume,
          timestamp: Date.now(),
        });

        await activeRoom.localParticipant.publishData(new TextEncoder().encode(payload), {
          reliable: true,
        });
      } catch (err) {
        console.warn('[Soundpad] LiveKit broadcast error:', err);
      }
    }

    // Record usage stat asynchronously
    api.soundpad.recordPlay(sound.id, {
      spaceId: spaceId || undefined,
      channelId: channelId || undefined,
      volume: effectiveVolume,
    }).catch(() => {});

    // Update playCount locally
    set((state) => ({
      sounds: state.sounds.map((s) =>
        s.id === sound.id ? { ...s, playCount: (s.playCount || 0) + 1 } : s
      ),
    }));

    const cleanupSound = async () => {
      if (get().playingSoundId === sound.id) {
        set({ playingSoundId: null, currentStopFn: null });
        if (useVoiceStore.getState().activeSoundpadEffect?.soundId === sound.id) {
          useVoiceStore.getState().setActiveSoundpadEffect(null);
        }
      }

      // If user was effectively muted before playing, re-mute the LiveKit track
      if (wasMutedBeforeSound && activeRoom) {
        try {
          const vs = useVoiceStore.getState();
          const cvId = vs.currentVoiceChannelId;
          const effOrigin = cvId ? getChannelOrigin(cvId) : '';
          const effMyId = cvId ? getMyUserIdForOrigin(effOrigin) : undefined;
          const effSpaceId = cvId ? useSpaceStore.getState().channelToSpaceMap.get(cvId) : null;
          const effKey = (effSpaceId && effMyId) ? `${effSpaceId}:${effMyId}` : '';
          const effectiveMuted = vs.isMuted || vs.spaceMutedUserIds.has(effKey) || vs.permissionMutedUserIds.has(effKey);

          if (effectiveMuted) {
            await activeRoom.localParticipant.setMicrophoneEnabled(false);
          }
        } catch (err) {
          console.warn('[Soundpad] Error restoring mute state:', err);
        }
      }
    };

    const result = await audioManager.playSoundpad(
      sound.audioUrl || sound.builtinSoundId || sound.id,
      {
        volume: effectiveVolume,
        onEnded: () => {
          void cleanupSound();
        },
      }
    );

    if (result) {
      set({
        currentStopFn: () => {
          result.stop();
          void cleanupSound();
        },
      });
    } else {
      void cleanupSound();
    }
  },

  stopCurrentSound: () => {
    const { currentStopFn } = get();
    if (currentStopFn) {
      try {
        currentStopFn();
      } catch {}
    }
    AudioManager.getInstance().stopAllSoundpad();
    set({ playingSoundId: null, currentStopFn: null });
    useVoiceStore.getState().setActiveSoundpadEffect(null);
  },

  toggleFavorite: async (soundId: string) => {
    // Optimistic toggle
    const currentFavs = new Set(get().favorites);
    const isNowFav = !currentFavs.has(soundId);
    if (isNowFav) {
      currentFavs.add(soundId);
    } else {
      currentFavs.delete(soundId);
    }

    set((state) => ({
      favorites: currentFavs,
      sounds: state.sounds.map((s) =>
        s.id === soundId ? { ...s, isFavorite: isNowFav } : s
      ),
    }));

    try {
      const res = await api.soundpad.toggleFavorite(soundId);
      if (res.isFavorite !== isNowFav) {
        const correctedFavs = new Set(get().favorites);
        if (res.isFavorite) correctedFavs.add(soundId);
        else correctedFavs.delete(soundId);
        set((state) => ({
          favorites: correctedFavs,
          sounds: state.sounds.map((s) =>
            s.id === soundId ? { ...s, isFavorite: res.isFavorite } : s
          ),
        }));
      }
    } catch (err) {
      console.error('[useSoundpadStore] Failed to toggle favorite:', err);
    }
  },

  createSound: async (data) => {
    try {
      const res = await api.soundpad.createSound(data);
      if (res.sound) {
        set((state) => ({
          sounds: [res.sound, ...state.sounds],
        }));
        return res.sound;
      }
      return null;
    } catch (err: any) {
      console.error('[useSoundpadStore] Failed to create sound:', err);
      throw err;
    }
  },

  deleteSound: async (soundId: string) => {
    try {
      await api.soundpad.deleteSound(soundId);
      set((state) => ({
        sounds: state.sounds.filter((s) => s.id !== soundId),
      }));
      return true;
    } catch (err) {
      console.error('[useSoundpadStore] Failed to delete sound:', err);
      return false;
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setActiveCategory: (activeCategory: string) => set({ activeCategory }),
  toggleSection: (sectionKey) =>
    set((state) => ({
      expandedSections: {
        ...state.expandedSections,
        [sectionKey]: !state.expandedSections[sectionKey],
      },
    })),
}));
