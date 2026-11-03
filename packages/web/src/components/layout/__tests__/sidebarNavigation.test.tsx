import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub AudioManager to avoid AudioWorkletNode reference error in jsdom
vi.mock('../../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SpaceSidebar } from '../SpaceSidebar';
import { ChannelSidebar } from '../ChannelSidebar';
import { MobileBottomNav } from '../MobileBottomNav';
import { useChatStore } from '../../../stores/chatStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useUIStore } from '../../../stores/uiStore';
import { useAuthStore } from '../../../stores/authStore';
import * as platformModule from '../../../platform/platform';

const SELECTED = 'bg-interactive-selected';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function TestDesktopLayout() {
  return (
    <div className="flex">
      <SpaceSidebar />
      <ChannelSidebar />
      <LocationProbe />
    </div>
  );
}

function renderApp(initialPath = '/channels/@me') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TestDesktopLayout />
    </MemoryRouter>,
  );
}

function getMeRailButton(): HTMLElement {
  return screen.getByTitle('Direct Messages');
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
  useChatStore.setState({ currentChannelId: null, unreadChannels: new Set(), readStates: new Map() });
  useSpaceStore.setState({
    spaces: [],
    currentSpaceId: null,
    channels: [],
    dmChannels: [],
    folders: [],
    spaceLayout: [],
    voiceChannelIds: new Set(),
  });
  useUIStore.setState({
    showDms: false,
    mobileScreen: 'dms',
    mobileStack: [],
  });
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

describe('Nuvio Sidebar Navigation Architecture — Mutual Exclusivity & Active States', () => {
  // Requirement 1: Amigos selecionado
  it('1. Amigos selecionado: highlights @me rail icon AND Friends item; keeps others inactive', () => {
    renderApp('/channels/@me');

    expect(getMeRailButton()).toHaveAttribute('aria-current', 'page');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(true);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 2: Oportunidades selecionado
  it('2. Oportunidades selecionado: highlights ONLY Opportunities; @me rail icon remains gray (inactive)', () => {
    renderApp('/opportunities');

    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 3: Loja selecionada
  it('3. Loja selecionada: highlights ONLY Store; @me rail icon remains gray (inactive)', () => {
    renderApp('/store');

    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 4: Baixar Nuvio selecionado
  it('4. Baixar Nuvio selecionado: highlights ONLY Download; @me rail icon remains gray (inactive)', () => {
    renderApp('/download');

    // The core bug was that @me was highlighted when on /download
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 5: Navegação sequencial entre as quatro páginas
  it('5. Navegação sequencial entre as quatro páginas: updates single active state seamlessly', () => {
    renderApp('/channels/@me');

    // Step 1: on Amigos
    expect(getMeRailButton()).toHaveAttribute('aria-current', 'page');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(true);

    // Step 2: click Opportunities
    fireEvent.click(getOpportunitiesItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/opportunities');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);

    // Step 3: click Store
    fireEvent.click(getStoreItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/store');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(false);

    // Step 4: click Download Nuvio
    fireEvent.click(getDownloadItem());
    expect(screen.getByTestId('location')).toHaveTextContent('/download');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);
    expect(getStoreItem().classList.contains(SELECTED)).toBe(false);

    // Step 5: click @me rail icon to return to Amigos
    fireEvent.click(getMeRailButton());
    expect(screen.getByTestId('location')).toHaveTextContent('/channels/@me');
    expect(getMeRailButton()).toHaveAttribute('aria-current', 'page');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(true);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 6: Atualização da página com uma rota ativa
  it('6. Atualização da página com uma rota ativa (direct render at /download preserves solitary active state)', () => {
    const { unmount } = renderApp('/download');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);
    unmount();

    renderApp('/opportunities');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(true);
  });

  // Requirement 7: Uso dos botões Voltar e Avançar (history navigation)
  it('7. Uso dos botões Voltar e Avançar reflete a seleção correta sem desatualização', () => {
    function HistoryNavigator() {
      const navigate = useNavigate();
      return (
        <div>
          <button data-testid="btn-back" onClick={() => navigate(-1)}>Back</button>
          <button data-testid="btn-forward" onClick={() => navigate(1)}>Forward</button>
          <TestDesktopLayout />
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/channels/@me', '/download']}>
        <HistoryNavigator />
      </MemoryRouter>,
    );

    // Current is /download
    expect(screen.getByTestId('location')).toHaveTextContent('/download');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);

    // Go back to /channels/@me
    fireEvent.click(screen.getByTestId('btn-back'));
    expect(screen.getByTestId('location')).toHaveTextContent('/channels/@me');
    expect(getMeRailButton()).toHaveAttribute('aria-current', 'page');
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(true);
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(false);

    // Go forward to /download
    fireEvent.click(screen.getByTestId('btn-forward'));
    expect(screen.getByTestId('location')).toHaveTextContent('/download');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getDownloadItem().classList.contains(SELECTED)).toBe(true);
    expect(getFriendsItem().classList.contains(SELECTED)).toBe(false);
  });

  // Requirement 8: Acesso direto por URL
  it('8. Acesso direto por URL em subrotas (/opportunities/jobs, /developers, /store/bots)', () => {
    const { unmount: u1 } = renderApp('/opportunities/jobs');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getOpportunitiesItem().classList.contains(SELECTED)).toBe(true);
    u1();

    const { unmount: u2 } = renderApp('/developers');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
    u2();

    renderApp('/store/bots');
    expect(getMeRailButton()).not.toHaveAttribute('aria-current');
    expect(getStoreItem().classList.contains(SELECTED)).toBe(true);
  });

  // Requirement 9: Navegação desktop e mobile
  it('9. Navegação mobile: MobileBottomNav does not highlight DMs tab on /download or /opportunities', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/download']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    // On /download, DMs tab must not have text-accent-primary
    const dmsTab = screen.getByRole('button', { name: 'DMs' });
    expect(dmsTab?.className).not.toContain('text-accent-primary');
    unmount();

    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const dmsTabActive = screen.getByRole('button', { name: 'DMs' });
    expect(dmsTabActive?.className).toContain('text-accent-primary');
  });

  // Requirement 10: Ausência de seleção duplicada
  it('10. Ausência de seleção duplicada: no concurrent active states across main areas', () => {
    const paths = ['/download', '/store', '/opportunities', '/channels/@me'];

    for (const p of paths) {
      const { unmount } = renderApp(p);

      const isMeActive = getMeRailButton().getAttribute('aria-current') === 'page';
      const isFriendsActive = getFriendsItem().classList.contains(SELECTED);
      const isOppActive = getOpportunitiesItem().classList.contains(SELECTED);
      const isStoreActive = getStoreItem().classList.contains(SELECTED);
      const isDownloadActive = getDownloadItem().classList.contains(SELECTED);

      if (p === '/download') {
        expect(isDownloadActive).toBe(true);
        expect(isMeActive).toBe(false);
        expect(isFriendsActive).toBe(false);
        expect(isOppActive).toBe(false);
        expect(isStoreActive).toBe(false);
      } else if (p === '/opportunities') {
        expect(isOppActive).toBe(true);
        expect(isMeActive).toBe(false);
        expect(isFriendsActive).toBe(false);
        expect(isStoreActive).toBe(false);
        expect(isDownloadActive).toBe(false);
      } else if (p === '/store') {
        expect(isStoreActive).toBe(true);
        expect(isMeActive).toBe(false);
        expect(isFriendsActive).toBe(false);
        expect(isOppActive).toBe(false);
        expect(isDownloadActive).toBe(false);
      } else if (p === '/channels/@me') {
        expect(isMeActive).toBe(true);
        expect(isFriendsActive).toBe(true);
        expect(isOppActive).toBe(false);
        expect(isStoreActive).toBe(false);
        expect(isDownloadActive).toBe(false);
      }

      unmount();
    }
  });
});
