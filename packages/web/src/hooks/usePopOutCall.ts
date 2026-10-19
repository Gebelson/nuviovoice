import { useState, useEffect, useCallback } from 'react';
import { useVoiceStore } from '../stores/voiceStore';
import { isElectron } from '../platform/platform';

let activePipWindow: Window | null = null;
const listeners = new Set<(win: Window | null) => void>();

function notifyListeners(win: Window | null) {
  listeners.forEach((fn) => fn(win));
}

/** Check whether Document Picture-in-Picture is supported by the runtime */
export function isDocumentPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

export function getActivePipWindow(): Window | null {
  return activePipWindow && !activePipWindow.closed ? activePipWindow : null;
}

/**
 * Copies all active stylesheets, <style> tags, and CSS variables from main document
 * into the PiP window document head so Tailwind classes, fonts, and dark theme work seamlessly.
 */
function copyStylesToPipWindow(pipDoc: Document) {
  try {
    // 1. Copy stylesheet rules or links
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
          const styleEl = pipDoc.createElement('style');
          styleEl.textContent = rules;
          pipDoc.head.appendChild(styleEl);
        }
      } catch {
        // Cross-origin or font sheet — copy as link tag
        if (sheet.href) {
          const linkEl = pipDoc.createElement('link');
          linkEl.rel = 'stylesheet';
          linkEl.href = sheet.href;
          pipDoc.head.appendChild(linkEl);
        }
      }
    });

    // 2. Copy inline style tags
    document.querySelectorAll('style').forEach((styleEl) => {
      const clonedStyle = pipDoc.createElement('style');
      clonedStyle.textContent = styleEl.textContent;
      pipDoc.head.appendChild(clonedStyle);
    });

    // 3. Inherit theme classes and styles on html and body
    pipDoc.documentElement.className = document.documentElement.className;
    pipDoc.body.className = document.body.className;
    pipDoc.body.style.margin = '0';
    pipDoc.body.style.padding = '0';
    pipDoc.body.style.overflow = 'hidden';
    pipDoc.body.style.background = '#0E1015';
    pipDoc.body.style.color = '#FFFFFF';
    pipDoc.body.style.width = '100vw';
    pipDoc.body.style.height = '100vh';
    pipDoc.body.style.userSelect = 'none';
  } catch (err) {
    console.warn('[usePopOutCall] Failed to copy some styles to PiP window:', err);
  }
}

export async function openPopOutCallWindow(options?: {
  width?: number;
  height?: number;
}): Promise<Window | null> {
  if (!isDocumentPipSupported()) {
    console.warn('[usePopOutCall] Document Picture-in-Picture API not supported in this environment');
    return null;
  }

  // If already open, bring to focus
  if (activePipWindow && !activePipWindow.closed) {
    activePipWindow.focus();
    return activePipWindow;
  }

  const voiceState = useVoiceStore.getState();
  const hasScreenShare = voiceState.participants.some(
    (p) => p.screenTrack !== null && voiceState.watchingStreams.has(p.userId),
  );
  const hasCamera = voiceState.participants.some((p) => p.videoTrack !== null);

  // Suggested sizes:
  // Compact voice: 320x200
  // Video: 420x280
  // Screen share: 480x300
  const width = options?.width ?? (hasScreenShare ? 480 : hasCamera ? 420 : 340);
  const height = options?.height ?? (hasScreenShare ? 300 : hasCamera ? 280 : 200);

  try {
    const pipWin = await (window as any).documentPictureInPicture.requestWindow({
      width,
      height,
    });

    activePipWindow = pipWin;
    pipWin.document.title = 'Nuvio — Chamada';
    copyStylesToPipWindow(pipWin.document);

    // Apply always on top setting in Electron if enabled
    if (isElectron()) {
      const alwaysOnTop = voiceState.pipAlwaysOnTop;
      const api = (window as any).nuvio ?? (window as any).backspace;
      api?.setPipAlwaysOnTop?.(alwaysOnTop);
    }

    voiceState.setIsPopOutOpen(true);
    notifyListeners(pipWin);

    // Handle closing the window by the user (OS X button or Alt+F4)
    pipWin.addEventListener('pagehide', () => {
      activePipWindow = null;
      useVoiceStore.getState().setIsPopOutOpen(false);
      notifyListeners(null);
    });

    return pipWin;
  } catch (err) {
    console.error('[usePopOutCall] Failed to open Document Picture-in-Picture window:', err);
    return null;
  }
}

export function closePopOutCallWindow(): void {
  if (activePipWindow && !activePipWindow.closed) {
    activePipWindow.close();
  }
  activePipWindow = null;
  useVoiceStore.getState().setIsPopOutOpen(false);
  notifyListeners(null);
}

export function usePopOutCall() {
  const [pipWin, setPipWin] = useState<Window | null>(() => getActivePipWindow());
  const isPoppedOut = useVoiceStore((s) => s.isPopOutOpen);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const pipAutoOpenOnMinimize = useVoiceStore((s) => s.pipAutoOpenOnMinimize);

  const isInCall = !!(currentVoiceChannelId || activeDmCall);

  useEffect(() => {
    const listener = (win: Window | null) => {
      setPipWin(win);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Close external PiP if the user leaves or gets disconnected from the call
  useEffect(() => {
    if (!isInCall && isPoppedOut) {
      closePopOutCallWindow();
    }
  }, [isInCall, isPoppedOut]);

  // Handle auto-open on minimize in Electron desktop
  useEffect(() => {
    if (!isElectron() || !pipAutoOpenOnMinimize) return;
    const api = (window as any).nuvio ?? (window as any).backspace;
    if (!api?.onMainWindowMinimized) return;

    const cleanup = api.onMainWindowMinimized(() => {
      const state = useVoiceStore.getState();
      const inCall = !!(state.currentVoiceChannelId || state.activeDmCall);
      if (inCall && !state.isPopOutOpen && isDocumentPipSupported()) {
        void openPopOutCallWindow();
      }
    });

    return cleanup;
  }, [pipAutoOpenOnMinimize]);

  const openPopOut = useCallback(async (options?: { width?: number; height?: number }) => {
    return openPopOutCallWindow(options);
  }, []);

  const closePopOut = useCallback(() => {
    closePopOutCallWindow();
  }, []);

  const togglePopOut = useCallback(() => {
    if (activePipWindow && !activePipWindow.closed) {
      closePopOutCallWindow();
    } else {
      void openPopOutCallWindow();
    }
  }, []);

  return {
    isSupported: isDocumentPipSupported(),
    isPoppedOut,
    pipWindow: pipWin,
    openPopOut,
    closePopOut,
    togglePopOut,
  };
}
