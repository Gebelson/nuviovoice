import { create } from 'zustand';
import { useAuthStore } from './authStore';

const STORAGE_KEY = 'nuvio:spacePreferences:v1';

interface StoredSpacePrefs {
  hideMutedChannels?: boolean;
}

function loadFromStorage(): Record<string, StoredSpacePrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveToStorage(prefs: Record<string, StoredSpacePrefs>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

function prefKey(spaceId: string): string {
  const userId = useAuthStore.getState().user?.id ?? 'default';
  return `${userId}:${spaceId}`;
}

interface SpacePreferencesState {
  prefs: Record<string, StoredSpacePrefs>;
  temporarilyRevealedSpaces: Record<string, boolean>;
  isHideMuted: (spaceId: string | null | undefined) => boolean;
  setHideMuted: (spaceId: string, hide: boolean) => void;
  toggleHideMuted: (spaceId: string) => boolean;
  isTemporarilyRevealed: (spaceId: string | null | undefined) => boolean;
  toggleTemporarilyRevealed: (spaceId: string) => void;
}

export const useSpacePreferencesStore = create<SpacePreferencesState>((set, get) => ({
  prefs: loadFromStorage(),
  temporarilyRevealedSpaces: {},

  isHideMuted: (spaceId) => {
    if (!spaceId) return false;
    const key = prefKey(spaceId);
    const fallbackKey = `default:${spaceId}`;
    const state = get().prefs;
    return Boolean(state[key]?.hideMutedChannels ?? state[fallbackKey]?.hideMutedChannels);
  },

  setHideMuted: (spaceId, hide) => {
    const key = prefKey(spaceId);
    set((state) => {
      const next = {
        ...state.prefs,
        [key]: { ...state.prefs[key], hideMutedChannels: hide },
      };
      saveToStorage(next);
      const nextRevealed = { ...state.temporarilyRevealedSpaces };
      if (!hide) {
        delete nextRevealed[spaceId];
      }
      return { prefs: next, temporarilyRevealedSpaces: nextRevealed };
    });
  },

  toggleHideMuted: (spaceId) => {
    const nextVal = !get().isHideMuted(spaceId);
    get().setHideMuted(spaceId, nextVal);
    return nextVal;
  },

  isTemporarilyRevealed: (spaceId) => {
    if (!spaceId) return false;
    return Boolean(get().temporarilyRevealedSpaces[spaceId]);
  },

  toggleTemporarilyRevealed: (spaceId) => {
    set((state) => ({
      temporarilyRevealedSpaces: {
        ...state.temporarilyRevealedSpaces,
        [spaceId]: !state.temporarilyRevealedSpaces[spaceId],
      },
    }));
  },
}));
