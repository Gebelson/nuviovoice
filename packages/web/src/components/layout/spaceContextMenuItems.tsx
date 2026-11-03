import React from 'react';
import type { TFunction } from 'i18next';
import {
  DEFAULT_NOTIFICATION_LEVEL,
  isMuteActive,
  isPublicSpace,
  type NotificationLevel,
  type SpaceFolder,
  type UpdateNotificationSettingRequest,
} from '@concord/shared';
import type { ContextMenuItem, ContextMenuLeafItem } from '../../stores/contextMenuStore';
import { useChatStore } from '../../stores/chatStore';
import {
  selectNotificationSetting,
  useNotificationSettingsStore,
} from '../../stores/notificationSettingsStore';
import { useSpacePreferencesStore } from '../../stores/spacePreferencesStore';
import { useSpaceStore, getMyUserIdForOrigin, type TaggedSpace } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { describeCodedError } from '../../i18n/errors';
import { spaceInviteUrl } from '../../utils/inviteParser';
import { hasPermissionBit, PermissionBits } from '../../utils/permissions';

export interface BuildSpaceContextMenuParams {
  space: TaggedSpace;
  folderId?: string;
  candidateFolders: SpaceFolder[];
  t: TFunction<['spaces', 'common']>;
  onOpenNotificationsModal: () => void;
  onOpenPrivacyModal: () => void;
  onOpenProfileModal: () => void;
  onRemoveFromFolder: (folderId: string, spaceId: string) => void;
  onMoveToFolder: (spaceId: string, targetFolderId: string, sourceFolderId?: string) => void;
  onCreateFolderWithSpace: (spaceId: string, sourceFolderId?: string) => void;
  onOpenSpaceSettings: () => void;
  onOpenTransferModal: () => void;
  onOpenLeaveConfirm: () => void;
}

export function buildSpaceContextMenuItems({
  space,
  folderId,
  candidateFolders,
  t,
  onOpenNotificationsModal,
  onOpenPrivacyModal,
  onOpenProfileModal,
  onRemoveFromFolder,
  onMoveToFolder,
  onCreateFolderWithSpace,
  onOpenSpaceSettings,
  onOpenTransferModal,
  onOpenLeaveConfirm,
}: BuildSpaceContextMenuParams): ContextMenuItem[] {
  const spaceId = space.id;
  const spaceOrigin = space._instanceOrigin ?? '';
  const myUserId = getMyUserIdForOrigin(spaceOrigin);
  const isOwner = Boolean(myUserId && space.ownerId === myUserId);

  const mySpacePerms = useSpaceStore.getState().spacePermissions.get(spaceId);
  const canInvite =
    isOwner ||
    isPublicSpace(space) ||
    space.visibility === 'request' ||
    mySpacePerms === undefined ||
    hasPermissionBit(mySpacePerms, PermissionBits.CREATE_INVITE);

  const canManageSpace =
    isOwner ||
    (mySpacePerms !== undefined &&
      (hasPermissionBit(mySpacePerms, PermissionBits.MANAGE_SPACE) ||
        hasPermissionBit(mySpacePerms, PermissionBits.ADMINISTRATOR)));

  const notifState = useNotificationSettingsStore.getState();
  const spaceNotifSetting = selectNotificationSetting(notifState, spaceOrigin, {
    spaceId,
    channelId: null,
  });
  const now = Date.now();
  const spaceMuted = isMuteActive(spaceNotifSetting, now);
  const currentLevel: NotificationLevel = spaceNotifSetting?.level ?? DEFAULT_NOTIFICATION_LEVEL;

  const levelLabel = (level: NotificationLevel): string => {
    switch (level) {
      case 'all':
        return t('spaces:notifications.level.all');
      case 'mentions':
        return t('spaces:notifications.level.mentions');
      case 'nothing':
        return t('spaces:notifications.level.nothing');
    }
  };

  const updateSpaceNotif = async (change: UpdateNotificationSettingRequest) => {
    try {
      await useNotificationSettingsStore
        .getState()
        .update(spaceOrigin, { spaceId, channelId: null }, change);
    } catch (err) {
      useUIStore
        .getState()
        .addToast(describeCodedError(err, t('spaces:notifications.saveFailed')), 'warning', 4000);
    }
  };

  const moveSubmenuChildren: ContextMenuLeafItem[] = [];
  if (folderId) {
    moveSubmenuChildren.push({
      key: 'remove-from-folder',
      type: 'action',
      label: t('spaces:sidebar.folder.removeFrom', 'Remover da pasta'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H5v-2h14v2z" />
        </svg>
      ),
      onClick: () => onRemoveFromFolder(folderId, spaceId),
    });
    moveSubmenuChildren.push({
      key: 'move-sep-remove',
      type: 'separator',
    });
  }

  for (const f of candidateFolders) {
    moveSubmenuChildren.push({
      key: `move-to-${f.id}`,
      type: 'action',
      label: f.name || t('spaces:sidebar.folder.unnamed', 'Pasta sem nome'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      ),
      onClick: () => onMoveToFolder(spaceId, f.id, folderId),
    });
  }

  if (candidateFolders.length > 0) {
    moveSubmenuChildren.push({
      key: 'move-sep-create',
      type: 'separator',
    });
  }

  moveSubmenuChildren.push({
    key: 'create-folder',
    type: 'action',
    label: t('spaces:spaceMenu.createNewFolder'),
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z" />
      </svg>
    ),
    onClick: () => onCreateFolderWithSpace(spaceId, folderId),
  });

  const muteMenuItem: ContextMenuItem = spaceMuted
    ? {
        key: 'unmute-space',
        type: 'action',
        label: t('spaces:spaceMenu.unmuteSpace'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        ),
        onClick: () => {
          void updateSpaceNotif({ mute: null });
        },
      }
    : {
        key: 'mute-space',
        type: 'submenu',
        label: t('spaces:spaceMenu.muteSpace'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.24.06-.47.14-.69.22L18 13.1V16zM5.41 3.35 4 4.76l2.81 2.81C6.29 8.57 6 9.73 6 11v5l-2 2v1h14.24l1.74 1.74 1.41-1.41L5.41 3.35z" />
          </svg>
        ),
        children: [
          {
            key: 'mute-1h',
            type: 'action',
            label: t('spaces:notifications.mute.oneHour'),
            onClick: () => {
              void updateSpaceNotif({ mute: '1h' });
            },
          },
          {
            key: 'mute-8h',
            type: 'action',
            label: t('spaces:notifications.mute.eightHours'),
            onClick: () => {
              void updateSpaceNotif({ mute: '8h' });
            },
          },
          {
            key: 'mute-24h',
            type: 'action',
            label: t('spaces:notifications.mute.oneDay'),
            onClick: () => {
              void updateSpaceNotif({ mute: '24h' });
            },
          },
          {
            key: 'mute-indefinite',
            type: 'action',
            label: t('spaces:notifications.mute.indefinite'),
            onClick: () => {
              void updateSpaceNotif({ mute: 'indefinite' });
            },
          },
        ],
      };

  return [
    // ─── Grupo 1: Marcar como lido ─────────────────────────────────────────
    {
      key: 'mark-as-read',
      type: 'action',
      label: t('spaces:spaceMenu.markAsRead'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
        </svg>
      ),
      onClick: async () => {
        await useChatStore.getState().ackSpace(spaceId);
        useUIStore.getState().addToast(t('spaces:spaceMenu.markedAsRead'), 'info', 2500);
      },
    },
    {
      key: 'sep-group-1',
      type: 'separator',
    },

    // ─── Grupo 2: Convite, Silenciamento, Notificações, Ocultar silenciados ─
    {
      key: 'invite',
      type: 'action',
      label: t('spaces:spaceMenu.invite'),
      hidden: !canInvite,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ),
      onClick: async () => {
        try {
          const code = await useSpaceStore.getState().generateInvite(spaceId);
          await navigator.clipboard.writeText(spaceInviteUrl(space._instanceOrigin, code));
          useUIStore.getState().addToast(
            t(
              space.visibility === 'request'
                ? 'spaces:sidebar.space.inviteCopiedRequest'
                : 'spaces:sidebar.space.inviteCopied',
            ),
            'success',
            3000,
          );
        } catch (err) {
          useUIStore
            .getState()
            .addToast(describeCodedError(err, t('spaces:sidebar.space.inviteFailed')), 'warning', 3000);
        }
      },
    },
    muteMenuItem,
    {
      key: 'notifications',
      type: 'submenu',
      label: t('spaces:spaceMenu.notificationSettings'),
      sublabel: levelLabel(currentLevel),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
      ),
      children: [
        {
          key: 'notif-all',
          type: 'checkbox',
          label: t('spaces:notifications.level.all'),
          subscribe: (cb) => useNotificationSettingsStore.subscribe(cb),
          getChecked: () =>
            (selectNotificationSetting(useNotificationSettingsStore.getState(), spaceOrigin, {
              spaceId,
              channelId: null,
            })?.level ?? DEFAULT_NOTIFICATION_LEVEL) === 'all',
          onChange: () => {
            void updateSpaceNotif({ level: 'all' });
          },
        },
        {
          key: 'notif-mentions',
          type: 'checkbox',
          label: t('spaces:notifications.level.mentions'),
          subscribe: (cb) => useNotificationSettingsStore.subscribe(cb),
          getChecked: () =>
            (selectNotificationSetting(useNotificationSettingsStore.getState(), spaceOrigin, {
              spaceId,
              channelId: null,
            })?.level ?? DEFAULT_NOTIFICATION_LEVEL) === 'mentions',
          onChange: () => {
            void updateSpaceNotif({ level: 'mentions' });
          },
        },
        {
          key: 'notif-nothing',
          type: 'checkbox',
          label: t('spaces:notifications.level.nothing'),
          subscribe: (cb) => useNotificationSettingsStore.subscribe(cb),
          getChecked: () =>
            (selectNotificationSetting(useNotificationSettingsStore.getState(), spaceOrigin, {
              spaceId,
              channelId: null,
            })?.level ?? DEFAULT_NOTIFICATION_LEVEL) === 'nothing',
          onChange: () => {
            void updateSpaceNotif({ level: 'nothing' });
          },
        },
        {
          key: 'notif-sep',
          type: 'separator',
        },
        {
          key: 'notif-open-modal',
          type: 'action',
          label: t('spaces:spaceMenu.openFullNotifications'),
          onClick: onOpenNotificationsModal,
        },
      ],
    },
    {
      key: 'hide-muted-channels',
      type: 'checkbox',
      label: t('spaces:spaceMenu.hideMutedChannels'),
      subscribe: (cb) => useSpacePreferencesStore.subscribe(cb),
      getChecked: () => useSpacePreferencesStore.getState().isHideMuted(spaceId),
      onChange: (checked) => {
        useSpacePreferencesStore.getState().setHideMuted(spaceId, checked);
      },
    },
    {
      key: 'sep-group-2',
      type: 'separator',
    },

    // ─── Grupo 3: Privacidade, Perfil no espaço, Mover para... ─────────────
    {
      key: 'privacy-settings',
      type: 'action',
      label: t('spaces:spaceMenu.privacySettings'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
        </svg>
      ),
      onClick: onOpenPrivacyModal,
    },
    {
      key: 'edit-space-profile',
      type: 'action',
      label: t('spaces:spaceMenu.editSpaceProfile'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      ),
      onClick: onOpenProfileModal,
    },
    {
      key: 'move-to',
      type: 'submenu',
      label: t('spaces:spaceMenu.moveTo'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      ),
      children: moveSubmenuChildren,
    },
    {
      key: 'space-settings',
      type: 'action',
      label: t('spaces:sidebar.space.settings'),
      hidden: !canManageSpace,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
        </svg>
      ),
      onClick: onOpenSpaceSettings,
    },
    {
      key: 'sep-group-3',
      type: 'separator',
    },

    // ─── Grupo 4: Sair do espaço / Transferir propriedade ──────────────────
    {
      key: 'transfer',
      type: 'action',
      label: t('spaces:sidebar.space.transferOwnership'),
      hidden: !isOwner,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z" />
        </svg>
      ),
      onClick: onOpenTransferModal,
    },
    {
      key: 'leave',
      type: 'action',
      label: t('spaces:sidebar.space.leave'),
      hidden: isOwner,
      danger: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
        </svg>
      ),
      onClick: onOpenLeaveConfirm,
    },
    {
      key: 'sep-group-4',
      type: 'separator',
    },

    // ─── Grupo 5: Copiar ID do espaço ──────────────────────────────────────
    {
      key: 'copy-id',
      type: 'action',
      label: t('spaces:spaceMenu.copyId'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
        </svg>
      ),
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(spaceId);
          useUIStore.getState().addToast(t('spaces:spaceMenu.idCopied'), 'success', 2500);
        } catch {
          useUIStore.getState().addToast(t('spaces:spaceMenu.idCopyFailed'), 'warning', 3000);
        }
      },
    },
  ];
}
