import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DesktopUpdateButton } from './DesktopUpdateButton';
import * as platformModule from '../../platform/platform';
import { useUpdateStore } from '../../stores/updateStore';
import { useVoiceStore } from '../../stores/voiceStore';

vi.mock('../../platform/platform', () => ({
  isElectron: vi.fn(),
}));

describe('DesktopUpdateButton', () => {
  const installMock = vi.fn();
  const checkNowMock = vi.fn();
  const openDownloadPageMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceStore.setState({
      currentVoiceChannelId: null,
      activeDmCall: null,
    });
    vi.mocked(platformModule.isElectron).mockReturnValue(true);
  });

  it('renders nothing when not in Electron environment', () => {
    vi.mocked(platformModule.isElectron).mockReturnValue(false);
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: null,
        status: { phase: 'available', version: '1.13.0' },
      },
    });

    const { container } = render(<DesktopUpdateButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when phase is idle or up-to-date', () => {
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: null,
        status: { phase: 'idle' },
      },
    });

    const { container } = render(<DesktopUpdateButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Atualizar Nuvio" when update is available, even if dismissed on toast', () => {
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: '1.13.0', // User dismissed the toast earlier
        status: { phase: 'available', version: '1.13.0' },
      },
      install: installMock,
    });

    render(<DesktopUpdateButton />);
    const btn = screen.getByRole('button', { name: /(Atualizar Nuvio|Update Nuvio)/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText('1.13.0')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(installMock).toHaveBeenCalledTimes(1);
  });

  it('renders progress percentage when downloading', () => {
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: null,
        status: { phase: 'downloading', version: '1.13.0', percent: 68, bytesPerSecond: 1024000 },
      },
    });

    render(<DesktopUpdateButton />);
    expect(screen.getByText(/(Baixando 68%|Downloading 68%)/i)).toBeInTheDocument();
  });

  it('renders "Reiniciar e atualizar" and intercepts when in active call', () => {
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: null,
        status: { phase: 'ready', version: '1.13.0' },
      },
      install: installMock,
    });

    // Case 1: NOT in call -> installs immediately
    const { unmount } = render(<DesktopUpdateButton />);
    const readyBtn = screen.getByRole('button', { name: /(Reiniciar e atualizar|Restart and update)/i });
    fireEvent.click(readyBtn);
    expect(installMock).toHaveBeenCalledTimes(1);
    unmount();

    // Case 2: IN ACTIVE CALL -> shows warning dialog
    useVoiceStore.setState({ currentVoiceChannelId: 'channel_voice_1' });
    render(<DesktopUpdateButton />);
    const readyBtnInCall = screen.getByRole('button', { name: /(Reiniciar e atualizar|Restart and update)/i });
    fireEvent.click(readyBtnInCall);

    // Warning dialog should appear
    expect(screen.getByText(/(Você está em uma chamada|You are currently in a call)/i)).toBeInTheDocument();
    expect(installMock).toHaveBeenCalledTimes(1); // not called again yet

    // Clicking confirm on dialog proceeds with restart
    const confirmButtons = screen.getAllByRole('button', { name: /(Reiniciar e atualizar|Restart and update)/i });
    // The dialog button is the second one
    fireEvent.click(confirmButtons[1]);
    expect(installMock).toHaveBeenCalledTimes(2);
  });

  it('renders "Falha na atualização" and allows retry when failed', () => {
    useUpdateStore.setState({
      snapshot: {
        capability: 'auto',
        dismissedVersion: null,
        status: { phase: 'failed', version: '1.13.0', message: 'Network error' },
      },
      checkNow: checkNowMock,
    });

    render(<DesktopUpdateButton />);
    const retryBtn = screen.getByRole('button', { name: /(Falha na atualização|Update failed)/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(checkNowMock).toHaveBeenCalledTimes(1);
  });
});
