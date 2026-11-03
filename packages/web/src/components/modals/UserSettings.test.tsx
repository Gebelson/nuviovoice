import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { InstanceInfoResponse, User } from '@concord/shared';

// ── Fixtures and store mocks ────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const user: User = {
    id: 'user-self',
    username: 'me',
    displayName: 'Me',
    avatar: null,
    banner: null,
    accentColor: null,
    avatarColor: null,
    bio: null,
    status: 'online',
    customStatus: null,
    isAdmin: false,
    createdAt: 0,
    homeInstance: null,
    homeUserId: null,
    replicatedInstances: [],
  };

  const instanceInfo: InstanceInfoResponse = {
    name: 'Test Instance',
    version: '1.2.1',
    registrationOpen: true,
    federatedRegistrationOpen: true,
    instanceId: 'instance-1',
    sourceCodeUrl: 'https://github.com/TheZwiss/backspace',
    commit: 'abc1234',
  };

  return {
    ui: {
      activeModal: 'userSettings',
      modalData: {} as Record<string, unknown>,
      isMobile: false,
      closeModal: vi.fn(),
    },
    auth: { user, logout: vi.fn() },
    settings: {
      updateStatus: null,
      updateAck: { seenVersion: null, toastShownFor: null },
      isAdmin: false,
    },
    instanceInfo,
    update: {
      initialize: vi.fn(),
      snapshot: {
        capability: 'external' as const,
        dismissedVersion: null,
        status: { phase: 'idle' as const },
      },
      currentVersion: '1.0.5',
      checkNow: vi.fn(),
      install: vi.fn(),
      openDownloadPage: vi.fn(),
    },
  };
});

vi.mock('../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: typeof mocks.ui) => unknown) => selector(mocks.ui),
    { getState: () => mocks.ui, setState: vi.fn(), subscribe: vi.fn() },
  ),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (s: typeof mocks.auth) => unknown) => selector(mocks.auth),
    { getState: () => mocks.auth, setState: vi.fn(), subscribe: vi.fn() },
  ),
}));

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (selector: (s: typeof mocks.settings) => unknown) => selector(mocks.settings),
    { getState: () => mocks.settings, setState: vi.fn(), subscribe: vi.fn() },
  ),
}));

vi.mock('../../stores/updateStore', () => ({
  useUpdateStore: (selector: (s: typeof mocks.update) => unknown) => selector(mocks.update),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      instance: { info: () => Promise.resolve(mocks.instanceInfo) },
    },
  };
});

// Stubs for panels to isolate modal navigation and layout testing
vi.mock('./settingsPanels/AccountPanel', () => ({ AccountPanel: () => <p>AccountPanel stub</p> }));
vi.mock('./settingsPanels/AppearancePanel', () => ({ AppearancePanel: () => <p>AppearancePanel stub</p> }));
vi.mock('./settingsPanels/DataPrivacyPanel', () => ({ DataPrivacyPanel: () => <p>DataPrivacyPanel stub</p> }));
vi.mock('./settingsPanels/MessagePermissionsPanel', () => ({ MessagePermissionsPanel: () => <p>MessagePermissionsPanel stub</p> }));
vi.mock('./settingsPanels/NotificationsPanel', () => ({ NotificationsPanel: () => <p>NotificationsPanel stub</p> }));
vi.mock('./settingsPanels/GamesAppsPanel', () => ({ GamesAppsPanel: () => <p>GamesAppsPanel stub</p> }));
vi.mock('./settingsPanels/AccessibilityPanel', () => ({ AccessibilityPanel: () => <p>AccessibilityPanel stub</p> }));
vi.mock('./settingsPanels/LanguageTimePanel', () => ({ LanguageTimePanel: () => <p>LanguageTimePanel stub</p> }));
vi.mock('./settingsPanels/VoicePanel', () => ({ VoicePanel: () => <p>VoicePanel stub</p> }));
vi.mock('./settingsPanels/PrivacyPanel', () => ({ PrivacyPanel: () => <p>PrivacyPanel stub</p> }));
vi.mock('./settingsPanels/ConnectionsPanel', () => ({ ConnectionsPanel: () => <p>ConnectionsPanel stub</p> }));
vi.mock('./settingsPanels/KeybindsPanel', () => ({ KeybindsPanel: () => <p>KeybindsPanel stub</p> }));
vi.mock('./settingsPanels/InstancePanel', () => ({ InstancePanel: () => <p>InstancePanel stub</p> }));

import { UserSettingsModal } from './UserSettings';

function installDesktopHost() {
  Object.defineProperty(window, 'backspace', {
    configurable: true,
    writable: true,
    value: {
      isSandboxed: vi.fn().mockResolvedValue(false),
      getAutoLaunchSettings: vi.fn().mockResolvedValue({ openAtLogin: false, startMinimized: true }),
      setAutoLaunchSettings: vi.fn(),
      clearInstanceUrl: vi.fn(),
    },
  });
}

function inDocumentOrder(...nodes: HTMLElement[]): boolean {
  return nodes.every(
    (node, i) =>
      i === 0 ||
      Boolean(nodes[i - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

async function openSettings(): Promise<void> {
  render(<UserSettingsModal />);
  await screen.findByRole('button', { name: /Log Out/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'backspace');
  mocks.ui.modalData = {};
  mocks.auth.user = { ...mocks.auth.user, isAdmin: false };
});

describe('UserSettingsModal Hub navigation structure', () => {
  it('renders all 6 primary Hub categories for regular users', async () => {
    await openSettings();

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data & Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Message Permissions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Experience' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Games & Apps' })).toBeInTheDocument();
    // Non-admin does not have Instance tab
    expect(screen.queryByRole('button', { name: 'Instance' })).not.toBeInTheDocument();

    expect(
      inDocumentOrder(
        screen.getByText('User Settings'),
        screen.getByRole('button', { name: 'Account' }),
        screen.getByRole('button', { name: 'Data & Privacy' }),
        screen.getByRole('button', { name: 'Message Permissions' }),
        screen.getByRole('button', { name: 'Notifications' }),
        screen.getByText('App Settings'),
        screen.getByRole('button', { name: 'Experience' }),
        screen.getByRole('button', { name: 'Games & Apps' }),
        screen.getByRole('button', { name: 'Log Out' }),
      ),
    ).toBe(true);
  });

  it('renders Administration category when user is admin', async () => {
    mocks.auth.user = { ...mocks.auth.user, isAdmin: true };
    await openSettings();

    expect(screen.getByRole('button', { name: 'Instance' })).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('switches panels when clicking Hub category tabs', async () => {
    await openSettings();

    expect(await screen.findByText('AccountPanel stub')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Data & Privacy' }));
    expect(await screen.findByText('DataPrivacyPanel stub')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Message Permissions' }));
    expect(await screen.findByText('MessagePermissionsPanel stub')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('NotificationsPanel stub')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Games & Apps' }));
    expect(await screen.findByText('GamesAppsPanel stub')).toBeInTheDocument();
  });
});

describe('UserSettingsModal Desktop & Platform handling', () => {
  it('shows the download offer in browser when viewing desktop sub-section', async () => {
    mocks.ui.modalData = { tab: 'desktop' };
    await openSettings();

    expect(await screen.findByRole('link', { name: 'All releases on GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change Instance' })).not.toBeInTheDocument();
  });

  it('shows desktop app controls inside Electron', async () => {
    installDesktopHost();
    mocks.ui.modalData = { tab: 'desktop' };
    await openSettings();

    expect(await screen.findByRole('button', { name: 'Change Instance' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'All releases on GitHub' })).not.toBeInTheDocument();
  });
});

describe('UserSettingsModal deep link resolution and backward compatibility', () => {
  it.each([
    ['appearance', 'AppearancePanel stub'],
    ['voice', 'VoicePanel stub'],
    ['keybinds', 'KeybindsPanel stub'],
    ['chat', 'MessagePermissionsPanel stub'],
    ['privacy', 'DataPrivacyPanel stub'],
    ['connections', 'GamesAppsPanel stub'],
    ['accessibility', 'AccessibilityPanel stub'],
    ['language-time', 'LanguageTimePanel stub'],
  ])('resolves deep link %s correctly', async (tab, expectedStub) => {
    mocks.ui.modalData = { tab };
    await openSettings();
    expect(await screen.findByText(expectedStub)).toBeInTheDocument();
  });

  it('falls back to Account for the instance tab when the user is not an admin', async () => {
    mocks.ui.modalData = { tab: 'instance' };
    await openSettings();
    expect(await screen.findByText('AccountPanel stub')).toBeInTheDocument();
  });

  it('opens the instance tab for an admin', async () => {
    mocks.auth.user = { ...mocks.auth.user, isAdmin: true };
    mocks.ui.modalData = { tab: 'instance' };
    await openSettings();
    expect(await screen.findByText('InstancePanel stub')).toBeInTheDocument();
  });

  it('falls back to Account for unknown tabs', async () => {
    mocks.ui.modalData = { tab: 'unknown_route' };
    await openSettings();
    expect(await screen.findByText('AccountPanel stub')).toBeInTheDocument();
  });
});
