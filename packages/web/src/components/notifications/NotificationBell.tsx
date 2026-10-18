import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocialStore, isIncomingRequest } from '../../stores/socialStore';
import { NotificationCenterPopover } from './NotificationCenterPopover';

export function NotificationBell() {
  const { t } = useTranslation(['social', 'common']);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const requests = useSocialStore((s) => s.requests);
  const incomingCount = requests.filter(
    (r) => r.status === 'pending' && isIncomingRequest(r) && !!r.user
  ).length;

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-8 h-8 flex items-center justify-center transition-colors rounded-[6px] relative ${
          open
            ? 'text-txt-primary bg-interactive-active'
            : 'text-txt-tertiary hover:text-txt-primary hover:bg-interactive-hover'
        }`}
        title={t('social:notifications.centerTitle', { defaultValue: 'Notificações' })}
        aria-label={t('social:notifications.centerTitle', { defaultValue: 'Notificações' })}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>

        {incomingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-mint text-[#0f172a] text-[10px] font-bold flex items-center justify-center leading-none shadow-sm animate-scale-in">
            {incomingCount > 99 ? '99+' : incomingCount}
          </span>
        )}
      </button>

      <NotificationCenterPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
      />
    </>
  );
}
