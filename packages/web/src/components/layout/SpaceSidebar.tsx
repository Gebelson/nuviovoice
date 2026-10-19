import { DmUnreadBadge } from './DmUnreadBadge';
import { SpaceUnreadBadge } from './SpaceUnreadBadge';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpaceStore, getMyUserIdForOrigin } from '../../stores/spaceStore';
import type { TaggedSpace } from '../../stores/spaceStore';
import { resolveSpaceLayout, type ResolvedSpaceLayoutItem } from '../../utils/spaceLayout';
import { spaceInviteUrl } from '../../utils/inviteParser';
import { activeHomeNavItem } from '../../utils/homeNav';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useInstanceStore } from '../../stores/instanceStore';
import { useContextMenuStore, type ContextMenuItem } from '../../stores/contextMenuStore';
import { Tooltip } from '../ui/Tooltip';
import { SpaceHoverCard } from './SpaceHoverCard';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TransferOwnershipModal } from '../modals/TransferOwnershipModal';
import { NotificationSettingsModal, type NotificationSettingsModalTarget } from '../notifications/NotificationSettingsModal';
import { FolderSettingsModal } from '../modals/FolderSettingsModal';
import { isPublicSpace, type SpaceLayoutItem, type SpaceFolder } from '@concord/shared';

import { getSpaceGradient } from '../../utils/gradients';
import { isElectron } from '../../platform/platform';
import { describeCodedError } from '../../i18n/errors';

// ─── Resolved layout types ─────────────────────────────────────────────────


// ─── Folder color presets ─────────────────────────────────────────────────

const FOLDER_COLORS = [
  { name: 'mint', value: '#86efac', labelKey: 'common:colors.mint' },
  { name: 'peach', value: '#fbbf93', labelKey: 'common:colors.peach' },
  { name: 'lavender', value: '#c4b5fd', labelKey: 'common:colors.lavender' },
  { name: 'sky', value: '#7dd3fc', labelKey: 'common:colors.sky' },
  { name: 'amber', value: '#fcd34d', labelKey: 'common:colors.amber' },
  { name: 'rose', value: '#fda4af', labelKey: 'common:colors.rose' },
  { name: 'coral', value: '#fb7185', labelKey: 'common:colors.coral' },
] as const;

// ─── SidebarItem ─────────────────────────────────────────────────────────

interface SidebarItemProps {
  id: string;
  name: string;
  icon?: string | null;
  avatarColor?: string | null;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  type?: 'space' | 'dm' | 'action';
  actionType?: 'add' | 'join' | 'explore';
  hasUnread?: boolean;
  dimmed?: boolean;
  federationBadge?: boolean;
  federationDisconnected?: boolean;
  spaceOrigin?: string;
  federationHost?: string | null;
  tooltipText?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  dropIndicator?: 'before' | 'after' | 'merge' | null;
}

function SidebarItem({ id, name, icon, avatarColor, active, onClick, onContextMenu, type = 'space', actionType, hasUnread, dimmed, federationBadge, federationDisconnected, spaceOrigin = '', federationHost = null, tooltipText, draggable, onDragStart, onDragOver, onDragEnd, onDrop, isDragging, dropIndicator }: SidebarItemProps) {
  const { t } = useTranslation(['spaces', 'common']);
  const [isHovered, setIsHovered] = useState(false);
  const firstLetter = name.charAt(0).toUpperCase();

  const getPillHeight = () => {
    if (active) return 'h-8';
    if (isHovered) return 'h-4';
    if (hasUnread && !active) return 'h-2';
    return 'h-2 scale-0';
  };

  const backgroundStyle = useMemo((): React.CSSProperties | undefined => {
    if (type === 'action') {
      return {
        background: isHovered ? 'rgba(134, 239, 172, 0.12)' : 'rgba(255, 255, 255, 0.04)',
      };
    }

    if (type === 'dm') {
      const lit = active || isHovered;
      return { background: lit ? 'rgb(var(--accent-primary))' : 'rgb(var(--interactive-muted))' };
    }

    // Space type — if it has a custom icon image, no gradient needed
    if (icon) return undefined;

    const spaceGrad = getSpaceGradient(id, name, avatarColor);
    return { background: spaceGrad.gradient };
  }, [type, id, name, icon, avatarColor, isHovered, active]);

  const getButtonClasses = () => {
    const base = 'w-10 h-10 flex items-center justify-center duration-200 overflow-hidden [transition:border-radius_0.2s,background_0.2s,color_0.2s]';

    if (type === 'dm') {
      return `${base} text-white ${active ? 'rounded-[13px]' : 'rounded-[20px] hover:rounded-[13px]'}`;
    }

    if (type === 'action') {
      return `${base} rounded-[20px] hover:rounded-[13px] text-accent-mint`;
    }

    if (icon) {
      return `${base} ${active ? 'rounded-[13px]' : 'rounded-[20px] hover:rounded-[13px]'}`;
    }

    return `${base} text-white ${active ? 'rounded-[13px]' : 'rounded-[20px] hover:rounded-[13px]'}`;
  };

  const buttonContent = (
    <button onClick={onClick} className={`${getButtonClasses()} ${dimmed ? 'opacity-40 saturate-50' : ''}`} style={backgroundStyle} title={tooltipText ? undefined : name} aria-current={active ? 'page' : undefined}>
      {type === 'dm' ? (
        <img src="/icons/logo-mark.svg" alt={t('common:appName')} className="w-7 h-auto select-none pointer-events-none" />
      ) : type === 'action' ? (
        actionType === 'add' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
        ) : actionType === 'explore' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
        )
      ) : icon ? (
        <img
          src={icon.startsWith('http') || icon.startsWith('/') ? icon : `/api/uploads/${icon}`}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[15px] font-bold">{firstLetter}</span>
      )}
    </button>
  );

  const innerContent = (
    <div className={`relative ${dropIndicator === 'merge' ? 'scale-110 ring-2 ring-accent-mint/60 rounded-full' : ''} transition-transform duration-150`}>
      {buttonContent}
      {type === 'space' && <SpaceUnreadBadge spaceId={id} />}
      {type === 'dm' && <DmUnreadBadge />}
      {federationBadge && (
        <div className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-surface-base flex items-center justify-center">
          {federationDisconnected ? (
            <div className="w-[8px] h-[8px] rounded-full bg-accent-amber" />
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary/80">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`relative flex items-center mb-1.5 w-full justify-center ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Drop indicator lines — offset into the mb-1.5 gap so adjacent items share one line */}
      {dropIndicator === 'before' && (
        <div className="absolute -top-[3px] left-3 right-3 h-[2px] bg-accent-mint rounded-full z-10" />
      )}
      {dropIndicator === 'after' && (
        <div className="absolute -bottom-[3px] left-3 right-3 h-[2px] bg-accent-mint rounded-full z-10" />
      )}

      {/* Pill Indicator */}
      {(type === 'space' || type === 'dm') && (
        <div className="absolute -left-0 w-2 h-10 flex items-center">
          <div
            className={`bg-white rounded-r-full transition-all duration-200 origin-left ${getPillHeight()} w-1`}
          />
        </div>
      )}

      {type === 'space' ? (
        <SpaceHoverCard
          spaceId={id}
          spaceName={name}
          origin={spaceOrigin}
          federationHost={federationHost}
          disabled={!!isDragging}
        >
          {innerContent}
        </SpaceHoverCard>
      ) : tooltipText ? (
        <Tooltip content={tooltipText} position="right" delay={300}>
          {innerContent}
        </Tooltip>
      ) : (
        innerContent
      )}
    </div>
  );
}

// ─── Mini space icon for collapsed folder ──────────────────────────────────

function MiniSpaceIcon({ space }: { space: TaggedSpace }) {
  const icon = space.icon;
  if (icon) {
    return (
      <img
        src={icon.startsWith('http') || icon.startsWith('/') ? icon : `/api/uploads/${icon}`}
        alt=""
        className="w-full h-full object-cover rounded-[3px]"
      />
    );
  }
  const grad = getSpaceGradient(space.id, space.name, space.avatarColor);
  return (
    <div
      className="w-full h-full rounded-[3px] flex items-center justify-center text-white"
      style={{ background: grad.gradient }}
    >
      <span className="text-[7px] font-bold leading-none">{space.name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ─── Folder icon (2×2 grid with glass-pill) ───────────────────────────────

function FolderIcon({ spaces, color, isActive, isHovered }: { spaces: TaggedSpace[]; color: string | null; isActive: boolean; isHovered: boolean }) {
  const display = spaces.slice(0, 4);
  const remaining = spaces.length - 4;
  const borderColor = color ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)` : undefined;
  return (
    <div
      className={`relative w-10 h-10 flex items-center justify-center overflow-hidden glass-pill [transition:border-radius_0.2s] ${
        isActive || isHovered ? 'rounded-[13px]' : 'rounded-[16px]'
      }`}
      style={borderColor ? { borderColor } : undefined}
    >
      <div className="grid grid-cols-2 gap-[2px] w-[28px] h-[28px] relative z-[1]">
        {display.map((s) => (
          <div key={s.id} className="w-[13px] h-[13px]">
            <MiniSpaceIcon space={s} />
          </div>
        ))}
        {display.length < 4 && Array.from({ length: 4 - display.length }).map((_, i) => (
          <div key={`empty-${i}`} className="w-[13px] h-[13px] rounded-[3px] bg-white/[0.04]" />
        ))}
      </div>
      {remaining > 0 && (
        <div className="absolute bottom-0 right-0 text-[7px] font-bold text-txt-tertiary bg-surface-base rounded-tl-sm px-0.5">
          +{remaining}
        </div>
      )}
    </div>
  );
}

// ─── CollapsedFolderSlot (compact 2x2 grid icon) ──────────────────────────

function CollapsedFolderSlot({
  folder,
  folderSpaces,
  isActive,
  hasUnread,
  isDragging,
  dropIndicator,
  onToggleExpand,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  folder: SpaceFolder;
  folderSpaces: TaggedSpace[];
  isActive: boolean;
  hasUnread: boolean;
  isDragging: boolean;
  dropIndicator: 'before' | 'after' | 'merge' | null;
  onToggleExpand: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const { t } = useTranslation(['spaces', 'common']);
  const [isHovered, setIsHovered] = useState(false);

  const getPillHeight = () => {
    if (isActive) return 'h-8';
    if (isHovered) return 'h-4';
    if (hasUnread) return 'h-2';
    return 'h-2 scale-0';
  };

  const iconContent = (
    <button
      onClick={onToggleExpand}
      aria-label={folder.name || t('spaces:sidebar.folder.tooltip', { count: folderSpaces.length })}
      className="relative focus:outline-none"
    >
      <FolderIcon spaces={folderSpaces} color={folder.color} isActive={isActive} isHovered={isHovered} />
      {/* Unread dot badge on collapsed folder */}
      {hasUnread && !isActive && (
        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-rose ring-2 ring-surface-base" />
      )}
    </button>
  );

  return (
    <div
      className={`relative flex items-center mb-1.5 w-full justify-center ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Drop indicators — before / after / merge */}
      {dropIndicator === 'before' && (
        <div className="absolute -top-[3px] left-3 right-3 h-[2px] bg-accent-mint rounded-full z-10" />
      )}
      {dropIndicator === 'after' && (
        <div className="absolute -bottom-[3px] left-3 right-3 h-[2px] bg-accent-mint rounded-full z-10" />
      )}
      {dropIndicator === 'merge' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-[16px] ring-2 ring-accent-mint/70 scale-105 transition-all duration-150" />
        </div>
      )}

      {/* Pill indicator */}
      <div className="absolute left-0 w-2 h-10 flex items-center">
        <div className={`bg-white rounded-r-full transition-all duration-200 origin-left ${getPillHeight()} w-1`} />
      </div>

      <Tooltip content={folder.name || t('spaces:sidebar.folder.tooltip', { count: folderSpaces.length })} position="right" delay={300}>
        {iconContent}
      </Tooltip>
    </div>
  );
}

// ─── FolderChildSpaceItem (item inside expanded folder capsule) ─────────────

function FolderChildSpaceItem({
  space,
  isActive,
  hasUnread,
  isDimmed,
  isFederated,
  spaceOrigin,
  federationHost,
  tooltipText,
  isDragging,
  dropIndicator,
  onClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  space: TaggedSpace;
  isActive: boolean;
  hasUnread: boolean;
  isDimmed: boolean;
  isFederated: boolean;
  spaceOrigin: string;
  federationHost: string | null;
  tooltipText: string;
  isDragging: boolean;
  dropIndicator: 'before' | 'after' | null;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const getPillHeight = () => {
    if (isActive) return 'h-8';
    if (isHovered) return 'h-4';
    if (hasUnread) return 'h-2';
    return 'h-2 scale-0';
  };

  const icon = space.icon;
  const spaceGrad = useMemo(() => {
    if (icon) return undefined;
    return getSpaceGradient(space.id, space.name, space.avatarColor);
  }, [icon, space.id, space.name, space.avatarColor]);

  const buttonClasses = `w-10 h-10 flex items-center justify-center duration-200 overflow-hidden text-white [transition:border-radius_0.2s,background_0.2s] ${
    isActive ? 'rounded-[13px]' : 'rounded-[20px] hover:rounded-[13px]'
  } ${isDimmed ? 'opacity-40 saturate-50' : ''}`;

  const buttonContent = (
    <button
      onClick={onClick}
      className={buttonClasses}
      style={spaceGrad ? { background: spaceGrad.gradient } : undefined}
      title={tooltipText}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon ? (
        <img
          src={icon.startsWith('http') || icon.startsWith('/') ? icon : `/api/uploads/${icon}`}
          alt={space.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[15px] font-bold">{space.name.charAt(0).toUpperCase()}</span>
      )}
    </button>
  );

  const innerContent = (
    <div className="relative">
      {buttonContent}
      <SpaceUnreadBadge spaceId={space.id} />
      {isFederated && !isDimmed && (
        <div className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-surface-base flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary/80">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`relative flex items-center w-full justify-center ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Drop indicators inside the folder capsule */}
      {dropIndicator === 'before' && (
        <div className="absolute -top-[3px] left-1 right-1 h-[2px] bg-accent-mint rounded-full z-10" />
      )}
      {dropIndicator === 'after' && (
        <div className="absolute -bottom-[3px] left-1 right-1 h-[2px] bg-accent-mint rounded-full z-10" />
      )}

      {/* Pill indicator positioned at the far left edge of the sidebar rail */}
      <div className="absolute -left-3 w-2 h-10 flex items-center">
        <div className={`bg-white rounded-r-full transition-all duration-200 origin-left ${getPillHeight()} w-1`} />
      </div>

      <SpaceHoverCard
        spaceId={space.id}
        spaceName={space.name}
        origin={spaceOrigin}
        federationHost={federationHost}
        disabled={isDragging}
      >
        {innerContent}
      </SpaceHoverCard>
    </div>
  );
}

// ─── ExpandedFolderSlot (Discord-style in-rail vertical capsule) ─────────────

function ExpandedFolderSlot({
  folder,
  folderSpaces,
  currentSpaceId,
  unreadSpaceIds,
  disconnectedOrigins,
  isDraggingFolder,
  headerDropIndicator,
  childDropState,
  onToggleExpand,
  onContextMenu,
  onHeaderDragStart,
  onHeaderDragOver,
  onHeaderDragEnd,
  onHeaderDrop,
  onSpaceClick,
  onSpaceContextMenu,
  onSpaceDragStart,
  onSpaceDragOver,
  onSpaceDragEnd,
  onSpaceDrop,
  getFederationInfo,
  dragState,
}: {
  folder: SpaceFolder;
  folderSpaces: TaggedSpace[];
  currentSpaceId: string | null;
  unreadSpaceIds: Set<string>;
  disconnectedOrigins: Set<string>;
  isDraggingFolder: boolean;
  headerDropIndicator: 'before' | 'after' | 'merge' | null;
  childDropState: { targetId: string; position: 'before' | 'after' } | null;
  onToggleExpand: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onHeaderDragStart: (e: React.DragEvent) => void;
  onHeaderDragOver: (e: React.DragEvent) => void;
  onHeaderDragEnd: () => void;
  onHeaderDrop: (e: React.DragEvent) => void;
  onSpaceClick: (spaceId: string) => void;
  onSpaceContextMenu: (spaceId: string, e: React.MouseEvent) => void;
  onSpaceDragStart: (e: React.DragEvent, spaceId: string) => void;
  onSpaceDragOver: (e: React.DragEvent, spaceId: string) => void;
  onSpaceDragEnd: () => void;
  onSpaceDrop: (e: React.DragEvent) => void;
  getFederationInfo: (space: TaggedSpace) => { origin: string; isFederated: boolean; isDimmed: boolean; tooltipText: string; hostLabel: string | null };
  dragState: { dragId: string; dragType: 'space' | 'folder'; sourceFolderId?: string } | null;
}) {
  const { t } = useTranslation(['spaces', 'common']);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const containerBg = folder.color
    ? `${folder.color}15`
    : 'rgba(255, 255, 255, 0.04)';
  const containerBorder = folder.color
    ? `${folder.color}35`
    : 'rgba(255, 255, 255, 0.08)';

  return (
    <div className="w-full flex flex-col items-center mb-1.5 animate-in fade-in duration-200">
      <div
        className="w-12 rounded-[24px] py-1.5 flex flex-col items-center gap-1.5 transition-all duration-200 relative"
        style={{
          backgroundColor: containerBg,
          border: `1px solid ${containerBorder}`,
        }}
      >
        {/* Folder Header: Open Folder button */}
        <div
          className={`relative flex items-center justify-center w-full ${isDraggingFolder ? 'opacity-50' : ''}`}
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
          onContextMenu={onContextMenu}
          draggable
          onDragStart={onHeaderDragStart}
          onDragOver={onHeaderDragOver}
          onDragEnd={onHeaderDragEnd}
          onDrop={onHeaderDrop}
        >
          {/* Header drop indicators */}
          {headerDropIndicator === 'before' && (
            <div className="absolute -top-[5px] left-2 right-2 h-[2px] bg-accent-mint rounded-full z-10" />
          )}
          {headerDropIndicator === 'after' && (
            <div className="absolute -bottom-[3px] left-2 right-2 h-[2px] bg-accent-mint rounded-full z-10" />
          )}
          {headerDropIndicator === 'merge' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-10 h-10 rounded-[14px] ring-2 ring-accent-mint/70 scale-105" />
            </div>
          )}

          {/* Left pill for header hover */}
          <div className="absolute -left-3 w-2 h-10 flex items-center">
            <div className={`bg-white rounded-r-full transition-all duration-200 origin-left ${isHeaderHovered ? 'h-4' : 'h-2 scale-0'} w-1`} />
          </div>

          <Tooltip content={folder.name ? `${folder.name} (${t('spaces:sidebar.folder.collapse', 'Recolher pasta')})` : t('spaces:sidebar.folder.collapse', 'Recolher pasta')} position="right" delay={300}>
            <button
              onClick={onToggleExpand}
              className="w-10 h-10 rounded-[16px] hover:rounded-[12px] flex items-center justify-center transition-all duration-200 bg-white/[0.06] hover:bg-white/[0.12] text-txt-secondary hover:text-white"
              style={folder.color ? { color: folder.color } : undefined}
              aria-label={t('spaces:sidebar.folder.collapse', 'Recolher pasta')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Space Children inside the Expanded Folder */}
        {folderSpaces.map((space) => {
          const isActive = currentSpaceId === space.id;
          const hasUnread = unreadSpaceIds.has(space.id) && !isActive;
          const isItemDragging = dragState?.dragType === 'space' && dragState.dragId === space.id;
          const dropPos = childDropState?.targetId === space.id ? childDropState.position : null;
          const { origin, isFederated, isDimmed, tooltipText, hostLabel } = getFederationInfo(space);

          return (
            <FolderChildSpaceItem
              key={space.id}
              space={space}
              isActive={isActive}
              hasUnread={hasUnread}
              isDimmed={isDimmed}
              isFederated={isFederated}
              spaceOrigin={origin}
              federationHost={hostLabel}
              tooltipText={tooltipText}
              isDragging={isItemDragging}
              dropIndicator={dropPos}
              onClick={() => onSpaceClick(space.id)}
              onContextMenu={(e) => onSpaceContextMenu(space.id, e)}
              onDragStart={(e) => onSpaceDragStart(e, space.id)}
              onDragOver={(e) => onSpaceDragOver(e, space.id)}
              onDragEnd={onSpaceDragEnd}
              onDrop={onSpaceDrop}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── SpaceSidebar (main component) ────────────────────────────────────────

export function SpaceSidebar() {
  const { t } = useTranslation(['spaces', 'common']);
  const spaces = useSpaceStore((s) => s.spaces);
  const currentSpaceId = useSpaceStore((s) => s.currentSpaceId);
  const setCurrentSpace = useSpaceStore((s) => s.setCurrentSpace);
  const channelToSpaceMap = useSpaceStore((s) => s.channelToSpaceMap);
  const dmChannels = useSpaceStore((s) => s.dmChannels);
  const folders = useSpaceStore((s) => s.folders);
  const spaceLayout = useSpaceStore((s) => s.spaceLayout);
  const updateSpaceLayout = useSpaceStore((s) => s.updateSpaceLayout);
  const generateInvite = useSpaceStore((s) => s.generateInvite);
  const leaveSpace = useSpaceStore((s) => s.leaveSpace);
  const showDms = useUIStore((s) => s.showDms);
  const setShowDms = useUIStore((s) => s.setShowDms);
  const openModal = useUIStore((s) => s.openModal);
  const addToast = useUIStore((s) => s.addToast);
  const floatingPanelHeight = useUIStore((s) => s.floatingPanelHeight);
  const currentChannelId = useChatStore((s) => s.currentChannelId);
  const setCurrentChannel = useChatStore((s) => s.setCurrentChannel);
  const unreadChannels = useChatStore((s) => s.unreadChannels);
  const instances = useInstanceStore((s) => s.instances);
  const navigate = useNavigate();
  const location = useLocation();

  // Expanded folders state (persisted across reloads)
  const EXPANDED_FOLDERS_STORAGE_KEY = 'nuvio_expanded_folders';
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_FOLDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch { /* ignore */ }
    return new Set();
  });

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(expandedFolderIds)));
    } catch { /* ignore */ }
  }, [expandedFolderIds]);

  const toggleFolderExpand = useCallback((folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  // Modal state for context menu actions that spawn modals
  const [transferModalSpaceId, setTransferModalSpaceId] = useState<string | null>(null);
  const [notificationTarget, setNotificationTarget] = useState<NotificationSettingsModalTarget | null>(null);
  const [leaveConfirmSpaceId, setLeaveConfirmSpaceId] = useState<string | null>(null);
  const [folderSettingsModalTarget, setFolderSettingsModalTarget] = useState<SpaceFolder | null>(null);

  // DnD state
  const [dragState, setDragState] = useState<{ dragId: string; dragType: 'space' | 'folder'; sourceFolderId?: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; targetFolderId?: string; position: 'before' | 'after' | 'merge' } | null>(null);
  const dropIndicatorRef = useRef(dropIndicator);
  dropIndicatorRef.current = dropIndicator;

  const openContextMenu = useContextMenuStore((s) => s.open);

  // Set of disconnected origins
  const disconnectedOrigins = useMemo(() => {
    const set = new Set<string>();
    for (const inst of instances) {
      if (inst.status === 'disconnected' || inst.status === 'error') {
        set.add(inst.origin);
      }
    }
    return set;
  }, [instances]);

  // Build space lookup map
  const spaceMap = useMemo(() => {
    const map = new Map<string, TaggedSpace>();
    for (const s of spaces) map.set(s.id, s);
    return map;
  }, [spaces]);

  // Reconciled layout: merge spaceLayout with actual spaces and folders
  const resolvedLayout = useMemo(
    () => resolveSpaceLayout(spaces, spaceLayout, folders),
    [spaces, spaceLayout, folders],
  );

  // Auto-expand folder when current active space is inside that folder
  useEffect(() => {
    if (!currentSpaceId) return;
    for (const item of resolvedLayout) {
      if (item.type === 'folder' && item.spaces.some(s => s.id === currentSpaceId)) {
        setExpandedFolderIds(prev => {
          if (prev.has(item.folder.id)) return prev;
          const next = new Set(prev);
          next.add(item.folder.id);
          return next;
        });
        break;
      }
    }
  }, [currentSpaceId, resolvedLayout]);

  // Compute which spaces have unread channels
  const unreadSpaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const channelId of unreadChannels) {
      const spaceId = channelToSpaceMap.get(channelId);
      if (spaceId) ids.add(spaceId);
    }
    return ids;
  }, [unreadChannels, channelToSpaceMap]);

  // Check if any DM channels are unread
  const hasDmUnread = useMemo(() => {
    for (const dm of dmChannels) {
      if (unreadChannels.has(dm.id)) return true;
    }
    return false;
  }, [unreadChannels, dmChannels]);

  const handleSpaceClick = useCallback((spaceId: string) => {
    const space = spaceMap.get(spaceId);
    const origin = space?._instanceOrigin;
    if (origin && disconnectedOrigins.has(origin)) {
      const inst = instances.find(i => i.origin === origin);
      addToast(t('spaces:sidebar.space.reconnecting', { instance: inst?.label || t('spaces:sidebar.space.remoteInstance') }), 'warning', 4000);
      return;
    }
    setCurrentSpace(spaceId);
    setShowDms(false);
    navigate(`/channels/${spaceId}`);
  }, [spaceMap, disconnectedOrigins, instances, addToast, setCurrentSpace, setShowDms, navigate, t]);

  const handleDmClick = () => {
    setShowDms(true);
    setCurrentSpace(null);
    setCurrentChannel(null);
    navigate('/channels/@me');
  };

  const handleExploreClick = () => {
    setCurrentSpace(null);
    setCurrentChannel(null);
    navigate('/explore');
  };

  // Split into private spaces (top, before +) and public spaces (bottom, before explore)
  const privateLayoutItems = useMemo(
    () => resolvedLayout.filter(item => {
      if (item.type === 'space') return !isPublicSpace(item.space);
      return !item.spaces.every(s => isPublicSpace(s));
    }),
    [resolvedLayout],
  );

  const publicLayoutItems = useMemo(
    () => resolvedLayout.filter(item => {
      if (item.type === 'space') return isPublicSpace(item.space);
      return item.spaces.every(s => isPublicSpace(s));
    }),
    [resolvedLayout],
  );

  const getItemRegion = useCallback((id: string, type: 'space' | 'folder'): 'private' | 'public' | null => {
    if (type === 'space') {
      const sp = spaceMap.get(id);
      if (!sp) return null;
      return isPublicSpace(sp) ? 'public' : 'private';
    }
    const folderItem = resolvedLayout.find(i => i.type === 'folder' && i.folder.id === id);
    if (!folderItem || folderItem.type !== 'folder') return null;
    return folderItem.spaces.every(s => isPublicSpace(s)) ? 'public' : 'private';
  }, [spaceMap, resolvedLayout]);

  // Build layout items and folder payload from resolvedLayout for persistence
  const buildLayoutPayload = useCallback((resolved: ResolvedSpaceLayoutItem[]) => {
    const items: SpaceLayoutItem[] = [];
    const folderPayload: Record<string, { name: string | null; color: string | null; spaceIds: string[] }> = {};

    for (const item of resolved) {
      if (item.type === 'space') {
        items.push({ t: 's', id: item.space.id });
      } else {
        items.push({ t: 'f', id: item.folder.id });
        folderPayload[item.folder.id] = {
          name: item.folder.name,
          color: item.folder.color,
          spaceIds: item.spaces.map(s => s.id),
        };
      }
    }

    return { items, folderPayload };
  }, []);

  const persistLayout = useCallback((resolved: ResolvedSpaceLayoutItem[]) => {
    const { items, folderPayload } = buildLayoutPayload(resolved);
    updateSpaceLayout(items, folderPayload);
  }, [buildLayoutPayload, updateSpaceLayout]);

  // ─── Folder context menu actions ────────────────────────────────────────

  const handleUngroup = useCallback((folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
    const newLayout = resolvedLayout.flatMap(item => {
      if (item.type === 'folder' && item.folder.id === folderId) {
        return item.spaces.map(s => ({ type: 'space' as const, space: s }));
      }
      return [item];
    });
    persistLayout(newLayout);
    addToast(t('spaces:sidebar.folder.ungrouped', 'Pasta desagrupada'), 'info', 2000);
  }, [resolvedLayout, persistLayout, addToast, t]);

  const handleRemoveFromFolder = useCallback((folderId: string, spaceId: string) => {
    const space = spaceMap.get(spaceId);
    if (!space) return;

    let newLayout = resolvedLayout.map(item => {
      if (item.type === 'folder') {
        return { ...item, spaces: [...item.spaces], folder: { ...item.folder } };
      }
      return { ...item };
    }) as ResolvedSpaceLayoutItem[];

    const folderIdx = newLayout.findIndex(i => i.type === 'folder' && i.folder.id === folderId);
    if (folderIdx === -1) return;

    const folderItem = newLayout[folderIdx] as ResolvedSpaceLayoutItem & { type: 'folder' };
    folderItem.spaces = folderItem.spaces.filter(s => s.id !== spaceId);
    folderItem.folder = { ...folderItem.folder, spaceIds: folderItem.spaces.map(s => s.id) };

    // Insert the removed space in the rail immediately after this folder
    newLayout.splice(folderIdx + 1, 0, { type: 'space', space });

    // Dissolve folder if < 2 members remain
    newLayout = newLayout.flatMap(item => {
      if (item.type === 'folder' && item.spaces.length < 2) {
        if (item.spaces.length === 1 && item.spaces[0]) {
          return [{ type: 'space' as const, space: item.spaces[0] }];
        }
        return [];
      }
      return [item];
    });

    persistLayout(newLayout);
    addToast(t('spaces:sidebar.folder.removed', 'Removido da pasta'), 'info', 2000);
  }, [resolvedLayout, spaceMap, persistLayout, addToast, t]);

  const handleMoveToFolder = useCallback((spaceId: string, targetFolderId: string) => {
    const space = spaceMap.get(spaceId);
    if (!space) return;

    let newLayout = resolvedLayout.map(item => {
      if (item.type === 'folder') {
        return { ...item, spaces: [...item.spaces], folder: { ...item.folder } };
      }
      return { ...item };
    }) as ResolvedSpaceLayoutItem[];

    // Remove standalone space
    newLayout = newLayout.filter(i => !(i.type === 'space' && i.space.id === spaceId));

    // Append to target folder
    const targetFolder = newLayout.find(i => i.type === 'folder' && i.folder.id === targetFolderId) as (ResolvedSpaceLayoutItem & { type: 'folder' }) | undefined;
    if (!targetFolder) return;

    targetFolder.spaces.push(space);
    targetFolder.folder = { ...targetFolder.folder, spaceIds: targetFolder.spaces.map(s => s.id) };

    // Auto expand destination folder
    setExpandedFolderIds(prev => new Set(prev).add(targetFolderId));

    persistLayout(newLayout);
    addToast(t('spaces:sidebar.folder.moved', 'Movido para a pasta'), 'success', 2000);
  }, [resolvedLayout, spaceMap, persistLayout, addToast, t]);

  const handleFolderSave = useCallback((folderId: string, name: string | null, color: string | null) => {
    const newLayout = resolvedLayout.map(item => {
      if (item.type === 'folder' && item.folder.id === folderId) {
        return {
          ...item,
          folder: {
            ...item.folder,
            name,
            color,
          },
        };
      }
      return item;
    });
    persistLayout(newLayout);
    setFolderSettingsModalTarget(null);
    addToast(t('common:states.saved', 'Alterações salvas'), 'success', 2000);
  }, [resolvedLayout, persistLayout, addToast, t]);

  const handleSpaceContextMenu = useCallback((spaceId: string, e: React.MouseEvent, folderId?: string) => {
    e.preventDefault();
    const space = useSpaceStore.getState().spaces.find(sp => sp.id === spaceId);
    if (!space) return;
    const isOwner = space.ownerId === getMyUserIdForOrigin((space as TaggedSpace)._instanceOrigin ?? '');
    const spaceRegion = isPublicSpace(space) ? 'public' : 'private';

    // Candidate folders in same partition
    const candidateFolders = resolvedLayout
      .filter((i): i is ResolvedSpaceLayoutItem & { type: 'folder' } =>
        i.type === 'folder' &&
        i.folder.id !== folderId &&
        (spaceRegion === 'public' ? i.spaces.every(s => isPublicSpace(s)) : !i.spaces.every(s => isPublicSpace(s)))
      )
      .map(i => i.folder);

    const items: ContextMenuItem[] = [
      {
        key: 'invite',
        type: 'action',
        label: t('common:actions.invitePeople'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ),
        onClick: async () => {
          try {
            const code = await useSpaceStore.getState().generateInvite(spaceId);
            await navigator.clipboard.writeText(spaceInviteUrl((space as TaggedSpace)._instanceOrigin, code));
            useUIStore.getState().addToast(
              t(space.visibility === 'request' ? 'spaces:sidebar.space.inviteCopiedRequest' : 'spaces:sidebar.space.inviteCopied'),
              'success',
              3000,
            );
          } catch (err) {
            useUIStore.getState().addToast(describeCodedError(err, t('spaces:sidebar.space.inviteFailed')), 'warning', 3000);
          }
        },
      },
      {
        key: 'notifications',
        type: 'action',
        label: t('spaces:notifications.open'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        ),
        onClick: () => setNotificationTarget({
          kind: 'space',
          origin: (space as TaggedSpace)._instanceOrigin ?? '',
          spaceId,
          spaceName: space.name,
        }),
      },
    ];

    if (folderId) {
      items.push({
        key: 'remove-from-folder',
        type: 'action',
        label: t('spaces:sidebar.folder.removeFrom', 'Remover da pasta'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        ),
        onClick: () => handleRemoveFromFolder(folderId, spaceId),
      });
    } else if (candidateFolders.length > 0) {
      for (const f of candidateFolders) {
        items.push({
          key: `move-to-${f.id}`,
          type: 'action',
          label: `${t('spaces:sidebar.folder.moveTo', 'Mover para')} "${f.name || t('spaces:sidebar.folder.unnamed', 'Pasta sem nome')}"`,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          ),
          onClick: () => handleMoveToFolder(spaceId, f.id),
        });
      }
    }

    items.push(
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
        onClick: () => setTransferModalSpaceId(spaceId),
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
        onClick: () => setLeaveConfirmSpaceId(spaceId),
      },
    );

    openContextMenu({ x: e.clientX, y: e.clientY }, items);
  }, [openContextMenu, resolvedLayout, handleRemoveFromFolder, handleMoveToFolder, t]);

  const handleFolderContextMenu = useCallback((folder: SpaceFolder, isExpanded: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      {
        key: 'toggle',
        type: 'action',
        label: isExpanded ? t('spaces:sidebar.folder.collapse', 'Recolher pasta') : t('spaces:sidebar.folder.open', 'Abrir pasta'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d={isExpanded
              ? "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"
              : "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"} />
          </svg>
        ),
        onClick: () => toggleFolderExpand(folder.id),
      },
      {
        key: 'settings',
        type: 'action',
        label: t('spaces:sidebar.folder.settings', 'Configurações da pasta'),
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        ),
        onClick: () => setFolderSettingsModalTarget(folder),
      },
      {
        key: 'sep',
        type: 'separator',
      },
      {
        key: 'ungroup',
        type: 'action',
        label: t('spaces:sidebar.folder.delete', 'Excluir pasta'),
        danger: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        ),
        onClick: () => handleUngroup(folder.id),
      },
    ];
    openContextMenu({ x: e.clientX, y: e.clientY }, items);
  }, [openContextMenu, toggleFolderExpand, handleUngroup, t]);

  // ─── DnD handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, id: string, type: 'space' | 'folder', sourceFolderId?: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragState({ dragId: id, dragType: type, sourceFolderId });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string, targetType: 'space' | 'folder', targetFolderId?: string) => {
    if (!dragState) return;

    // Prevent dragging across private/public partition
    const dragRegion = getItemRegion(dragState.dragId, dragState.dragType);
    const targetRegion = getItemRegion(targetFolderId ? targetFolderId : targetId, targetFolderId ? 'folder' : targetType);
    if (!dragRegion || !targetRegion || dragRegion !== targetRegion) {
      e.dataTransfer.dropEffect = 'none';
      dropIndicatorRef.current = null;
      setDropIndicator(null);
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'merge';
    if (targetFolderId) {
      // Dragging over a space INSIDE an expanded folder -> before/after reordering
      position = relY < height * 0.5 ? 'before' : 'after';
    } else if (targetType === 'folder') {
      if (dragState.dragType === 'space') {
        // Space dragging over folder header: top 25% before, center 50% merge, bottom 25% after
        if (relY < height * 0.25) position = 'before';
        else if (relY > height * 0.75) position = 'after';
        else position = 'merge';
      } else {
        position = relY < height * 0.5 ? 'before' : 'after';
      }
    } else {
      // Space dragging over another standalone space
      if (dragState.dragType === 'space' && dragState.dragId !== targetId) {
        if (relY < height * 0.25) position = 'before';
        else if (relY > height * 0.75) position = 'after';
        else position = 'merge';
      } else {
        position = relY < height * 0.5 ? 'before' : 'after';
      }
    }

    // Normalize 'before' to previous item's 'after' if at top level
    if (!targetFolderId && position === 'before') {
      const regionList = dragRegion === 'public' ? publicLayoutItems : privateLayoutItems;
      const targetIdx = regionList.findIndex(item =>
        (item.type === 'space' && item.space.id === targetId) ||
        (item.type === 'folder' && item.folder.id === targetId)
      );
      if (targetIdx > 0) {
        const prevItem = regionList[targetIdx - 1]!;
        const prevId = prevItem.type === 'space' ? prevItem.space.id : prevItem.folder.id;
        dropIndicatorRef.current = { targetId: prevId, position: 'after' };
        setDropIndicator({ targetId: prevId, position: 'after' });
        return;
      }
    }

    dropIndicatorRef.current = { targetId, targetFolderId, position };
    setDropIndicator({ targetId, targetFolderId, position });
  }, [dragState, getItemRegion, publicLayoutItems, privateLayoutItems]);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const indicator = dropIndicatorRef.current;
    if (!dragState || !indicator) {
      handleDragEnd();
      return;
    }

    const { dragId, dragType, sourceFolderId } = dragState;
    const { targetId, targetFolderId, position } = indicator;

    // Don't drop on self in same position
    if (dragId === targetId && position !== 'merge') {
      handleDragEnd();
      return;
    }

    // Enforce region boundary
    const dragRegion = getItemRegion(dragId, dragType);
    const targetRegion = getItemRegion(targetFolderId ? targetFolderId : targetId, targetFolderId ? 'folder' : (resolvedLayout.find(i => i.type === 'folder' && i.folder.id === targetId) ? 'folder' : 'space'));
    if (!dragRegion || !targetRegion || dragRegion !== targetRegion) {
      addToast(t('spaces:sidebar.folder.cannotMix', 'Espaços privados e públicos não podem ser misturados em pastas.'), 'warning', 3000);
      handleDragEnd();
      return;
    }

    // Work with mutable copy of resolved layout
    let newLayout = resolvedLayout.map(item => {
      if (item.type === 'folder') {
        return { ...item, spaces: [...item.spaces], folder: { ...item.folder } };
      }
      return { ...item };
    }) as ResolvedSpaceLayoutItem[];

    if (dragType === 'space') {
      const dragSpace = spaceMap.get(dragId);
      if (!dragSpace) { handleDragEnd(); return; }

      // 1. Remove dragSpace from source
      if (sourceFolderId) {
        const srcFolder = newLayout.find(i => i.type === 'folder' && i.folder.id === sourceFolderId) as (ResolvedSpaceLayoutItem & { type: 'folder' }) | undefined;
        if (srcFolder) {
          srcFolder.spaces = srcFolder.spaces.filter(s => s.id !== dragId);
          srcFolder.folder = { ...srcFolder.folder, spaceIds: srcFolder.spaces.map(s => s.id) };
        }
      } else {
        newLayout = newLayout.filter(item => !(item.type === 'space' && item.space.id === dragId));
      }

      // 2. Insert dragSpace into target
      if (targetFolderId) {
        // Dropping into an expanded folder
        const destFolder = newLayout.find(i => i.type === 'folder' && i.folder.id === targetFolderId) as (ResolvedSpaceLayoutItem & { type: 'folder' }) | undefined;
        if (destFolder) {
          const targetIdx = destFolder.spaces.findIndex(s => s.id === targetId);
          const insertIdx = targetIdx === -1 ? destFolder.spaces.length : (position === 'before' ? targetIdx : targetIdx + 1);
          destFolder.spaces.splice(insertIdx, 0, dragSpace);
          destFolder.folder = { ...destFolder.folder, spaceIds: destFolder.spaces.map(s => s.id) };
        }
      } else if (position === 'merge') {
        const targetIdx = newLayout.findIndex(item =>
          (item.type === 'space' && item.space.id === targetId) ||
          (item.type === 'folder' && item.folder.id === targetId)
        );
        if (targetIdx !== -1) {
          const targetItem = newLayout[targetIdx];
          if (targetItem && targetItem.type === 'space') {
            // Create new folder containing both spaces
            const tempId = `new:${Date.now()}`;
            const newFolder: ResolvedSpaceLayoutItem = {
              type: 'folder',
              folder: {
                id: tempId,
                userId: '',
                name: null,
                color: null,
                position: targetIdx,
                spaceIds: [targetItem.space.id, dragSpace.id],
              },
              spaces: [targetItem.space, dragSpace],
            };
            newLayout[targetIdx] = newFolder;
            setExpandedFolderIds(prev => new Set(prev).add(tempId));
          } else if (targetItem && targetItem.type === 'folder') {
            targetItem.spaces.push(dragSpace);
            targetItem.folder = { ...targetItem.folder, spaceIds: targetItem.spaces.map((s: TaggedSpace) => s.id) };
          }
        }
      } else {
        // Reorder at top level
        const targetIdx = newLayout.findIndex(item =>
          (item.type === 'space' && item.space.id === targetId) ||
          (item.type === 'folder' && item.folder.id === targetId)
        );
        if (targetIdx !== -1) {
          const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
          newLayout.splice(insertIdx, 0, { type: 'space', space: dragSpace });
        }
      }

      // 3. Dissolve folders with < 2 members
      newLayout = newLayout.flatMap(item => {
        if (item.type === 'folder' && item.spaces.length < 2) {
          if (item.spaces.length === 1 && item.spaces[0]) {
            return [{ type: 'space' as const, space: item.spaces[0] }];
          }
          return [];
        }
        return [item];
      });

    } else if (dragType === 'folder') {
      const dragIdx = newLayout.findIndex(i => i.type === 'folder' && i.folder.id === dragId);
      if (dragIdx !== -1) {
        const [dragItem] = newLayout.splice(dragIdx, 1);
        if (dragItem) {
          const targetIdx = newLayout.findIndex(item =>
            (item.type === 'space' && item.space.id === targetId) ||
            (item.type === 'folder' && item.folder.id === targetId)
          );
          if (targetIdx === -1) {
            newLayout.push(dragItem);
          } else {
            const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
            newLayout.splice(insertIdx, 0, dragItem);
          }
        }
      }
    }

    persistLayout(newLayout);
    handleDragEnd();
  }, [dragState, resolvedLayout, spaceMap, getItemRegion, handleDragEnd, persistLayout, addToast, t]);

  // ─── Helpers for rendering ──────────────────────────────────────────

  const getFederationInfo = useCallback((space: TaggedSpace) => {
    const origin = space._instanceOrigin ?? '';
    const isFederated = !!origin;
    const isDimmed = isFederated && disconnectedOrigins.has(origin);
    let tooltipText = space.name;
    let hostLabel: string | null = null;
    if (isFederated) {
      try {
        hostLabel = new URL(origin).host;
        tooltipText = `${space.name} \u00b7 ${hostLabel}`;
      } catch { /* ignore */ }
    }
    return { origin, isFederated, isDimmed, tooltipText, hostLabel };
  }, [disconnectedOrigins]);

  const folderHasUnread = useCallback((folderSpaces: TaggedSpace[]) => {
    return folderSpaces.some(s => unreadSpaceIds.has(s.id));
  }, [unreadSpaceIds]);

  const folderHasActive = useCallback((folderSpaces: TaggedSpace[]) => {
    return currentSpaceId ? folderSpaces.some(s => s.id === currentSpaceId) : false;
  }, [currentSpaceId]);

  const renderLayoutItem = (item: ResolvedSpaceLayoutItem) => {
    if (item.type === 'space') {
      const { origin, isFederated, isDimmed, tooltipText, hostLabel } = getFederationInfo(item.space);
      return (
        <SidebarItem
          key={item.space.id}
          id={item.space.id}
          name={item.space.name}
          icon={item.space.icon}
          avatarColor={item.space.avatarColor}
          active={currentSpaceId === item.space.id}
          onClick={() => handleSpaceClick(item.space.id)}
          onContextMenu={(e) => handleSpaceContextMenu(item.space.id, e)}
          hasUnread={unreadSpaceIds.has(item.space.id)}
          dimmed={isDimmed}
          federationBadge={isFederated}
          federationDisconnected={isDimmed}
          spaceOrigin={origin}
          federationHost={hostLabel}
          tooltipText={tooltipText}
          draggable
          onDragStart={(e) => handleDragStart(e, item.space.id, 'space')}
          onDragOver={(e) => handleDragOver(e, item.space.id, 'space')}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          isDragging={dragState?.dragType === 'space' && dragState.dragId === item.space.id}
          dropIndicator={dropIndicator?.targetId === item.space.id && !dropIndicator.targetFolderId ? dropIndicator.position : null}
        />
      );
    }

    // Folder item
    const { folder, spaces: folderSpaces } = item;
    const isExpanded = expandedFolderIds.has(folder.id);
    const isActive = folderHasActive(folderSpaces);
    const hasUnread = folderHasUnread(folderSpaces);

    if (isExpanded) {
      return (
        <ExpandedFolderSlot
          key={`folder-${folder.id}`}
          folder={folder}
          folderSpaces={folderSpaces}
          currentSpaceId={currentSpaceId}
          unreadSpaceIds={unreadSpaceIds}
          disconnectedOrigins={disconnectedOrigins}
          isDraggingFolder={dragState?.dragType === 'folder' && dragState.dragId === folder.id}
          headerDropIndicator={
            dropIndicator?.targetId === folder.id && !dropIndicator.targetFolderId
              ? dropIndicator.position
              : null
          }
          childDropState={
            dropIndicator?.targetFolderId === folder.id
              ? { targetId: dropIndicator.targetId, position: dropIndicator.position === 'merge' ? 'after' : dropIndicator.position }
              : null
          }
          onToggleExpand={() => toggleFolderExpand(folder.id)}
          onContextMenu={(e) => handleFolderContextMenu(folder, true, e)}
          onHeaderDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
          onHeaderDragOver={(e) => handleDragOver(e, folder.id, 'folder')}
          onHeaderDragEnd={handleDragEnd}
          onHeaderDrop={handleDrop}
          onSpaceClick={handleSpaceClick}
          onSpaceContextMenu={(spaceId, e) => handleSpaceContextMenu(spaceId, e, folder.id)}
          onSpaceDragStart={(e, spaceId) => handleDragStart(e, spaceId, 'space', folder.id)}
          onSpaceDragOver={(e, spaceId) => handleDragOver(e, spaceId, 'space', folder.id)}
          onSpaceDragEnd={handleDragEnd}
          onSpaceDrop={handleDrop}
          getFederationInfo={getFederationInfo}
          dragState={dragState}
        />
      );
    }

    return (
      <CollapsedFolderSlot
        key={`folder-${folder.id}`}
        folder={folder}
        folderSpaces={folderSpaces}
        isActive={isActive}
        hasUnread={hasUnread}
        isDragging={dragState?.dragType === 'folder' && dragState.dragId === folder.id}
        dropIndicator={dropIndicator?.targetId === folder.id && !dropIndicator.targetFolderId ? dropIndicator.position : null}
        onToggleExpand={() => toggleFolderExpand(folder.id)}
        onContextMenu={(e) => handleFolderContextMenu(folder, false, e)}
        onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
        onDragOver={(e) => handleDragOver(e, folder.id, 'folder')}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
      />
    );
  };

  return (
    <nav data-pip-obstacle="left" className="w-[72px] bg-surface-base flex flex-col items-center py-3 overflow-y-auto flex-shrink-0 no-scrollbar select-none desktop:fixed desktop:inset-y-0 desktop:left-0 desktop:z-[100] desktop:glass-strip" style={{ paddingBottom: floatingPanelHeight + 24, ...(isElectron() ? { top: 'var(--titlebar-inset)' } : {}) }} onDragOver={(e) => { if (dragState) e.preventDefault(); }} onDrop={handleDrop}>
      <SidebarItem
        id="@me"
        name={t('spaces:sidebar.directMessages')}
        active={
          showDms ||
          activeHomeNavItem(location.pathname, currentChannelId) === 'backspace' ||
          activeHomeNavItem(location.pathname, currentChannelId) === 'download'
        }
        onClick={handleDmClick}
        type="dm"
        hasUnread={hasDmUnread}
      />

      <div className="w-8 h-[2px] bg-white/[0.06] rounded-full mb-1.5 shrink-0" />

      {/* Private spaces (above the divider and add button) */}
      {privateLayoutItems.map(renderLayoutItem)}

      {/* Add space button */}
      <SidebarItem
        id="add-space"
        name={t('spaces:sidebar.addSpace')}
        active={false}
        onClick={() => openModal('createSpace')}
        type="action"
        actionType="add"
      />

      {/* Divider between private and public spaces */}
      <div className="w-8 h-[2px] bg-white/[0.06] rounded-full my-1.5 shrink-0" />

      {/* Public spaces (below divider, above explore) */}
      {publicLayoutItems.map(renderLayoutItem)}

      {/* Explore button */}
      <SidebarItem
        id="explore"
        name={t('spaces:sidebar.exploreSpaces')}
        active={location.pathname === '/explore'}
        onClick={handleExploreClick}
        type="action"
        actionType="explore"
      />

      {transferModalSpaceId && (
        <TransferOwnershipModal
          spaceId={transferModalSpaceId}
          onClose={() => setTransferModalSpaceId(null)}
        />
      )}
      {notificationTarget && (
        <NotificationSettingsModal
          target={notificationTarget}
          onClose={() => setNotificationTarget(null)}
        />
      )}
      {leaveConfirmSpaceId && (() => {
        const space = spaces.find(s => s.id === leaveConfirmSpaceId);
        return (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setLeaveConfirmSpaceId(null)}
            onConfirm={() => {
              if (currentSpaceId === leaveConfirmSpaceId) {
                navigate('/channels/@me');
                setCurrentSpace(null);
                setShowDms(true);
              }
              leaveSpace(leaveConfirmSpaceId);
              setLeaveConfirmSpaceId(null);
            }}
            title={space ? t('spaces:sidebar.space.leaveConfirm.titleNamed', { name: space.name }) : t('spaces:sidebar.space.leaveConfirm.title')}
            description={t('spaces:sidebar.space.leaveConfirm.description')}
            variant="danger"
            confirmLabel={t('common:actions.leave')}
          />
        );
      })()}
      {folderSettingsModalTarget && (
        <FolderSettingsModal
          isOpen={true}
          folder={folderSettingsModalTarget}
          onClose={() => setFolderSettingsModalTarget(null)}
          onSave={handleFolderSave}
        />
      )}
    </nav>
  );
}
