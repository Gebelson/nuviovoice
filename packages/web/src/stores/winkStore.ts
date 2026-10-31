import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getOfficialWink } from '@concord/shared/src/winks';
import { playWinkSound } from '../audio/winkAudio';

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

      triggerWink: ({ winkId, senderName, isLocalReplay = false, channelId }) => {
        const state = get();
        const { settings } = state;

        // Honor user preferences
        if (!isLocalReplay) {
          if (!settings.autoplay || settings.disableIncoming) {
            return;
          }
        }

        const wink = getOfficialWink(winkId);
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

        // Play audio if enabled
        if (settings.playAudio && wink.hasAudio) {
          try {
            playWinkSound(wink.soundType, settings.volume);
          } catch {
            // AudioContext restrictions handled gracefully
          }
        }

        // Auto-dismiss after wink duration
        const duration = wink.durationMs || 4000;
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
