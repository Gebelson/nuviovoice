import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectPwaPlatform,
  detectPwaBrowser,
  isPwaStandalone,
  getDeviceDisplayLabel,
  detectPwaEnvironment,
} from '../../../platform/pwaEnvironment';
import {
  usePwaInstallStore,
  PWA_AUTO_PROMPT_COOLDOWN_MS,
  type BeforeInstallPromptEvent,
} from '../../../stores/pwaInstallStore';
import { PwaInstallModal } from '../PwaInstallModal';
import { PwaInstallController } from '../PwaInstallController';
import { useAuthStore } from '../../../stores/authStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useUIStore } from '../../../stores/uiStore';

// Mock Modal to simplify testing
vi.mock('../../ui/Modal', () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="pwa-install-modal">{children}</div> : null,
}));

describe('PWA Mobile Installation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    usePwaInstallStore.setState({
      isOpen: false,
      isInstalled: false,
      isDismissedNever: false,
      lastDismissedAt: null,
      deferredPrompt: null,
      isInstalling: false,
      installSource: 'auto',
      environment: detectPwaEnvironment({ standalone: false }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('1. Environment Detection (pwaEnvironment)', () => {
    it('detects iPhone Safari correctly', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      expect(detectPwaPlatform(ua)).toBe('ios');
      expect(detectPwaBrowser(ua)).toBe('safari');
      const env = detectPwaEnvironment({ ua, maxTouchPoints: 5 });
      expect(env.platform).toBe('ios');
      expect(env.browser).toBe('safari');
      expect(env.isIphone).toBe(true);
      expect(env.isMobileDevice).toBe(true);
      expect(env.isInAppBrowser).toBe(false);
      expect(env.label).toBe('iPhone • Safari');
    });

    it('detects iPadOS with desktop Safari userAgent correctly via touch points', () => {
      // Modern iPads report MacIntel userAgent
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
      expect(detectPwaPlatform(ua, 5)).toBe('ios');
      const env = detectPwaEnvironment({ ua, maxTouchPoints: 5 });
      expect(env.isIpad).toBe(true);
      expect(env.isMobileDevice).toBe(true);
      expect(env.label).toBe('iPad • Safari');
    });

    it('detects Android Chrome correctly', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
      expect(detectPwaPlatform(ua)).toBe('android');
      expect(detectPwaBrowser(ua)).toBe('chrome');
      const env = detectPwaEnvironment({ ua });
      expect(env.platform).toBe('android');
      expect(env.browser).toBe('chrome');
      expect(env.isMobileDevice).toBe(true);
      expect(env.label).toBe('Android • Google Chrome');
    });

    it('detects Samsung Internet on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36';
      expect(detectPwaPlatform(ua)).toBe('android');
      expect(detectPwaBrowser(ua)).toBe('samsung');
      const env = detectPwaEnvironment({ ua });
      expect(env.label).toBe('Android • Samsung Internet');
    });

    it('detects In-App browsers (Instagram, WhatsApp, TikTok, etc.)', () => {
      const instagramUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 282.0.0.16.108';
      expect(detectPwaBrowser(instagramUa)).toBe('inapp');
      const igEnv = detectPwaEnvironment({ ua: instagramUa });
      expect(igEnv.isInAppBrowser).toBe(true);

      const whatsAppUa =
        'Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 WhatsApp/2.23.10.77';
      expect(detectPwaBrowser(whatsAppUa)).toBe('inapp');
    });

    it('detects desktop platforms and marks isMobileDevice as false', () => {
      const desktopUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      expect(detectPwaPlatform(desktopUa, 0)).toBe('desktop');
      const env = detectPwaEnvironment({ ua: desktopUa, maxTouchPoints: 0 });
      expect(env.isMobileDevice).toBe(false);
      expect(env.label).toBe('Computador • Google Chrome');
    });

    it('detects standalone mode from localStorage or custom flag', () => {
      expect(isPwaStandalone(true)).toBe(true);
      expect(isPwaStandalone(false)).toBe(false);
      localStorage.setItem('nuvio_pwa_installed', 'true');
      expect(isPwaStandalone()).toBe(true);
    });
  });

  describe('2. PWA Install Store (pwaInstallStore)', () => {
    it('manages modal open and close states', () => {
      const store = usePwaInstallStore.getState();
      expect(store.isOpen).toBe(false);

      act(() => {
        store.openInstallModal('settings');
      });
      expect(usePwaInstallStore.getState().isOpen).toBe(true);
      expect(usePwaInstallStore.getState().installSource).toBe('settings');

      act(() => {
        store.closeInstallModal();
      });
      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('handles dismissNotNow with 7-day cooldown timestamp', () => {
      const store = usePwaInstallStore.getState();
      const before = Date.now();

      act(() => {
        store.dismissNotNow();
      });

      const after = Date.now();
      const state = usePwaInstallStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.lastDismissedAt).toBeGreaterThanOrEqual(before);
      expect(state.lastDismissedAt).toBeLessThanOrEqual(after);
      expect(localStorage.getItem('nuvio_pwa_last_dismissed')).toBeTruthy();
    });

    it('handles dismissNever permanently', () => {
      const store = usePwaInstallStore.getState();

      act(() => {
        store.dismissNever();
      });

      const state = usePwaInstallStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.isDismissedNever).toBe(true);
      expect(localStorage.getItem('nuvio_pwa_dismissed_never')).toBe('true');
    });

    it('evaluates canShowAutoPrompt rules accurately', () => {
      // 1. Mobile device, uninstalled, no dismiss -> true
      usePwaInstallStore.setState({
        environment: {
          platform: 'ios',
          browser: 'safari',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: true,
          isInAppBrowser: false,
          canPromptNative: false,
          label: 'iPhone • Safari',
        },
        isInstalled: false,
        isDismissedNever: false,
        lastDismissedAt: null,
      });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(true);

      // 2. Desktop -> false
      usePwaInstallStore.setState({
        environment: {
          platform: 'desktop',
          browser: 'chrome',
          isStandalone: false,
          isMobileDevice: false,
          isIpad: false,
          isIphone: false,
          isInAppBrowser: false,
          canPromptNative: false,
          label: 'Computador • Google Chrome',
        },
      });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(false);

      // Back to mobile
      usePwaInstallStore.setState({
        environment: {
          platform: 'android',
          browser: 'chrome',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: false,
          isInAppBrowser: false,
          canPromptNative: true,
          label: 'Android • Google Chrome',
        },
      });

      // 3. Already installed -> false
      usePwaInstallStore.setState({ isInstalled: true });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(false);

      // 4. Never show again -> false
      usePwaInstallStore.setState({ isInstalled: false, isDismissedNever: true });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(false);

      // 5. Cooldown: recently dismissed -> false
      usePwaInstallStore.setState({
        isDismissedNever: false,
        lastDismissedAt: Date.now() - 1000 * 60, // 1 minute ago
      });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(false);

      // 6. Cooldown expired (8 days ago) -> true
      usePwaInstallStore.setState({
        lastDismissedAt: Date.now() - (PWA_AUTO_PROMPT_COOLDOWN_MS + 1000 * 60),
      });
      expect(usePwaInstallStore.getState().canShowAutoPrompt()).toBe(true);
    });

    it('handles deferredPrompt and native install flow', async () => {
      const promptMock = vi.fn().mockResolvedValue(undefined);
      const fakeEvent: BeforeInstallPromptEvent = {
        platforms: ['android'],
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'android' }),
        prompt: promptMock,
      } as any;

      const store = usePwaInstallStore.getState();

      act(() => {
        store.setDeferredPrompt(fakeEvent);
      });

      expect(usePwaInstallStore.getState().deferredPrompt).toBe(fakeEvent);
      expect(usePwaInstallStore.getState().environment.canPromptNative).toBe(true);

      // Trigger install
      const outcome = await usePwaInstallStore.getState().triggerNativeInstall();
      expect(outcome).toBe('accepted');
      expect(promptMock).toHaveBeenCalled();
      expect(usePwaInstallStore.getState().isInstalled).toBe(true);
      expect(usePwaInstallStore.getState().deferredPrompt).toBe(null);
    });
  });

  describe('3. PwaInstallModal Component Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      usePwaInstallStore.setState({ isOpen: false });
      const { container } = render(<PwaInstallModal />);
      expect(container.firstChild).toBeNull();
    });

    it('renders iOS Safari step-by-step instructions with share button', () => {
      usePwaInstallStore.setState({
        isOpen: true,
        environment: {
          platform: 'ios',
          browser: 'safari',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: true,
          isInAppBrowser: false,
          canPromptNative: false,
          label: 'iPhone • Safari',
        },
      });

      render(<PwaInstallModal />);

      expect(screen.getByText('Instale o Nuvio')).toBeTruthy();
      expect(screen.getByText('iPhone • Safari')).toBeTruthy();
      expect(screen.getByText(/Como adicionar à tela inicial no Safari/i)).toBeTruthy();
      expect(screen.getByText(/1\. Toque em Compartilhar/i)).toBeTruthy();
      expect(screen.getByText(/2\. Selecione "Adicionar à Tela de Início"/i)).toBeTruthy();
      expect(screen.getByText(/3\. Confirme em "Adicionar"/i)).toBeTruthy();
    });

    it('renders In-App browser warning and copy link button', () => {
      usePwaInstallStore.setState({
        isOpen: true,
        environment: {
          platform: 'ios',
          browser: 'inapp',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: true,
          isInAppBrowser: true,
          canPromptNative: false,
          label: 'iPhone • Navegador interno',
        },
      });

      render(<PwaInstallModal />);

      expect(screen.getByText(/Navegador interno detectado/i)).toBeTruthy();
      expect(screen.getByText(/Copiar link do Nuvio/i)).toBeTruthy();
    });

    it('renders direct "Instalar Nuvio" button when native prompt is supported', () => {
      usePwaInstallStore.setState({
        isOpen: true,
        environment: {
          platform: 'android',
          browser: 'chrome',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: false,
          isInAppBrowser: false,
          canPromptNative: true,
          label: 'Android • Google Chrome',
        },
      });

      render(<PwaInstallModal />);

      expect(screen.getByText('Instalação rápida disponível')).toBeTruthy();
      expect(screen.getByText('Instalar Nuvio')).toBeTruthy();
    });

    it('handles "Não mostrar esta mensagem novamente" checkbox and "Agora não" button', () => {
      usePwaInstallStore.setState({
        isOpen: true,
        environment: {
          platform: 'ios',
          browser: 'safari',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: true,
          isInAppBrowser: false,
          canPromptNative: false,
          label: 'iPhone • Safari',
        },
      });

      render(<PwaInstallModal />);

      const checkbox = screen.getByLabelText(/Não mostrar esta mensagem novamente/i);
      expect(checkbox).toBeTruthy();
      fireEvent.click(checkbox);

      const notNowBtn = screen.getByText('Agora não');
      fireEvent.click(notNowBtn);

      expect(usePwaInstallStore.getState().isDismissedNever).toBe(true);
      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });
  });

  describe('4. PwaInstallController Smart Auto-Prompt Rules', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useAuthStore.setState({
        user: { id: 'u1', username: 'testuser' } as any,
        token: 'fake-jwt-token',
      });
      useVoiceStore.setState({
        currentVoiceChannelId: null,
        activeDmCall: null,
        isScreenSharing: false,
      });
      useWinkStore.setState({ activeWink: null });
      useUIStore.setState({ activeModal: null });

      usePwaInstallStore.setState({
        isOpen: false,
        isInstalled: false,
        isDismissedNever: false,
        lastDismissedAt: null,
        environment: {
          platform: 'android',
          browser: 'chrome',
          isStandalone: false,
          isMobileDevice: true,
          isIpad: false,
          isIphone: false,
          isInAppBrowser: false,
          canPromptNative: true,
          label: 'Android • Google Chrome',
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not auto-prompt when user is not logged in', () => {
      useAuthStore.setState({ user: null, token: null });
      render(<PwaInstallController />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('does not auto-prompt when user is in a voice call', () => {
      useVoiceStore.setState({ currentVoiceChannelId: 'vc-123' });
      render(<PwaInstallController />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('does not auto-prompt when screen sharing is active', () => {
      useVoiceStore.setState({ isScreenSharing: true });
      render(<PwaInstallController />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('does not auto-prompt when a Wink animation is playing', () => {
      useWinkStore.setState({
        activeWink: {
          id: 'w-1',
          winkId: 'diabravinho',
          senderName: 'Friend',
          audioUrl: '/winks/diabravinho.ogg',
          animationUrl: '/winks/diabravinho.json',
        } as any,
      });
      render(<PwaInstallController />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('does not auto-prompt when another modal is open', () => {
      useUIStore.setState({ activeModal: 'userSettings' as any });
      render(<PwaInstallController />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(usePwaInstallStore.getState().isOpen).toBe(false);
    });

    it('auto-prompts after 3.5s delay when all conditions are satisfied', () => {
      render(<PwaInstallController />);

      // At 2 seconds, still closed
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(usePwaInstallStore.getState().isOpen).toBe(false);

      // At 3.6 seconds, timer triggers openInstallModal('auto')
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(usePwaInstallStore.getState().isOpen).toBe(true);
      expect(usePwaInstallStore.getState().installSource).toBe('auto');
    });
  });
});
