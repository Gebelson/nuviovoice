import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DiscoverUser } from '@concord/shared';
import { useDiscoverStore, type TaggedDiscoverUser } from './discoverStore';
import { useSocialStore, type TaggedFriend } from './socialStore';
import { api } from '../api/client';

vi.mock('../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      social: {
        ...actual.api?.social,
        discover: vi.fn().mockResolvedValue({ users: [], total: 0 }),
      },
    },
  };
});

vi.mock('./instanceStore', () => ({
  useInstanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ instances: [], _autoConnectDone: true }),
    {
      getState: () => ({ instances: [], _autoConnectDone: true }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
  waitForAutoConnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./authStore', async () => {
  const state = { user: { id: 'me-id' } };
  return (await import('../test/authStoreMock')).authStoreMock(() => state);
});

const makeDiscoverUser = (overrides: Partial<DiscoverUser> = {}): DiscoverUser => ({
  id: 'u-1',
  username: 'alice',
  displayName: 'Alice',
  avatar: null,
  banner: null,
  avatarColor: null,
  bio: null,
  status: 'online',
  customStatus: null,
  createdAt: 1000,
  homeInstance: null,
  homeUserId: null,
  mutualFriendCount: 0,
  mutualSpaceCount: 0,
  relationship: 'none',
  ...overrides,
});

describe('useDiscoverStore — friend exclusion & real-time updates', () => {
  beforeEach(() => {
    useDiscoverStore.getState().reset();
    useSocialStore.setState({ friends: [], requests: [] });
    vi.mocked(api.social.discover).mockReset();
  });

  it('excludes users with relationship="friends", the authenticated user, and users in socialStore.friends on fetchUsers', async () => {
    const existingFriend: TaggedFriend = {
      id: 'f-2',
      username: 'bob',
      displayName: 'Bob',
      avatar: null,
      banner: null,
      accentColor: null,
      avatarColor: null,
      bio: null,
      status: 'online',
      customStatus: null,
      createdAt: 1000,
      addedAt: 1000,
      homeInstance: null,
      homeUserId: null,
      _instanceOrigin: '',
    };
    useSocialStore.setState({ friends: [existingFriend] });

    vi.mocked(api.social.discover).mockResolvedValue({
      users: [
        makeDiscoverUser({ id: 'me-id', username: 'me' }),
        makeDiscoverUser({ id: 'f-1', username: 'friend1', relationship: 'friends' }),
        makeDiscoverUser({ id: 'f-2', username: 'bob', relationship: 'none' }),
        makeDiscoverUser({ id: 'u-pending', username: 'carol', relationship: 'outbound_pending', requestId: 'req-1' }),
        makeDiscoverUser({ id: 'u-new', username: 'dave', relationship: 'none' }),
      ],
      total: 5,
    });

    await useDiscoverStore.getState().fetchUsers();

    const state = useDiscoverStore.getState();
    expect(state.users.map(u => u.id)).toEqual(['u-pending', 'u-new']);
    expect(state.total).toBe(2);
  });

  it('immediately removes a user from discoverStore when updateRelationship is called with "friends"', () => {
    const u1: TaggedDiscoverUser = { ...makeDiscoverUser({ id: 'u-1', username: 'alice', relationship: 'inbound_pending', requestId: 'req-1' }), _instanceOrigin: '' };
    const u2: TaggedDiscoverUser = { ...makeDiscoverUser({ id: 'u-2', username: 'bob', relationship: 'none' }), _instanceOrigin: '' };
    useDiscoverStore.setState({ users: [u1, u2], total: 2 });

    useDiscoverStore.getState().updateRelationship('u-1', '', 'friends');

    const state = useDiscoverStore.getState();
    expect(state.users.map(u => u.id)).toEqual(['u-2']);
    expect(state.total).toBe(1);
  });

  it('removes a user across instances when removeFriendUser is called', () => {
    const bobOnOrbit: TaggedDiscoverUser = {
      ...makeDiscoverUser({ id: 'b-1', username: 'bob', homeUserId: 'b-1', homeInstance: null }),
      _instanceOrigin: 'https://orbit.test',
    };
    const carolOnHome: TaggedDiscoverUser = {
      ...makeDiscoverUser({ id: 'c-1', username: 'carol' }),
      _instanceOrigin: '',
    };
    useDiscoverStore.setState({ users: [bobOnOrbit, carolOnHome], total: 2 });

    // Accepted friend event arrives on home instance for replicated stub of Bob
    useDiscoverStore.getState().removeFriendUser(
      { id: 'nb', homeUserId: 'b-1', homeInstance: 'orbit.test' },
      '',
    );

    const state = useDiscoverStore.getState();
    expect(state.users.map(u => u.id)).toEqual(['c-1']);
    expect(state.total).toBe(1);
  });
});
