import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageWithUser, User } from '@concord/shared';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';
import { useAuthStore } from '../../../stores/authStore';
import { useChatStore } from '../../../stores/chatStore';
import { useComposerStore } from '../../../stores/composerStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useWinkStore } from '../../../stores/winkStore';
import { MessageInput } from '../MessageInput';
import { WinkMessageCard } from '../WinkMessageCard';
import { WinkAnimationPlayer } from '../WinkAnimationPlayer';
import { WinkPickerPopover } from '../WinkPickerPopover';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));
vi.mock('../../../audio/winkAudio', () => ({
  playWinkSound: vi.fn(),
}));

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

const sendWinkMock = vi.fn().mockResolvedValue({
  id: 'msg-wink-1',
  dmChannelId: 'dm-1',
  userId: 'user-me',
  content: '{"type":"wink","winkId":"kiss","senderName":"Alice"}',
  type: 'wink',
  createdAt: Date.now(),
});

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      dm: {
        ...actual.api.dm,
        sendWink: (...args: any[]) => sendWinkMock(...args),
      },
    },
    getApiForOrigin: () => ({
      ...actual.api,
      dm: {
        ...actual.api.dm,
        sendWink: (...args: any[]) => sendWinkMock(...args),
      },
    }),
  };
});

describe('Winks functionality in Direct Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: me, token: 'token' });
    useComposerStore.setState({ states: new Map() });
    useChatStore.setState({
      currentChannelId: 'dm-1',
      messages: new Map(),
      replyTargets: new Map(),
      editingMessageId: null,
    });
    useWinkStore.setState({
      settings: {
        autoplay: true,
        playAudio: true,
        volume: 80,
        reduceMotion: false,
        disableIncoming: false,
      },
      recentWinkIds: ['kiss', 'giant-heart', 'confetti'],
      activeWink: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Winks button in DM channels, immediately to the left of the emoji button', () => {
    useSpaceStore.getState().reset();
    useSpaceStore.getState().populateFromReady('', [], [], [{
      id: 'dm-1',
      federatedId: null,
      ownerId: null,
      ownerHomeUserId: null,
      ownerHomeInstance: null,
      createdAt: 1,
      members: [me],
      lastMessage: null,
      name: 'Bob',
      icon: null,
      metadataUpdatedAt: 1,
    }]);

    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    expect(winksButton).toBeInTheDocument();

    const emojiButton = screen.getByRole('button', { name: /emoji/i });
    expect(emojiButton).toBeInTheDocument();

    // Verify ordering: winks button is immediately preceding emoji button
    const buttons = screen.getAllByRole('button');
    const winksIdx = buttons.indexOf(winksButton);
    const emojiIdx = buttons.indexOf(emojiButton);
    expect(winksIdx).toBe(emojiIdx - 1);
  });

  it('DOES NOT render Winks button in Space channels', () => {
    useSpaceStore.getState().reset();
    useSpaceStore.getState().populateFromReady('', [{
      id: 'space-1',
      name: 'Space',
      icon: null,
      banner: null,
      ownerId: 'user-me',
      ownerHomeUserId: null,
      ownerHomeInstance: null,
      homeInstance: null,
      federatedId: null,
      replicatedInstances: [],
      createdAt: 1,
      channels: [{
        id: 'space-channel-1',
        spaceId: 'space-1',
        name: 'general',
        type: 'text',
        position: 0,
        topic: null,
        rateLimitPerUser: 0,
        isDefault: true,
        createdAt: 1,
      }],
      roles: [],
      members: [],
    } as any], [], []);
    useSpaceStore.getState().channelPermissions.set('space-channel-1', BigInt(0x7fffffff));

    render(<MessageInput channelId="space-channel-1" channelName="#general" />);

    const winksButton = screen.queryByRole('button', { name: /wink/i });
    expect(winksButton).not.toBeInTheDocument();

    const emojiButton = screen.getByRole('button', { name: /emoji/i });
    expect(emojiButton).toBeInTheDocument();
  });

  it('opens WinkPickerPopover when clicking the Winks button', () => {
    useSpaceStore.getState().reset();
    useSpaceStore.getState().populateFromReady('', [], [], [{
      id: 'dm-1',
      federatedId: null,
      ownerId: null,
      ownerHomeUserId: null,
      ownerHomeInstance: null,
      createdAt: 1,
      members: [me],
      lastMessage: null,
      name: 'Bob',
      icon: null,
      metadataUpdatedAt: 1,
    }]);

    render(<MessageInput channelId="dm-1" channelName="@Bob" />);

    const winksButton = screen.getByRole('button', { name: /wink/i });
    fireEvent.click(winksButton);

    // Popover header
    expect(screen.getByText('Animações clássicas para mensagens diretas')).toBeInTheDocument();
    // Search input
    expect(screen.getByPlaceholderText('Encontre um Wink...')).toBeInTheDocument();
  });

  it('WinkPickerPopover displays official catalog and filter by category', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchorRef = { current: document.createElement('div') };

    render(<WinkPickerPopover onSelect={onSelect} onClose={onClose} anchorRef={anchorRef} />);

    // Check all 16 winks are represented
    expect(OFFICIAL_WINKS.length).toBe(16);

    // Filter by Romance category
    const romanceButton = screen.getByRole('button', { name: 'Romance' });
    fireEvent.click(romanceButton);

    expect(screen.getByText('Beijo animado')).toBeInTheDocument();
    expect(screen.getByText('Coração gigante')).toBeInTheDocument();

    // Click to select
    const kissButton = screen.getByRole('button', { name: /beijo animado/i });
    fireEvent.click(kissButton);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'kiss' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('WinkMessageCard renders correctly and triggers local replay', () => {
    render(
      <WinkMessageCard
        winkId="kiss"
        senderName="Alice"
        channelId="dm-1"
      />
    );

    expect(screen.getByText('Wink do Nuvio')).toBeInTheDocument();
    expect(screen.getByText('Beijo animado')).toBeInTheDocument();

    const replayButton = screen.getByRole('button', { name: /reproduzir/i });
    expect(replayButton).toBeInTheDocument();

    fireEvent.click(replayButton);

    const activeWink = useWinkStore.getState().activeWink;
    expect(activeWink).not.toBeNull();
    expect(activeWink?.winkId).toBe('kiss');
    expect(activeWink?.isLocalReplay).toBe(true);
  });

  it('WinkAnimationPlayer displays active wink and allows manual dismiss', () => {
    useWinkStore.getState().triggerWink({
      winkId: 'confetti',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    render(<WinkAnimationPlayer />);

    expect(screen.getByTestId('wink-animation-player')).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Confetes/)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /fechar/i });
    fireEvent.click(closeBtn);

    expect(useWinkStore.getState().activeWink).toBeNull();
  });

  it('useWinkStore honors disableIncoming and autoplay settings', () => {
    useWinkStore.setState({
      settings: {
        autoplay: false,
        playAudio: false,
        volume: 50,
        reduceMotion: true,
        disableIncoming: true,
      },
      activeWink: null,
    });

    // An incoming wink should not trigger when disableIncoming is true or autoplay is false
    useWinkStore.getState().triggerWink({
      winkId: 'kiss',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: false,
    });

    expect(useWinkStore.getState().activeWink).toBeNull();

    // Local replay must always trigger regardless of disableIncoming
    useWinkStore.getState().triggerWink({
      winkId: 'kiss',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    expect(useWinkStore.getState().activeWink).not.toBeNull();
    expect(useWinkStore.getState().activeWink?.winkId).toBe('kiss');
  });
});
