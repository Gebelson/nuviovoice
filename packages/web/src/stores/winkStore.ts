import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  OFFICIAL_WINKS,
  getOfficialWink,
  resolveWinkMediaUrls,
  type OfficialWink,
  type WinkContactMute,
  type WinkMuteDuration,
} from '@concord/shared/src/winks';
import { api } from '../api/client';
import { AudioManager } from '../audio/AudioManager';
import { useUIStore } from './uiStore';

export interface WinkSettings {
  autoplay: boolean;
  playAudio: boolean;
  playAudioInBackground: boolean;
  playAudioInCall: boolean;
  volume: number; // 0 - 100
  notifyWinks: boolean;
  notifyWinksInBackground: boolean;
  reduceMotion: boolean;
  disableIncoming: boolean;
}

export interface ActiveWink {
  winkId: string;
  senderName?: string;
  senderId?: string;
  isLocalReplay?: boolean;
  channelId?: string | null;
  startedAt: number;
  messageId?: string;
  origin?: string;
}

interface WinkState {
  settings: WinkSettings;
  favoriteWinkIds: string[];
  recentWinkIds: string[];
  contactMutes: Record<string, WinkContactMute>;
  activeWink: ActiveWink | null;
  queue: ActiveWink[];
  isAutoplayBlocked: boolean;
  audioUnlocked: boolean;
  publishedWinks: OfficialWink[];
  isLoadingPublished: boolean;

  fetchPublishedWinks: () => Promise<void>;
  getWink: (id: string) => OfficialWink | undefined;
  triggerWink: (params: {
    winkId: string;
    senderName?: string;
    senderId?: string;
    isLocalReplay?: boolean;
    channelId?: string | null;
    messageId?: string;
    origin?: string;
  }) => void;
  queueWink: (params: {
    winkId: string;
    senderName?: string;
    senderId?: string;
    isLocalReplay?: boolean;
    channelId?: string | null;
    messageId?: string;
    origin?: string;
  }) => void;
  startWinkPlaybackTimer: (durationMs?: number) => void;
  dismissActiveWink: () => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  unlockAudio: () => void;
  hasProcessedMessage: (dedupeKey: string) => boolean;
  markMessageProcessed: (dedupeKey: string) => void;
  recordRecentWink: (winkId: string) => Promise<void>;
  updateSettings: (settings: Partial<WinkSettings>) => void;

  // Contact Mutes
  isContactMuted: (targetUserId: string) => boolean;
  getContactMute: (targetUserId: string) => WinkContactMute | undefined;
  fetchMutes: () => Promise<void>;
  setContactMute: (targetUserId: string, duration: WinkMuteDuration, targetUser?: any) => Promise<void>;
  removeContactMute: (targetUserId: string) => Promise<void>;

  // Favorites
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (winkId: string) => Promise<void>;

  // Recents
  fetchRecents: () => Promise<void>;
}

let winkTimer: ReturnType<typeof setTimeout> | null = null;

// Bounded in-memory deduplication set
const processedMessageKeys = new Set<string>();
const MAX_PROCESSED_KEYS = 500;

export const useWinkStore = create<WinkState>()(
  persist(
    (set, get) => ({
      settings: {
        autoplay: true,
        playAudio: true,
        playAudioInBackground: true,
        playAudioInCall: false,
        volume: 80,
        notifyWinks: true,
        notifyWinksInBackground: true,
        reduceMotion: false,
        disableIncoming: false,
      },
      favoriteWinkIds: [],
      recentWinkIds: ['diabravinho', 'bolsogado', 'nikole'],
      contactMutes: {},
      activeWink: null,
      queue: [],
      isAutoplayBlocked: false,
      audioUnlocked: false,
      publishedWinks: [...OFFICIAL_WINKS],
      isLoadingPublished: false,

      fetchPublishedWinks: async () => {
        set({ isLoadingPublished: true });
        try {
          const list = await api.winks.list();
          const map = new Map<string, OfficialWink>();
          // Base presets first with resolved static paths
          for (const w of OFFICIAL_WINKS) {
            const resolved = resolveWinkMediaUrls(w);
            map.set(w.id, {
              ...w,
              webmUrl: resolved.webmUrl,
              mp4Url: resolved.mp4Url,
              alphaMp4Url: resolved.alphaMp4Url,
              thumbnailUrl: resolved.thumbnailUrl,
            });
          }
          // Merge API items, preserving static asset resolution
          for (const w of list) {
            const resolved = resolveWinkMediaUrls(w);
            map.set(w.id, {
              ...w,
              webmUrl: resolved.webmUrl,
              mp4Url: resolved.mp4Url,
              alphaMp4Url: resolved.alphaMp4Url,
              thumbnailUrl: resolved.thumbnailUrl,
            });
          }
          set({ publishedWinks: Array.from(map.values()), isLoadingPublished: false });
        } catch {
          // If server call fails, fallback to official presets
          set({ publishedWinks: [...OFFICIAL_WINKS], isLoadingPublished: false });
        } finally {
          try {
            AudioManager.getInstance().preloadWinkSounds();
          } catch {}
        }
      },

      getWink: (id: string) => {
        const state = get();
        return state.publishedWinks.find((w) => w.id === id) || getOfficialWink(id);
      },

      hasProcessedMessage: (dedupeKey: string) => {
        return processedMessageKeys.has(dedupeKey);
      },

      markMessageProcessed: (dedupeKey: string) => {
        if (processedMessageKeys.size >= MAX_PROCESSED_KEYS) {
          const firstKey = processedMessageKeys.values().next().value;
          if (firstKey) processedMessageKeys.delete(firstKey);
        }
        processedMessageKeys.add(dedupeKey);
      },

      setAutoplayBlocked: (blocked: boolean) => {
        set({ isAutoplayBlocked: blocked });
      },

      unlockAudio: () => {
        set({ audioUnlocked: true, isAutoplayBlocked: false });
        try {
          const audio = AudioManager.getInstance();
          audio.resumeContext().catch(() => {});
        } catch {}
      },

      isContactMuted: (targetUserId: string) => {
        if (!targetUserId) return false;
        const mute = get().contactMutes[targetUserId];
        if (!mute) return false;
        if (mute.muteType === 'indefinite') return true;
        if (mute.expiresAt) {
          if (mute.expiresAt > Date.now()) {
            return true;
          } else {
            // Expired — remove locally
            const next = { ...get().contactMutes };
            delete next[targetUserId];
            set({ contactMutes: next });
            return false;
          }
        }
        return false;
      },

      getContactMute: (targetUserId: string) => {
        if (!targetUserId) return undefined;
        const mute = get().contactMutes[targetUserId];
        if (!mute) return undefined;
        if (mute.muteType === 'indefinite') return mute;
        if (mute.expiresAt && mute.expiresAt > Date.now()) return mute;
        return undefined;
      },

      fetchMutes: async () => {
        try {
          const mutesList = await api.winks.mutes.list();
          const map: Record<string, WinkContactMute> = {};
          for (const m of mutesList) {
            map[m.targetUserId] = m;
          }
          set({ contactMutes: map });
        } catch (err) {
          console.warn('[winkStore] Failed to fetch contact mutes:', err);
        }
      },

      setContactMute: async (targetUserId: string, duration: WinkMuteDuration, targetUser?: any) => {
        const prevMutes = get().contactMutes;
        const now = Date.now();
        let expiresAt: number | null = null;
        if (duration === '1h') expiresAt = now + 3600 * 1000;
        else if (duration === '8h') expiresAt = now + 8 * 3600 * 1000;
        else if (duration === '24h') expiresAt = now + 24 * 3600 * 1000;

        const optimisticMute: WinkContactMute = {
          id: prevMutes[targetUserId]?.id || `local-${now}`,
          userId: '',
          targetUserId,
          muteType: duration === 'indefinite' ? 'indefinite' : 'temporary',
          createdAt: prevMutes[targetUserId]?.createdAt || now,
          updatedAt: now,
          expiresAt,
          user: targetUser || prevMutes[targetUserId]?.user || null,
        };

        set({
          contactMutes: {
            ...prevMutes,
            [targetUserId]: optimisticMute,
          },
        });

        try {
          const serverMute = await api.winks.mutes.set(targetUserId, duration);
          set((state) => ({
            contactMutes: {
              ...state.contactMutes,
              [targetUserId]: serverMute,
            },
          }));
        } catch {
          set({ contactMutes: prevMutes });
          useUIStore.getState().addToast('Não foi possível silenciar o contato.', 'warning');
        }
      },

      removeContactMute: async (targetUserId: string) => {
        const prevMutes = get().contactMutes;
        const next = { ...prevMutes };
        delete next[targetUserId];
        set({ contactMutes: next });

        try {
          await api.winks.mutes.delete(targetUserId);
        } catch {
          set({ contactMutes: prevMutes });
          useUIStore.getState().addToast('Não foi possível reativar Winks do contato.', 'warning');
        }
      },

      fetchFavorites: async () => {
        try {
          const favs = await api.winks.favorites.list();
          set({ favoriteWinkIds: favs });
        } catch (err) {
          console.warn('[winkStore] Failed to fetch favorite winks:', err);
        }
      },

      toggleFavorite: async (winkId: string) => {
        const current = get().favoriteWinkIds;
        const isFav = current.includes(winkId);
        const next = isFav ? current.filter((id) => id !== winkId) : [...current, winkId];

        set({ favoriteWinkIds: next });

        try {
          if (isFav) {
            await api.winks.favorites.remove(winkId);
          } else {
            await api.winks.favorites.add(winkId);
          }
        } catch {
          set({ favoriteWinkIds: current });
          useUIStore.getState().addToast('Não foi possível atualizar favoritos.', 'warning');
        }
      },

      fetchRecents: async () => {
        try {
          const recents = await api.winks.recents.list();
          if (Array.isArray(recents) && recents.length > 0) {
            set({ recentWinkIds: recents.slice(0, 20) });
          }
        } catch (err) {
          console.warn('[winkStore] Failed to fetch recent winks:', err);
        }
      },

      recordRecentWink: async (winkId: string) => {
        if (!winkId) return;
        set((state) => {
          const filtered = state.recentWinkIds.filter((id) => id !== winkId);
          return {
            recentWinkIds: [winkId, ...filtered].slice(0, 20),
          };
        });

        try {
          await api.winks.recents.record(winkId);
        } catch {}
      },

      queueWink: (params) => {
        const state = get();
        // If sender is muted and not local replay, do not queue
        if (!params.isLocalReplay && params.senderId && state.isContactMuted(params.senderId)) {
          return;
        }

        if (!state.activeWink) {
          state.triggerWink(params);
        } else {
          if (state.queue.length < 3) {
            set((s) => ({
              queue: [
                ...s.queue,
                {
                  ...params,
                  startedAt: Date.now(),
                },
              ],
            }));
          }
        }
      },

      triggerWink: ({ winkId, senderName, senderId, isLocalReplay = false, channelId, messageId, origin }) => {
        const state = get();
        const { settings } = state;

        if (!isLocalReplay) {
          if (!settings.autoplay || settings.disableIncoming) {
            return;
          }
          if (senderId && state.isContactMuted(senderId)) {
            return;
          }
        }

        const wink = state.getWink(winkId);
        if (!wink) return;

        if (!wink.webmUrl && !wink.mp4Url) {
          return;
        }

        if (winkTimer) {
          clearTimeout(winkTimer);
          winkTimer = null;
        }

        const active: ActiveWink = {
          winkId,
          senderName: senderName || 'Alguém',
          senderId,
          isLocalReplay,
          channelId,
          messageId,
          origin,
          startedAt: Date.now(),
        };

        set({ activeWink: active, isAutoplayBlocked: false });

        winkTimer = setTimeout(() => {
          const current = get().activeWink;
          if (current && current.startedAt === active.startedAt) {
            get().dismissActiveWink();
          }
        }, 15000);
      },

      startWinkPlaybackTimer: (durationMs?: number) => {
        if (winkTimer) {
          clearTimeout(winkTimer);
          winkTimer = null;
        }
        const duration = (durationMs && durationMs > 0 ? durationMs : 5000) + 1500;
        winkTimer = setTimeout(() => {
          get().dismissActiveWink();
        }, duration);
      },

      dismissActiveWink: () => {
        if (winkTimer) {
          clearTimeout(winkTimer);
          winkTimer = null;
        }

        const state = get();
        if (state.queue.length > 0) {
          const [next, ...remainingQueue] = state.queue;
          if (next) {
            set({ activeWink: next, queue: remainingQueue, isAutoplayBlocked: false });
            winkTimer = setTimeout(() => {
              const current = get().activeWink;
              if (current && current.startedAt === next.startedAt) {
                get().dismissActiveWink();
              }
            }, 15000);
          } else {
            set({ activeWink: null, isAutoplayBlocked: false });
          }
        } else {
          set({ activeWink: null, isAutoplayBlocked: false });
        }
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },
    }),
    {
      name: 'nuvio_winks_settings_v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        favoriteWinkIds: state.favoriteWinkIds,
        recentWinkIds: state.recentWinkIds.slice(0, 20),
        contactMutes: state.contactMutes,
      }),
    }
  )
);
