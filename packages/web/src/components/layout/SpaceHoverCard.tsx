import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { isMuteActive } from '@concord/shared';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { useDismissOnEscape } from '../../hooks/useDismissOnEscape';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore, getMyUserIdForOrigin } from '../../stores/spaceStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAuthStore } from '../../stores/authStore';
import {
  selectNotificationSetting,
  useNotificationSettingsStore,
} from '../../stores/notificationSettingsStore';
import { hasPermissionBit, PermissionBits } from '../../utils/permissions';
import { spaceMemberName, userDisplayName, userKey } from '../../utils/identity';
import { Avatar } from '../ui/Avatar';
import { BellOffIcon } from '../notifications/ChannelMutedIndicator';

// ─── Single active hover card coordinator ────────────────────────────────────

type CloseCallback = () => void;
let activeCardId: string | null = null;
let activeCloseCallback: CloseCallback | null = null;

function claimActiveHoverCard(id: string, close: CloseCallback): void {
  if (activeCardId && activeCardId !== id && activeCloseCallback) {
    activeCloseCallback();
  }
  activeCardId = id;
  activeCloseCallback = close;
}

function releaseActiveHoverCard(id: string): void {
  if (activeCardId === id) {
    activeCardId = null;
    activeCloseCallback = null;
  }
}

// Track spaces for which we already triggered a quiet background member fetch
const quietFetchedSpaces = new Set<string>();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpaceHoverParticipant {
  userId: string;
  displayName: string;
  avatar: string | null;
  avatarColor?: string | null;
}

export interface SpaceVoiceChannelGroup {
  channelId: string;
  channelName: string | null;
  participants: SpaceHoverParticipant[];
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

export interface ParticipantAvatarListProps {
  participants: SpaceHoverParticipant[];
  /**
   * Maximum avatars to display before showing a +N indicator.
   * Defaults to 18 (3 rows of 6) and is always floored at a minimum of 5 so
   * the list never artificially caps at 5 when more users are in voice.
   */
  maxVisible?: number;
  avatarSize?: number;
}

export function ParticipantAvatarList({
  participants,
  maxVisible = 18,
  avatarSize = 28,
}: ParticipantAvatarListProps) {
  if (participants.length === 0) return null;

  // Never cap below 5; default allows up to 18 avatars across multiple rows
  const effectiveMax = Math.max(5, maxVisible);
  const hasOverflow = participants.length > effectiveMax;
  // When overflowing, keep at least 5 visible avatars (or effectiveMax - 1 if larger)
  const visibleCount = hasOverflow ? Math.max(5, effectiveMax - 1) : participants.length;
  const visible = participants.slice(0, visibleCount);
  const overflowCount = participants.length - visible.length;

  return (
    <div
      data-testid="space-hover-avatar-list"
      className="flex flex-wrap items-center gap-1.5 max-w-[204px]"
    >
      {visible.map((participant) => (
        <div
          key={participant.userId}
          data-testid="space-hover-avatar"
          title={participant.displayName}
          aria-label={participant.displayName}
          className="relative inline-flex flex-shrink-0 rounded-full ring-1 ring-white/10 transition-transform duration-150"
        >
          <Avatar
            src={participant.avatar}
            name={participant.displayName}
            userId={participant.userId}
            avatarColor={participant.avatarColor}
            size={avatarSize}
          />
        </div>
      ))}
      {overflowCount > 0 && (
        <div
          data-testid="space-hover-avatar-overflow"
          className="inline-flex items-center justify-center rounded-full bg-surface-elevated border border-border-subtle text-[11px] font-semibold text-txt-secondary flex-shrink-0 select-none"
          style={{ width: avatarSize, height: avatarSize }}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

export interface SpaceHoverParticipantsProps {
  groups: SpaceVoiceChannelGroup[];
  allParticipants: SpaceHoverParticipant[];
  maxVisible?: number;
}

export function SpaceHoverParticipants({
  groups,
  allParticipants,
  maxVisible = 18,
}: SpaceHoverParticipantsProps) {
  if (allParticipants.length === 0) return null;

  const channelNames = groups
    .map((g) => g.channelName)
    .filter((name): name is string => Boolean(name && name.trim()));

  return (
    <div
      data-testid="space-hover-participants"
      className="mt-2 pt-2 border-t border-white/[0.07] flex flex-col gap-1.5"
    >
      {channelNames.length > 0 && (
        <div
          data-testid="space-hover-voice-channels"
          className="flex items-center gap-1.5 text-[11px] font-medium text-txt-secondary min-w-0"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="flex-shrink-0 text-status-online"
          >
            <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46ZM19.07 4.93C20.91 6.77 22 9.28 22 12C22 14.72 20.91 17.23 19.07 19.07L17.66 17.66C19.11 16.21 20 14.21 20 12C20 9.79 19.11 7.79 17.66 6.34L19.07 4.93Z" />
          </svg>
          <span className="truncate">{channelNames.join(', ')}</span>
        </div>
      )}
      <ParticipantAvatarList participants={allParticipants} maxVisible={maxVisible} />
    </div>
  );
}

export interface MutedStatusLabelProps {
  muted: boolean;
}

/**
 * Displays "Silenciado" at the bottom of the hover card ONLY when the space is
 * muted. When the space is not muted, renders nothing at all.
 */
export function MutedStatusLabel({ muted }: MutedStatusLabelProps) {
  const { t } = useTranslation(['spaces']);
  if (!muted) return null;

  return (
    <div
      data-testid="space-hover-muted"
      className="mt-2 pt-1.5 border-t border-white/[0.07] flex items-center gap-1.5 text-[11px] font-medium text-txt-tertiary"
    >
      <BellOffIcon size={12} className="flex-shrink-0 text-txt-tertiary" />
      <span>{t('spaces:notifications.mutedIndicator')}</span>
    </div>
  );
}

// ─── Main SpaceHoverCard Component ───────────────────────────────────────────

export interface SpaceHoverCardProps {
  spaceId: string;
  spaceName: string;
  origin?: string;
  federationHost?: string | null;
  children: React.ReactNode;
  disabled?: boolean;
  delay?: number;
  maxVisibleAvatars?: number;
}

export function SpaceHoverCard({
  spaceId,
  spaceName,
  origin = '',
  federationHost = null,
  children,
  disabled = false,
  delay = 80,
  maxVisibleAvatars = 18,
}: SpaceHoverCardProps) {
  const isMobile = useUIStore((s) => s.isMobile);
  const [isVisible, setIsVisible] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();

  const cardKey = `${origin}:${spaceId}`;

  // Space mute state (reactive to settings and timed-mute expiry clock)
  const spaceSetting = useNotificationSettingsStore((s) =>
    selectNotificationSetting(s, origin, { spaceId, channelId: null }),
  );
  useNotificationSettingsStore((s) => s.clock);
  const isSpaceMuted = isMuteActive(spaceSetting, Date.now());

  // Channel index & permissions to identify visible voice channels of this space
  const spaceChannelIndex = useSpaceStore((s) => s.spaceChannelIndex);
  const channelPermissions = useSpaceStore((s) => s.channelPermissions);
  const channelNames = useSpaceStore((s) => s.channelNames);
  const currentSpaceId = useSpaceStore((s) => s.currentSpaceId);
  const members = useSpaceStore((s) => s.members);
  const userViews = useSpaceStore((s) => s.userViews);
  const authUser = useAuthStore((s) => s.user);

  // Voice store state (read-only; never initiates a LiveKit connection)
  const voiceUsers = useVoiceStore((s) => s.voiceUsers);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const isLiveKitConnected = useVoiceStore((s) => s.isLiveKitConnected);
  const livekitParticipants = useVoiceStore((s) => s.participants);

  const { groups, allParticipants, hasUnresolvedUser } = useMemo(() => {
    const visibleVoiceChannelIds: string[] = [];
    for (const [channelId, entry] of spaceChannelIndex) {
      if (entry.spaceId !== spaceId || entry.origin !== origin || entry.type !== 'voice') {
        continue;
      }
      // If explicit channel permissions are recorded, verify VIEW_CHANNEL or ADMINISTRATOR
      const perms = channelPermissions.get(channelId);
      if (
        perms !== undefined &&
        !hasPermissionBit(perms, PermissionBits.VIEW_CHANNEL) &&
        !hasPermissionBit(perms, PermissionBits.ADMINISTRATOR)
      ) {
        continue;
      }
      visibleVoiceChannelIds.push(channelId);
    }

    const isCurrentOpenSpace = currentSpaceId === spaceId;
    const myOriginUserId = getMyUserIdForOrigin(origin);
    let unresolved = false;

    const resolveParticipant = (userId: string): SpaceHoverParticipant => {
      // 1. Open space roster (includes space-specific nickname if set)
      if (isCurrentOpenSpace) {
        const member = members.find((m) => m.userId === userId);
        if (member?.user) {
          return {
            userId: member.user.homeUserId ?? member.user.id,
            displayName: spaceMemberName(member, member.user),
            avatar: member.user.avatar ?? null,
            avatarColor: member.user.avatarColor ?? null,
          };
        }
      }

      // 2. Canonical userViews cache (populated from ready for all spaces)
      const directView = userViews.get(userKey({ id: userId }, origin));
      if (directView?.user) {
        return {
          userId: directView.user.homeUserId ?? directView.user.id,
          displayName: userDisplayName(directView.user),
          avatar: directView.user.avatar ?? null,
          avatarColor: directView.user.avatarColor ?? null,
        };
      }

      for (const entry of userViews.values()) {
        if (
          (entry.deliveredBy === origin && entry.user.id === userId) ||
          entry.user.id === userId ||
          entry.user.homeUserId === userId
        ) {
          return {
            userId: entry.user.homeUserId ?? entry.user.id,
            displayName: userDisplayName(entry.user),
            avatar: entry.user.avatar ?? null,
            avatarColor: entry.user.avatarColor ?? null,
          };
        }
      }

      // 3. Signed-in user fallback
      if (authUser && (authUser.id === userId || myOriginUserId === userId)) {
        return {
          userId: authUser.homeUserId ?? authUser.id,
          displayName: userDisplayName(authUser),
          avatar: authUser.avatar ?? null,
          avatarColor: authUser.avatarColor ?? null,
        };
      }

      // 4. LiveKit participant fallback (if in the same room)
      const lkParticipant = livekitParticipants.find((p) => p.userId === userId);
      if (lkParticipant) {
        return {
          userId,
          displayName: lkParticipant.username || userId,
          avatar: null,
          avatarColor: null,
        };
      }

      unresolved = true;
      return {
        userId,
        displayName: userId,
        avatar: null,
        avatarColor: null,
      };
    };

    const channelGroups: SpaceVoiceChannelGroup[] = [];
    const deduplicated: SpaceHoverParticipant[] = [];
    const seenUserIds = new Set<string>();

    for (const channelId of visibleVoiceChannelIds) {
      const rawUserIds =
        currentVoiceChannelId === channelId && isLiveKitConnected && livekitParticipants.length > 0
          ? [...new Set(livekitParticipants.map((p) => p.userId))]
          : (voiceUsers.get(channelId) ?? []);

      if (rawUserIds.length === 0) continue;

      const channelParticipants: SpaceHoverParticipant[] = [];
      const seenInChannel = new Set<string>();

      for (const rawId of rawUserIds) {
        if (!rawId || seenInChannel.has(rawId)) continue;
        seenInChannel.add(rawId);
        const resolved = resolveParticipant(rawId);
        channelParticipants.push(resolved);
        if (!seenUserIds.has(resolved.userId)) {
          seenUserIds.add(resolved.userId);
          deduplicated.push(resolved);
        }
      }

      if (channelParticipants.length > 0) {
        channelGroups.push({
          channelId,
          channelName: channelNames.get(channelId) ?? null,
          participants: channelParticipants,
        });
      }
    }

    return {
      groups: channelGroups,
      allParticipants: deduplicated,
      hasUnresolvedUser: unresolved,
    };
  }, [
    spaceChannelIndex,
    channelPermissions,
    channelNames,
    spaceId,
    origin,
    currentSpaceId,
    members,
    userViews,
    authUser,
    voiceUsers,
    currentVoiceChannelId,
    isLiveKitConnected,
    livekitParticipants,
  ]);

  // If the card is hovered and a voice user wasn't in userViews yet, do a one-time quiet fetch
  useEffect(() => {
    if (isVisible && hasUnresolvedUser && !quietFetchedSpaces.has(cardKey)) {
      quietFetchedSpaces.add(cardKey);
      void useSpaceStore.getState().loadSpaceDetail(spaceId, { quiet: true });
    }
  }, [isVisible, hasUnresolvedUser, cardKey, spaceId]);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const forceClose = useCallback(() => {
    clearTimers();
    setIsPending(false);
    setIsVisible(false);
    releaseActiveHoverCard(cardKey);
  }, [clearTimers, cardKey]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (isVisible) return;

    claimActiveHoverCard(cardKey, forceClose);

    if (delay <= 0) {
      setIsPending(false);
      setIsVisible(true);
      return;
    }

    setIsPending(true);
    if (openTimerRef.current !== null) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setIsPending(false);
      setIsVisible(true);
    }, delay);
  }, [disabled, isVisible, cardKey, forceClose, delay]);

  const handleScheduleClose = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsPending(false);
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setIsVisible(false);
      releaseActiveHoverCard(cardKey);
    }, 80);
  }, [cardKey]);

  useEffect(() => {
    if (disabled && (isVisible || isPending)) {
      forceClose();
    }
  }, [disabled, isVisible, isPending, forceClose]);

  useEffect(() => {
    return () => {
      clearTimers();
      releaseActiveHoverCard(cardKey);
    };
  }, [clearTimers, cardKey]);

  useDismissOnEscape(!isMobile && (isPending || isVisible), forceClose);

  const { style } = useFloatingPosition(anchorRef, floatingRef, {
    placement: 'right',
    offset: 12,
    enabled: isVisible && !disabled,
  });

  if (isMobile) return <>{children}</>;

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={handleOpen}
      onMouseLeave={handleScheduleClose}
      onFocus={handleOpen}
      onBlur={handleScheduleClose}
      onClick={forceClose}
      onContextMenu={forceClose}
    >
      {children}
      {isVisible && !disabled && createPortal(
        <div
          ref={floatingRef}
          role="tooltip"
          data-testid="space-hover-card"
          style={style}
          onMouseEnter={handleOpen}
          onMouseLeave={handleScheduleClose}
          className="px-3.5 py-2.5 min-w-[140px] max-w-[248px] glass rounded-xl border border-white/[0.08] shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* 1. Space Name (Top) */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              data-testid="space-hover-name"
              title={spaceName}
              className="text-[14px] font-semibold text-txt-primary leading-snug truncate"
            >
              {spaceName}
            </span>
            {federationHost && (
              <span
                data-testid="space-hover-federation-host"
                className="text-[11px] font-normal text-txt-tertiary truncate flex-shrink-0"
              >
                · {federationHost}
              </span>
            )}
          </div>

          {/* 2. Voice Channel Participants (Middle) */}
          <SpaceHoverParticipants
            groups={groups}
            allParticipants={allParticipants}
            maxVisible={maxVisibleAvatars}
          />

          {/* 3. Muted Status Label (Bottom — ONLY rendered when muted) */}
          <MutedStatusLabel muted={isSpaceMuted} />
        </div>,
        portalContainer,
      )}
    </div>
  );
}
