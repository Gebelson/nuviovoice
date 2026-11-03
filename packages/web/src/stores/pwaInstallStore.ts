import { create } from 'zustand';
import {
  detectPwaEnvironment,
  isPwaStandalone,
  type PwaEnvironment,
} from '../platform/pwaEnvironment';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const STORAGE_KEYS = {
  INSTALLED: 'nuvio_pwa_installed',
  DISMISSED_NEVER: 'nuvio_pwa_dismissed_never',
  LAST_DISMISSED: 'nuvio_pwa_last_dismissed',
} as const;

// 7 days in milliseconds
export const PWA_AUTO_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isOpen: boolean;
  isDismissedNever: boolean;
  lastDismissedAt: number | null;
  isInstalling: boolean;
  installSource: 'auto' | 'settings' | 'banner';
  environment: PwaEnvironment;

  // Actions
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  openInstallModal: (source?: 'auto' | 'settings' | 'banner') => void;
  closeInstallModal: () => void;
  dismissNotNow: () => void;
  dismissNever: () => void;
  markInstalled: () => void;
  triggerNativeInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>;
  canShowAutoPrompt: () => boolean;
  refreshEnvironment: () => void;
}

function readStoredBoolean(key: string): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key) === 'true';
    }
  } catch {
    // Sandbox or restricted access
  }
  return false;
}

function readStoredNumber(key: string): number | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val) {
        const num = parseInt(val, 10);
        return isNaN(num) ? null : num;
      }
    }
  } catch {
    // Sandbox
  }
  return null;
}

export const usePwaInstallStore = create<PwaInstallState>((set, get) => {
  const isInstalledInitial =
    readStoredBoolean(STORAGE_KEYS.INSTALLED) || isPwaStandalone();
  const isDismissedNeverInitial = readStoredBoolean(STORAGE_KEYS.DISMISSED_NEVER);
  const lastDismissedAtInitial = readStoredNumber(STORAGE_KEYS.LAST_DISMISSED);
  const initialEnv = detectPwaEnvironment({ standalone: isInstalledInitial });

  return {
    deferredPrompt: null,
    isInstalled: isInstalledInitial,
    isOpen: false,
    isDismissedNever: isDismissedNeverInitial,
    lastDismissedAt: lastDismissedAtInitial,
    isInstalling: false,
    installSource: 'auto',
    environment: initialEnv,

    setDeferredPrompt: (prompt) => {
      set((state) => ({
        deferredPrompt: prompt,
        environment: {
          ...state.environment,
          canPromptNative: prompt !== null,
        },
      }));
    },

    refreshEnvironment: () => {
      const { deferredPrompt, isInstalled } = get();
      const env = detectPwaEnvironment({
        standalone: isInstalled || isPwaStandalone(),
        hasNativePrompt: deferredPrompt !== null,
      });
      set({ environment: env });
    },

    openInstallModal: (source = 'settings') => {
      set({ isOpen: true, installSource: source });
    },

    closeInstallModal: () => {
      set({ isOpen: false, isInstalling: false });
    },

    dismissNotNow: () => {
      const now = Date.now();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.LAST_DISMISSED, String(now));
        }
      } catch {}
      set({ isOpen: false, lastDismissedAt: now });
    },

    dismissNever: () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.DISMISSED_NEVER, 'true');
        }
      } catch {}
      set({ isOpen: false, isDismissedNever: true });
    },

    markInstalled: () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
        }
      } catch {}
      set({
        isInstalled: true,
        isOpen: false,
        deferredPrompt: null,
        environment: {
          ...get().environment,
          isStandalone: true,
          canPromptNative: false,
        },
      });
    },

    triggerNativeInstall: async () => {
      const { deferredPrompt } = get();
      if (!deferredPrompt) {
        return 'unsupported';
      }

      set({ isInstalling: true });
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice.outcome === 'accepted') {
          get().markInstalled();
          return 'accepted';
        } else {
          get().dismissNotNow();
          return 'dismissed';
        }
      } catch {
        return 'unsupported';
      } finally {
        set({ deferredPrompt: null, isInstalling: false });
      }
    },

    canShowAutoPrompt: () => {
      const { isInstalled, isDismissedNever, lastDismissedAt, environment } =
        get();

      // 1. Must be a mobile or tablet device
      if (!environment.isMobileDevice) {
        return false;
      }

      // 2. Must not already be installed
      if (isInstalled || isPwaStandalone()) {
        return false;
      }

      // 3. User must not have selected "Never show again"
      if (isDismissedNever) {
        return false;
      }

      // 4. Cooldown after "Not now"
      if (lastDismissedAt && Date.now() - lastDismissedAt < PWA_AUTO_PROMPT_COOLDOWN_MS) {
        return false;
      }

      return true;
    },
  };
});
