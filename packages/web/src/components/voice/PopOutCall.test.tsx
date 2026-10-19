import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PictureInPicture } from './PictureInPicture';
import { PopOutCallWindow } from './PopOutCallWindow';
import { useVoiceStore } from '../../stores/voiceStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';

// AudioManager loads an AudioWorklet module that jsdom cannot evaluate.
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({}) },
}));

describe('PopOut / Detached Call Window', () => {
  beforeEach(() => {
    useVoiceStore.setState({
      currentVoiceChannelId: 'voice-1',
      activeDmCall: null,
      participants: [
        {
          identity: 'user-1',
          userId: 'user-1',
          username: 'Alice',
          homeUserId: null,
          isMuted: false,
          isDeafened: false,
          isCameraOn: false,
          isScreenSharing: false,
          isLocal: false,
          audioTrack: null,
          videoTrack: null,
          screenTrack: null,
          screenAudioTrack: null,
          lkVideoTrack: null,
          lkScreenTrack: null,
          cachedUser: null,
        },
      ],
      focusedParticipantId: null,
      watchingStreams: new Set(),
      speakingParticipantIds: new Set(['user-1']),
      pipEnabled: true,
      isPopOutOpen: false,
      pipAlwaysOnTop: true,
    });
    useChatStore.setState({ currentChannelId: 'text-1' });
    useUIStore.setState({ voiceFullscreen: false, pipCollapsed: false });
    useSpaceStore.setState({
      channels: [{ id: 'voice-1', spaceId: 'space-1', name: 'General Voice', type: 'voice', position: 0 } as any],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('in-app PictureInPicture hides when external pop-out window is open', () => {
    const { container: before } = render(
      <MemoryRouter>
        <PictureInPicture />
      </MemoryRouter>,
    );
    expect(before).not.toBeEmptyDOMElement();
    cleanup();

    useVoiceStore.setState({ isPopOutOpen: true });
    const { container: after } = render(
      <MemoryRouter>
        <PictureInPicture />
      </MemoryRouter>,
    );
    expect(after).toBeEmptyDOMElement();
  });

  it('PopOutCallWindow renders channel name and participants in voice mode', () => {
    const onClose = vi.fn();
    const onReturnToMain = vi.fn();

    render(
      <MemoryRouter>
        <PopOutCallWindow onClose={onClose} onReturnToMain={onReturnToMain} />
      </MemoryRouter>,
    );

    // Call title
    expect(screen.getByText('# General Voice')).toBeInTheDocument();
    // Participant username
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('clicking close floating window calls onClose without clearing the voice channel', () => {
    const onClose = vi.fn();
    const onReturnToMain = vi.fn();

    render(
      <MemoryRouter>
        <PopOutCallWindow onClose={onClose} onReturnToMain={onReturnToMain} />
      </MemoryRouter>,
    );

    // Click close floating window button
    const closeBtn = screen.getByTitle(/Fechar janela flutuante|Close floating window/i);
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
    // Voice channel remains connected!
    expect(useVoiceStore.getState().currentVoiceChannelId).toBe('voice-1');
  });

  it('clicking return to main calls onReturnToMain without disconnecting', () => {
    const onClose = vi.fn();
    const onReturnToMain = vi.fn();

    render(
      <MemoryRouter>
        <PopOutCallWindow onClose={onClose} onReturnToMain={onReturnToMain} />
      </MemoryRouter>,
    );

    const returnBtn = screen.getByTitle(/Voltar ao Nuvio|Return to Nuvio/i);
    fireEvent.click(returnBtn);

    expect(onReturnToMain).toHaveBeenCalled();
    expect(useVoiceStore.getState().currentVoiceChannelId).toBe('voice-1');
  });
});
