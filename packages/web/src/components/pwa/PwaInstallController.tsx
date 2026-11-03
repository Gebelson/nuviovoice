import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useWinkStore } from '../../stores/winkStore';
import { useUIStore } from '../../stores/uiStore';
import {
  usePwaInstallStore,
  type BeforeInstallPromptEvent,
} from '../../stores/pwaInstallStore';
import { isElectron } from '../../platform/platform';

/**
 * Manages PWA events (beforeinstallprompt, appinstalled) and controls
 * smart, non-intrusive automatic prompting on mobile devices.
 */
export function PwaInstallController() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const activeWink = useWinkStore((s) => s.activeWink);
  const activeModal = useUIStore((s) => s.activeModal);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);

  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);
  const markInstalled = usePwaInstallStore((s) => s.markInstalled);
  const openInstallModal = usePwaInstallStore((s) => s.openInstallModal);
  const canShowAutoPrompt = usePwaInstallStore((s) => s.canShowAutoPrompt);
  const isOpen = usePwaInstallStore((s) => s.isOpen);

  const hasEvaluatedAutoPrompt = useRef(false);

  // 1. Intercept beforeinstallprompt and appinstalled events
  useEffect(() => {
    // If running inside desktop Electron app, do nothing
    if (isElectron()) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default generic mini-infobar on Android
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      markInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [setDeferredPrompt, markInstalled]);

  // 2. Smart auto-prompt evaluation
  useEffect(() => {
    // Skip if running inside Electron, already evaluated in session, or modal already open
    if (isElectron() || hasEvaluatedAutoPrompt.current || isOpen) return;

    // Do not show during login/registration (requires authenticated user and token)
    if (!user || !token) return;

    // Do not show during voice/video calls or screen sharing
    if (currentVoiceChannelId || activeDmCall || isScreenSharing) return;

    // Do not show over an active Wink animation
    if (activeWink !== null) return;

    // Do not show if another modal is active
    if (activeModal !== null) return;

    // Check store eligibility (isMobileDevice, not installed, not dismissed never, cooldown respected)
    if (!canShowAutoPrompt()) {
      return;
    }

    // Delay display by 3.5 seconds to let initial interface stabilize completely
    const timer = setTimeout(() => {
      // Re-verify conditions right before opening
      const currentCall =
        useVoiceStore.getState().currentVoiceChannelId ||
        useVoiceStore.getState().activeDmCall;
      const currentSharing = useVoiceStore.getState().isScreenSharing;
      const currentModal = useUIStore.getState().activeModal;
      const currentWink = useWinkStore.getState().activeWink;

      if (
        !currentCall &&
        !currentSharing &&
        !currentModal &&
        !currentWink &&
        canShowAutoPrompt()
      ) {
        hasEvaluatedAutoPrompt.current = true;
        openInstallModal('auto');
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [
    user,
    token,
    currentVoiceChannelId,
    activeDmCall,
    isScreenSharing,
    activeWink,
    activeModal,
    isOpen,
    canShowAutoPrompt,
    openInstallModal,
  ]);

  return null;
}
