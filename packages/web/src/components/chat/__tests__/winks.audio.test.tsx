import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DmMessageWithUser, User } from '@concord/shared';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks';
import { useAuthStore } from '../../../stores/authStore';
import { useChatStore } from '../../../stores/chatStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useUserPreferencesStore } from '../../../stores/userPreferencesStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { GlobalWinkOverlay } from '../GlobalWinkOverlay';
import { applyIncomingDmMessage } from '../../../utils/dmMessageRouting';
import { AudioManager } from '../../../audio/AudioManager';

vi.mock('../../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));

const mockPlayWinkSound = vi.fn();
const mockStopWinkSound = vi.fn();
const mockResumeContext = vi.fn();

vi.mock('../../../audio/AudioManager', () => {
  const mockSource = { stop: vi.fn(), disconnect: vi.fn() };
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

describe('Winks Audio System & Global Playback Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayWinkSound.mockResolvedValue({ stop: vi.fn(), disconnect: vi.fn() });
    mockResumeContext.mockResolvedValue(undefined);

    useAuthStore.setState({ user: me, token: 'token' });
    useChatStore.setState({
      currentChannelId: 'dm-alice-bob',
      messages: new Map(),
      replyTargets: new Map(),
      editingMessageId: null,
    });
    useSpaceStore.setState({
      dmChannels: [
        { id: 'dm-alice-bob', userId: bob.id, user: bob } as any,
        { id: 'dm-other-user', userId: 'user-charlie' } as any,
      ],
      currentSpaceId: null,
    });
    useUserPreferencesStore.setState({
      muteAllNotificationSounds: false,
    });
    useVoiceStore.setState({
      soundEffectVolume: 0.8,
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
      queue: [],
      isAutoplayBlocked: false,
      audioUnlocked: false,
      publishedWinks: [...OFFICIAL_WINKS],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Receber Wink na conversa aberta: animação aparece e o áudio é reproduzido automaticamente', async () => {
    // Viewing the active sender's conversation
    useChatStore.setState({ currentChannelId: 'dm-alice-bob' });

    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-101');
    await applyIncomingDmMessage('', msg);

    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true); // Muted video guarantees no HTMLMediaElement autoplay blockage

    // When video starts playing
    await act(async () => {
      fireEvent.playing(video);
    });

    // Audio is automatically played via AudioManager
    expect(mockPlayWinkSound).toHaveBeenCalledWith('diabravinho', expect.objectContaining({
      fallbackUrl: expect.stringContaining('diabravinho'),
    }));
    expect(useWinkStore.getState().isAutoplayBlocked).toBe(false);
  });

  it('2. Receber Wink em outra conversa: o áudio NÃO é bloqueado e toca automaticamente via Web Audio', async () => {
    // User is in a completely different conversation (e.g. Charlie)
    useChatStore.setState({ currentChannelId: 'dm-other-user' });

    const msg = createWinkMessage('dm-alice-bob', 'bolsogado', 'msg-102');
    await applyIncomingDmMessage('', msg);

    // Wink is activated globally
    expect(useWinkStore.getState().activeWink?.winkId).toBe('bolsogado');

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();

    await act(async () => {
      fireEvent.playing(video);
    });

    // Audio plays automatically even though active conversation is dm-other-user
    expect(mockPlayWinkSound).toHaveBeenCalledWith('bolsogado', expect.objectContaining({
      fallbackUrl: expect.stringContaining('bolsogado'),
    }));
    // No banner asking to unmute
    expect(screen.queryByText(/Ativar som/i)).not.toBeInTheDocument();
    expect(useWinkStore.getState().isAutoplayBlocked).toBe(false);
  });

  it('3. Receber Wink em outra seção do aplicativo (Amigos, Explorar, Configurações, Canais de texto)', async () => {
    // Current channel is a Space text channel, not a DM
    useChatStore.setState({ currentChannelId: 'channel-general-space-9' });
    useSpaceStore.setState({ currentSpaceId: 'space-9' });

    const msg = createWinkMessage('dm-alice-bob', 'nikole', 'msg-103');
    await applyIncomingDmMessage('', msg);

    expect(useWinkStore.getState().activeWink?.winkId).toBe('nikole');

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    await act(async () => {
      fireEvent.playing(video);
    });

    expect(mockPlayWinkSound).toHaveBeenCalledWith('nikole', expect.any(Object));
    expect(useWinkStore.getState().isAutoplayBlocked).toBe(false);
  });

  it('4. Receber Wink com som desabilitado nas preferências: animação é exibida mas áudio permanece silencioso', async () => {
    useWinkStore.setState({
      settings: {
        autoplay: true,
        playAudio: false, // User disabled wink audio
        volume: 80,
        reduceMotion: false,
        disableIncoming: false,
      },
    });

    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-104');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    await act(async () => {
      fireEvent.playing(video);
    });

    // Sound should NOT be requested
    expect(mockPlayWinkSound).not.toHaveBeenCalled();
  });

  it('5. Receber Wink quando "Silenciar todos os sons de notificação" estiver ativado', async () => {
    useUserPreferencesStore.setState({ muteAllNotificationSounds: true });

    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-105');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    await act(async () => {
      fireEvent.playing(video);
    });

    expect(mockPlayWinkSound).not.toHaveBeenCalled();
  });

  it('6. Bloqueio de autoplay estrito pelo navegador (AudioContext suspenso): exibe fallback "Ativar som" e destrava no clique', async () => {
    // Simulate AudioContext suspended by browser on cold start without prior interaction
    mockPlayWinkSound.mockResolvedValueOnce(null);

    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-106');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    const video = document.querySelector('video') as HTMLVideoElement;
    await act(async () => {
      fireEvent.playing(video);
    });

    // playWinkSound was attempted, but returned null because context was suspended
    expect(mockPlayWinkSound).toHaveBeenCalled();
    // Autoplay blocked state is engaged gracefully
    expect(useWinkStore.getState().isAutoplayBlocked).toBe(true);

    // Discrete button "Ativar som" is visible
    const unmuteBtn = screen.getByRole('button', { name: /ativar áudio deste wink|ativar som/i });
    expect(unmuteBtn).toBeInTheDocument();

    // Clicking unmute unlocks audio and retries playback
    mockPlayWinkSound.mockResolvedValueOnce({ stop: vi.fn(), disconnect: vi.fn() });
    await act(async () => {
      fireEvent.click(unmuteBtn);
    });

    expect(useWinkStore.getState().audioUnlocked).toBe(true);
    expect(useWinkStore.getState().isAutoplayBlocked).toBe(false);
  });

  it('7. Trocar de conversa durante a reprodução não cancela o Wink em andamento', async () => {
    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-107');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    // User navigates between channels
    act(() => {
      useChatStore.setState({ currentChannelId: 'dm-another-channel' });
    });

    // Wink overlay remains mounted and playing
    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    expect(screen.getByTestId('wink-animation-player')).toBeInTheDocument();
  });

  it('8. Receber dois Winks consecutivos: enfileiramento correto e interrupção do áudio anterior', async () => {
    const msg1 = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-108-a');
    const msg2 = createWinkMessage('dm-alice-bob', 'bolsogado', 'msg-108-b');

    await applyIncomingDmMessage('', msg1);
    await applyIncomingDmMessage('', msg2);

    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');
    expect(useWinkStore.getState().queue.length).toBe(1);
    expect(useWinkStore.getState().queue[0]?.winkId).toBe('bolsogado');

    render(<GlobalWinkOverlay />);

    // Dismissing first wink stops audio and starts next in queue
    act(() => {
      useWinkStore.getState().dismissActiveWink();
    });

    expect(mockStopWinkSound).toHaveBeenCalled();
    expect(useWinkStore.getState().activeWink?.winkId).toBe('bolsogado');
  });

  it('9. Evitar reprodução duplicada para o mesmo message ID', async () => {
    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-109-dupe');

    await applyIncomingDmMessage('', msg);
    expect(useWinkStore.getState().activeWink?.winkId).toBe('diabravinho');

    // Dismiss active wink
    act(() => {
      useWinkStore.getState().dismissActiveWink();
    });
    expect(useWinkStore.getState().activeWink).toBeNull();

    // Same message ID arrives again (e.g. WebSocket reconnect or S2S replay)
    await applyIncomingDmMessage('', msg);

    // Must NOT re-trigger wink
    expect(useWinkStore.getState().activeWink).toBeNull();
  });

  it('10. Preservar transparência e encerrar áudio ao finalizar a animação', async () => {
    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-110');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    const overlay = screen.getByTestId('wink-animation-player');
    expect(overlay.style.backgroundColor).toBe('transparent');

    const video = document.querySelector('video') as HTMLVideoElement;
    await act(async () => {
      fireEvent.playing(video);
    });

    expect(mockPlayWinkSound).toHaveBeenCalled();

    // Video reaches end
    act(() => {
      fireEvent.ended(video);
    });

    // Sound is stopped immediately and active wink is cleared
    expect(mockStopWinkSound).toHaveBeenCalled();
    expect(useWinkStore.getState().activeWink).toBeNull();
  });

  it('11. Fechamento manual da animação encerra o áudio correspondente imediatamente', async () => {
    const msg = createWinkMessage('dm-alice-bob', 'diabravinho', 'msg-111');
    await applyIncomingDmMessage('', msg);

    render(<GlobalWinkOverlay />);

    const closeBtn = screen.getByRole('button', { name: /fechar wink|fechar/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(mockStopWinkSound).toHaveBeenCalled();
    expect(useWinkStore.getState().activeWink).toBeNull();
  });
});
