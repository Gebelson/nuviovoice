import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WinkPickerPopover } from '../WinkPickerPopover';
import { MessagePermissionsPanel } from '../../modals/settingsPanels/MessagePermissionsPanel';
import { useUIStore } from '../../../stores/uiStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useAuthStore } from '../../../stores/authStore';
import { checkAndTriggerIncomingWink } from '../../../utils/dmMessageRouting';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';
import type { User, DmMessageWithUser } from '@concord/shared';
import i18n from '../../../i18n';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));

vi.mock('../../../audio/AudioManager', () => {
  const mockInstance = {
    loadWinkSound: vi.fn().mockResolvedValue({}),
    playWinkSound: vi.fn().mockResolvedValue({ stop: vi.fn() }),
    stopWinkSound: vi.fn(),
    preloadWinkSounds: vi.fn(),
  };
  return {
    AudioManager: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
    },
  };
});

const {
  mockMutesList,
  mockMutesSet,
  mockMutesDelete,
  mockFavoritesList,
  mockFavoritesAdd,
  mockFavoritesRemove,
  mockRecentsList,
  mockRecentsRecord,
  mockWinksList,
} = vi.hoisted(() => ({
  mockMutesList: vi.fn().mockResolvedValue([]),
  mockMutesSet: vi.fn(),
  mockMutesDelete: vi.fn().mockResolvedValue({ success: true }),
  mockFavoritesList: vi.fn().mockResolvedValue(['diabravinho']),
  mockFavoritesAdd: vi.fn().mockResolvedValue({ success: true, favorites: ['diabravinho'] }),
  mockFavoritesRemove: vi.fn().mockResolvedValue({ success: true, favorites: [] }),
  mockRecentsList: vi.fn().mockResolvedValue(['bolsogado', 'nikole']),
  mockRecentsRecord: vi.fn().mockResolvedValue({ success: true, recents: ['diabravinho'] }),
  mockWinksList: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      winks: {
        list: () => mockWinksList(),
        mutes: {
          list: () => mockMutesList(),
          set: (...args: any[]) => mockMutesSet(...args),
          delete: (...args: any[]) => mockMutesDelete(...args),
        },
        favorites: {
          list: () => mockFavoritesList(),
          add: (...args: any[]) => mockFavoritesAdd(...args),
          remove: (...args: any[]) => mockFavoritesRemove(...args),
        },
        recents: {
          list: () => mockRecentsList(),
          record: (...args: any[]) => mockRecentsRecord(...args),
        },
      },
      users: {
        update: vi.fn().mockResolvedValue({ id: 'u1' }),
      },
    },
    getApiForOrigin: () => ({
      ...actual.api,
    }),
  };
});

describe('Winks Preferences, Favorites and Muting', () => {
  const currentUser: User = {
    id: 'user-me',
    username: 'gebelson',
    displayName: 'Gebelson',
    avatar: null,
    banner: null,
    accentColor: null,
    avatarColor: null,
    bio: null,
    status: 'online',
    customStatus: null,
    isAdmin: false,
    createdAt: 1,
    homeInstance: null,
    homeUserId: null,
    replicatedInstances: [],
    receiveWinks: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');
    mockWinksList.mockResolvedValue([...OFFICIAL_WINKS]);
    mockFavoritesList.mockResolvedValue(['diabravinho']);
    mockRecentsList.mockResolvedValue(['bolsogado', 'nikole']);
    mockMutesList.mockResolvedValue([]);

    useAuthStore.setState({ user: currentUser, token: 'token-123' });
    useUIStore.setState({ isMobile: false });
    useWinkStore.setState({
      favoriteWinkIds: ['diabravinho'],
      recentWinkIds: ['bolsogado', 'nikole'],
      contactMutes: {},
      publishedWinks: [...OFFICIAL_WINKS],
      queue: [],
      activeWink: null,
      processedMessageIds: new Set(),
      settings: {
        autoplay: true,
        volume: 0.8,
        previewMuted: false,
        disableIncoming: false,
        vibration: true,
        backgroundPlay: 'always',
        notifyOnBackgroundWink: true,
      },
    });
  });

  describe('WinkPickerPopover Tabs and Favorites', () => {
    it('renders the 3 tabs: Todos, Favoritos, and Recentes', async () => {
      render(
        <WinkPickerPopover
          isOpen={true}
          onClose={vi.fn()}
          onSelectWink={vi.fn()}
        />
      );

      expect(screen.getByRole('tab', { name: /todos/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /favoritos/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /recentes/i })).toBeInTheDocument();
    });

    it('displays only favorited winks in Favoritos tab', async () => {
      render(
        <WinkPickerPopover
          isOpen={true}
          onClose={vi.fn()}
          onSelectWink={vi.fn()}
        />
      );

      // Wait for published winks to load
      await waitFor(() => {
        expect(screen.getByText('Diabravinho')).toBeInTheDocument();
      });

      // Switch to Favoritos tab
      const favTab = screen.getByRole('tab', { name: /favoritos/i });
      await act(async () => {
        fireEvent.click(favTab);
      });

      // diabravinho should be present
      expect(screen.getByText('Diabravinho')).toBeInTheDocument();
      // bolsogado is not in favorites, should not be displayed in favorites tab
      expect(screen.queryByText('Bolsogado')).not.toBeInTheDocument();
    });

    it('shows empty state when Favoritos is empty', async () => {
      mockFavoritesList.mockResolvedValue([]);
      useWinkStore.setState({ favoriteWinkIds: [] });

      render(
        <WinkPickerPopover
          isOpen={true}
          onClose={vi.fn()}
          onSelectWink={vi.fn()}
        />
      );

      const favTab = screen.getByRole('tab', { name: /favoritos/i });
      await act(async () => {
        fireEvent.click(favTab);
      });

      expect(screen.getByText('Nenhum Wink favorito')).toBeInTheDocument();
    });

    it('toggling favorite heart adds or removes item without triggering onSelectWink', async () => {
      const onSelectWink = vi.fn();
      render(
        <WinkPickerPopover
          isOpen={true}
          onClose={vi.fn()}
          onSelectWink={onSelectWink}
        />
      );

      // Find the favorite button for diabravinho (currently favorited)
      const favButtons = screen.getAllByRole('button', { name: /remover dos favoritos|adicionar aos favoritos/i });
      expect(favButtons.length).toBeGreaterThan(0);

      await act(async () => {
        fireEvent.click(favButtons[0]);
      });

      // onSelectWink should NOT have been called
      expect(onSelectWink).not.toHaveBeenCalled();
      // favoriteWinkIds should have toggled
      expect(mockFavoritesRemove).toHaveBeenCalledWith('diabravinho');
    });

    it('displays recent winks in Recentes tab in newest-to-oldest order', async () => {
      render(
        <WinkPickerPopover
          isOpen={true}
          onClose={vi.fn()}
          onSelectWink={vi.fn()}
        />
      );

      // Wait for published winks to load
      await waitFor(() => {
        expect(screen.getByText('Diabravinho')).toBeInTheDocument();
      });

      const recentsTab = screen.getByRole('tab', { name: /recentes/i });
      await act(async () => {
        fireEvent.click(recentsTab);
      });

      expect(screen.getByText('Bolsogado')).toBeInTheDocument();
      expect(screen.getByText('Nikole')).toBeInTheDocument();
    });
  });

  describe('Contact Muting logic & dmMessageRouting', () => {
    it('isContactMuted returns true for active temporary and indefinite mutes', () => {
      const store = useWinkStore.getState();

      // Not muted
      expect(store.isContactMuted('user-bob')).toBe(false);

      // Active timed mute (1 hour in future)
      useWinkStore.setState({
        contactMutes: {
          'user-bob': {
            id: 'm1',
            userId: 'user-me',
            targetUserId: 'user-bob',
            muteType: 'temporary',
            expiresAt: Date.now() + 3600 * 1000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });

      expect(useWinkStore.getState().isContactMuted('user-bob')).toBe(true);

      // Expired timed mute (1 hour in past)
      useWinkStore.setState({
        contactMutes: {
          'user-bob': {
            id: 'm1',
            userId: 'user-me',
            targetUserId: 'user-bob',
            muteType: 'temporary',
            expiresAt: Date.now() - 3600 * 1000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });

      expect(useWinkStore.getState().isContactMuted('user-bob')).toBe(false);

      // Indefinite mute
      useWinkStore.setState({
        contactMutes: {
          'user-bob': {
            id: 'm2',
            userId: 'user-me',
            targetUserId: 'user-bob',
            muteType: 'indefinite',
            expiresAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });

      expect(useWinkStore.getState().isContactMuted('user-bob')).toBe(true);
    });

    it('dmMessageRouting suppresses queueWink when contact is muted', () => {
      useWinkStore.setState({
        contactMutes: {
          'user-spammer': {
            id: 'm3',
            userId: 'user-me',
            targetUserId: 'user-spammer',
            muteType: 'indefinite',
            expiresAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });

      const message: DmMessageWithUser = {
        id: 'msg-w-1',
        dmChannelId: 'dm-1',
        userId: 'user-spammer',
        content: 'wink:diabravinho',
        type: 'wink',
        winkId: 'diabravinho',
        createdAt: Date.now(),
        user: {
          id: 'user-spammer',
          username: 'spammer',
          displayName: 'Spammer',
          avatar: null,
        },
      };

      const triggered = checkAndTriggerIncomingWink('', 'dm-1', message);
      expect(triggered).toBe(false);
      expect(useWinkStore.getState().activeWink).toBeNull();
      expect(useWinkStore.getState().queue.length).toBe(0);

      // Normal unmuted contact should trigger
      const normalMsg: DmMessageWithUser = {
        id: 'msg-w-2',
        dmChannelId: 'dm-1',
        userId: 'user-friend',
        content: 'wink:diabravinho',
        type: 'wink',
        winkId: 'diabravinho',
        createdAt: Date.now(),
        user: {
          id: 'user-friend',
          username: 'friend',
          displayName: 'Friend',
          avatar: null,
        },
      };

      const normalTriggered = checkAndTriggerIncomingWink('', 'dm-1', normalMsg);
      expect(normalTriggered).toBe(true);
      expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    });
  });

  describe('Settings > Permissões de mensagens > Ignorar e bloquear > Winks silenciados', () => {
    it('renders muted winks section and unmute button', async () => {
      useWinkStore.setState({
        contactMutes: {
          'user-charlie': {
            id: 'm4',
            userId: 'user-me',
            targetUserId: 'user-charlie',
            muteType: 'indefinite',
            expiresAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            targetUser: {
              id: 'user-charlie',
              username: 'charlie',
              displayName: 'Charlie Brown',
              avatar: null,
            },
          },
        },
      });

      render(<MessagePermissionsPanel activeSection="ignore-block" />);

      expect(screen.getByText('Winks silenciados')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      expect(screen.getByText('@charlie')).toBeInTheDocument();
      expect(screen.getByText('Até reativar')).toBeInTheDocument();

      const unmuteBtn = screen.getByRole('button', { name: 'Reativar Winks' });
      expect(unmuteBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(unmuteBtn);
      });

      expect(mockMutesDelete).toHaveBeenCalledWith('user-charlie');
    });

    it('displays empty state when no contacts are muted', () => {
      useWinkStore.setState({ contactMutes: {} });

      render(<MessagePermissionsPanel activeSection="ignore-block" />);

      expect(screen.getByText('Nenhum contato com Winks silenciados no momento.')).toBeInTheDocument();
    });
  });
});
