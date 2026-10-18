import { create } from 'zustand';
import type { FriendRequest, User } from '@concord/shared';
import { AudioManager } from '../audio/AudioManager';
import { getSfxVolume } from '../utils/sfx';
import { selectMyChosenStatus, useAuthStore } from './authStore';
import { useVoiceStore } from './voiceStore';

export interface FriendRequestToastItem {
  requestId: string;
  origin: string;
  user: User;
  createdAt: number;
  state: 'pending' | 'accepted' | 'declined';
}

interface StoredPreferences {
  floatingEnabled: boolean;
  soundEnabled: boolean;
  hideOnScreenShare: boolean;
}

const STORAGE_KEY = 'nuvio:friend_notifications';

function loadStoredPreferences(): StoredPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        floatingEnabled: parsed.floatingEnabled ?? true,
        soundEnabled: parsed.soundEnabled ?? true,
        hideOnScreenShare: parsed.hideOnScreenShare ?? true,
      };
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return {
    floatingEnabled: true,
    soundEnabled: true,
    hideOnScreenShare: true,
  };
}

function savePreferences(prefs: StoredPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore localStorage write errors
  }
}

interface FriendRequestNotificationState {
  // Active toasts currently shown on screen (max 2)
  activeToasts: FriendRequestToastItem[];
  // Queued incoming requests (FIFO) waiting for an active slot
  queue: FriendRequestToastItem[];

  // User preferences
  floatingEnabled: boolean;
  soundEnabled: boolean;
  hideOnScreenShare: boolean;

  // Actions
  pushNotification: (request: FriendRequest, origin: string) => void;
  dismissToast: (requestId: string) => void;
  resolveToast: (requestId: string, status: 'accepted' | 'declined') => void;
  cancelToast: (requestId: string) => void;
  dismissTopToast: () => void;

  setFloatingEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHideOnScreenShare: (enabled: boolean) => void;
  clearAll: () => void;
}

const initialPrefs = loadStoredPreferences();

export const useFriendRequestNotificationStore = create<FriendRequestNotificationState>((set, get) => ({
  activeToasts: [],
  queue: [],

  floatingEnabled: initialPrefs.floatingEnabled,
  soundEnabled: initialPrefs.soundEnabled,
  hideOnScreenShare: initialPrefs.hideOnScreenShare,

  pushNotification: (request: FriendRequest, origin: string) => {
    if (!request || !request.user || !request.id) return;

    const { floatingEnabled, soundEnabled, hideOnScreenShare, activeToasts, queue } = get();

    // Check if floating notifications are disabled by the user
    if (!floatingEnabled) return;

    // Check Do Not Disturb (DND) status
    const selfStatus = selectMyChosenStatus(useAuthStore.getState());
    if (selfStatus === 'dnd') return;

    // Check Screen Sharing suppression
    const isScreenSharing = useVoiceStore.getState().isScreenSharing;
    if (hideOnScreenShare && isScreenSharing) return;

    // Deduplication check: ignore if already active or queued
    const alreadyExists =
      activeToasts.some((t) => t.requestId === request.id) ||
      queue.some((t) => t.requestId === request.id);
    if (alreadyExists) return;

    const newItem: FriendRequestToastItem = {
      requestId: request.id,
      origin,
      user: request.user,
      createdAt: Date.now(),
      state: 'pending',
    };

    if (activeToasts.length < 2) {
      set({ activeToasts: [...activeToasts, newItem] });

      // Play discreet notification cue
      if (soundEnabled) {
        AudioManager.getInstance()
          .playSound('message', {
            volume: getSfxVolume() * 0.75,
          })
          .catch(() => {});
      }
    } else {
      // Maximum 2 reached; append to FIFO queue
      set({ queue: [...queue, newItem] });
    }
  },

  dismissToast: (requestId: string) => {
    const { activeToasts, queue } = get();
    const remainingActive = activeToasts.filter((t) => t.requestId !== requestId);

    if (remainingActive.length === activeToasts.length) {
      // It was in the queue or not found
      set({ queue: queue.filter((t) => t.requestId !== requestId) });
      return;
    }

    // Promote the next item from queue if slots are open
    if (queue.length > 0 && remainingActive.length < 2) {
      const [next, ...restQueue] = queue;
      if (next) {
        set({
          activeToasts: [...remainingActive, next],
          queue: restQueue,
        });
      } else {
        set({ activeToasts: remainingActive });
      }
    } else {
      set({ activeToasts: remainingActive });
    }
  },

  resolveToast: (requestId: string, status: 'accepted' | 'declined') => {
    const { activeToasts, queue } = get();
    const target = activeToasts.find((t) => t.requestId === requestId);

    if (!target) {
      // If it was in the queue, remove it directly
      set({ queue: queue.filter((t) => t.requestId !== requestId) });
      return;
    }

    if (status === 'declined') {
      // Declined requests are closed immediately
      get().dismissToast(requestId);
    } else {
      // Mark accepted state so the UI card can briefly show positive feedback
      set({
        activeToasts: activeToasts.map((t) =>
          t.requestId === requestId ? { ...t, state: 'accepted' } : t
        ),
      });
    }
  },

  cancelToast: (requestId: string) => {
    // If the sender cancelled the request or it was invalidated
    get().dismissToast(requestId);
  },

  dismissTopToast: () => {
    const { activeToasts } = get();
    if (activeToasts.length > 0) {
      // Dismiss the most recent toast (last in active array)
      const top = activeToasts[activeToasts.length - 1];
      if (top) {
        get().dismissToast(top.requestId);
      }
    }
  },

  setFloatingEnabled: (enabled: boolean) => {
    set({ floatingEnabled: enabled });
    if (!enabled) {
      set({ activeToasts: [], queue: [] });
    }
    const current = get();
    savePreferences({
      floatingEnabled: enabled,
      soundEnabled: current.soundEnabled,
      hideOnScreenShare: current.hideOnScreenShare,
    });
  },

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
    const current = get();
    savePreferences({
      floatingEnabled: current.floatingEnabled,
      soundEnabled: enabled,
      hideOnScreenShare: current.hideOnScreenShare,
    });
  },

  setHideOnScreenShare: (enabled: boolean) => {
    set({ hideOnScreenShare: enabled });
    const current = get();
    savePreferences({
      floatingEnabled: current.floatingEnabled,
      soundEnabled: current.soundEnabled,
      hideOnScreenShare: enabled,
    });
  },

  clearAll: () => {
    set({ activeToasts: [], queue: [] });
  },
}));
