import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub AudioManager to avoid AudioWorkletNode reference error in jsdom.
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { ChannelSidebar } from './ChannelSidebar';
import * as platformModule from '../../platform/platform';

const SELECTED = 'bg-interactive-selected';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <ChannelSidebar />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function getFriendsItem(): HTMLElement {
  const el = screen.getByText(/Friends|Amigos/i, { selector: 'span' }).parentElement;
  if (!el) throw new Error('Friends item not found');
  return el;
}

function getOpportunitiesItem(): HTMLElement {
  return screen.getByTestId('dm-sidebar-opportunities');
}

function getStoreItem(): HTMLElement {
  return screen.getByTestId('dm-sidebar-store');
}

function getDownloadItem(): HTMLElement {
  return screen.getByTestId('dm-sidebar-download-nuvio');
}

beforeEach(() => {
  vi.spyOn(platformModule, 'isElectron').mockReturnValue(false);
  useChatStore.setState({ currentChannelId: null });
  useSpaceStore.setState({ spaces: [], currentSpaceId: null, channels: [], dmChannels: [] });
  useUIStore.setState({ showDms: true });
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

describe('ChannelSidebar home navigation items', () => {
  it('selects only Friends on the DM home (/channels/@me)', () => {
    renderAt('/channels/@me');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(true);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  it('selects only Opportunities on /opportunities', () => {
    renderAt('/opportunities');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(true);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  it('selects only Store on /store and /developers', () => {
    const { unmount } = renderAt('/store');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
    unmount();

    renderAt('/developers');
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
  });

  it('selects only Download Nuvio on /download', () => {
    renderAt('/download');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);
  });

  it('selects none of the 4 home items while a DM conversation is open', () => {
    useChatStore.setState({ currentChannelId: 'dm-1' });
    renderAt('/channels/@me/dm-1');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  it('navigates to /opportunities when Opportunities is clicked', () => {
    renderAt('/channels/@me');
    fireEvent.click(getOpportunitiesItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/opportunities');
  });

  it('navigates to /store when Store is clicked', () => {
    renderAt('/channels/@me');
    fireEvent.click(getStoreItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/store');
  });

  it('navigates to /download when Download Nuvio is clicked', () => {
    renderAt('/channels/@me');
    fireEvent.click(getDownloadItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/download');
  });

  it('navigates to /channels/@me when Friends is clicked', () => {
    renderAt('/download');
    fireEvent.click(getFriendsItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/channels/@me');
  });
});
