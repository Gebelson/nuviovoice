import React from 'react';
import type { ContextMenuItem } from '../../stores/contextMenuStore';
import { useWinkStore } from '../../stores/winkStore';
import type { WinkMuteDuration } from '@concord/shared/src/winks';

export function formatRemainingTime(expiresAt: number | null): string {
  if (!expiresAt) return 'Até reativar';
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return 'Expirando...';
  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function buildWinkMuteMenuItems(targetUserId: string, targetUser?: any): ContextMenuItem {
  const isMuted = useWinkStore.getState().isContactMuted(targetUserId);
  const mute = useWinkStore.getState().getContactMute(targetUserId);

  if (!isMuted || !mute) {
    return {
      key: 'mute-winks-sub',
      type: 'submenu',
      label: 'Silenciar Winks',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ),
      children: [
        {
          key: 'mute-winks-1h',
          type: 'action',
          label: 'Por 1 hora',
          onClick: () => {
            void useWinkStore.getState().setContactMute(targetUserId, '1h', targetUser);
          },
        },
        {
          key: 'mute-winks-8h',
          type: 'action',
          label: 'Por 8 horas',
          onClick: () => {
            void useWinkStore.getState().setContactMute(targetUserId, '8h', targetUser);
          },
        },
        {
          key: 'mute-winks-24h',
          type: 'action',
          label: 'Por 24 horas',
          onClick: () => {
            void useWinkStore.getState().setContactMute(targetUserId, '24h', targetUser);
          },
        },
        {
          key: 'mute-winks-indefinite',
          type: 'action',
          label: 'Até eu reativar',
          onClick: () => {
            void useWinkStore.getState().setContactMute(targetUserId, 'indefinite', targetUser);
          },
        },
      ],
    };
  }

  // Already muted
  const remainingText = formatRemainingTime(mute.expiresAt);
  return {
    key: 'mute-winks-active-sub',
    type: 'submenu',
    label: `Winks silenciados (${remainingText})`,
    sublabel: remainingText,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    ),
    children: [
      {
        key: 'mute-winks-status',
        type: 'action',
        disabled: true,
        label: `Status: ${mute.muteType === 'indefinite' ? 'Até reativar' : `Restam ${remainingText}`}`,
        onClick: () => {},
      },
      { key: 'mute-winks-sep1', type: 'separator' },
      {
        key: 'mute-winks-change-1h',
        type: 'action',
        label: 'Alterar para 1 hora',
        onClick: () => {
          void useWinkStore.getState().setContactMute(targetUserId, '1h', targetUser);
        },
      },
      {
        key: 'mute-winks-change-8h',
        type: 'action',
        label: 'Alterar para 8 horas',
        onClick: () => {
          void useWinkStore.getState().setContactMute(targetUserId, '8h', targetUser);
        },
      },
      {
        key: 'mute-winks-change-24h',
        type: 'action',
        label: 'Alterar para 24 horas',
        onClick: () => {
          void useWinkStore.getState().setContactMute(targetUserId, '24h', targetUser);
        },
      },
      {
        key: 'mute-winks-change-indefinite',
        type: 'action',
        label: 'Alterar para até eu reativar',
        onClick: () => {
          void useWinkStore.getState().setContactMute(targetUserId, 'indefinite', targetUser);
        },
      },
      { key: 'mute-winks-sep2', type: 'separator' },
      {
        key: 'unmute-winks',
        type: 'action',
        label: 'Reativar Winks',
        onClick: () => {
          void useWinkStore.getState().removeContactMute(targetUserId);
        },
      },
    ],
  };
}
