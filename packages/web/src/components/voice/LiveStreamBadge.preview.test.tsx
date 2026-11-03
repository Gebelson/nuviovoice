import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Track, RoomEvent } from 'livekit-client';

const { mockRooms, mockNavigate, mockPreviewToken, getActiveRoomMock, setActiveRoomMock, MockRoom } = vi.hoisted(() => {
  const rooms: any[] = [];
  let activeMock: any = null;
  const nav = vi.fn();
  const prevToken = vi.fn();

  class MockRoom {
    events: Record<string, Function[]> = {};
    remoteParticipants = new Map<string, any>();
    localParticipant = {
      identity: 'local-user:local',
      name: 'local',
      trackPublications: new Map(),
      getTrackPublication: vi.fn(),
    };

    constructor(public opts?: any) {
      rooms.push(this);
    }

    on(event: string, fn: Function) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(fn);
      return this;
    }

    off(event: string, fn: Function) {
      if (this.events[event]) {
        this.events[event] = this.events[event].filter((h: any) => h !== fn);
      }
      return this;
    }

    emit(event: string, ...args: any[]) {
      const list = this.events[event] || [];
      for (const fn of [...list]) {
        fn(...args);
      }
    }

    connect = vi.fn().mockImplementation(async (_url: string, _token: string, _opts?: any) => {
      return this;
    });

    disconnect = vi.fn().mockImplementation(() => {
      this.emit('disconnected');
    });
  }

  return {
    mockRooms: rooms,
    mockNavigate: nav,
    mockPreviewToken: prevToken,
    getActiveRoomMock: () => activeMock,
    setActiveRoomMock: (r: any) => { activeMock = r; },
    MockRoom,
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../utils/voice', () => ({
  joinVoiceChannel: vi.fn(),
  broadcastVoiceStatus: vi.fn(),
  clearSpaceVoiceForDmCall: vi.fn(),
}));

vi.mock('livekit-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('livekit-client')>();
  return {
    ...actual,
    Room: MockRoom,
  };
});

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      livekit: {
        ...actual.api.livekit,
        previewToken: (...args: any[]) => mockPreviewToken(...args),
      },
    },
  };
});

vi.mock('../../hooks/useLiveKit', () => ({
  getActiveRoom: () => getActiveRoomMock(),
  parseIdentity: (identity: string) => {
    const [userId, username] = identity.split(':');
    return { userId, username: username || identity };
  },
}));

import { LiveStreamBadge } from './LiveStreamBadge';
import { useVoiceStore } from '../../stores/voiceStore';
import { joinVoiceChannel } from '../../utils/voice';

function createMockTrack() {
  return {
    kind: Track.Kind.Video,
    source: Track.Source.ScreenShare,
    attach: vi.fn(),
    detach: vi.fn(),
  };
}

function createMockPublication(track = createMockTrack()) {
  return {
    kind: Track.Kind.Video,
    source: Track.Source.ScreenShare,
    track,
    isSubscribed: false,
    setSubscribed: vi.fn(function (this: any, sub: boolean) {
      this.isSubscribed = sub;
    }),
    setVideoQuality: vi.fn(),
  };
}

function createMockParticipant(userId: string, username: string, pub = createMockPublication()) {
  const pubs = new Map<string, any>();
  pubs.set('screen-pub-1', pub);
  return {
    identity: `${userId}:${username}`,
    name: username,
    trackPublications: pubs,
  };
}

describe('LiveStreamBadge - Comprehensive 18 Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRooms.length = 0;
    setActiveRoomMock(null);
    mockPreviewToken.mockResolvedValue({ token: 'jwt.token.preview', url: 'wss://livekit.test' });

    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    useVoiceStore.setState({
      currentVoiceChannelId: null,
      isLiveKitConnected: false,
      activeDmCall: null,
      participants: [],
      watchingStreams: new Set(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Active stream preview loads and plays video frames
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 1: Active stream preview loads and plays video frames', async () => {
    vi.useFakeTimers();

    const mockTrack = createMockTrack();
    const mockPub = createMockPublication(mockTrack);
    const mockPart = createMockParticipant('user-1', 'frango', mockPub);

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
          spaceId="space-1"
          spaceName="Nuvio Oficial"
        />
      </MemoryRouter>
    );

    const badge = screen.getByRole('button', { name: /frango/i });
    fireEvent.mouseEnter(badge);

    // Fast-forward debounce (250ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockPreviewToken).toHaveBeenCalledWith('chan-voice-1');

    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    expect(room).toBeDefined();
    expect(room.connect).toHaveBeenCalled();

    // Populate remote participants in preview room
    room.remoteParticipants.set('user-1:frango', mockPart);

    // Simulate TrackSubscribed from LiveKit
    act(() => {
      room.emit(RoomEvent.TrackSubscribed, mockTrack, mockPub, mockPart);
    });

    expect(mockTrack.attach).toHaveBeenCalled();

    // Simulate real video frames arrival (playing event on HTMLVideoElement)
    const video = screen.getByRole('dialog').querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();

    act(() => {
      fireEvent.playing(video);
    });

    // In playing state, video is visible (opacity-100 block)
    expect(video).toHaveClass('opacity-100');
    expect(video).toHaveClass('block');
    expect(screen.queryByText(/Carregando prévia/i)).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Stream ended transitions to status='ended' and auto-closes after 2.5s
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 2: Stream ended transitions to status="ended" and auto-closes after 2.5s', async () => {
    vi.useFakeTimers();

    const mockTrack = createMockTrack();
    const mockPub = createMockPublication(mockTrack);
    const mockPart = createMockParticipant('user-1', 'frango', mockPub);

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    room.remoteParticipants.set('user-1:frango', mockPart);
    act(() => {
      room.emit(RoomEvent.TrackSubscribed, mockTrack, mockPub, mockPart);
    });

    const video = screen.getByRole('dialog').querySelector('video') as HTMLVideoElement;
    act(() => {
      fireEvent.playing(video);
    });
    expect(video).toHaveClass('opacity-100');

    // Participant stops screen sharing
    act(() => {
      room.emit(RoomEvent.TrackUnsubscribed, mockTrack, mockPub, mockPart);
    });

    // Status transitions to ended
    expect(screen.getByText(/Esta transmissão foi encerrada|This stream has ended/i)).toBeInTheDocument();

    // After 2.5s auto-closes
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Absence of video track / timeout transitions to status='error' with retry button
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 3: Absence of video track / timeout transitions to status="error" with retry button', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Advance beyond the 8-second frame acquisition guard
    act(() => {
      vi.advanceTimersByTime(8500);
    });

    // Expect error state
    expect(screen.getByText(/Não foi possível carregar a prévia|Could not load preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente|Retry/i })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Expired/invalid token handling
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 4: Expired/invalid token handling', async () => {
    vi.useFakeTimers();
    mockPreviewToken.mockRejectedValueOnce(new Error('Token expired or invalid'));

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should display error state
    expect(screen.getByText(/Não foi possível carregar a prévia|Could not load preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente|Retry/i })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Authorization failure (403 voice_connect_forbidden -> status='forbidden')
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 5: Authorization failure (403 voice_connect_forbidden -> status="forbidden")', async () => {
    vi.useFakeTimers();
    mockPreviewToken.mockRejectedValueOnce({ status: 403, code: 'voice_connect_forbidden' });

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Forbidden state with padlock icon and message, no retry button
    expect(screen.getByText(/Você não tem permissão para visualizar esta transmissão|You do not have permission to view this stream/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tentar novamente|Retry/i })).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. LiveKit connection disconnect -> status cleanup
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 6: LiveKit connection disconnect cleans up active tracks', async () => {
    vi.useFakeTimers();

    const mockTrack = createMockTrack();
    const mockPub = createMockPublication(mockTrack);
    const mockPart = createMockParticipant('user-1', 'frango', mockPub);

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    room.remoteParticipants.set('user-1:frango', mockPart);
    act(() => {
      room.emit(RoomEvent.TrackSubscribed, mockTrack, mockPub, mockPart);
    });

    // Simulate unexpected Room disconnection
    act(() => {
      room.emit(RoomEvent.Disconnected);
    });

    expect(mockTrack.detach).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Reconnection / retry button triggers fresh connection
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 7: Reconnection / retry button triggers fresh connection', async () => {
    vi.useFakeTimers();
    mockPreviewToken.mockRejectedValueOnce(new Error('Network failure'));

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente|Retry/i });
    expect(retryBtn).toBeInTheDocument();

    mockPreviewToken.mockResolvedValueOnce({ token: 'new-token', url: 'wss://livekit.test' });

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(mockPreviewToken).toHaveBeenCalledTimes(2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Close during loading aborts connection and cleans up room
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 8: Close during loading aborts connection and cleans up room', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    const badge = screen.getByRole('button', { name: /frango/i });
    fireEvent.mouseEnter(badge);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    expect(room).toBeDefined();

    // Mouse leaves badge before connection plays video
    fireEvent.mouseLeave(badge);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(room.disconnect).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Rapid hover switching between streamers releases previous card cleanly
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 9: Rapid hover switching between streamers releases previous card cleanly', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <div>
          <LiveStreamBadge
            userId="user-1"
            displayName="frango"
            avatar={null}
            channelId="chan-voice-1"
            channelName="voice"
          />
          <LiveStreamBadge
            userId="user-2"
            displayName="batata"
            avatar={null}
            channelId="chan-voice-1"
            channelName="voice"
          />
        </div>
      </MemoryRouter>
    );

    const badge1 = screen.getByRole('button', { name: /frango/i });
    const badge2 = screen.getByRole('button', { name: /batata/i });

    // Hover badge 1
    fireEvent.mouseEnter(badge1);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog', { name: 'frango' })).toBeInTheDocument();

    // Quickly hover badge 2
    fireEvent.mouseEnter(badge2);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Badge 1 dialog was forced closed, badge 2 dialog is now open
    expect(screen.queryByRole('dialog', { name: 'frango' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'batata' })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Multiple badges for different users coexist safely
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 10: Multiple badges for different users coexist safely', () => {
    render(
      <MemoryRouter>
        <div>
          <LiveStreamBadge
            userId="user-1"
            displayName="frango"
            avatar={null}
            channelId="chan-voice-1"
            channelName="voice"
          />
          <LiveStreamBadge
            userId="user-2"
            displayName="batata"
            avatar={null}
            channelId="chan-voice-1"
            channelName="voice"
          />
        </div>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /frango/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /batata/i })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Active voice call preserved without disruption
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 11: Active voice call preserved without disruption (reuses active room)', async () => {
    vi.useFakeTimers();

    const existingRoom = new MockRoom();
    setActiveRoomMock(existingRoom);

    useVoiceStore.setState({
      currentVoiceChannelId: 'chan-voice-1',
      isLiveKitConnected: true,
    });

    const mockTrack = createMockTrack();
    const mockPub = createMockPublication(mockTrack);
    const mockPart = createMockParticipant('user-1', 'frango', mockPub);
    existingRoom.remoteParticipants.set('user-1:frango', mockPart);

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should NOT fetch preview token or connect new room because we are in the same channel!
    expect(mockPreviewToken).not.toHaveBeenCalled();
    expect(existingRoom.disconnect).not.toHaveBeenCalled();

    // Subscribed to track on the existing active room
    expect(mockPub.setSubscribed).toHaveBeenCalledWith(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Viewing preview does not activate spectator microphone
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 12: Viewing preview does not activate spectator microphone', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    expect(room.localParticipant.trackPublications.size).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Viewing preview does not activate spectator camera
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 13: Viewing preview does not activate spectator camera', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    expect(room.localParticipant.trackPublications.size).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. "Tentar novamente" button resets and retries
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 14: "Tentar novamente" button resets error state and initiates fresh connection', async () => {
    vi.useFakeTimers();
    mockPreviewToken.mockRejectedValueOnce(new Error('Initial failure'));

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente|Retry/i });
    expect(retryBtn).toBeInTheDocument();

    mockPreviewToken.mockResolvedValueOnce({ token: 'new-token', url: 'wss://livekit.test' });

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(mockPreviewToken).toHaveBeenCalledTimes(2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. "Assistir transmissão" joins call, watches stream, and navigates
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 15: "Assistir transmissão" joins call, watches stream, and navigates', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
          spaceId="space-1"
          spaceName="Nuvio Oficial"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const watchBtn = screen.getByRole('button', { name: /Assistir transmissão|Watch stream/i });
    await act(async () => {
      fireEvent.click(watchBtn);
    });

    // Marked as watching stream
    expect(useVoiceStore.getState().watchingStreams.has('user-1')).toBe(true);

    // Channel joined and navigated
    expect(joinVoiceChannel).toHaveBeenCalledWith('chan-voice-1', undefined);
    expect(mockNavigate).toHaveBeenCalledWith('/channels/space-1/chan-voice-1');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. Listeners and room disconnection on unmount
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 16: Listeners and room disconnection on unmount', async () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const room = mockRooms[0];
    expect(room).toBeDefined();

    unmount();

    expect(room.disconnect).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. Public and private channels respect permissions
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 17: Private channel 403 response produces forbidden state', async () => {
    vi.useFakeTimers();
    mockPreviewToken.mockRejectedValueOnce({ status: 403, code: 'voice_connect_forbidden' });

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="private-chan-1"
          channelName="secret"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Você não tem permissão para visualizar esta transmissão|You do not have permission to view this stream/i)).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. Silent playback (muted video, no audio subscription)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Scenario 18: Silent playback (muted video, no audio subscription)', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <LiveStreamBadge
          userId="user-1"
          displayName="frango"
          avatar={null}
          channelId="chan-voice-1"
          channelName="voice"
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /frango/i }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = screen.getByRole('dialog');
    const video = dialog.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true);

    // Audio muted indicator is rendered
    expect(screen.getByText(/Sem áudio na prévia|Muted preview/i)).toBeInTheDocument();

    // Verify autoSubscribe was false on connection
    const room = mockRooms[0];
    expect(room.connect).toHaveBeenCalledWith(
      'wss://livekit.test',
      'jwt.token.preview',
      expect.objectContaining({ autoSubscribe: false })
    );
  });
});
