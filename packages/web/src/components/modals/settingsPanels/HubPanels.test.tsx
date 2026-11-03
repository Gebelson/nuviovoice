import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataPrivacyPanel } from './DataPrivacyPanel';
import { MessagePermissionsPanel } from './MessagePermissionsPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { GamesAppsPanel } from './GamesAppsPanel';
import { AccessibilityPanel } from './AccessibilityPanel';
import { LanguageTimePanel } from './LanguageTimePanel';
import { useUserPreferencesStore } from '../../../stores/userPreferencesStore';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      users: { update: vi.fn().mockResolvedValue({}) },
      instance: { info: vi.fn().mockResolvedValue({ version: '1.2.1' }) },
    },
  };
});

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: {
        id: 'u1',
        username: 'testuser',
        displayName: 'Test User',
        receiveWinks: true,
        friendDiscoveryVisibility: 'everyone',
      },
    }),
}));

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      addToast: vi.fn(),
    }),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Hub Panels Mounting and Subsections', () => {
  describe('DataPrivacyPanel', () => {
    it('renders all 3 subsections and allows switching between them', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <DataPrivacyPanel activeSection="data-usage" onSelectSection={onSelect} />,
      );

      expect(screen.getByText(/Como o Nuvio usa meus dados|How Nuvio uses my data/i)).toBeInTheDocument();

      rerender(<DataPrivacyPanel activeSection="profile-privacy" onSelectSection={onSelect} />);
      expect(screen.getByText(/Visibilidade do perfil público|Public Profile Visibility/i)).toBeInTheDocument();

      rerender(<DataPrivacyPanel activeSection="voice-encryption" onSelectSection={onSelect} />);
      expect(screen.getByText(/Criptografia de voz em tempo real|Real-time Voice Encryption/i)).toBeInTheDocument();
    });

    it('toggles operational data usage preference', () => {
      render(<DataPrivacyPanel activeSection="data-usage" />);
      const initial = useUserPreferencesStore.getState().useDataToOperate;

      // Find toggle
      const toggles = screen.getAllByRole('switch');
      expect(toggles.length).toBeGreaterThan(0);
      fireEvent.click(toggles[0]);

      expect(useUserPreferencesStore.getState().useDataToOperate).toBe(!initial);
    });
  });

  describe('MessagePermissionsPanel', () => {
    it('renders content filters and allows switching between subsections', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <MessagePermissionsPanel activeSection="content-filters" onSelectSection={onSelect} />,
      );

      expect(screen.getByText(/Mídia sensível|Sensitive Media/i)).toBeInTheDocument();

      rerender(<MessagePermissionsPanel activeSection="direct-messages" onSelectSection={onSelect} />);
      expect(screen.getByText(/Regras para mensagens diretas|Direct Message \(DM\) Rules/i)).toBeInTheDocument();

      rerender(<MessagePermissionsPanel activeSection="friend-requests" onSelectSection={onSelect} />);
      expect(screen.getByText(/Quem pode enviar pedidos de amizade|Who Can Send Friend Requests/i)).toBeInTheDocument();

      rerender(<MessagePermissionsPanel activeSection="ignore-block" onSelectSection={onSelect} />);
      expect(screen.getByText(/Contas bloqueadas|Blocked Accounts/i)).toBeInTheDocument();
    });
  });

  describe('NotificationsPanel', () => {
    it('renders overview and allows switching to sounds and email', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <NotificationsPanel activeSection="overview" onSelectSection={onSelect} />,
      );

      expect(screen.getByText(/Entrega de notificações|Notification Delivery/i)).toBeInTheDocument();

      rerender(<NotificationsPanel activeSection="sounds" onSelectSection={onSelect} />);
      expect(screen.getByText(/Volume e prévia sonora|Audio Alerts & Preview/i)).toBeInTheDocument();

      rerender(<NotificationsPanel activeSection="email" onSelectSection={onSelect} />);
      expect(screen.getByText(/Notificações por e-mail|Email Notifications/i)).toBeInTheDocument();
    });
  });

  describe('AccessibilityPanel & LanguageTimePanel', () => {
    it('renders accessibility controls and toggles high contrast mode', () => {
      render(<AccessibilityPanel />);
      expect(screen.getByText(/Contraste e Legibilidade|Contrast & Readability/i)).toBeInTheDocument();

      const initialContrast = useUserPreferencesStore.getState().highContrastMode;
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);
      expect(useUserPreferencesStore.getState().highContrastMode).toBe(!initialContrast);
    });

    it('renders language and time settings and updates time format', () => {
      render(<LanguageTimePanel />);
      expect(screen.getAllByText(/Formato de hora|Clock Format/i).length).toBeGreaterThan(0);

      useUserPreferencesStore.getState().setPreference('timeFormat', '12h');
      expect(useUserPreferencesStore.getState().timeFormat).toBe('12h');
    });
  });

  describe('GamesAppsPanel', () => {
    it('renders registered games and game overlay subsections', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <GamesAppsPanel activeSection="registered-games" onSelectSection={onSelect} />,
      );

      expect(screen.getAllByText(/Jogo em execução detectado|Active Game Detected/i).length).toBeGreaterThan(0);

      rerender(<GamesAppsPanel activeSection="game-overlay" onSelectSection={onSelect} />);
      expect(screen.getAllByText(/Janela Flutuante \(PiP\) Nativa|Native Nuvio Picture-in-Picture/i).length).toBeGreaterThan(0);

      rerender(<GamesAppsPanel activeSection="connected-apps" onSelectSection={onSelect} />);
      expect(screen.getAllByText(/Aplicativos autorizados|Authorized Applications/i).length).toBeGreaterThan(0);
    });
  });
});
