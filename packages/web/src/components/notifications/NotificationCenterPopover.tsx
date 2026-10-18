import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { useSocialStore, isIncomingRequest, type TaggedFriendRequest } from '../../stores/socialStore';
import { Avatar } from '../ui/Avatar';
import { useCanonicalUserView } from '../../utils/userViewLookup';
import { parseFederatedUsername, userDisplayName } from '../../utils/identity';
import { useUIStore } from '../../stores/uiStore';
import { formatDmTimestamp } from '../../utils/dmFormatters';

interface NotificationCenterPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function IncomingRequestRow({ request }: { request: TaggedFriendRequest }) {
  const { t } = useTranslation(['social', 'common']);
  const updateFriendRequest = useSocialStore((s) => s.updateFriendRequest);
  const openModal = useUIStore((s) => s.openModal);
  const addToast = useUIStore((s) => s.addToast);
  const [acting, setActing] = useState(false);

  const canonicalUser = useCanonicalUserView(request.user!, request._instanceOrigin);
  const displayName = userDisplayName(canonicalUser);
  const parsed = parseFederatedUsername(canonicalUser.username ?? '');
  const handle = parsed.domain ? `@${parsed.baseName}@${parsed.domain}` : `@${parsed.baseName}`;

  const handleAccept = async () => {
    if (acting) return;
    setActing(true);
    try {
      await updateFriendRequest(request.id, request._instanceOrigin, 'accepted');
    } catch {
      setActing(false);
      addToast(t('social:request.error', { defaultValue: 'Falha ao aceitar pedido.' }), 'warning');
    }
  };

  const handleDecline = async () => {
    if (acting) return;
    setActing(true);
    try {
      await updateFriendRequest(request.id, request._instanceOrigin, 'declined');
    } catch {
      setActing(false);
    }
  };

  const handleOpenProfile = () => {
    openModal('userProfile', {
      user: canonicalUser,
      origin: request._instanceOrigin,
    });
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors">
      <div
        onClick={handleOpenProfile}
        className="cursor-pointer hover:opacity-90 transition-opacity shrink-0"
        title={displayName}
      >
        <Avatar
          src={canonicalUser.avatar}
          name={displayName}
          size={38}
          status={canonicalUser.status}
          userId={canonicalUser.homeUserId ?? canonicalUser.id}
          avatarColor={canonicalUser.avatarColor}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          onClick={handleOpenProfile}
          className="text-xs font-semibold text-txt-primary truncate cursor-pointer hover:underline"
        >
          {displayName}
        </div>
        <div className="text-[11px] text-txt-tertiary truncate leading-tight">
          {handle}
        </div>
        <div className="text-[11px] text-txt-secondary mt-0.5 flex items-center gap-1.5">
          <span>{t('social:request.incoming', { defaultValue: 'Pedido de amizade' })}</span>
          {request.createdAt && (
            <>
              <span className="text-txt-tertiary">·</span>
              <span className="text-[10px] text-txt-tertiary">
                {formatDmTimestamp(request.createdAt)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={acting}
          onClick={handleAccept}
          className="px-2.5 py-1 rounded-md bg-accent-mint text-[#0f172a] text-xs font-semibold hover:bg-accent-mint/90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {t('social:notifications.accept', { defaultValue: 'Aceitar' })}
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={handleDecline}
          className="px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.98] text-txt-secondary hover:text-txt-primary text-xs font-medium transition-colors disabled:opacity-50"
        >
          {t('social:notifications.decline', { defaultValue: 'Recusar' })}
        </button>
      </div>
    </div>
  );
}

export function NotificationCenterPopover({
  open,
  onClose,
  anchorRef,
}: NotificationCenterPopoverProps) {
  const { t } = useTranslation(['social', 'common']);
  const popoverRef = useRef<HTMLDivElement>(null);

  const requests = useSocialStore((s) => s.requests);
  const incomingRequests = requests.filter(
    (r) => r.status === 'pending' && isIncomingRequest(r) && !!r.user
  );

  const { style } = useFloatingPosition(anchorRef, popoverRef, {
    placement: 'bottom',
    offset: 8,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      role="dialog"
      aria-label={t('social:notifications.centerTitle', { defaultValue: 'Central de Notificações' })}
      className="fixed z-[310] w-[360px] max-w-[calc(100vw-24px)] bg-surface-elevated/95 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-txt-primary">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          <span className="text-sm font-semibold text-txt-primary">
            {t('social:notifications.centerTitle', { defaultValue: 'Notificações' })}
          </span>
          {incomingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-accent-mint/20 text-accent-mint">
              {incomingRequests.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-txt-tertiary hover:text-txt-primary p-1 rounded-md transition-colors"
          title={t('common:actions.close', { defaultValue: 'Fechar' })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Requests list */}
      <div className="max-h-[360px] overflow-y-auto p-2 flex flex-col gap-1">
        {incomingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] text-txt-tertiary flex items-center justify-center mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            </div>
            <p className="text-xs text-txt-tertiary">
              {t('social:notifications.noPending', { defaultValue: 'Nenhuma notificação pendente' })}
            </p>
          </div>
        ) : (
          incomingRequests.map((req) => (
            <IncomingRequestRow key={`${req.id}:${req._instanceOrigin}`} request={req} />
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
