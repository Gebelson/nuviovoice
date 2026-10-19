import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ChannelSidebar } from './ChannelSidebar';
import { DownloadDesktopModal } from '../modals/DownloadDesktopModal';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import * as platformModule from '../../platform/platform';

vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-pathname">{location.pathname}</div>;
}

describe('ChannelSidebar — Baixar Nuvio replacement in Friends secondary menu', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUIStore.setState({ activeModal: null, modalData: {}, showDms: true });
    useSpaceStore.setState({
      spaces: [],
      currentSpaceId: null,
      channels: [],
      dmChannels: [],
    });
    useChatStore.setState({ currentChannelId: null, unreadChannels: new Set() });
    useAuthStore.setState({
      user: {
        id: 'u-1',
        username: 'gebelson',
        displayName: 'Gebelson',
        createdAt: 1,
        isAdmin: false,
        replicatedInstances: [],
      } as any,
    });
  });

  it('replaces secondary Explore item with "Download Nuvio" / "Baixar Nuvio" on Web and opens DownloadDesktopModal on click without navigating to /explore', async () => {
    vi.spyOn(platformModule, 'isElectron').mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <ChannelSidebar />
        <DownloadDesktopModal />
        <LocationProbe />
      </MemoryRouter>,
    );

    // Friends and Direct Messages remain intact
    expect(screen.getByText(/Friends|Amigos/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct Messages|Mensagens diretas/i)).toBeInTheDocument();

    // Secondary "Explore" item is no longer present in ChannelSidebar
    expect(screen.queryByText(/^(Explore|Explorar)$/i)).not.toBeInTheDocument();

    // "Download Nuvio" / "Baixar Nuvio" is rendered with the download icon
    const downloadItem = screen.getByTestId('dm-sidebar-download-nuvio');
    expect(downloadItem).toBeInTheDocument();
    expect(downloadItem).toHaveTextContent(/Download Nuvio|Baixar Nuvio/i);
    expect(downloadItem.querySelector('svg polyline')).not.toBeNull();

    // Clicking opens the download modal and does NOT navigate to /explore
    await user.click(downloadItem);
    expect(useUIStore.getState().activeModal).toBe('downloadDesktop');
    expect(screen.getByTestId('current-pathname')).toHaveTextContent('/channels/@me');

    // Official Windows installer link is shown in the modal
    const installerLink = screen.getByRole('link', { name: /Download for Windows|Baixar para Windows/i });
    expect(installerLink).toHaveAttribute('href', expect.stringContaining('Nuvio-Setup.exe'));
  });

  it('hides the "Baixar Nuvio" item inside Nuvio Desktop (isElectron === true)', () => {
    vi.spyOn(platformModule, 'isElectron').mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <ChannelSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Friends|Amigos/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct Messages|Mensagens diretas/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dm-sidebar-download-nuvio')).not.toBeInTheDocument();
  });
});
