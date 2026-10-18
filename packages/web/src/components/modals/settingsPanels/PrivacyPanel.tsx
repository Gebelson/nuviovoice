import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useActivityStore } from '../../../stores/activityStore';
import { useFriendRequestNotificationStore } from '../../../stores/friendRequestNotificationStore';
import { api } from '../../../api/client';
import { Toggle } from '../../ui/Toggle';

export function PrivacyPanel() {
  const { t } = useTranslation(['settings', 'common']);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const showActivity = useActivityStore((s) => s.showActivity);
  const [discoverable, setDiscoverable] = useState(user?.discoverable !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDiscoverable(user?.discoverable !== false);
  }, [user?.discoverable]);

  const handleToggle = async (enabled: boolean) => {
    setDiscoverable(enabled);
    setSaving(true);
    try {
      const updated = await api.users.update({ discoverable: enabled });
      setUser(updated);
    } catch {
      // Revert on failure
      setDiscoverable(!enabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{t('settings:privacy.title')}</h2>
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('settings:privacy.discovery.sectionTitle')}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">{t('settings:privacy.discovery.label')}</div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.discovery.description')}
              </div>
            </div>
            <Toggle enabled={discoverable} onChange={handleToggle} />
          </div>
          {saving && (
            <div className="text-xs text-txt-tertiary mt-2">{t('common:states.saving')}</div>
          )}
        </div>
      </div>

      {/* Activity Status */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('settings:privacy.activity.sectionTitle')}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">{t('settings:privacy.activity.label')}</div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.activity.description')}
              </div>
            </div>
            <Toggle
              enabled={showActivity}
              onChange={async (enabled) => {
                try {
                  await api.users.update({ showActivity: enabled });
                  useActivityStore.getState().setShowActivity(enabled);
                } catch (err) {
                  console.error('Failed to update activity visibility:', err);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Friend Request Notifications */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('settings:privacy.friendNotifications.sectionTitle', { defaultValue: 'Notificações de pedidos de amizade' })}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5 space-y-3 divide-y divide-white/[0.04]">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">
                {t('settings:privacy.friendNotifications.floatingLabel', { defaultValue: 'Exibir notificações flutuantes' })}
              </div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.friendNotifications.floatingDescription', { defaultValue: 'Mostra um card interativo no canto superior direito quando você recebe um pedido de amizade.' })}
              </div>
            </div>
            <Toggle
              enabled={useFriendRequestNotificationStore((s) => s.floatingEnabled)}
              onChange={(val) => useFriendRequestNotificationStore.getState().setFloatingEnabled(val)}
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">
                {t('settings:privacy.friendNotifications.soundLabel', { defaultValue: 'Som de notificação' })}
              </div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.friendNotifications.soundDescription', { defaultValue: 'Reproduz um som discreto ao receber uma nova solicitação de amizade.' })}
              </div>
            </div>
            <Toggle
              enabled={useFriendRequestNotificationStore((s) => s.soundEnabled)}
              onChange={(val) => useFriendRequestNotificationStore.getState().setSoundEnabled(val)}
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">
                {t('settings:privacy.friendNotifications.screenShareLabel', { defaultValue: 'Ocultar durante compartilhamento de tela' })}
              </div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.friendNotifications.screenShareDescription', { defaultValue: 'Não exibe notificações flutuantes na tela enquanto você estiver transmitindo ou compartilhando sua tela.' })}
              </div>
            </div>
            <Toggle
              enabled={useFriendRequestNotificationStore((s) => s.hideOnScreenShare)}
              onChange={(val) => useFriendRequestNotificationStore.getState().setHideOnScreenShare(val)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
