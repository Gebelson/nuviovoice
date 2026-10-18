import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AVATAR_COLORS,
  SPACE_CATEGORIES,
  type AvatarColor,
  type SpaceCategory,
} from '@concord/shared';
import { Modal } from '../ui/Modal';
import { ImageCropModal } from '../ui/ImageCropModal';
import { SpaceCoverEditor } from './SpaceCoverEditor';
import { Avatar } from '../ui/Avatar';
import { getSpaceGradient, SPACE_GRADIENT_MAP } from '../../utils/gradients';
import { useAvatarColorNames } from './spaceSettingsPanels/spaceOptions';
import { useSpaceStore } from '../../stores/spaceStore';
import { useExploreStore } from '../../stores/exploreStore';
import { useUIStore } from '../../stores/uiStore';
import { useTransferStore } from '../../stores/transferStore';
import { waitForTransferAttachment } from '../../utils/waitForTransfer';
import { api } from '../../api/client';
import { describeError } from '../../i18n/errors';

type WizardStep = 1 | 2 | 3 | 4 | 5;

function slugifyInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export function CreatePublicSpaceModal() {
  const { t } = useTranslation(['spaces', 'common']);
  const colorNames = useAvatarColorNames();
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const addToast = useUIStore((s) => s.addToast);
  const createPublicSpace = useSpaceStore((s) => s.createPublicSpace);
  const fetchExploreSpaces = useExploreStore((s) => s.fetchSpaces);
  const navigate = useNavigate();

  const isOpen = activeModal === 'createPublicSpace';

  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Info
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [description, setDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [category, setCategory] = useState<SpaceCategory>('community');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Step 2: Visual Identity
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('lavender');
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [bannerBlob, setBannerBlob] = useState<Blob | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Configuration
  const [rules, setRules] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'request'>('public');
  const [initialPermissions, setInitialPermissions] = useState<'standard' | 'restricted'>('standard');

  // Step 5: Submit & Eligibility
  const [eligible, setEligible] = useState<boolean>(true);
  const [eligibilityReason, setEligibilityReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check eligibility when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api.spaces
      .checkPublicEligibility()
      .then((res) => {
        if (!cancelled) {
          setEligible(res.allowed);
          setEligibilityReason(res.reason);
        }
      })
      .catch(() => {
        if (!cancelled) setEligible(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugTouched) {
      const next = slugifyInput(name);
      setSlug(next);
    }
  }, [name, slugTouched]);

  // Debounced slug availability check
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed || !SLUG_REGEX.test(trimmed)) {
      setSlugAvailable(null);
      setCheckingSlug(false);
      return;
    }
    let cancelled = false;
    setCheckingSlug(true);
    const timer = setTimeout(() => {
      api.spaces
        .checkSlug(trimmed)
        .then((res) => {
          if (!cancelled) {
            setSlugAvailable(res.available);
            setCheckingSlug(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSlugAvailable(null);
            setCheckingSlug(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, isOpen]);

  const resetAll = () => {
    setStep(1);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setSlugAvailable(null);
    setCheckingSlug(false);
    setDescription('');
    setFullDescription('');
    setCategory('community');
    setTagInput('');
    setTags([]);
    setAvatarColor('lavender');
    setIconBlob(null);
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    setCropSrc(null);
    setBannerBlob(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
    setBannerCropSrc(null);
    setRules('');
    setVisibility('public');
    setInitialPermissions('standard');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    resetAll();
    closeModal();
  };

  const handleAddTag = () => {
    const cleaned = tagInput.trim().toLowerCase().replace(/^#+/, '').slice(0, 24);
    if (!cleaned) return;
    if (tags.length >= 10 || tags.includes(cleaned)) {
      setTagInput('');
      return;
    }
    setTags([...tags, cleaned]);
    setTagInput('');
  };

  const handleRemoveTag = (target: string) => {
    setTags(tags.filter((tag) => tag !== target));
  };

  // Icon upload handlers
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (iconInputRef.current) iconInputRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleIconCropComplete = (blob: Blob) => {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconBlob(blob);
    setIconPreview(URL.createObjectURL(blob));
    setCropSrc(null);
  };

  // Banner upload handlers
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bannerInputRef.current) bannerInputRef.current.value = '';
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast(t('spaces:settings.overview.bannerInvalidType'), 'warning', 4000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast(t('spaces:settings.overview.bannerTooLarge'), 'warning', 4000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBannerCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBannerCropComplete = (blob: Blob) => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerBlob(blob);
    setBannerPreview(URL.createObjectURL(blob));
    setBannerCropSrc(null);
  };

  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      setError(t('spaces:createPublic.errors.nameRequired'));
      return false;
    }
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug || !SLUG_REGEX.test(normalizedSlug)) {
      setError(t('spaces:createPublic.errors.slugInvalid'));
      return false;
    }
    if (slugAvailable === false) {
      setError(t('spaces:createPublic.errors.slugTaken'));
      return false;
    }
    if (!description.trim()) {
      setError(t('spaces:createPublic.errors.descriptionRequired'));
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    setError('');
    setStep((prev) => (prev < 5 ? ((prev + 1) as WizardStep) : prev));
  };

  const handlePrevStep = () => {
    setError('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));
  };

  const handleSubmit = async () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!eligible) {
      setError(eligibilityReason || t('spaces:createPublic.errors.notEligible'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      let iconFilename: string | undefined;
      if (iconBlob) {
        const iconFile = new File([iconBlob], 'icon.webp', { type: iconBlob.type || 'image/webp' });
        const tid = await useTransferStore.getState().startUpload(iconFile, { tray: false });
        const uploaded = await waitForTransferAttachment(tid);
        iconFilename = uploaded.filename;
      }

      let bannerFilename: string | undefined;
      if (bannerBlob) {
        const bannerFile = new File([bannerBlob], 'banner.webp', { type: bannerBlob.type || 'image/webp' });
        const tid = await useTransferStore.getState().startUpload(bannerFile, { tray: false });
        const uploaded = await waitForTransferAttachment(tid);
        bannerFilename = uploaded.filename;
      }

      const created = await createPublicSpace({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim(),
        fullDescription: fullDescription.trim() || undefined,
        category,
        tags,
        rules: rules.trim() || undefined,
        visibility,
        initialPermissions,
        icon: iconFilename,
        banner: bannerFilename,
        avatarColor,
      });

      void fetchExploreSpaces();
      handleClose();
      navigate(`/channels/${created.id}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const steps: { num: WizardStep; label: string }[] = [
    { num: 1, label: t('spaces:createPublic.steps.info') },
    { num: 2, label: t('spaces:createPublic.steps.identity') },
    { num: 3, label: t('spaces:createPublic.steps.settings') },
    { num: 4, label: t('spaces:createPublic.steps.preview') },
    { num: 5, label: t('spaces:createPublic.steps.confirm') },
  ];

  const previewGradient = getSpaceGradient('preview', name.trim() || 'N', avatarColor).gradient;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('spaces:createPublic.title')}
        maxWidth="max-w-2xl"
        mobileStyle="fullscreen"
      >
        <div className="space-y-5">
          <p className="text-xs text-txt-secondary -mt-2">
            {t('spaces:createPublic.subtitle')}
          </p>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-1 border-b border-border-soft pb-3 overflow-x-auto">
            {steps.map((s) => {
              const active = step === s.num;
              const completed = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < step || validateStep1()) {
                      setStep(s.num);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-accent-primary/20 text-accent-primary'
                      : completed
                        ? 'text-accent-mint hover:bg-white/[0.04]'
                        : 'text-txt-tertiary hover:text-txt-secondary'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      active
                        ? 'bg-accent-primary text-white'
                        : completed
                          ? 'bg-accent-mint/20 text-accent-mint'
                          : 'bg-surface-input text-txt-tertiary'
                    }`}
                  >
                    {completed ? '✓' : s.num}
                  </span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="p-2.5 bg-accent-rose/10 border border-accent-rose/30 rounded text-txt-danger text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: Informações */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                    {t('spaces:createPublic.fields.name')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('spaces:createPublic.fields.namePlaceholder')}
                    maxLength={100}
                    className="input-standard w-full"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                    {t('spaces:createPublic.fields.slug')} *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(slugifyInput(e.target.value));
                      }}
                      placeholder={t('spaces:createPublic.fields.slugPlaceholder')}
                      maxLength={48}
                      className="input-standard w-full pr-20 font-mono text-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px]">
                      {checkingSlug ? (
                        <span className="text-txt-tertiary">{t('common:states.loading')}</span>
                      ) : slugAvailable === true ? (
                        <span className="text-accent-mint font-medium">{t('spaces:createPublic.slugAvailable')}</span>
                      ) : slugAvailable === false ? (
                        <span className="text-txt-danger font-medium">{t('spaces:createPublic.slugTaken')}</span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-[11px] text-txt-tertiary mt-1">
                    {t('spaces:createPublic.fields.slugHint')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.category')} *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SpaceCategory)}
                  className="input-standard w-full"
                >
                  {SPACE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`spaces:explore.categories.${cat}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.shortDescription')} *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder={t('spaces:createPublic.fields.shortDescriptionPlaceholder')}
                  rows={2}
                  className="input-standard w-full resize-none"
                />
                <div className="text-[11px] text-txt-tertiary text-right">
                  {description.length}/200
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.fullDescription')}
                </label>
                <textarea
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value.slice(0, 2000))}
                  placeholder={t('spaces:createPublic.fields.fullDescriptionPlaceholder')}
                  rows={3}
                  className="input-standard w-full resize-none"
                />
                <div className="text-[11px] text-txt-tertiary text-right">
                  {fullDescription.length}/2000
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.tags')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={t('spaces:createPublic.fields.tagsPlaceholder')}
                    className="input-standard flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-soft rounded text-xs font-medium text-txt-primary"
                  >
                    {t('spaces:createPublic.fields.addTag')}
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-primary/15 text-accent-primary"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-txt-danger"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Identidade visual */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Avatar & Color */}
              <div className="rounded-lg bg-white/[0.02] border border-border-soft p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => iconInputRef.current?.click()}
                    className="relative w-16 h-16 rounded-full border-2 border-dashed border-border-soft hover:border-accent-primary flex items-center justify-center overflow-hidden group transition-colors"
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-xl font-bold"
                        style={{ background: previewGradient }}
                      >
                        {(name.trim() || 'N').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-txt-primary">
                      {t('spaces:settings.overview.iconLabel')}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => iconInputRef.current?.click()}
                        className="px-3 py-1 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-soft rounded text-xs font-medium text-txt-primary"
                      >
                        {t('spaces:createPublic.uploadAvatar')}
                      </button>
                      {iconPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(iconPreview);
                            setIconPreview(null);
                            setIconBlob(null);
                          }}
                          className="px-2.5 py-1 text-xs text-txt-tertiary hover:text-txt-danger"
                        >
                          {t('common:actions.remove')}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconFileChange}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs text-txt-secondary mb-1.5">
                    {t('spaces:settings.overview.colorLabel')}
                  </label>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map((key) => {
                      const entry = SPACE_GRADIENT_MAP[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAvatarColor(key)}
                          className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                          style={{
                            background: entry.gradient,
                            borderColor: avatarColor === key ? 'white' : 'transparent',
                          }}
                          title={colorNames[key]}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Cover 15:4 (1800x480) */}
              <div className="rounded-lg bg-white/[0.02] border border-border-soft p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-txt-primary uppercase tracking-wider">
                      {t('spaces:settings.overview.bannerLabel')}
                    </div>
                    <p className="text-xs text-txt-tertiary mt-0.5">
                      {t('spaces:settings.overview.bannerHint')}
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="relative w-full aspect-[15/4] rounded-lg overflow-hidden border border-border-soft hover:border-accent-primary cursor-pointer group"
                >
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center text-white/90"
                      style={{ background: previewGradient }}
                    >
                      <span className="text-xs font-semibold">{t('spaces:settings.overview.uploadBanner')}</span>
                      <span className="text-[11px] text-white/75">{t('spaces:settings.overview.bannerRatio')}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-soft rounded text-xs font-medium text-txt-primary"
                  >
                    {bannerPreview ? t('spaces:settings.overview.changeBanner') : t('spaces:settings.overview.uploadBanner')}
                  </button>
                  {bannerPreview && (
                    <>
                      <button
                        type="button"
                        onClick={() => setBannerCropSrc(bannerPreview)}
                        className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-soft rounded text-xs font-medium text-txt-primary"
                      >
                        {t('spaces:settings.overview.repositionBanner')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(bannerPreview);
                          setBannerPreview(null);
                          setBannerBlob(null);
                        }}
                        className="px-3 py-1.5 text-xs text-txt-tertiary hover:text-txt-danger"
                      >
                        {t('spaces:settings.overview.removeBanner')}
                      </button>
                    </>
                  )}
                </div>

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleBannerFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Configurações */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.entryMode')}
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      visibility === 'public'
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-soft bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="entryMode"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-txt-primary">
                        {t('spaces:createPublic.entryModes.openTitle')}
                      </div>
                      <div className="text-xs text-txt-tertiary">
                        {t('spaces:createPublic.entryModes.openDesc')}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      visibility === 'request'
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-soft bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="entryMode"
                      checked={visibility === 'request'}
                      onChange={() => setVisibility('request')}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-txt-primary">
                        {t('spaces:createPublic.entryModes.approvalTitle')}
                      </div>
                      <div className="text-xs text-txt-tertiary">
                        {t('spaces:createPublic.entryModes.approvalDesc')}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.initialPermissions')}
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      initialPermissions === 'standard'
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-soft bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="initialPerms"
                      checked={initialPermissions === 'standard'}
                      onChange={() => setInitialPermissions('standard')}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-txt-primary">
                        {t('spaces:createPublic.permissions.standardTitle')}
                      </div>
                      <div className="text-xs text-txt-tertiary">
                        {t('spaces:createPublic.permissions.standardDesc')}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      initialPermissions === 'restricted'
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-soft bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="initialPerms"
                      checked={initialPermissions === 'restricted'}
                      onChange={() => setInitialPermissions('restricted')}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-txt-primary">
                        {t('spaces:createPublic.permissions.restrictedTitle')}
                      </div>
                      <div className="text-xs text-txt-tertiary">
                        {t('spaces:createPublic.permissions.restrictedDesc')}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                  {t('spaces:createPublic.fields.rules')}
                </label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value.slice(0, 2000))}
                  placeholder={t('spaces:createPublic.fields.rulesPlaceholder')}
                  rows={3}
                  className="input-standard w-full resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Pré-visualização */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-txt-secondary">
                {t('spaces:createPublic.previewHint')}
              </p>

              <div className="max-w-md mx-auto bg-surface-channel rounded-lg border border-border-soft overflow-hidden shadow-lg">
                <div className="w-full aspect-[15/4] relative overflow-hidden">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full relative" style={{ background: previewGradient }}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/15 via-transparent to-black/35" />
                    </div>
                  )}
                  <div
                    className="absolute bottom-0 inset-x-0 h-16"
                    style={{ background: 'linear-gradient(to top, rgba(20,20,26,0.9), transparent)' }}
                  />
                  <div className="absolute top-2 right-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
                        visibility === 'public'
                          ? 'bg-accent-mint/20 text-accent-mint'
                          : 'bg-accent-amber/20 text-accent-amber'
                      }`}
                    >
                      {visibility === 'public'
                        ? t('spaces:explore.badges.public')
                        : t('spaces:explore.badges.request')}
                    </span>
                  </div>
                </div>

                <div className="relative px-4 -mt-8 z-10">
                  <div className="p-0.5 rounded-xl bg-surface-channel inline-block shadow-lg">
                    <Avatar
                      src={iconPreview}
                      name={name.trim() || 'N'}
                      size={52}
                      userId="preview"
                      avatarColor={avatarColor}
                      palette="space"
                    />
                  </div>
                </div>

                <div className="px-4 pt-2 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-[15px] font-bold text-txt-primary truncate">
                      {name.trim() || t('spaces:createPublic.fields.namePlaceholder')}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated text-txt-secondary">
                      {t(`spaces:explore.categories.${category}`)}
                    </span>
                  </div>

                  <p className="text-[13px] text-txt-secondary line-clamp-2 mb-3">
                    {description.trim() || t('spaces:explore.noDescription')}
                  </p>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-txt-tertiary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[12px] text-txt-tertiary">
                    <span>{t('spaces:explore.memberCount', { count: 1 })}</span>
                    <span className="font-mono text-[11px]">/{slug || t('spaces:createPublic.fields.slugPlaceholder')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Criar espaço */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-white/[0.02] border border-border-soft p-4 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-border-soft/50">
                  <span className="text-txt-tertiary">{t('spaces:createPublic.fields.name')}</span>
                  <span className="font-semibold text-txt-primary">{name.trim()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-soft/50">
                  <span className="text-txt-tertiary">{t('spaces:createPublic.fields.slug')}</span>
                  <span className="font-mono text-txt-primary">/{slug}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-soft/50">
                  <span className="text-txt-tertiary">{t('spaces:createPublic.fields.category')}</span>
                  <span className="text-txt-primary">{t(`spaces:explore.categories.${category}`)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border-soft/50">
                  <span className="text-txt-tertiary">{t('spaces:createPublic.fields.entryMode')}</span>
                  <span className="text-txt-primary">
                    {visibility === 'public'
                      ? t('spaces:createPublic.entryModes.openTitle')
                      : t('spaces:createPublic.entryModes.approvalTitle')}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-txt-tertiary">{t('spaces:createPublic.fields.initialPermissions')}</span>
                  <span className="text-txt-primary">
                    {initialPermissions === 'standard'
                      ? t('spaces:createPublic.permissions.standardTitle')
                      : t('spaces:createPublic.permissions.restrictedTitle')}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-accent-mint/10 border border-accent-mint/25 text-xs text-accent-mint">
                {t('spaces:createPublic.publishNotice')}
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-border-soft">
            <button
              type="button"
              onClick={step === 1 ? handleClose : handlePrevStep}
              className="px-4 py-2 text-sm text-txt-secondary hover:text-txt-primary transition-colors"
            >
              {step === 1 ? t('common:actions.cancel') : t('common:actions.back')}
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded transition-colors"
              >
                {t('spaces:createPublic.nextStep')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !eligible}
                className="px-5 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
              >
                {loading ? t('spaces:create.submitting') : t('spaces:createPublic.submit')}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ImageCropModal
        isOpen={cropSrc !== null}
        onClose={() => setCropSrc(null)}
        imageSrc={cropSrc ?? ''}
        onCropComplete={handleIconCropComplete}
        title={t('spaces:settings.overview.cropIconTitle')}
        cropShape="round"
        aspectRatio={1}
        maxOutputDimension={256}
      />

      <SpaceCoverEditor
        isOpen={bannerCropSrc !== null}
        onClose={() => setBannerCropSrc(null)}
        imageSrc={bannerCropSrc ?? ''}
        onSave={handleBannerCropComplete}
        spaceName={name.trim() || 'Nuvio'}
        spaceIcon={iconPreview}
        avatarColor={avatarColor}
        description={description}
        visibility={visibility}
      />
    </>
  );
}
