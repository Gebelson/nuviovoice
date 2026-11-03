import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub AudioManager to avoid AudioWorkletNode reference error in jsdom.
// Reached transitively via the stores.
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: {
    getInstance: vi.fn().mockReturnValue({
      setOutputDevice: vi.fn(),
      setVolume: vi.fn(),
    }),
  },
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HttpError } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import {
  useContextMenuStore,
  type ContextMenuAction,
  type ContextMenuCheckbox,
  type ContextMenuSubmenu,
} from '../../stores/contextMenuStore';
import {
  notificationSettingKey,
  useNotificationSettingsStore,
} from '../../stores/notificationSettingsStore';
import { useSpacePreferencesStore } from '../../stores/spacePreferencesStore';
import { useSpaceStore, type TaggedSpace } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { spaceInviteUrl } from '../../utils/inviteParser';
import { SpaceSidebar } from './SpaceSidebar';

const SPACE: TaggedSpace = {
  id: 'space-1',
  name: 'Kobold',
  icon: null,
  banner: null,
  avatarColor: null,
  ownerId: 'someone-else',
  inviteCode: null,
  visibility: 'request',
  directoryListed: false,
  description: null,
  createdAt: 0,
  _instanceOrigin: '',
};

const realGenerateInvite = useSpaceStore.getState().generateInvite;
const realAckSpace = useChatStore.getState().ackSpace;
const writeText = vi.fn<(text: string) => Promise<void>>();

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/channels/@me']}>
      <SpaceSidebar />
    </MemoryRouter>,
  );
}

function openSpaceMenu(): void {
  fireEvent.contextMenu(screen.getByText(SPACE.name.charAt(0)));
}

function menuAction(key: string): ContextMenuAction {
  const item = useContextMenuStore.getState().menu?.items.find((i) => i.key === key);
  if (!item || item.type !== 'action') throw new Error(`space menu has no "${key}" action`);
  return item;
}

function menuSubmenu(key: string): ContextMenuSubmenu {
  const item = useContextMenuStore.getState().menu?.items.find((i) => i.key === key);
  if (!item || item.type !== 'submenu') throw new Error(`space menu has no "${key}" submenu`);
  return item;
}

function menuCheckbox(key: string): ContextMenuCheckbox {
  const item = useContextMenuStore.getState().menu?.items.find((i) => i.key === key);
  if (!item || item.type !== 'checkbox') throw new Error(`space menu has no "${key}" checkbox`);
  return item;
}

function lastToast(): { message: string; type: string } | undefined {
  return useUIStore.getState().toasts.at(-1);
}

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: 'me-1',
      username: 'gebelson',
      displayName: 'Gebelson',
      avatar: null,
      banner: null,
      accentColor: null,
      avatarColor: null,
      bio: null,
      customStatus: null,
      status: 'online',
      createdAt: 0,
    } as any,
    myRowIds: { '': 'me-1' },
  });
  useChatStore.setState({ currentChannelId: null, unreadChannels: new Set() });
  useSpaceStore.setState({
    spaces: [SPACE],
    currentSpaceId: null,
    channels: [],
    dmChannels: [],
    folders: [],
    spaceLayout: [{ t: 's', id: SPACE.id }],
    spacePermissions: new Map(),
  });
  useNotificationSettingsStore.getState().reset();
  useSpacePreferencesStore.setState({ prefs: {}, temporarilyRevealedSpaces: {} });
  useUIStore.setState({ showDms: true, isMobile: false, toasts: [] });
  useContextMenuStore.getState().close();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(() => {
  useSpaceStore.setState({ generateInvite: realGenerateInvite });
  useChatStore.setState({ ackSpace: realAckSpace });
});

describe('SpaceSidebar space menu: 5-group organization', () => {
  it('organizes items into 5 distinct groups separated by dividers', () => {
    renderSidebar();
    openSpaceMenu();

    const visibleItems = (useContextMenuStore.getState().menu?.items ?? []).filter((i) => !i.hidden);
    const keys = visibleItems.map((i) => i.key);

    expect(keys).toEqual([
      'mark-as-read',
      'sep-group-1',
      'invite',
      'mute-space',
      'notifications',
      'hide-muted-channels',
      'sep-group-2',
      'privacy-settings',
      'edit-space-profile',
      'move-to',
      'sep-group-3',
      'leave',
      'sep-group-4',
      'copy-id',
    ]);
  });

  it('shows Transfer Ownership instead of Leave Space when the user is the space owner', () => {
    useSpaceStore.setState({
      spaces: [{ ...SPACE, ownerId: 'me-1' }],
    });
    renderSidebar();
    openSpaceMenu();

    const visibleKeys = (useContextMenuStore.getState().menu?.items ?? [])
      .filter((i) => !i.hidden)
      .map((i) => i.key);

    expect(visibleKeys).toContain('transfer');
    expect(visibleKeys).not.toContain('leave');
    expect(visibleKeys).toContain('space-settings');
  });
});

describe('SpaceSidebar space menu: Mark as Read', () => {
  it('marks all accessible channels of the space as read and shows confirmation', async () => {
    const ackSpaceMock = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({ ackSpace: ackSpaceMock });
    renderSidebar();
    openSpaceMenu();

    await act(async () => {
      await menuAction('mark-as-read').onClick();
    });

    expect(ackSpaceMock).toHaveBeenCalledWith(SPACE.id);
    expect(lastToast()?.type).toBe('info');
  });
});

describe('SpaceSidebar space menu: Invite People', () => {
  it('shows the reason an instance up to 1.9.0 gives for refusing a request space its link', async () => {
    useSpaceStore.setState({
      generateInvite: vi.fn().mockRejectedValue(
        new HttpError(403, 'This space uses join requests', undefined, 'space_uses_join_requests'),
      ),
    });
    renderSidebar();
    openSpaceMenu();
    await act(async () => { menuAction('invite').onClick(); });
    await waitFor(() => expect(lastToast()?.message).toBe('This space is joined by request, so it has no invite links.'));
    expect(lastToast()?.type).toBe('warning');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the link of a space joined by request and says where it leads', async () => {
    useSpaceStore.setState({ generateInvite: vi.fn().mockResolvedValue('abc123') });
    renderSidebar();
    openSpaceMenu();
    await act(async () => { menuAction('invite').onClick(); });
    await waitFor(() => expect(lastToast()?.type).toBe('success'));
    expect(lastToast()?.message).toBe('Invite link copied. People who open it can ask to join.');
    expect(writeText).toHaveBeenCalledWith(spaceInviteUrl('', 'abc123'));
  });

  it('copies the link of a public space with the plain confirmation', async () => {
    useSpaceStore.setState({ spaces: [{ ...SPACE, visibility: 'public' }], generateInvite: vi.fn().mockResolvedValue('abc123') });
    renderSidebar();
    openSpaceMenu();
    await act(async () => { menuAction('invite').onClick(); });
    await waitFor(() => expect(lastToast()?.type).toBe('success'));
    expect(lastToast()?.message).toBe('Invite link copied to clipboard');
    expect(writeText).toHaveBeenCalledWith(spaceInviteUrl('', 'abc123'));
  });

  it('keeps the generic text when the failure has no code', async () => {
    useSpaceStore.setState({ generateInvite: vi.fn().mockRejectedValue(new HttpError(502, 'Bad Gateway')) });
    renderSidebar();
    openSpaceMenu();
    await act(async () => { menuAction('invite').onClick(); });
    await waitFor(() => expect(lastToast()?.message).toBe('Failed to generate invite'));
  });

  it('keeps the generic text when the clipboard write fails', async () => {
    useSpaceStore.setState({ generateInvite: vi.fn().mockResolvedValue('abc123') });
    writeText.mockRejectedValue(new DOMException('Document is not focused.', 'NotAllowedError'));
    renderSidebar();
    openSpaceMenu();
    await act(async () => { menuAction('invite').onClick(); });
    await waitFor(() => expect(lastToast()?.message).toBe('Failed to generate invite'));
  });
});

describe('SpaceSidebar space menu: Mute & Notification settings', () => {
  it('offers duration submenu when unmuted, and direct unmute action + sidebar indicator when muted', () => {
    renderSidebar();
    openSpaceMenu();

    const muteSub = menuSubmenu('mute-space');
    expect(muteSub.children.map((c) => c.key)).toEqual([
      'mute-1h',
      'mute-8h',
      'mute-24h',
      'mute-indefinite',
    ]);
    expect(screen.queryByTestId('space-muted-indicator')).toBeNull();

    // Simulate active mute on the space
    act(() => {
      const map = new Map();
      map.set(notificationSettingKey('', { spaceId: SPACE.id, channelId: null }), {
        spaceId: SPACE.id,
        channelId: null,
        level: null,
        muted: true,
        mutedUntil: null,
        suppressEveryone: false,
        suppressRoles: false,
        updatedAt: Date.now(),
      });
      useNotificationSettingsStore.setState({ settings: map, clock: Date.now() });
    });

    expect(screen.getByTestId('space-muted-indicator')).toBeInTheDocument();

    openSpaceMenu();
    const unmuteAct = menuAction('unmute-space');
    expect(unmuteAct).toBeDefined();
  });

  it('shows current notification level summary and opens the full dialog from the submenu', () => {
    const { container } = renderSidebar();
    openSpaceMenu();

    const notifSub = menuSubmenu('notifications');
    expect(notifSub.sublabel).toBeTruthy();
    const openModalItem = notifSub.children.find((c) => c.key === 'notif-open-modal') as ContextMenuAction;
    expect(openModalItem).toBeDefined();

    act(() => { openModalItem.onClick(); });
    const heading = screen.getByRole('heading', { name: /Kobold/ });
    const strip = container.querySelector('nav');
    expect(strip).not.toBeNull();
    expect(strip).not.toContainElement(heading);
    expect(heading.closest('.fixed')?.parentElement).toBe(document.body);
  });

  it('toggles Hide Muted Channels preference per space', () => {
    renderSidebar();
    openSpaceMenu();

    const hideMutedItem = menuCheckbox('hide-muted-channels');
    expect(hideMutedItem.getChecked()).toBe(false);

    act(() => { hideMutedItem.onChange(true); });
    expect(useSpacePreferencesStore.getState().isHideMuted(SPACE.id)).toBe(true);

    openSpaceMenu();
    expect(menuCheckbox('hide-muted-channels').getChecked()).toBe(true);
  });
});

describe('SpaceSidebar space menu: Copy Space ID', () => {
  it('copies the internal space ID and shows confirmation toast', async () => {
    renderSidebar();
    openSpaceMenu();

    await act(async () => {
      await menuAction('copy-id').onClick();
    });

    expect(writeText).toHaveBeenCalledWith('space-1');
    expect(lastToast()?.type).toBe('success');
  });
});

describe('SpaceSidebar space menu: Group 3 & Group 4 actions', () => {
  it('opens Move To submenu with Create New Folder option and creates a folder when clicked', () => {
    const updateSpaceLayoutMock = vi.fn().mockResolvedValue(undefined);
    useSpaceStore.setState({ updateSpaceLayout: updateSpaceLayoutMock });
    renderSidebar();
    openSpaceMenu();

    const moveSub = menuSubmenu('move-to');
    const createFolderItem = moveSub.children.find((c) => c.key === 'create-folder') as ContextMenuAction;
    expect(createFolderItem).toBeDefined();

    act(() => {
      createFolderItem.onClick();
    });

    expect(updateSpaceLayoutMock).toHaveBeenCalledTimes(1);
    const [itemsArg, foldersArg] = updateSpaceLayoutMock.mock.calls[0]!;
    expect(itemsArg[0].t).toBe('f');
    const folderKey = itemsArg[0].id;
    expect(foldersArg[folderKey].spaceIds).toEqual([SPACE.id]);
  });

  it('opens confirmation dialog before leaving the space', () => {
    const leaveSpaceMock = vi.fn().mockResolvedValue(undefined);
    useSpaceStore.setState({ leaveSpace: leaveSpaceMock });
    renderSidebar();
    openSpaceMenu();

    const leaveItem = menuAction('leave');
    expect(leaveItem.danger).toBe(true);

    act(() => {
      leaveItem.onClick();
    });

    // Does not leave immediately before confirming
    expect(leaveSpaceMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Kobold/i })).toBeInTheDocument();
  });
});
