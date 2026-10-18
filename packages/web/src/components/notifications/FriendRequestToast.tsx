import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { User } from '@concord/shared';
import { Avatar } from '../ui/Avatar';
import { useSocialStore } from '../../stores/socialStore';
import {
  useFriendRequestNotificationStore,
  type FriendRequestToastItem,
} from '../../stores/friendRequestNotificationStore';
import { useCanonicalUserView } from '../../utils/userViewLookup';
import { parseFederatedUsername, userDisplayName } from '../../utils/identity';
import { openDirectMessage } from '../../utils/openDirectMessage';
import { useUIStore } from '../../stores/uiStore';

const TOAST_DURATION_MS = 10_000;
const TICK_INTERVAL_MS = 100;

interface FriendRequestToastProps {
  toast: FriendRequestToastItem;
}

export function FriendRequestToast({ toast }: FriendRequestToastProps) {
  const { t } = useTranslation(['social', 'common']);
  const navigate = useNavigate();
  const openModal = useUIStore((s) => s.openModal);
  const addToast = useUIStore((s) => s.addToast);

  const { dismissToast, resolveToast } = useFriendRequestNotificationStore();
  const { updateFriendRequest } = useSocialStore();

  const [timeLeft, setTimeLeft] = useState(TOAST_DURATION_MS);
  const [isPaused, setIsPaused] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [acceptedLocal, setAcceptedLocal] = useState(toast.state === 'accepted');

  const canonicalUser = useCanonicalUserView(toast.user, toast.origin);
  const displayName = userDisplayName(canonicalUser);
  const parsedUsername = parseFederatedUsername(canonicalUser.username ?? '');
  const handleDisplay = parsedUsername.domain
    ? `@${parsedUsername.baseName}@${parsedUsername.domain}`
    : `@${parsedUsername.baseName}`;

  // Countdown timer with pause on hover/focus
  useEffect(() => {
    if (acceptedLocal || isActing) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (isPaused) return prev;
        if (prev <= TICK_INTERVAL_MS) {
          clearInterval(timer);
          dismissToast(toast.requestId);
          return 0;
        }
        return prev - TICK_INTERVAL_MS;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isPaused, acceptedLocal, isActing, dismissToast, toast.requestId]);

  const handleOpenProfile = () => {
    openModal('userProfile', {
      user: canonicalUser,
      origin: toast.origin,
    });
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActing) return;
    setIsActing(true);
    try {
      await updateFriendRequest(toast.requestId, toast.origin, 'accepted');
      resolveToast(toast.requestId, 'accepted');
      setAcceptedLocal(true);

      // Auto-dismiss after brief celebration feedback
      setTimeout(() => {
        dismissToast(toast.requestId);
      }, 2400);
    } catch (err) {
      setIsActing(false);
      addToast(
        t('social:request.error', {
          defaultValue: 'Falha ao aceitar pedido de amizade.',
        }),
        'warning',
      );
    }
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActing) return;
    setIsActing(true);
    try {
      await updateFriendRequest(toast.requestId, toast.origin, 'declined');
      resolveToast(toast.requestId, 'declined');
      dismissToast(toast.requestId);
    } catch {
      setIsActing(false);
      dismissToast(toast.requestId);
    }
  };

  const handleStartChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const rowId = await openDirectMessage(canonicalUser, toast.origin);
      useUIStore.getState().setShowDms(true);
      navigate(`/channels/@me/${rowId}`);
      dismissToast(toast.requestId);
    } catch {
      dismissToast(toast.requestId);
    }
  };

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / TOAST_DURATION_MS) * 100));

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="pointer-events-auto w-full max-w-[360px] bg-surface-elevated/95 backdrop-blur-md border border-white/[0.08] rounded-[16px] shadow-2xl shadow-black/50 overflow-hidden transition-all duration-200 transform animate-slide-down flex flex-col"
    >
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-accent-mint/15 text-accent-mint flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-txt-secondary uppercase">
              {t('social:notifications.title', { defaultValue: 'Solicitação de amizade' })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => dismissToast(toast.requestId)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-white/[0.06] transition-colors"
            title={t('social:notifications.dismiss', { defaultValue: 'Fechar notificação' })}
            aria-label={t('social:notifications.dismiss', { defaultValue: 'Fechar notificação' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        {acceptedLocal ? (
          <div className="flex items-center justify-between py-1 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-accent-mint/20 text-accent-mint flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="text-xs text-txt-primary font-medium truncate">
                {t('social:notifications.accepted', {
                  name: displayName,
                  defaultValue: `Você e @${displayName} agora são amigos!`,
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartChat}
              className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent-mint text-[#0f172a] hover:bg-accent-mint/90 transition-all shrink-0"
            >
              {t('social:notifications.chat', { defaultValue: 'Conversar' })}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div
                onClick={handleOpenProfile}
                className="cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                title={displayName}
              >
                <Avatar
                  src={canonicalUser.avatar}
                  name={displayName}
                  size={42}
                  status={canonicalUser.status}
                  userId={canonicalUser.homeUserId ?? canonicalUser.id}
                  avatarColor={canonicalUser.avatarColor}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div
                  onClick={handleOpenProfile}
                  className="font-semibold text-sm text-txt-primary truncate cursor-pointer hover:underline"
                >
                  {displayName}
                </div>
                <div className="text-xs text-txt-tertiary truncate leading-tight">
                  {handleDisplay}
                </div>
                <div className="text-xs text-txt-secondary mt-0.5 leading-snug">
                  {t('social:notifications.received', {
                    name: displayName,
                    defaultValue: `@${displayName} enviou um pedido de amizade.`,
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={isActing}
                onClick={handleAccept}
                className="flex-1 py-1.5 px-3 rounded-lg bg-accent-mint text-[#0f172a] text-xs font-semibold hover:bg-accent-mint/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
              >
                {t('social:notifications.accept', { defaultValue: 'Aceitar' })}
              </button>
              <button
                type="button"
                disabled={isActing}
                onClick={handleDecline}
                className="py-1.5 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.98] text-txt-secondary hover:text-txt-primary text-xs font-medium transition-colors disabled:opacity-50"
              >
                {t('social:notifications.decline', { defaultValue: 'Recusar' })}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Progress countdown bar */}
      {!acceptedLocal && (
        <div className="h-0.5 w-full bg-white/[0.04]">
          <div
            className={`h-full bg-accent-mint/50 transition-all ease-linear ${
              isPaused ? 'opacity-40' : 'opacity-100'
            }`}
            style={{
              width: `${progressPercent}%`,
              transitionDuration: `${TICK_INTERVAL_MS}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}
