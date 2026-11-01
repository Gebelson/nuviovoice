import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendDiscoveryVisibility } from '@concord/shared';
import { useAuthStore } from '../../../stores/authStore';
import { useActivityStore } from '../../../stores/activityStore';
import { useFriendRequestNotificationStore } from '../../../stores/friendRequestNotificationStore';
import { useUIStore } from '../../../stores/uiStore';
import { api } from '../../../api/client';
import { Toggle } from '../../ui/Toggle';

export function PrivacyPanel() {
  const { t } = useTranslation(['settings', 'common']);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const addToast = useUIStore((s) => s.addToast);
  const showActivity = useActivityStore((s) => s.showActivity);

  const initialVisibility: FriendDiscoveryVisibility =
    user?.friendDiscoveryVisibility || (user?.discoverable === false ? 'nobody' : 'everyone');

  const [discoveryVisibility, setDiscoveryVisibility] = useState<FriendDiscoveryVisibility>(initialVisibility);
  const [receiveWinks, setReceiveWinks] = useState(user?.receiveWinks !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const vis: FriendDiscoveryVisibility =
      user?.friendDiscoveryVisibility || (user?.discoverable === false ? 'nobody' : 'everyone');
    setDiscoveryVisibility(vis);
    setReceiveWinks(user?.receiveWinks !== false);
  }, [user?.friendDiscoveryVisibility, user?.discoverable, user?.receiveWinks]);

  const handleDiscoveryChange = async (value: FriendDiscoveryVisibility) => {
    if (value === discoveryVisibility || saving) return;
    const prev = discoveryVisibility;
    setDiscoveryVisibility(value);
    setSaving(true);
    try {
      const updated = await api.users.update({ friendDiscoveryVisibility: value });
      setUser(updated);
      addToast(
        t('settings:privacy.feedback.success', { defaultValue: 'Preferências de privacidade atualizadas.' }),
        'success',
      );
    } catch {
      setDiscoveryVisibility(prev);
      addToast(
        t('settings:privacy.feedback.error', { defaultValue: 'Não foi possível salvar suas preferências. Tente novamente.' }),
        'warning',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleWinksToggle = async (enabled: boolean) => {
    if (saving) return;
    const prev = receiveWinks;
    setReceiveWinks(enabled);
    setSaving(true);
    try {
      const updated = await api.users.update({ receiveWinks: enabled });
      setUser(updated);
      addToast(
        t('settings:privacy.feedback.success', { defaultValue: 'Preferências de privacidade atualizadas.' }),
        'success',
      );
    } catch {
      setReceiveWinks(prev);
      addToast(
        t('settings:privacy.feedback.error', { defaultValue: 'Não foi possível salvar suas preferências. Tente novamente.' }),
        'warning',
      );
    } finally {
      setSaving(false);
    }
  };

  const discoveryOptions: { value: FriendDiscoveryVisibility; label: string; description: string }[] = [
    {
      value: 'everyone',
      label: t('settings:privacy.discovery.everyoneLabel', { defaultValue: 'Todos' }),
      description: t('settings:privacy.discovery.everyoneDesc', {
        defaultValue: 'Qualquer usuário poderá encontrar seu perfil em buscas e recomendações.',
      }),
    },
    {
      value: 'mutual_friends',
      label: t('settings:privacy.discovery.mutualFriendsLabel', { defaultValue: 'Amigos de amigos' }),
      description: t('settings:privacy.discovery.mutualFriendsDesc', {
        defaultValue: 'Apenas pessoas que compartilham pelo menos um amigo em comum com você.',
      }),
    },
    {
      value: 'nobody',
      label: t('settings:privacy.discovery.nobodyLabel', { defaultValue: 'Ninguém' }),
      description: t('settings:privacy.discovery.nobodyDesc', {
        defaultValue: 'Seu perfil fica totalmente oculto de buscas, sugestões e recomendações.',
      }),
    },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{t('settings:privacy.title')}</h2>

      {/* Descoberta de pessoas */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('settings:privacy.discovery.sectionTitle', { defaultValue: 'Descoberta de pessoas' })}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5 space-y-3">
          <div>
            <div className="text-sm font-medium text-txt-primary">
              {t('settings:privacy.discovery.label', { defaultValue: 'Quem pode me encontrar em Adicionar amigos?' })}
            </div>
            <div className="text-xs text-txt-tertiary mt-0.5">
              {t('settings:privacy.discovery.description', {
                defaultValue: 'Escolha quem pode encontrar seu perfil na descoberta de pessoas.',
              })}
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label={t('settings:privacy.discovery.label', { defaultValue: 'Quem pode me encontrar em Adicionar amigos?' })}
            className="space-y-2 pt-1"
          >
            {discoveryOptions.map((opt) => {
              const isSelected = discoveryVisibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={saving}
                  onClick={() => handleDiscoveryChange(opt.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all border ${
                    isSelected
                      ? 'bg-accent-primary/10 border-accent-primary/40 text-txt-primary'
                      : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.04] text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-accent-primary bg-accent-primary' : 'border-white/20'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-txt-tertiary mt-0.5">{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {saving && (
            <div className="text-xs text-txt-tertiary mt-2">{t('common:states.saving')}</div>
          )}
        </div>
      </div>

      {/* Winks */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('settings:privacy.winks.sectionTitle', { defaultValue: 'Winks' })}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">
                {t('settings:privacy.winks.label', { defaultValue: 'Receber Winks' })}
              </div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {t('settings:privacy.winks.description', {
                  defaultValue: 'Permitir que outras pessoas enviem animações especiais para você nas mensagens privadas.',
                })}
              </div>
            </div>
            <Toggle
              enabled={receiveWinks}
              onChange={handleWinksToggle}
              ariaLabel={t('settings:privacy.winks.label', { defaultValue: 'Receber Winks' })}
            />
          </div>
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
