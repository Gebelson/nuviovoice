import { describe, it, expect, beforeEach } from 'vitest';
import { useLiveStreamStore } from './liveStreamStore';
import type { LiveStreamInfo } from '@concord/shared';

const mockStream1: LiveStreamInfo = {
  id: 'stream-1',
  userId: 'user-1',
  platform: 'twitch',
  channelId: 'twitch_gamer',
  channelName: 'twitch_gamer',
  channelUrl: 'https://twitch.tv/twitch_gamer',
  isLive: true,
  streamTitle: 'Jogando ao vivo!',
  streamGame: 'Valorant',
  streamThumbnail: 'https://example.com/thumb1.jpg',
  viewerCount: 250,
  startedAt: Date.now() - 100000,
  embedUrl: 'https://player.twitch.tv/?channel=twitch_gamer&autoplay=true&muted=false',
  streamer: {
    id: 'user-1',
    username: 'twitch_gamer',
    displayName: 'Twitch Gamer',
    avatar: null,
    avatarColor: '#9146ff',
    verification: {
      status: 'verified',
      category: 'creator',
    },
  },
  linkedSpace: {
    id: 'space-1',
    name: 'Comunidade Gamer',
    icon: null,
    avatarColor: '#5865F2',
    description: 'Servidor oficial de fãs',
    verification: {
      status: 'verified',
      category: 'space',
    },
  },
};

const mockStream2: LiveStreamInfo = {
  id: 'stream-2',
  userId: 'user-2',
  platform: 'kick',
  channelId: 'kick_streamer',
  channelName: 'kick_streamer',
  channelUrl: 'https://kick.com/kick_streamer',
  isLive: true,
  streamTitle: 'Chuva de subs!',
  streamGame: 'IRL',
  streamThumbnail: null,
  viewerCount: 85,
  startedAt: Date.now() - 50000,
  embedUrl: 'https://player.kick.com/kick_streamer?autoplay=true&muted=false',
  streamer: {
    id: 'user-2',
    username: 'kick_streamer',
    displayName: 'Kick Streamer',
    avatar: null,
    avatarColor: '#53fc18',
    verification: null,
  },
  linkedSpace: null,
};

describe('LiveStreamStore', () => {
  beforeEach(() => {
    useLiveStreamStore.setState({
      liveStreams: [],
      activeStream: null,
      playerMode: 'closed',
      floatingPosition: { x: 24, y: 24 },
      floatingSize: { width: 384, height: 216 },
      anchorRect: null,
      isMuted: false,
      isNativePipActive: false,
      isLoading: false,
    });
  });

  it('opens a stream and sets playerMode', () => {
    const store = useLiveStreamStore.getState();
    store.openStream(mockStream1, 'main');

    const state = useLiveStreamStore.getState();
    expect(state.activeStream).toEqual(mockStream1);
    expect(state.playerMode).toBe('main');
  });

  it('switches between main, floating, minimized and closed modes', () => {
    const store = useLiveStreamStore.getState();
    store.openStream(mockStream1, 'main');

    store.setPlayerMode('floating');
    expect(useLiveStreamStore.getState().playerMode).toBe('floating');

    store.minimizeStream();
    expect(useLiveStreamStore.getState().playerMode).toBe('minimized');

    store.restoreStream('floating');
    expect(useLiveStreamStore.getState().playerMode).toBe('floating');

    store.closeStream();
    expect(useLiveStreamStore.getState().playerMode).toBe('closed');
    expect(useLiveStreamStore.getState().activeStream).toBeNull();
  });

  it('updates floating coordinates and dimensions', () => {
    const store = useLiveStreamStore.getState();
    store.setFloatingPosition({ x: 120, y: 240 });
    store.setFloatingSize({ width: 480, height: 270 });

    const state = useLiveStreamStore.getState();
    expect(state.floatingPosition).toEqual({ x: 120, y: 240 });
    expect(state.floatingSize).toEqual({ width: 480, height: 270 });
  });

  it('handles WebSocket events: stream_started, stream_updated, stream_ended', () => {
    const store = useLiveStreamStore.getState();

    // Stream started
    store.handleStreamStarted(mockStream1);
    expect(useLiveStreamStore.getState().liveStreams).toHaveLength(1);
    expect(useLiveStreamStore.getState().liveStreams[0].id).toBe('stream-1');

    // Add second stream
    store.handleStreamStarted(mockStream2);
    expect(useLiveStreamStore.getState().liveStreams).toHaveLength(2);

    // Stream updated (viewer count increases)
    const updatedStream1: LiveStreamInfo = {
      ...mockStream1,
      viewerCount: 350,
      streamTitle: 'Torneio Final!',
    };
    store.openStream(mockStream1, 'main');
    store.handleStreamUpdated(updatedStream1);

    const stateAfterUpdate = useLiveStreamStore.getState();
    expect(stateAfterUpdate.liveStreams.find((s) => s.id === 'stream-1')?.viewerCount).toBe(350);
    expect(stateAfterUpdate.activeStream?.viewerCount).toBe(350);
    expect(stateAfterUpdate.activeStream?.streamTitle).toBe('Torneio Final!');

    // Stream ended
    store.handleStreamEnded('stream-1', 'user-1');
    const stateAfterEnd = useLiveStreamStore.getState();
    expect(stateAfterEnd.liveStreams).toHaveLength(1);
    expect(stateAfterEnd.liveStreams[0].id).toBe('stream-2');
    expect(stateAfterEnd.activeStream).toBeNull();
    expect(stateAfterEnd.playerMode).toBe('closed');
  });
});
