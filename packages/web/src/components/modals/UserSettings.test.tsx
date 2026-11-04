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

describe('UserSettings category expansion and collapse controls', () => {
  it('does NOT force Experience or any other category to be permanently open on initial load', async () => {
    await openSettings();

    // Default active page is Account
    expect(await screen.findByText('AccountPanel stub')).toBeInTheDocument();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'false');

    // Subsections of Experience must NOT be visible when collapsed
    expect(screen.queryByRole('button', { name: 'Voice & Video' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accessibility' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keybinds' })).not.toBeInTheDocument();
  });

  it('allows clicking the Experience header to expand and show its subsections', async () => {
    await openSettings();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    fireEvent.click(experienceBtn);

    expect(experienceBtn).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('button', { name: 'Voice & Video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accessibility' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keybinds' })).toBeInTheDocument();
  });

  it('allows clicking the Experience header again to collapse its subsections while keeping the panel active', async () => {
    await openSettings();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    // 1st click: expand
    fireEvent.click(experienceBtn);
    expect(await screen.findByRole('button', { name: 'Voice & Video' })).toBeInTheDocument();
    expect(await screen.findByText('AppearancePanel stub')).toBeInTheDocument();

    // 2nd click: collapse
    fireEvent.click(experienceBtn);
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'false');

    // Subsections must be removed from the sidebar
    expect(screen.queryByRole('button', { name: 'Voice & Video' })).not.toBeInTheDocument();

    // The Appearance panel must still remain active in the content area
    expect(screen.getByText('AppearancePanel stub')).toBeInTheDocument();
    expect(experienceBtn).toHaveAttribute('aria-current', 'page');
  });

  it('preserves the active subsection after collapsing and re-expanding the category', async () => {
    await openSettings();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    // Expand
    fireEvent.click(experienceBtn);
    const voiceSubBtn = await screen.findByRole('button', { name: 'Voice & Video' });

    // Select Voice & Video subsection
    fireEvent.click(voiceSubBtn);
    expect(await screen.findByText('VoicePanel stub')).toBeInTheDocument();

    // Collapse category
    fireEvent.click(experienceBtn);
    expect(screen.queryByRole('button', { name: 'Voice & Video' })).not.toBeInTheDocument();
    expect(screen.getByText('VoicePanel stub')).toBeInTheDocument();

    // Re-expand category
    fireEvent.click(experienceBtn);
    const reloadedVoiceBtn = await screen.findByRole('button', { name: 'Voice & Video' });
    expect(reloadedVoiceBtn).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('VoicePanel stub')).toBeInTheDocument();
  });

  it('automatically collapses the previous category when expanding another category', async () => {
    await openSettings();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    const notificationsBtn = screen.getByRole('button', { name: 'Notifications' });

    // Expand Experience
    fireEvent.click(experienceBtn);
    expect(await screen.findByRole('button', { name: 'Voice & Video' })).toBeInTheDocument();
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'true');
    expect(notificationsBtn).toHaveAttribute('aria-expanded', 'false');

    // Click Notifications -> Experience must collapse
    fireEvent.click(notificationsBtn);
    expect(notificationsBtn).toHaveAttribute('aria-expanded', 'true');
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'false');

    // Notifications subsections must be visible
    expect(await screen.findByRole('button', { name: 'Sounds' })).toBeInTheDocument();
    // Experience subsections must no longer be in the document
    expect(screen.queryByRole('button', { name: 'Voice & Video' })).not.toBeInTheDocument();
  });

  it('automatically collapses open categories when navigating to a category without subsections', async () => {
    await openSettings();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    const accountBtn = screen.getByRole('button', { name: 'Account' });

    // Expand Experience
    fireEvent.click(experienceBtn);
    expect(await screen.findByRole('button', { name: 'Voice & Video' })).toBeInTheDocument();

    // Click Account (which has no subsections)
    fireEvent.click(accountBtn);
    expect(await screen.findByText('AccountPanel stub')).toBeInTheDocument();

    // Experience must be collapsed
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Voice & Video' })).not.toBeInTheDocument();
  });

  it('automatically expands only the target category when deep-linking to a subsection', async () => {
    mocks.ui.modalData = { tab: 'voice' };
    await openSettings();

    expect(await screen.findByText('VoicePanel stub')).toBeInTheDocument();

    const experienceBtn = screen.getByRole('button', { name: 'Experience' });
    expect(experienceBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Voice & Video' })).toHaveAttribute('aria-current', 'true');

    // Other expandable categories must remain collapsed
    const dataPrivacyBtn = screen.getByRole('button', { name: 'Data & Privacy' });
    expect(dataPrivacyBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Profile Privacy' })).not.toBeInTheDocument();
  });
});
