import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import { VoiceControls } from './VoiceControls';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore } from '../../stores/spaceStore';
import * as voiceUtils from '../../utils/voice';

vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ onResumed: () => () => {} }) },
}));

vi.mock('../../utils/voice', () => ({
  broadcastVoiceStatus: vi.fn(),
  broadcastDeafenViaLiveKit: vi.fn(),
  reconnectVoice: vi.fn(),
}));

vi.mock('../../utils/voiceActions', () => ({
  handleCameraAction: vi.fn(),
  handleScreenShareAction: vi.fn(),
  handleDisconnectAction: vi.fn(),
  reconnectVoice: vi.fn(),
}));

vi.mock('./ScreenShareSettingsPopover', () => ({
  ScreenShareSettingsPopover: () => null,
}));

vi.mock('./ConnectionInfoPopover', () => ({
  ConnectionInfoPopover: () => null,
}));

describe('VoiceControls Microphone Button', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');
    useSpaceStore.setState({
      channels: [{ id: 'voice-1', name: 'voice', type: 'voice' } as any],
      channelPermissions: new Map(),
      channelToSpaceMap: new Map(),
      members: [],
    });
    useVoiceStore.setState({
      currentVoiceChannelId: 'voice-1',
      activeDmCall: null,
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      spaceMutedUserIds: new Set(),
      spaceDeafenedUserIds: new Set(),
      permissionMutedUserIds: new Set(),
      participants: [{ identity: 'user-1', isLocal: true } as any],
      speakingParticipantIds: new Set(),
    });
  });

  it('renders unmuted microphone state with "Desativar microfone" tooltip and no slash line', () => {
    render(<VoiceControls />);

    const micBtn = screen.getByTitle('Desativar microfone');
    expect(micBtn).toBeInTheDocument();
    expect(micBtn).toHaveAttribute('aria-label', 'Desativar microfone');
    expect(micBtn).toHaveAttribute('aria-pressed', 'true');

    // In unmuted state, the diagonal slash line is NOT present
    const svg = micBtn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector('line')).toBeNull();
  });

  it('renders muted microphone state with "Ativar microfone" tooltip and slash line', () => {
    useVoiceStore.setState({ isMuted: true });

    render(<VoiceControls />);

    const micBtn = screen.getByTitle('Ativar microfone');
    expect(micBtn).toBeInTheDocument();
    expect(micBtn).toHaveAttribute('aria-label', 'Ativar microfone');
    expect(micBtn).toHaveAttribute('aria-pressed', 'false');

    // In muted state, the diagonal slash line is present
    const svg = micBtn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const line = svg?.querySelector('line');
    expect(line).not.toBeNull();
    expect(line).toHaveAttribute('x1', '4');
    expect(line).toHaveAttribute('y1', '4');
    expect(line).toHaveAttribute('x2', '20');
    expect(line).toHaveAttribute('y2', '20');
  });

  it('toggles mute on click and calls broadcastVoiceStatus', () => {
    render(<VoiceControls />);

    const micBtn = screen.getByTitle('Desativar microfone');
    fireEvent.click(micBtn);

    expect(useVoiceStore.getState().isMuted).toBe(true);
    expect(voiceUtils.broadcastVoiceStatus).toHaveBeenCalledTimes(1);
  });
});
