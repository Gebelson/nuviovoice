import { create } from 'zustand';
import type { LiveStreamInfo } from '@concord/shared';
import { api } from '../api/client';

export type LivePlayerMode = 'main' | 'floating' | 'minimized' | 'closed';

export interface FloatingCoordinates {
  x: number;
  y: number;
}

export interface FloatingDimensions {
  width: number;
  height: number;
}

export interface LiveStreamStoreState {
  liveStreams: LiveStreamInfo[];
  activeStream: LiveStreamInfo | null;
  playerMode: LivePlayerMode;
  floatingPosition: FloatingCoordinates;
  floatingSize: FloatingDimensions;
  anchorRect: { top: number; left: number; width: number; height: number } | null;
  isMuted: boolean;
  isNativePipActive: boolean;
  isLoading: boolean;

  // Actions
  loadLiveStreams: () => Promise<void>;
  openStream: (stream: LiveStreamInfo, mode?: LivePlayerMode) => void;
  openStreamById: (channelId: string) => Promise<LiveStreamInfo | null>;
  setPlayerMode: (mode: LivePlayerMode) => void;
  closeStream: () => void;
  minimizeStream: () => void;
  restoreStream: (targetMode?: LivePlayerMode) => void;
  setFloatingPosition: (pos: FloatingCoordinates) => void;
  setFloatingSize: (size: FloatingDimensions) => void;
  setAnchorRect: (rect: { top: number; left: number; width: number; height: number } | null) => void;
  toggleMute: () => void;
  toggleNativePip: (containerEl?: HTMLElement | null) => Promise<void>;

  // WebSocket event listeners
  handleStreamStarted: (stream: LiveStreamInfo) => void;
  handleStreamUpdated: (stream: LiveStreamInfo) => void;
  handleStreamEnded: (channelId: string, userId: string) => void;
}

const DEFAULT_FLOATING_WIDTH = 384; // 16:9 width
const DEFAULT_FLOATING_HEIGHT = 216; // 16:9 height

function getInitialFloatingPosition(): FloatingCoordinates {
  if (typeof window === 'undefined') return { x: 24, y: 24 };
  const margin = 24;
  const width = Math.min(DEFAULT_FLOATING_WIDTH, window.innerWidth - 32);
  const height = Math.round((width * 9) / 16);
  return {
    x: Math.max(margin, window.innerWidth - width - margin),
    y: Math.max(margin, window.innerHeight - height - margin - 32),
  };
}

let nativePipWindow: Window | null = null;

export const useLiveStreamStore = create<LiveStreamStoreState>((set, get) => ({
  liveStreams: [],
  activeStream: null,
  playerMode: 'closed',
  floatingPosition: getInitialFloatingPosition(),
  floatingSize: { width: DEFAULT_FLOATING_WIDTH, height: DEFAULT_FLOATING_HEIGHT },
  anchorRect: null,
  isMuted: false,
  isNativePipActive: false,
  isLoading: false,

  loadLiveStreams: async () => {
    try {
      set({ isLoading: true });
      const res = await api.live.getStreams();
      const streams = res.streams || [];
      set({ liveStreams: streams, isLoading: false });

      // If activeStream is no longer live or updated, sync it
      const currentActive = get().activeStream;
      if (currentActive) {
        const matching = streams.find((s) => s.id === currentActive.id);
        if (matching) {
          set({ activeStream: matching });
        }
      }
    } catch {
      set({ isLoading: false });
    }
  },

  openStream: (stream: LiveStreamInfo, mode: LivePlayerMode = 'main') => {
    set({
      activeStream: stream,
      playerMode: mode,
    });
  },

  openStreamById: async (id: string) => {
    try {
      set({ isLoading: true });
      // First check local liveStreams
      const existing = get().liveStreams.find((s) => s.id === id || s.channelId === id);
      if (existing) {
        set({ activeStream: existing, playerMode: 'main', isLoading: false });
        return existing;
      }

      // Fetch from API
      const res = await api.live.getStream(id);
      if (res.stream) {
        set({ activeStream: res.stream, playerMode: 'main', isLoading: false });
        return res.stream;
      }
      set({ isLoading: false });
      return null;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  setPlayerMode: (mode: LivePlayerMode) => {
    if (mode === 'closed') {
      get().closeStream();
      return;
    }
    set({ playerMode: mode });
  },

  closeStream: () => {
    if (nativePipWindow) {
      try {
        nativePipWindow.close();
      } catch {
        // ignore
      }
      nativePipWindow = null;
    }
    set({
      activeStream: null,
      playerMode: 'closed',
      isNativePipActive: false,
    });
  },

  minimizeStream: () => {
    set({ playerMode: 'minimized' });
  },

  restoreStream: (targetMode: LivePlayerMode = 'main') => {
    set({ playerMode: targetMode });
  },

  setFloatingPosition: (pos: FloatingCoordinates) => {
    set({ floatingPosition: pos });
  },

  setFloatingSize: (size: FloatingDimensions) => {
    set({ floatingSize: size });
  },

  setAnchorRect: (rect) => {
    set({ anchorRect: rect });
  },

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }));
  },

  toggleNativePip: async (containerEl?: HTMLElement | null) => {
    if (typeof window === 'undefined') return;

    if (nativePipWindow) {
      nativePipWindow.close();
      nativePipWindow = null;
      set({ isNativePipActive: false });
      return;
    }

    // Check Document Picture-in-Picture API
    if ('documentPictureInPicture' in window && containerEl) {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: Math.round(get().floatingSize.width),
          height: Math.round(get().floatingSize.height),
        });

        nativePipWindow = pipWin;
        set({ isNativePipActive: true });

        // Clone styles
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            const link = document.createElement('link');
            if (styleSheet.href) {
              link.rel = 'stylesheet';
              link.type = styleSheet.type;
              link.media = styleSheet.media.mediaText;
              link.href = styleSheet.href;
              pipWin.document.head.appendChild(link);
            }
          }
        });

        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.background = '#000';
        pipWin.document.body.appendChild(containerEl);

        pipWin.addEventListener('pagehide', () => {
          nativePipWindow = null;
          set({ isNativePipActive: false });
          // Reparent back to persistent root if needed
          const rootEl = document.getElementById('persistent-live-player-root');
          if (rootEl && containerEl && !rootEl.contains(containerEl)) {
            rootEl.appendChild(containerEl);
          }
        });
      } catch {
        // Fallback to in-app floating mode
        set({ playerMode: 'floating', isNativePipActive: false });
      }
    } else {
      // Document Picture-in-Picture not supported, switch to in-app floating
      set({ playerMode: 'floating' });
    }
  },

  handleStreamStarted: (stream: LiveStreamInfo) => {
    set((state) => {
      const exists = state.liveStreams.some((s) => s.id === stream.id);
      const updatedList = exists
        ? state.liveStreams.map((s) => (s.id === stream.id ? stream : s))
        : [stream, ...state.liveStreams];
      return { liveStreams: updatedList };
    });
  },

  handleStreamUpdated: (stream: LiveStreamInfo) => {
    set((state) => {
      const updatedList = state.liveStreams.map((s) => (s.id === stream.id ? stream : s));
      const active = state.activeStream?.id === stream.id ? stream : state.activeStream;
      return { liveStreams: updatedList, activeStream: active };
    });
  },

  handleStreamEnded: (channelId: string, userId: string) => {
    set((state) => {
      const updatedList = state.liveStreams.filter(
        (s) => s.id !== channelId && s.channelId !== channelId && s.userId !== userId
      );
      const isActive =
        state.activeStream?.id === channelId ||
        state.activeStream?.channelId === channelId ||
        state.activeStream?.userId === userId;

      return {
        liveStreams: updatedList,
        activeStream: isActive ? null : state.activeStream,
        playerMode: isActive ? 'closed' : state.playerMode,
      };
    });
  },
}));
