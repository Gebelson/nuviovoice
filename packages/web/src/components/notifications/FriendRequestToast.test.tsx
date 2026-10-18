import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@concord/shared';
import { FriendRequestToast } from './FriendRequestToast';
import { useFriendRequestNotificationStore, type FriendRequestToastItem } from '../../stores/friendRequestNotificationStore';
import { useSocialStore } from '../../stores/socialStore';
import { useUIStore } from '../../stores/uiStore';
import { setLanguage } from '../../i18n';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const mockUser: User = {
  id: 'usr-123',
  username: 'danilo',
  displayName: 'Danilo Alcantara',
  status: 'online',
  customStatus: null,
  avatar: null,
  avatarColor: '#10b981',
  createdAt: 1000,
  isAdmin: false,
  replicatedInstances: [],
};

const mockToast: FriendRequestToastItem = {
  requestId: 'req-abc',
  origin: '',
  user: mockUser,
  createdAt: Date.now(),
  state: 'pending',
};

describe('FriendRequestToast', () => {
  beforeEach(async () => {
    await setLanguage('pt');
    useFriendRequestNotificationStore.getState().clearAll();
  });

  it('renders display name, handle, avatar, and accept/decline buttons', () => {
    render(<FriendRequestToast toast={mockToast} />);

    expect(screen.getByText('Danilo Alcantara')).toBeInTheDocument();
    expect(screen.getByText('@danilo')).toBeInTheDocument();
    expect(screen.getByText('Solicitação de amizade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeInTheDocument();
  });

  it('accepts the friend request when clicking Aceitar and shows confirmation', async () => {
    const updateFriendRequest = vi.fn().mockResolvedValue(undefined);
    useSocialStore.setState({ updateFriendRequest });

    render(<FriendRequestToast toast={mockToast} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => {
      expect(updateFriendRequest).toHaveBeenCalledWith('req-abc', '', 'accepted');
    });

    expect(await screen.findByText(/Você e @Danilo Alcantara agora são amigos!/i)).toBeInTheDocument();
  });

  it('declines the friend request and closes the toast when clicking Recusar', async () => {
    const updateFriendRequest = vi.fn().mockResolvedValue(undefined);
    useSocialStore.setState({ updateFriendRequest });
    const dismissToastSpy = vi.spyOn(useFriendRequestNotificationStore.getState(), 'dismissToast');

    render(<FriendRequestToast toast={mockToast} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() => {
      expect(updateFriendRequest).toHaveBeenCalledWith('req-abc', '', 'declined');
    });
    expect(dismissToastSpy).toHaveBeenCalledWith('req-abc');
  });

  it('dismisses the toast without modifying friend request when clicking X', () => {
    const updateFriendRequest = vi.fn();
    useSocialStore.setState({ updateFriendRequest });
    const dismissToastSpy = vi.spyOn(useFriendRequestNotificationStore.getState(), 'dismissToast');

    render(<FriendRequestToast toast={mockToast} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }));

    expect(dismissToastSpy).toHaveBeenCalledWith('req-abc');
    expect(updateFriendRequest).not.toHaveBeenCalled();
  });

  it('opens user profile modal when clicking user avatar', () => {
    const openModalSpy = vi.spyOn(useUIStore.getState(), 'openModal');

    render(<FriendRequestToast toast={mockToast} />);

    fireEvent.click(screen.getByTitle('Danilo Alcantara'));

    expect(openModalSpy).toHaveBeenCalledWith('userProfile', expect.objectContaining({
      origin: '',
    }));
  });
});
