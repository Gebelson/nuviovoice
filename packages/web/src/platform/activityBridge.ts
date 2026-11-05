import type { Activity } from '@concord/shared';
import { useActivityStore } from '../stores/activityStore';
import { useUserPreferencesStore } from '../stores/userPreferencesStore';

let unsubscribeIpc: (() => void) | null = null;
let unsubscribePrefs: (() => void) | null = null;

export function initActivityBridge(): void {
  if (unsubscribeIpc) return; // already initialized
  const api = window.nuvio || window.backspace;
  if (!api?.onActivityDetected) return; // not Electron

  // Initial sync of registered games to Electron
  try {
    api.setRegisteredGames?.(useUserPreferencesStore.getState().registeredGames);
  } catch {}

  // Keep registered games in sync whenever user updates them in Settings
  unsubscribePrefs = useUserPreferencesStore.subscribe((state) => {
    try {
      api.setRegisteredGames?.(state.registeredGames);
    } catch {}
  });

  // Subscribe to future activity changes from main process
  unsubscribeIpc = api.onActivityDetected((activity) => {
    if (activity) {
      useActivityStore.getState().pushActivities([activity as Activity]);
    } else {
      useActivityStore.getState().pushActivities([]);
    }
  });

  // Request current state (handles instance-switch: game was already running)
  api.getCurrentActivity?.().then((activity: unknown) => {
    if (activity) {
      useActivityStore.getState().pushActivities([activity as Activity]);
    }
  }).catch(() => {});
}

export function teardownActivityBridge(): void {
  unsubscribeIpc?.();
  unsubscribeIpc = null;
  unsubscribePrefs?.();
  unsubscribePrefs = null;
}
