import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFriendRequestNotificationStore } from './friendRequestNotificationStore';
import { useAuthStore } from './authStore';
import { useVoiceStore } from './voiceStore';
import type { FriendRequest, User } from '@concord/shared';

vi.mock('../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: () => ({
      playSound: vi.fn().mockResolvedValue(null),
    }),
  },
}));

const mockUser1: User = {
  id: 'user-1',
  username: 'marcos',
  displayName: 'Marcos Silva',
  status: 'online',
  customStatus: null,
  avatar: null,
  avatarColor: '#22c55e',
  createdAt: 1000,
  isAdmin: false,
  replicatedInstances: [],
};

const mockUser2: User = {
  id: 'user-2',
  username: 'beatriz',
  displayName: 'Beatriz Costa',
  status: 'idle',
  customStatus: null,
  avatar: null,
  avatarColor: '#3b82f6',
  createdAt: 2000,
  isAdmin: false,
  replicatedInstances: [],
};

const mockUser3: User = {
  id: 'user-3',
  username: 'carlos',
  displayName: 'Carlos Eduardo',
  status: 'online',
  customStatus: null,
  avatar: null,
  avatarColor: '#a855f7',
  createdAt: 3000,
  isAdmin: false,
  replicatedInstances: [],
};

const makeRequest = (id: string, user: User): FriendRequest => ({
  id,
  fromId: user.id,
  toId: 'me',
  status: 'pending',
  createdAt: Date.now(),
  user,
});

describe('friendRequestNotificationStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useFriendRequestNotificationStore.getState().clearAll();
    useFriendRequestNotificationStore.setState({
      floatingEnabled: true,
      soundEnabled: true,
      hideOnScreenShare: true,
    });
    useAuthStore.setState({
      user: {
        id: 'me',
        username: 'me',
        displayName: 'My Account',
        status: 'online',
        customStatus: null,
        avatar: null,
        avatarColor: null,
        createdAt: 0,
        isAdmin: false,
        replicatedInstances: [],
      },
    });
    useVoiceStore.setState({
      isScreenSharing: false,
    });
  });

  it('pushes up to 2 active toasts and queues the rest in FIFO order', () => {
    const store = useFriendRequestNotificationStore.getState();
    const req1 = makeRequest('req-1', mockUser1);
    const req2 = makeRequest('req-2', mockUser2);
    const req3 = makeRequest('req-3', mockUser3);

    store.pushNotification(req1, '');
    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(1);
    expect(useFriendRequestNotificationStore.getState().queue).toHaveLength(0);

    store.pushNotification(req2, '');
    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(2);
    expect(useFriendRequestNotificationStore.getState().queue).toHaveLength(0);

    // 3rd item should be queued
    store.pushNotification(req3, '');
    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(2);
    expect(useFriendRequestNotificationStore.getState().queue).toHaveLength(1);
    expect(useFriendRequestNotificationStore.getState().queue[0].requestId).toBe('req-3');
  });

  it('deduplicates incoming requests by requestId', () => {
    const store = useFriendRequestNotificationStore.getState();
    const req1 = makeRequest('req-1', mockUser1);

    store.pushNotification(req1, '');
    store.pushNotification(req1, '');
    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(1);
  });

  it('promotes the next item from the queue when an active toast is dismissed', () => {
    const store = useFriendRequestNotificationStore.getState();
    const req1 = makeRequest('req-1', mockUser1);
    const req2 = makeRequest('req-2', mockUser2);
    const req3 = makeRequest('req-3', mockUser3);

    store.pushNotification(req1, '');
    store.pushNotification(req2, '');
    store.pushNotification(req3, '');

    expect(useFriendRequestNotificationStore.getState().activeToasts.map((t) => t.requestId)).toEqual(['req-1', 'req-2']);
    expect(useFriendRequestNotificationStore.getState().queue.map((t) => t.requestId)).toEqual(['req-3']);

    // Dismiss req-1 -> req-3 should be promoted into activeToasts
    store.dismissToast('req-1');

    const state = useFriendRequestNotificationStore.getState();
    expect(state.activeToasts.map((t) => t.requestId)).toEqual(['req-2', 'req-3']);
    expect(state.queue).toHaveLength(0);
  });

  it('suppresses floating notifications when Do Not Disturb (DND) is active', () => {
    useAuthStore.setState({
      user: {
        id: 'me',
        username: 'me',
        displayName: 'My Account',
        status: 'dnd',
        customStatus: null,
        avatar: null,
        avatarColor: null,
        createdAt: 0,
        isAdmin: false,
        replicatedInstances: [],
      },
    });

    const store = useFriendRequestNotificationStore.getState();
    store.pushNotification(makeRequest('req-1', mockUser1), '');

    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(0);
    expect(useFriendRequestNotificationStore.getState().queue).toHaveLength(0);
  });

  it('suppresses floating notifications when screen sharing and hideOnScreenShare is true', () => {
    useVoiceStore.setState({ isScreenSharing: true });

    const store = useFriendRequestNotificationStore.getState();
    store.pushNotification(makeRequest('req-1', mockUser1), '');

    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(0);
  });

  it('suppresses notifications when floatingEnabled is false', () => {
    useFriendRequestNotificationStore.getState().setFloatingEnabled(false);

    const store = useFriendRequestNotificationStore.getState();
    store.pushNotification(makeRequest('req-1', mockUser1), '');

    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(0);
  });

  it('dismissTopToast dismisses the newest active toast (Escape key action)', () => {
    const store = useFriendRequestNotificationStore.getState();
    store.pushNotification(makeRequest('req-1', mockUser1), '');
    store.pushNotification(makeRequest('req-2', mockUser2), '');

    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(2);

    store.dismissTopToast();

    // Topmost was req-2 (last in array)
    expect(useFriendRequestNotificationStore.getState().activeToasts.map((t) => t.requestId)).toEqual(['req-1']);
  });

  it('cancelToast removes the request if sender cancels', () => {
    const store = useFriendRequestNotificationStore.getState();
    store.pushNotification(makeRequest('req-1', mockUser1), '');

    store.cancelToast('req-1');
    expect(useFriendRequestNotificationStore.getState().activeToasts).toHaveLength(0);
  });
});
