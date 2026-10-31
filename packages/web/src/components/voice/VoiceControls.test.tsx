import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import { VoiceControls } from './VoiceControls';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { PermissionBits } from '../../utils/permissions';

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

vi.mock('./SoundpadPopover', () => ({
  SoundpadPopover: ({ open }: { open: boolean }) =>
    open ? <div data-testid="soundpad-popover">Soundpad Popover</div> : null,
}));

describe('VoiceControls Soundpad Button', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');
    useSpaceStore.setState({
      channels: [{ id: 'voice-1', name: 'voice', type: 'voice' } as any],
      channelPermissions: new Map([['voice-1', PermissionBits.USE_SOUNDPAD]]),
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

  it('renders enabled Soundpad button with megaphone icon and tooltip when permitted', () => {
    render(<VoiceControls />);

    const soundpadBtn = screen.getByTitle('Soundpad');
    expect(soundpadBtn).toBeInTheDocument();
    expect(soundpadBtn).toHaveAttribute('aria-label', 'Abrir Soundpad');
    expect(soundpadBtn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(soundpadBtn).toHaveAttribute('aria-expanded', 'false');
    expect(soundpadBtn).not.toBeDisabled();

    // Megaphone SVG contains path elements
    const svg = soundpadBtn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll('path').length).toBe(2);
  });

  it('renders disabled Soundpad button when user lacks USE_SOUNDPAD permission', () => {
    useSpaceStore.setState({
      channelPermissions: new Map([['voice-1', 0n]]),
    });

    render(<VoiceControls />);

    const soundpadBtn = screen.getByTitle('Você não tem permissão para usar o Soundpad');
    expect(soundpadBtn).toBeInTheDocument();
    expect(soundpadBtn).toBeDisabled();
    expect(soundpadBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles Soundpad popover open and closed on click', () => {
    render(<VoiceControls />);

    const soundpadBtn = screen.getByTitle('Soundpad');
    expect(screen.queryByTestId('soundpad-popover')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(soundpadBtn);
    expect(soundpadBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('soundpad-popover')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(soundpadBtn);
    expect(soundpadBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('soundpad-popover')).not.toBeInTheDocument();
  });
});
