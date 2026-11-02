import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@concord/shared';

vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));
vi.mock('../../hooks/useHubUpdateState', () => ({
  useHubUpdateState: () => ({ state: 'current', version: '1.2.0' }),
}));

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { ChannelSidebar } from './ChannelSidebar';

function mockUser(fields: Partial<User> & Pick<User, 'id' | 'username'>): User {
  return {
    displayName: 'Gebelson',
    avatar: null,
    banner: null,
    accentColor: null,
    avatarColor: null,
    bio: null,
    status: 'online',
    customStatus: null,
    isAdmin: true,
    createdAt: 1,
    homeInstance: null,
    homeUserId: null,
    replicatedInstances: [],
    ...fields,
  } as User;
}

describe('ChannelSidebar User Area Verification Badge', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'test-token', user: null });
  });

  it('renders official team verification shield badge in bottom-left user panel when verified', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: mockUser({
        id: '375685713431105536',
        username: 'gebelson',
        displayName: 'Gebelson',
        verification: {
          status: 'verified',
          category: 'official',
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <ChannelSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Gebelson')).toBeInTheDocument();
    expect(screen.getByText('@gebelson')).toBeInTheDocument();
    const badge = screen.getByTestId('verification-badge-official');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Equipe oficial Nuvio');
  });

  it('does not render badge if user is not verified', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: mockUser({
        id: '123',
        username: 'regular_user',
        displayName: 'Regular User',
        verification: null,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <ChannelSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Regular User')).toBeInTheDocument();
    expect(screen.queryByTestId('verification-badge-official')).not.toBeInTheDocument();
    expect(screen.queryByTestId('verification-badge-personal')).not.toBeInTheDocument();
  });
});
