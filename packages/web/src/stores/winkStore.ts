import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OFFICIAL_WINKS, getOfficialWink, resolveWinkMediaUrls, type OfficialWink } from '@concord/shared/src/winks';
import { api } from '../api/client';
import { AudioManager } from '../audio/AudioManager';

export interface WinkSettings {
  autoplay: boolean;
  playAudio: boolean;
  volume: number; // 0 - 100
  reduceMotion: boolean;
  disableIncoming: boolean;
}

export interface ActiveWink {
  winkId: string;
  senderName?: string;
  isLocalReplay?: boolean;
  channelId?: string | null;
  startedAt: number;
  messageId?: string;
  origin?: string;
}

interface WinkState {
  settings: WinkSettings;
  recentWinkIds: string[];
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
    isLocalReplay?: boolean;
    channelId?: string | null;
    messageId?: string;
    origin?: string;
  }) => void;
  queueWink: (params: {
    winkId: string;
    senderName?: string;
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
  recordRecentWink: (winkId: string) => void;
  updateSettings: (settings: Partial<WinkSettings>) => void;
}

let winkTimer: ReturnType<typeof setTimeout> | null = null;

const VALID_CATALOG_IDS = new Set(['diabravinho', 'bolsogado', 'nikole']);

function filterValidIds(ids: string[]): string[] {
  return ids.filter((id) => VALID_CATALOG_IDS.has(id));
}

// Bounded in-memory deduplication set
const processedMessageKeys = new Set<string>();
const MAX_PROCESSED_KEYS = 500;

export const useWinkStore = create<WinkState>()(
  persist(
    (set, get) => ({
      settings: {
        autoplay: true,
        playAudio: true,
        volume: 80,
        reduceMotion: false,
        disableIncoming: false,
      },
      recentWinkIds: ['diabravinho', 'bolsogado', 'nikole'],
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
          // Merge API items, strictly filtering out any legacy preset IDs and preserving static asset resolution
          for (const w of list) {
            if (VALID_CATALOG_IDS.has(w.id)) {
              const resolved = resolveWinkMediaUrls(w);
              map.set(w.id, {
                ...w,
                webmUrl: resolved.webmUrl,
                mp4Url: resolved.mp4Url,
                alphaMp4Url: resolved.alphaMp4Url,
                thumbnailUrl: resolved.thumbnailUrl,
              });
            }
          }
          set({ publishedWinks: Array.from(map.values()), isLoadingPublished: false });
        } catch {
          // If server call fails, fallback strictly to the 3 new winks
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
          // Evict oldest elements
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
        } catch {
          // Audio manager resume optional
        }
      },

      queueWink: (params) => {
        const state = get();
        // If nothing is playing, play immediately
        if (!state.activeWink) {
          state.triggerWink(params);
        } else {
          // Otherwise enqueue (limit queue to 3 items to avoid backlog)
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

      triggerWink: ({ winkId, senderName, isLocalReplay = false, channelId, messageId, origin }) => {
        const state = get();
        const { settings } = state;

        // Honor user preferences for incoming winks
        if (!isLocalReplay) {
          if (!settings.autoplay || settings.disableIncoming) {
            return;
          }
        }

        const wink = state.getWink(winkId);
        if (!wink) return;

        // Don't attempt to play nonexistent or legacy animations without media
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
          isLocalReplay,
          channelId,
          messageId,
          origin,
          startedAt: Date.now(),
        };

        set({ activeWink: active, isAutoplayBlocked: false });

        // Fallback safety timeout (15s): in case network drops or browser completely stalls
        // before confirming playback, ensure overlay doesn't hang indefinitely.
        // Once playback actually starts, startWinkPlaybackTimer sets the definitive timer.
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
        // Safety timeout begins ONLY after video confirmed started playing.
        // The natural end event (onEnded) handles normal termination.
        // This timer gives an extra safety margin to prevent premature disappearance.
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
            // Start fallback timer for next wink
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

      recordRecentWink: (winkId: string) => {
        if (!VALID_CATALOG_IDS.has(winkId)) return;
        set((state) => {
          const filtered = filterValidIds(state.recentWinkIds).filter((id) => id !== winkId);
          return {
            recentWinkIds: [winkId, ...filtered].slice(0, 3),
          };
        });
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
      name: 'nuvio_winks_settings_v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        recentWinkIds: filterValidIds(state.recentWinkIds),
      }),
    }
  )
);
