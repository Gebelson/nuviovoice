import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { getApiForOrigin } from '../../stores/spaceStore';
import { describeError } from '../../i18n/errors';

export interface SpacePrivacyModalTarget {
  origin: string;
  spaceId: string;
  spaceName: string;
}

interface SpacePrivacyModalProps {
  target: SpacePrivacyModalTarget;
  onClose: () => void;
}

export function SpacePrivacyModal({ target, onClose }: SpacePrivacyModalProps) {
  const { t } = useTranslation(['spaces', 'common']);
  const [allowDms, setAllowDms] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<'allowDms' | 'allowFriendRequests' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getApiForOrigin(target.origin)
      .spaces.getPrivacy(target.spaceId)
      .then((res) => {
        if (cancelled) return;
        setAllowDms(res.allowDms);
        setAllowFriendRequests(res.allowFriendRequests);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target.origin, target.spaceId]);

  const toggleSetting = async (field: 'allowDms' | 'allowFriendRequests', nextValue: boolean) => {
    if (savingField) return;
    setError('');
    const prevDms = allowDms;
    const prevFriends = allowFriendRequests;
    if (field === 'allowDms') setAllowDms(nextValue);
    else setAllowFriendRequests(nextValue);

    setSavingField(field);
    try {
      const updated = await getApiForOrigin(target.origin).spaces.updatePrivacy(target.spaceId, {
        [field]: nextValue,
      });
      setAllowDms(updated.allowDms);
      setAllowFriendRequests(updated.allowFriendRequests);
    } catch (err) {
      setAllowDms(prevDms);
      setAllowFriendRequests(prevFriends);
      setError(describeError(err));
    } finally {
      setSavingField(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('spaces:spaceMenu.privacyModal.title', { spaceName: target.spaceName })}
      maxWidth="max-w-md"
      mobileStyle="sheet"
    >
      <div className="space-y-4">
        <p className="text-sm text-txt-secondary">
          {t('spaces:spaceMenu.privacyModal.subtitle', { spaceName: target.spaceName })}
        </p>

        {error && (
          <div role="alert" className="p-2.5 bg-accent-rose/10 border border-accent-rose/30 rounded-md text-txt-danger text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Allow DMs */}
          <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-surface-elevated/40 border border-white/[0.06]">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-txt-primary">
                {t('spaces:spaceMenu.privacyModal.allowDmsLabel')}
              </div>
              <div className="text-xs text-txt-tertiary mt-1">
                {t('spaces:spaceMenu.privacyModal.allowDmsDesc')}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowDms}
              aria-label={t('spaces:spaceMenu.privacyModal.allowDmsLabel')}
              disabled={loading || savingField !== null}
              onClick={() => void toggleSetting('allowDms', !allowDms)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                allowDms ? 'bg-accent-primary' : 'bg-surface-active'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowDms ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Allow Friend Requests */}
          <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-surface-elevated/40 border border-white/[0.06]">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-txt-primary">
                {t('spaces:spaceMenu.privacyModal.allowFriendRequestsLabel')}
              </div>
              <div className="text-xs text-txt-tertiary mt-1">
                {t('spaces:spaceMenu.privacyModal.allowFriendRequestsDesc')}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowFriendRequests}
              aria-label={t('spaces:spaceMenu.privacyModal.allowFriendRequestsLabel')}
              disabled={loading || savingField !== null}
              onClick={() => void toggleSetting('allowFriendRequests', !allowFriendRequests)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                allowFriendRequests ? 'bg-accent-primary' : 'bg-surface-active'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowFriendRequests ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <p className="text-xs text-txt-tertiary">
          {t('spaces:spaceMenu.privacyModal.globalNotice')}
        </p>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-full transition-colors"
          >
            {t('common:actions.done')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
