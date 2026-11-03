import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWinkStore } from '../../../stores/winkStore';
import { useUserPreferencesStore } from '../../../stores/userPreferencesStore';
import { InterfaceScaleSection } from './InterfaceScaleSection';
import {
  SettingsCardSection,
  SettingsToggleItem,
} from './_shared/SettingsPrimitives';

export function AccessibilityPanel() {
  const { t } = useTranslation(['settings', 'common']);

  const reduceMotion = useWinkStore((s) => s.settings.reduceMotion);
  const updateWinkSettings = useWinkStore((s) => s.updateSettings);

  const highContrastMode = useUserPreferencesStore((s) => s.highContrastMode);
  const alwaysUnderlineLinks = useUserPreferencesStore((s) => s.alwaysUnderlineLinks);
  const colorSaturation = useUserPreferencesStore((s) => s.colorSaturation);
  const highlightSpeakingIndicator = useUserPreferencesStore((s) => s.highlightSpeakingIndicator);
  const setPreference = useUserPreferencesStore((s) => s.setPreference);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-txt-primary">{t('accessibility.title')}</h2>
        <p className="text-xs text-txt-secondary mt-1">{t('accessibility.subtitle')}</p>
      </div>

      <SettingsCardSection
        heading={t('accessibility.contrastHeading')}
        description={t('accessibility.contrastDescription')}
      >
        <SettingsToggleItem
          heading={t('accessibility.highContrast.title')}
          description={t('accessibility.highContrast.description')}
          checked={highContrastMode}
          onChange={(val) => setPreference('highContrastMode', val)}
        />
        <SettingsToggleItem
          heading={t('accessibility.underlineLinks.title')}
          description={t('accessibility.underlineLinks.description')}
          checked={alwaysUnderlineLinks}
          onChange={(val) => setPreference('alwaysUnderlineLinks', val)}
        />
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-txt-primary">
                {t('accessibility.saturation.title')}
              </div>
              <p className="text-xs text-txt-tertiary mt-0.5">
                {t('accessibility.saturation.description')}
              </p>
            </div>
            <span className="text-xs text-txt-tertiary tabular-nums">
              {colorSaturation}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={colorSaturation}
            onChange={(e) => setPreference('colorSaturation', Number(e.target.value))}
            className="w-full accent-accent-mint cursor-pointer"
          />
        </div>
      </SettingsCardSection>

      <SettingsCardSection
        heading={t('accessibility.motionHeading')}
        description={t('accessibility.motionDescription')}
      >
        <SettingsToggleItem
          heading={t('messagePermissions.directMessages.winksReduceMotion.title')}
          description={t('messagePermissions.directMessages.winksReduceMotion.description')}
          checked={reduceMotion}
          onChange={(val) => updateWinkSettings({ reduceMotion: val })}
        />
        <SettingsToggleItem
          heading={t('accessibility.speakingIndicator.title')}
          description={t('accessibility.speakingIndicator.description')}
          checked={highlightSpeakingIndicator}
          onChange={(val) => setPreference('highlightSpeakingIndicator', val)}
        />
      </SettingsCardSection>

      <InterfaceScaleSection />
    </div>
  );
}
