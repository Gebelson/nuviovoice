import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFriendRequestNotificationStore } from '../../stores/friendRequestNotificationStore';
import { FriendRequestToast } from './FriendRequestToast';
import { useUIStore } from '../../stores/uiStore';

export function FriendRequestToastContainer() {
  const { t } = useTranslation(['social']);
  const activeToasts = useFriendRequestNotificationStore((s) => s.activeToasts);
  const dismissTopToast = useFriendRequestNotificationStore((s) => s.dismissTopToast);
  const isMobile = useUIStore((s) => s.isMobile);

  // Global Escape key handler to dismiss topmost notification without declining
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeToasts.length > 0) {
        dismissTopToast();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeToasts.length, dismissTopToast]);

  if (activeToasts.length === 0) return null;

  return (
    <div
      aria-label={t('social:notifications.title')}
      className={`fixed z-[320] flex flex-col gap-2.5 pointer-events-none transition-all duration-200 ${
        isMobile
          ? 'top-3 left-3 right-3 items-center'
          : 'top-5 right-5 w-[360px]'
      }`}
    >
      {activeToasts.map((toast) => (
        <FriendRequestToast key={toast.requestId} toast={toast} />
      ))}
    </div>
  );
}
