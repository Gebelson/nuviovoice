import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_MEMBER_NICKNAME_LENGTH, normalizeMemberNickname } from '@concord/shared/src/constants';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { ImageCropModal } from '../ui/ImageCropModal';
import { getApiForOrigin, getMyUserIdForOrigin, useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { useTransferStore } from '../../stores/transferStore';
import { waitForTransferAttachment } from '../../utils/waitForTransfer';
import { applySpaceMemberUpdate } from '../../stores/spaceMemberUpdates';
import { resolveAssetUrl } from '../../utils/assetUrls';
import { describeError } from '../../i18n/errors';
import { userDisplayName } from '../../utils/identity';

export interface SpaceProfileModalTarget {
  origin: string;
  spaceId: string;
  spaceName: string;
}

interface SpaceProfileModalProps {
  target: SpaceProfileModalTarget;
  onClose: () => void;
}

export function SpaceProfileModal({ target, onClose }: SpaceProfileModalProps) {
  const { t } = useTranslation(['spaces', 'common', 'errors']);
  const currentUser = useAuthStore((s) => s.user);
  const myUserId = getMyUserIdForOrigin(target.origin) ?? currentUser?.id ?? '';

  const [initialNickname, setInitialNickname] = useState<string | null>(null);
  const [initialAvatar, setInitialAvatar] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatarFilename, setAvatarFilename] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const state = useSpaceStore.getState();
    const cachedMember =
      state.currentSpaceId === target.spaceId
        ? state.members.find((m) => m.spaceId === target.spaceId && m.userId === myUserId)
        : undefined;

    if (cachedMember) {
      setInitialNickname(cachedMember.nickname ?? null);
      setInitialAvatar(cachedMember.avatar ?? null);
      setNickname(cachedMember.nickname ?? '');
      setAvatarFilename(cachedMember.avatar ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getApiForOrigin(target.origin)
      .spaces.members(target.spaceId)
      .then((members) => {
        if (cancelled) return;
        const me = members.find((m) => m.userId === myUserId);
        setInitialNickname(me?.nickname ?? null);
        setInitialAvatar(me?.avatar ?? null);
        setNickname(me?.nickname ?? '');
        setAvatarFilename(me?.avatar ?? null);
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
  }, [target.origin, target.spaceId, myUserId]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const accountName = currentUser ? userDisplayName(currentUser) : '';
  const effectivePreviewName = nickname.trim() || accountName;
  const effectivePreviewAvatar =
    avatarPreview ??
    (avatarFilename ? resolveAssetUrl(avatarFilename, target.origin) : currentUser?.avatar ?? null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (blob: Blob) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    const previewUrl = URL.createObjectURL(blob);
    setAvatarPreview(previewUrl);
    setCropSrc(null);
    setError('');

    const file = new File([blob], 'space-avatar.png', { type: 'image/png' });
    setUploadingAvatar(true);
    try {
      const tid = await useTransferStore.getState().startUpload(file, {
        tray: false,
        origin: target.origin || undefined,
      });
      const { filename } = await waitForTransferAttachment(tid);
      setAvatarFilename(filename);
    } catch {
      setError(t('spaces:create.icon.uploadFailed'));
      setAvatarPreview(null);
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRestoreGlobal = async () => {
    if (saving || uploadingAvatar || !myUserId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await getApiForOrigin(target.origin).spaces.updateMember(
        target.spaceId,
        myUserId,
        { nickname: null, avatar: null },
      );
      applySpaceMemberUpdate(target.origin, updated);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploadingAvatar || !myUserId) return;

    const normalizedNick = normalizeMemberNickname(nickname);
    if (normalizedNick === undefined) {
      setError(t('errors:member_nickname_invalid', { max: MAX_MEMBER_NICKNAME_LENGTH }));
      return;
    }

    if (normalizedNick === initialNickname && avatarFilename === initialAvatar) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await getApiForOrigin(target.origin).spaces.updateMember(
        target.spaceId,
        myUserId,
        { nickname: normalizedNick, avatar: avatarFilename },
      );
      applySpaceMemberUpdate(target.origin, updated);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const hasCustomProfile =
    Boolean(nickname.trim()) ||
    Boolean(avatarFilename) ||
    Boolean(initialNickname) ||
    Boolean(initialAvatar);

  return (
    <>
      <Modal
        isOpen
        onClose={() => {
          if (!saving && !uploadingAvatar) onClose();
        }}
        title={t('spaces:spaceMenu.profileModal.title')}
        maxWidth="max-w-md"
        mobileStyle="sheet"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-txt-secondary">
            {t('spaces:spaceMenu.profileModal.subtitle', { spaceName: target.spaceName })}
          </p>

          {error && (
            <div role="alert" className="p-2.5 bg-accent-rose/10 border border-accent-rose/30 rounded-md text-txt-danger text-sm">
              {error}
            </div>
          )}

          {/* Live Preview Card */}
          <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-txt-tertiary mb-2.5">
              {t('spaces:spaceMenu.profileModal.previewLabel')}
            </div>
            <div className="flex items-center gap-3">
              <Avatar
                src={effectivePreviewAvatar}
                name={effectivePreviewName}
                size={48}
                status={currentUser?.status ?? 'online'}
                user={currentUser ?? undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-txt-primary truncate">
                  {effectivePreviewName}
                </div>
                {currentUser?.username && (
                  <div className="text-xs text-txt-tertiary truncate">
                    @{currentUser.username}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Space Avatar Controls */}
          <div>
            <label className="block text-xs font-bold text-txt-secondary uppercase mb-2">
              {t('spaces:spaceMenu.profileModal.avatarLabel')}
            </label>
            <div className="flex items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={loading || saving || uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-active text-txt-primary text-xs font-medium transition-colors disabled:opacity-50"
              >
                {uploadingAvatar
                  ? t('common:states.pleaseWait')
                  : t('spaces:spaceMenu.profileModal.uploadAvatar')}
              </button>
              {avatarFilename && (
                <button
                  type="button"
                  disabled={loading || saving || uploadingAvatar}
                  onClick={() => {
                    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                    setAvatarPreview(null);
                    setAvatarFilename(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-txt-tertiary hover:text-txt-primary text-xs transition-colors disabled:opacity-50"
                >
                  {t('spaces:spaceMenu.profileModal.useGlobalAvatar')}
                </button>
              )}
            </div>
          </div>

          {/* Space Nickname Input */}
          <div>
            <label htmlFor="space-profile-nickname" className="block text-xs font-bold text-txt-secondary uppercase mb-2">
              {t('spaces:spaceMenu.profileModal.nicknameLabel')}
            </label>
            <input
              id="space-profile-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={MAX_MEMBER_NICKNAME_LENGTH}
              placeholder={accountName}
              disabled={loading || saving || uploadingAvatar}
              className="input-standard w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {hasCustomProfile ? (
              <button
                type="button"
                disabled={loading || saving || uploadingAvatar}
                onClick={() => void handleRestoreGlobal()}
                className="text-xs text-txt-tertiary hover:text-txt-primary transition-colors disabled:opacity-50"
              >
                {t('spaces:spaceMenu.profileModal.restoreGlobal')}
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving || uploadingAvatar}
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-txt-tertiary hover:text-txt-secondary transition-colors disabled:opacity-50"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || saving || uploadingAvatar}
                className="px-4 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50"
              >
                {saving ? t('common:states.pleaseWait') : t('common:actions.save')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {cropSrc && (
        <ImageCropModal
          isOpen
          imageSrc={cropSrc}
          aspectRatio={1}
          cropShape="round"
          title={t('spaces:spaceMenu.profileModal.avatarLabel')}
          onClose={() => setCropSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}
