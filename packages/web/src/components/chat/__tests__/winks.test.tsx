import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@concord/shared';
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
  content: '{"type":"wink","winkId":"diabravinho","senderName":"Alice"}',
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
      recentWinkIds: ['diabravinho', 'bolsogado', 'nikole'],
      activeWink: null,
      publishedWinks: [...OFFICIAL_WINKS],
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

  it('WinkPickerPopover displays exactly the 3 new winks in order without empty categories', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const anchorRef = { current: document.createElement('div') };

    render(<WinkPickerPopover onSelect={onSelect} onClose={onClose} anchorRef={anchorRef} />);

    // Check exactly 3 winks are present
    expect(OFFICIAL_WINKS.length).toBe(3);
    expect(OFFICIAL_WINKS.map((w) => w.id)).toEqual(['diabravinho', 'bolsogado', 'nikole']);

    // Check names appear in document
    expect(screen.getAllByText('Diabravinho').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bolsogado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nikole').length).toBeGreaterThan(0);

    // Filter by Humor category
    const humorButton = screen.getByRole('button', { name: 'Humor' });
    fireEvent.click(humorButton);

    // Click to select Diabravinho
    const diabravinhoBtn = screen.getByRole('button', { name: /diabravinho/i });
    fireEvent.click(diabravinhoBtn);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'diabravinho' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('WinkMessageCard renders correctly and triggers local replay for valid winks', () => {
    render(
      <WinkMessageCard
        winkId="diabravinho"
        senderName="Alice"
        channelId="dm-1"
      />
    );

    expect(screen.getByText('Wink do Nuvio')).toBeInTheDocument();
    expect(screen.getByText('Diabravinho')).toBeInTheDocument();

    const replayButton = screen.getByRole('button', { name: /reproduzir/i });
    expect(replayButton).toBeInTheDocument();

    fireEvent.click(replayButton);

    const activeWink = useWinkStore.getState().activeWink;
    expect(activeWink).not.toBeNull();
    expect(activeWink?.winkId).toBe('diabravinho');
    expect(activeWink?.isLocalReplay).toBe(true);
  });

  it('WinkMessageCard displays "Wink não disponível" for historical messages with removed winks', () => {
    render(
      <WinkMessageCard
        winkId="kiss"
        senderName="Bob"
        channelId="dm-1"
      />
    );

    expect(screen.getByText('Wink não disponível')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reproduzir/i })).not.toBeInTheDocument();
  });

  it('WinkAnimationPlayer displays active wink and allows manual dismiss', () => {
    useWinkStore.getState().triggerWink({
      winkId: 'diabravinho',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    render(<WinkAnimationPlayer />);

    expect(screen.getByTestId('wink-animation-player')).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Diabravinho/)).toBeInTheDocument();

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
      winkId: 'diabravinho',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: false,
    });

    expect(useWinkStore.getState().activeWink).toBeNull();

    // Local replay must always trigger regardless of disableIncoming
    useWinkStore.getState().triggerWink({
      winkId: 'diabravinho',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    expect(useWinkStore.getState().activeWink).not.toBeNull();
    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
  });
  it('official winks have correct static /winks/... URLs and resolveWinkMediaUrls preserves them', () => {
    const diabravinho = useWinkStore.getState().getWink('diabravinho');
    expect(diabravinho?.webmUrl).toBe('/winks/diabravinho.webm');
    expect(diabravinho?.mp4Url).toBe('/winks/diabravinho.mp4');
    expect(diabravinho?.thumbnailUrl).toBe('/winks/diabravinho_thumb.webp');

    const bolsogado = useWinkStore.getState().getWink('bolsogado');
    expect(bolsogado?.webmUrl).toBe('/winks/bolsogado.webm');
    expect(bolsogado?.mp4Url).toBe('/winks/bolsogado.mp4');
    expect(bolsogado?.thumbnailUrl).toBe('/winks/bolsogado_thumb.webp');

    const nikole = useWinkStore.getState().getWink('nikole');
    expect(nikole?.webmUrl).toBe('/winks/nikole.webm');
    expect(nikole?.mp4Url).toBe('/winks/nikole.mp4');
    expect(nikole?.thumbnailUrl).toBe('/winks/nikole_thumb.webp');
  });

  it('WinkAnimationPlayer falls back from WebM to MP4 on error instead of silently dismissing', () => {
    useWinkStore.getState().triggerWink({
      winkId: 'diabravinho',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    render(<WinkAnimationPlayer />);

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toContain('/winks/diabravinho.webm');

    // Trigger media error on WebM
    act(() => {
      fireEvent.error(video);
    });

    // Wink must NOT be dismissed silently
    expect(useWinkStore.getState().activeWink).not.toBeNull();
    // It should have switched format to MP4
    expect(video.src).toContain('/winks/diabravinho.mp4');

    // If MP4 also errors, it displays error banner without crashing or silent unmount
    act(() => {
      fireEvent.error(video);
    });
    expect(useWinkStore.getState().activeWink).not.toBeNull();
    expect(screen.getByText(/Não foi possível carregar a animação/)).toBeInTheDocument();
  });

  it('WinkAnimationPlayer dismisses cleanly on ended event', () => {
    useWinkStore.getState().triggerWink({
      winkId: 'bolsogado',
      senderName: 'Bob',
      channelId: 'dm-1',
      isLocalReplay: true,
    });

    render(<WinkAnimationPlayer />);
    const video = document.querySelector('video') as HTMLVideoElement;

    // Simulate video playing
    act(() => {
      fireEvent.playing(video);
    });
    expect(useWinkStore.getState().activeWink).not.toBeNull();

    // Simulate video ended naturally
    act(() => {
      fireEvent.ended(video);
    });
    expect(useWinkStore.getState().activeWink).toBeNull();
  });
});