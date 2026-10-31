import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OFFICIAL_WINKS, getOfficialWink, type OfficialWink } from '@concord/shared/src/winks';
import { playWinkSound } from '../audio/winkAudio';
import { api } from '../api/client';

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
}

interface WinkState {
  settings: WinkSettings;
  recentWinkIds: string[];
  activeWink: ActiveWink | null;
  publishedWinks: OfficialWink[];
  isLoadingPublished: boolean;

  fetchPublishedWinks: () => Promise<void>;
  getWink: (id: string) => OfficialWink | undefined;
  triggerWink: (params: {
    winkId: string;
    senderName?: string;
    isLocalReplay?: boolean;
    channelId?: string | null;
  }) => void;
  dismissActiveWink: () => void;
  recordRecentWink: (winkId: string) => void;
  updateSettings: (settings: Partial<WinkSettings>) => void;
}

let winkTimer: ReturnType<typeof setTimeout> | null = null;

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
      recentWinkIds: ['kiss', 'giant-heart', 'confetti', 'knocking-screen'],
      activeWink: null,
      publishedWinks: [...OFFICIAL_WINKS],
      isLoadingPublished: false,

      fetchPublishedWinks: async () => {
        set({ isLoadingPublished: true });
        try {
          const list = await api.winks.list();
          // Merge with built-in presets ensuring presets are preserved
          const map = new Map<string, OfficialWink>();
          for (const w of OFFICIAL_WINKS) {
            map.set(w.id, w);
          }
          for (const w of list) {
            map.set(w.id, w);
          }
          set({ publishedWinks: Array.from(map.values()), isLoadingPublished: false });
        } catch {
          // If server call fails, fallback to built-in presets
          set({ publishedWinks: [...OFFICIAL_WINKS], isLoadingPublished: false });
        }
      },

      getWink: (id: string) => {
        const state = get();
        const found = state.publishedWinks.find((w) => w.id === id);
        if (found) return found;
        return getOfficialWink(id);
      },

      triggerWink: ({ winkId, senderName, isLocalReplay = false, channelId }) => {
        const state = get();
        const { settings } = state;

        // Honor user preferences
        if (!isLocalReplay) {
          if (!settings.autoplay || settings.disableIncoming) {
            return;
          }
        }

        const wink = state.getWink(winkId);
        if (!wink) return;

        if (winkTimer) {
          clearTimeout(winkTimer);
          winkTimer = null;
        }

        const active: ActiveWink = {
          winkId,
          senderName: senderName || 'Alguém',
          isLocalReplay,
          channelId,
          startedAt: Date.now(),
        };

        set({ activeWink: active });

        // If it's a procedural built-in wink without a video file, play WebAudio sound
        const isVideo = !!(wink.webmUrl || wink.mp4Url);
        if (!isVideo && settings.playAudio && wink.hasAudio && wink.soundType) {
          try {
            playWinkSound(wink.soundType, settings.volume);
          } catch {
            // AudioContext restrictions handled gracefully
          }
        }

        // Auto-dismiss safety timer (video onEnded also calls dismissActiveWink)
        const duration = (wink.durationMs || 4000) + 500;
        winkTimer = setTimeout(() => {
          set({ activeWink: null });
          winkTimer = null;
        }, duration);
      },

      dismissActiveWink: () => {
        if (winkTimer) {
          clearTimeout(winkTimer);
          winkTimer = null;
        }
        set({ activeWink: null });
      },

      recordRecentWink: (winkId: string) => {
        set((state) => {
          const filtered = state.recentWinkIds.filter((id) => id !== winkId);
          return {
            recentWinkIds: [winkId, ...filtered].slice(0, 8),
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
      name: 'nuvio_winks_settings_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        recentWinkIds: state.recentWinkIds,
      }),
    }
  )
);
