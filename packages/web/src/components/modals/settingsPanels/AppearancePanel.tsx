import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AVATAR_COLORS, type AvatarColor, type User } from '@concord/shared';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import {
  useUserPreferencesStore,
  type SurfaceThemePreset,
  type MessageDensityPreset,
} from '../../../stores/userPreferencesStore';
import { Avatar } from '../../ui/Avatar';
import {
  getAvatarGradient,
  adjustColor,
  mutedGradient,
  AVATAR_GRADIENT_MAP,
  BANNER_COLOR_PRESETS,
} from '../../../utils/gradients';
import { resolveUploadUrl } from '../../../utils/assetUrls';
import { describeError } from '../../../i18n/errors';
import { InterfaceScaleSection } from './InterfaceScaleSection';
import { LanguageSection } from './LanguageSection';
import {
  SettingsCardSection,
  SettingsRadioOption,
  SettingsToggleItem,
} from './_shared/SettingsPrimitives';

export function AppearancePanel() {
  const { t } = useTranslation(['settings', 'common']);
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addToast = useUIStore((s) => s.addToast);

  const surfaceTheme = useUserPreferencesStore((s) => s.surfaceTheme);
  const messageDensity = useUserPreferencesStore((s) => s.messageDensity);
  const showAvatarsInCompact = useUserPreferencesStore((s) => s.showAvatarsInCompact);
  const setPreference = useUserPreferencesStore((s) => s.setPreference);

  const [avatarColorState, setAvatarColorState] = useState<AvatarColor | null>(
    user?.avatarColor ?? null,
  );
  const [accentColor, setAccentColor] = useState<string | null>(
    user?.accentColor ?? null,
  );
  const [customHex, setCustomHex] = useState(user?.accentColor ?? '');
  const [savingVisuals, setSavingVisuals] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAvatarColorState(user.avatarColor ?? null);
    setAccentColor(user.accentColor ?? null);
    setCustomHex(user.accentColor ?? '');
  }, [user?.id, user?.avatarColor, user?.accentColor]);

  const visualsDirty = Boolean(
    user &&
      (avatarColorState !== (user.avatarColor ?? null) ||
        accentColor !== (user.accentColor ?? null)),
  );

  const handleSaveProfileVisuals = async () => {
    if (!user || !visualsDirty) return;
    setSavingVisuals(true);
    try {
      const updates: Record<string, string | undefined> = {};
      if (accentColor !== (user.accentColor ?? null)) updates.accentColor = accentColor ?? '';
      if (avatarColorState !== (user.avatarColor ?? null)) updates.avatarColor = avatarColorState ?? '';
      await updateProfile(updates as Parameters<typeof updateProfile>[0]);
      addToast(t('settings:account.save.updated'), 'success', 2000);
    } catch (err) {
      addToast(
        err instanceof Error ? describeError(err) : t('settings:account.save.failed'),
        'warning',
      );
    } finally {
      setSavingVisuals(false);
    }
  };

  const handleResetProfileVisuals = () => {
    if (!user) return;
    setAvatarColorState(user.avatarColor ?? null);
    setAccentColor(user.accentColor ?? null);
    setCustomHex(user.accentColor ?? '');
  };

  const effectiveDisplayName = user ? user.displayName || user.username : '';
  const bannerUrl = user ? resolveUploadUrl(user.banner) : null;
  const bannerFallback = user
    ? accentColor
      ? mutedGradient(accentColor, adjustColor(accentColor, -40))
      : (() => {
          const g = getAvatarGradient(
            user.homeUserId ?? user.id,
            effectiveDisplayName,
            avatarColorState,
          );
          return mutedGradient(g.from, g.to);
        })()
    : 'linear-gradient(135deg, rgb(var(--accent-primary)), rgb(var(--accent-lavender)))';

  const surfaceOptions: Array<{
    value: SurfaceThemePreset;
    titleKey:
      | 'appearance.themes.obsidian.title'
      | 'appearance.themes.midnight.title'
      | 'appearance.themes.amethyst.title';
    descKey:
      | 'appearance.themes.obsidian.description'
      | 'appearance.themes.midnight.description'
      | 'appearance.themes.amethyst.description';
    swatchClass: string;
  }> = [
    {
      value: 'obsidian',
      titleKey: 'appearance.themes.obsidian.title',
      descKey: 'appearance.themes.obsidian.description',
      swatchClass: 'from-[#0e1015] via-[#151922] to-[#6366f1]/40',
    },
    {
      value: 'midnight_contrast',
      titleKey: 'appearance.themes.midnight.title',
      descKey: 'appearance.themes.midnight.description',
      swatchClass: 'from-[#050608] via-[#0b0d12] to-[#34d399]/40',
    },
    {
      value: 'amethyst_glass',
      titleKey: 'appearance.themes.amethyst.title',
      descKey: 'appearance.themes.amethyst.description',
      swatchClass: 'from-[#141020] via-[#1d1630] to-[#a855f7]/40',
    },
  ];

  const densityOptions: Array<{
    value: MessageDensityPreset;
    titleKey:
      | 'appearance.density.comfortable.title'
      | 'appearance.density.balanced.title'
      | 'appearance.density.compact.title';
    descKey:
      | 'appearance.density.comfortable.description'
      | 'appearance.density.balanced.description'
      | 'appearance.density.compact.description';
  }> = [
    {
      value: 'comfortable',
      titleKey: 'appearance.density.comfortable.title',
      descKey: 'appearance.density.comfortable.description',
    },
    {
      value: 'balanced',
      titleKey: 'appearance.density.balanced.title',
      descKey: 'appearance.density.balanced.description',
    },
    {
      value: 'compact',
      titleKey: 'appearance.density.compact.title',
      descKey: 'appearance.density.compact.description',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-txt-primary">{t('settings:appearance.title')}</h2>
        <p className="text-xs text-txt-secondary mt-1">{t('settings:appearance.hubSubtitle')}</p>
      </div>

      {/* ── Personalização Visual do Perfil (movida de Conta) ── */}
      {user && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
                {t('settings:appearance.profileVisuals.heading')}
              </div>
              <p className="text-xs text-txt-secondary mt-1">
                {t('settings:appearance.profileVisuals.description')}
              </p>
            </div>
            {visualsDirty && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                {t('settings:appearance.profileVisuals.unsavedBadge')}
              </span>
            )}
          </div>

          {/* Live Visual Profile Card Preview */}
          <div>
            <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
              {t('settings:appearance.profileVisuals.previewLabel')}
            </div>
            <div className="rounded-lg overflow-hidden border border-white/[0.06] bg-surface-channel">
              <div
                className="h-[80px]"
                style={
                  bannerUrl
                    ? {
                        backgroundImage: `url(${bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { background: bannerFallback }
                }
              />
              <div className="px-4 pb-3">
                <Avatar
                  src={user.avatar}
                  name={effectiveDisplayName}
                  size={56}
                  userId={user.homeUserId ?? user.id}
                  user={{ ...user, avatarColor: avatarColorState } as User}
                  ring={{ width: 4, color: 'var(--color-surface-channel, #1e1e2a)' }}
                  className="mt-[-32px] mb-2"
                />
                <div className="font-semibold text-[15px] leading-tight text-txt-primary">
                  {effectiveDisplayName}
                </div>
                <div className="text-[12px] text-txt-tertiary">@{user.username}</div>
              </div>
            </div>
          </div>

          {/* Avatar Color */}
          <div>
            <label className="block text-xs text-txt-secondary mb-1.5">
              {t('settings:account.profile.avatarColor.label')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((key) => {
                const entry = AVATAR_GRADIENT_MAP[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAvatarColorState(key)}
                    className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      background: entry.gradient,
                      borderColor: avatarColorState === key ? 'white' : 'transparent',
                      boxShadow: avatarColorState === key ? `0 0 0 2px ${entry.glow}40` : 'none',
                    }}
                    title={t(`common:colors.${key}`)}
                    aria-label={t(`common:colors.${key}`)}
                  />
                );
              })}
            </div>
          </div>

          {/* Banner Color */}
          <div>
            <label className="block text-xs text-txt-secondary mb-1.5">
              {t('settings:account.profile.bannerColor.label')}
            </label>
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {[0, 1, 2].map((row) =>
                BANNER_COLOR_PRESETS.map((family) => {
                  const color = family[row]!;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setAccentColor(color);
                        setCustomHex(color);
                      }}
                      className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: accentColor === color ? 'white' : 'transparent',
                        boxShadow: accentColor === color ? `0 0 0 2px ${color}40` : 'none',
                      }}
                      title={color}
                    />
                  );
                }),
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customHex}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomHex(val);
                  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                    setAccentColor(val);
                  }
                }}
                placeholder={t('settings:account.profile.bannerColor.hexPlaceholder')}
                className="input-standard w-24 px-2 py-1.5 text-xs font-mono"
                maxLength={7}
              />
              {accentColor && (
                <div
                  className="w-6 h-6 rounded-full border border-white/10 flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              {accentColor && (
                <button
                  type="button"
                  onClick={() => {
                    setAccentColor(null);
                    setCustomHex('');
                  }}
                  className="text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
                >
                  {t('common:actions.clear')}
                </button>
              )}
            </div>
          </div>

          {/* Save / Reset Visual Colors */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!visualsDirty || savingVisuals}
              onClick={handleSaveProfileVisuals}
              className="px-3.5 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              {savingVisuals
                ? t('common:states.saving')
                : t('settings:appearance.profileVisuals.saveButton')}
            </button>
            {visualsDirty && (
              <button
                type="button"
                onClick={handleResetProfileVisuals}
                className="px-3 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
              >
                {t('common:actions.reset')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nuvio Visual Theme Presets */}
      <SettingsCardSection
        heading={t('settings:appearance.themes.heading')}
        description={t('settings:appearance.themes.description')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
          {surfaceOptions.map((opt) => {
            const active = surfaceTheme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreference('surfaceTheme', opt.value)}
                className={`text-left rounded-xl p-3 border transition-all ${
                  active
                    ? 'border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/30'
                    : 'border-white/[0.06] bg-surface-base/40 hover:border-white/[0.14]'
                }`}
              >
                <div
                  className={`h-12 rounded-lg bg-gradient-to-br ${opt.swatchClass} border border-white/10 mb-2.5`}
                />
                <div className="text-xs font-semibold text-txt-primary">{t(opt.titleKey)}</div>
                <div className="text-[11px] text-txt-tertiary mt-0.5 leading-snug">
                  {t(opt.descKey)}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCardSection>

      {/* Message & Layout Density */}
      <SettingsCardSection
        heading={t('settings:appearance.density.heading')}
        description={t('settings:appearance.density.description')}
      >
        {densityOptions.map((opt) => (
          <SettingsRadioOption
            key={opt.value}
            selected={messageDensity === opt.value}
            onSelect={() => setPreference('messageDensity', opt.value)}
            heading={t(opt.titleKey)}
            description={t(opt.descKey)}
          />
        ))}
        <SettingsToggleItem
          heading={t('settings:appearance.density.showAvatarsCompact.title')}
          description={t('settings:appearance.density.showAvatarsCompact.description')}
          checked={showAvatarsInCompact}
          onChange={(val) => setPreference('showAvatarsInCompact', val)}
        />
      </SettingsCardSection>

      <InterfaceScaleSection />
      <LanguageSection />
    </div>
  );
}
