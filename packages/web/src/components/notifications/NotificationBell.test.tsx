import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FriendRequest, User } from '@concord/shared';
import { NotificationBell } from './NotificationBell';
import { useSocialStore, type TaggedFriendRequest } from '../../stores/socialStore';
import { setLanguage } from '../../i18n';

const mockUser: User = {
  id: 'usr-999',
  username: 'larissa',
  displayName: 'Larissa Mendes',
  status: 'online',
  customStatus: null,
  avatar: null,
  avatarColor: '#ec4899',
  createdAt: 1000,
  isAdmin: false,
  replicatedInstances: [],
};

const makeIncomingRequest = (id: string): TaggedFriendRequest => ({
  id,
  fromId: mockUser.id,
  toId: 'me',
  status: 'pending',
  createdAt: Date.now(),
  user: mockUser,
  _instanceOrigin: '',
});

describe('NotificationBell', () => {
  beforeEach(async () => {
    await setLanguage('pt');
    useSocialStore.setState({ requests: [] });
  });

  it('renders the bell button without badge when there are no pending requests', () => {
    render(<NotificationBell />);

    const button = screen.getByRole('button', { name: 'Central de Notificações' });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows badge count when there are pending incoming requests', () => {
    useSocialStore.setState({
      requests: [makeIncomingRequest('req-1'), makeIncomingRequest('req-2')],
    });

    render(<NotificationBell />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens and closes the notification center popover on button clicks', () => {
    useSocialStore.setState({
      requests: [makeIncomingRequest('req-1')],
    });

    render(<NotificationBell />);

    const button = screen.getByRole('button', { name: 'Central de Notificações' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Click to open popover
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Central de Notificações' })).toBeInTheDocument();
    expect(screen.getByText('Larissa Mendes')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
