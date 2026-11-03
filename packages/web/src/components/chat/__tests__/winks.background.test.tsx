import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { DmMessageWithUser, User } from '@concord/shared';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';
import { useAuthStore } from '../../../stores/authStore';
import { useChatStore } from '../../../stores/chatStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useUserPreferencesStore } from '../../../stores/userPreferencesStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { GlobalWinkOverlay } from '../GlobalWinkOverlay';
import { NotificationController } from '../../NotificationController';
import { applyIncomingDmMessage } from '../../../utils/dmMessageRouting';
import * as notificationsPlatform from '../../../platform/notifications';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));

const mockPlayWinkSound = vi.fn();
const mockStopWinkSound = vi.fn();
const mockResumeContext = vi.fn();

vi.mock('../../../audio/AudioManager', () => {
  const mockInstance = {
    setOutputDevice: vi.fn(),
    setVolume: vi.fn(),
    loadSound: vi.fn().mockResolvedValue(null),
    playSound: vi.fn().mockResolvedValue(null),
    loadWinkSound: vi.fn().mockResolvedValue({}),
    playWinkSound: (...args: any[]) => mockPlayWinkSound(...args),
    stopWinkSound: () => mockStopWinkSound(),
    resumeContext: () => mockResumeContext(),
    preloadWinkSounds: vi.fn(),
    getContext: vi.fn().mockReturnValue({ state: 'running' }),
  };
  return {
    AudioManager: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
    },
  };
});

const me: User = {
  id: 'user-me',
  username: 'alice',
  displayName: 'Alice',
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
};

const bob: User = {
  id: 'user-bob',
  username: 'bob',
  displayName: 'Bob',
  avatar: null,
  banner: null,
  accentColor: null,
  avatarColor: null,
  bio: null,
  status: 'online',
  customStatus: null,
  isAdmin: false,
  createdAt: 2,
  homeInstance: null,
  homeUserId: null,
  replicatedInstances: [],
};

function createWinkMessage(channelId: string, winkId: string, id = `msg-${Date.now()}`): DmMessageWithUser {
  return {
    id,
    dmChannelId: channelId,
    userId: bob.id,
    user: bob,
    content: JSON.stringify({ type: 'wink', winkId, senderName: 'Bob' }),
    type: 'wink',
    createdAt: Date.now(),
  } as unknown as DmMessageWithUser;
}

describe('Winks Background Audio & Call Ducking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayWinkSound.mockResolvedValue({ stop: vi.fn(), disconnect: vi.fn() });
    mockResumeContext.mockResolvedValue(undefined);

    useAuthStore.setState({ user: me, token: 'fake-token' });
    useChatStore.setState({
      currentChannelId: 'dm-channel-1',
      messages: new Map(),
      channelDrafts: new Map(),
      unreadChannels: new Set(),
      realtimeMessageEvents: [],
    });
    useSpaceStore.setState({
      currentSpaceId: '@me',
      dmChannels: [
        {
          id: 'dm-channel-1',
          userId: bob.id,
          user: bob,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          closed: 0,
        } as any,
      ],
      channelToSpaceMap: new Map(),
    });
    useVoiceStore.setState({
      currentVoiceChannelId: null,
      activeDmCall: null,
      isLiveKitConnected: false,
      soundEffectVolume: 1.0,
    });
    useUserPreferencesStore.setState({
      muteAllNotificationSounds: false,
      desktopNotificationsEnabled: true,
    });
    useWinkStore.setState({
      publishedWinks: [...OFFICIAL_WINKS],
      settings: {
        autoplay: true,
        playAudio: true,
        playAudioInBackground: true,
        playAudioInCall: false,
        volume: 80,
        notifyWinks: true,
        notifyWinksInBackground: true,
        reduceMotion: false,
        disableIncoming: false,
      },
      activeWink: null,
      queue: [],
      isAutoplayBlocked: false,
      audioUnlocked: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    vi.restoreAllMocks();
  });

  it('immediately triggers audio when window is hidden/in background and playAudioInBackground is true', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });

    render(
      <MemoryRouter>
        <GlobalWinkOverlay />
      </MemoryRouter>
    );

    const winkMsg = createWinkMessage('dm-channel-1', 'diabravinho', 'msg-bg-1');

    await act(async () => {
      await applyIncomingDmMessage('', winkMsg);
    });

    expect(useWinkStore.getState().activeWink).not.toBeNull();
    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    expect(mockPlayWinkSound).toHaveBeenCalledTimes(1);
    expect(mockPlayWinkSound).toHaveBeenCalledWith('diabravinho', expect.objectContaining({
      volume: 0.8,
    }));
  });

  it('does NOT trigger audio when window is hidden if playAudioInBackground is disabled', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    useWinkStore.getState().updateSettings({ playAudioInBackground: false });

    render(
      <MemoryRouter>
        <GlobalWinkOverlay />
      </MemoryRouter>
    );

    const winkMsg = createWinkMessage('dm-channel-1', 'diabravinho', 'msg-bg-2');

    await act(async () => {
      await applyIncomingDmMessage('', winkMsg);
    });

    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    expect(mockPlayWinkSound).not.toHaveBeenCalled();
  });

  it('mutes Wink audio during an active voice call if playAudioInCall is false', async () => {
    useVoiceStore.setState({
      currentVoiceChannelId: 'voice-room-1',
      isLiveKitConnected: true,
    });
    useWinkStore.getState().updateSettings({ playAudioInCall: false });

    render(
      <MemoryRouter>
        <GlobalWinkOverlay />
      </MemoryRouter>
    );

    const winkMsg = createWinkMessage('dm-channel-1', 'diabravinho', 'msg-call-1');

    await act(async () => {
      await applyIncomingDmMessage('', winkMsg);
    });

    // Wink is active visually, but sound is muted
    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    expect(mockPlayWinkSound).not.toHaveBeenCalled();
  });

  it('plays Wink audio with 50% ducking during active call if playAudioInCall is true', async () => {
    useVoiceStore.setState({
      currentVoiceChannelId: 'voice-room-1',
      isLiveKitConnected: true,
    });
    useWinkStore.getState().updateSettings({ playAudioInCall: true, volume: 80 });

    render(
      <MemoryRouter>
        <GlobalWinkOverlay />
      </MemoryRouter>
    );

    const winkMsg = createWinkMessage('dm-channel-1', 'diabravinho', 'msg-call-2');

    await act(async () => {
      await applyIncomingDmMessage('', winkMsg);
    });

    expect(mockPlayWinkSound).toHaveBeenCalledTimes(1);
    // 80% volume ducked by 50% = 0.40 volume
    expect(mockPlayWinkSound).toHaveBeenCalledWith('diabravinho', expect.objectContaining({
      volume: 0.4,
    }));
  });

  it('suppresses redundant desktop notification if the user is focused on the active channel watching the wink', async () => {
    const sendNotificationSpy = vi.spyOn(notificationsPlatform, 'sendNotification');

    render(
      <MemoryRouter>
        <GlobalWinkOverlay />
        <NotificationController />
      </MemoryRouter>
    );

    const winkMsg = createWinkMessage('dm-channel-1', 'bolsogado', 'msg-active-1');

    await act(async () => {
      await applyIncomingDmMessage('', winkMsg);
    });

    // Global overlay is showing the animation
    expect(screen.getByTestId('wink-animation-player')).toBeInTheDocument();
    // NotificationController suppressed OS notification because user is watching the wink in the open channel!
    expect(sendNotificationSpy).not.toHaveBeenCalled();
  });
});
