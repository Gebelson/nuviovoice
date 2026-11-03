import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUserPreferencesStore,
  type TimeFormatOption,
  type DateFormatOption,
  type TimezoneModeOption,
} from '../../../stores/userPreferencesStore';
import { LanguageSection } from './LanguageSection';
import {
  SettingsCardSection,
  SettingsRadioOption,
} from './_shared/SettingsPrimitives';

export function LanguageTimePanel() {
  const { t } = useTranslation(['settings', 'common']);

  const timeFormat = useUserPreferencesStore((s) => s.timeFormat);
  const dateFormat = useUserPreferencesStore((s) => s.dateFormat);
  const timezoneMode = useUserPreferencesStore((s) => s.timezoneMode);
  const setPreference = useUserPreferencesStore((s) => s.setPreference);

  const timeOptions: Array<{
    value: TimeFormatOption;
    titleKey: 'languageTime.timeFormat.h24.title' | 'languageTime.timeFormat.h12.title';
    descKey: 'languageTime.timeFormat.h24.description' | 'languageTime.timeFormat.h12.description';
  }> = [
    {
      value: '24h',
      titleKey: 'languageTime.timeFormat.h24.title',
      descKey: 'languageTime.timeFormat.h24.description',
    },
    {
      value: '12h',
      titleKey: 'languageTime.timeFormat.h12.title',
      descKey: 'languageTime.timeFormat.h12.description',
    },
  ];

  const dateOptions: Array<{
    value: DateFormatOption;
    titleKey:
      | 'languageTime.dateFormat.dmy.title'
      | 'languageTime.dateFormat.mdy.title'
      | 'languageTime.dateFormat.ymd.title';
    descKey:
      | 'languageTime.dateFormat.dmy.description'
      | 'languageTime.dateFormat.mdy.description'
      | 'languageTime.dateFormat.ymd.description';
  }> = [
    {
      value: 'DD/MM/YYYY',
      titleKey: 'languageTime.dateFormat.dmy.title',
      descKey: 'languageTime.dateFormat.dmy.description',
    },
    {
      value: 'MM/DD/YYYY',
      titleKey: 'languageTime.dateFormat.mdy.title',
      descKey: 'languageTime.dateFormat.mdy.description',
    },
    {
      value: 'YYYY-MM-DD',
      titleKey: 'languageTime.dateFormat.ymd.title',
      descKey: 'languageTime.dateFormat.ymd.description',
    },
  ];

  const timezoneOptions: Array<{
    value: TimezoneModeOption;
    titleKey: 'languageTime.timezone.auto.title' | 'languageTime.timezone.utc.title';
    descKey: 'languageTime.timezone.auto.description' | 'languageTime.timezone.utc.description';
  }> = [
    {
      value: 'auto',
      titleKey: 'languageTime.timezone.auto.title',
      descKey: 'languageTime.timezone.auto.description',
    },
    {
      value: 'utc',
      titleKey: 'languageTime.timezone.utc.title',
      descKey: 'languageTime.timezone.utc.description',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-txt-primary">{t('languageTime.title')}</h2>
        <p className="text-xs text-txt-secondary mt-1">{t('languageTime.subtitle')}</p>
      </div>

      <LanguageSection />

      <SettingsCardSection
        heading={t('languageTime.timeFormat.heading')}
        description={t('languageTime.timeFormat.description')}
      >
        {timeOptions.map((opt) => (
          <SettingsRadioOption
            key={opt.value}
            selected={timeFormat === opt.value}
            onSelect={() => setPreference('timeFormat', opt.value)}
            heading={t(opt.titleKey)}
            description={t(opt.descKey)}
          />
        ))}
      </SettingsCardSection>

      <SettingsCardSection
        heading={t('languageTime.dateFormat.heading')}
        description={t('languageTime.dateFormat.description')}
      >
        {dateOptions.map((opt) => (
          <SettingsRadioOption
            key={opt.value}
            selected={dateFormat === opt.value}
            onSelect={() => setPreference('dateFormat', opt.value)}
            heading={t(opt.titleKey)}
            description={t(opt.descKey)}
          />
        ))}
      </SettingsCardSection>

      <SettingsCardSection
        heading={t('languageTime.timezone.heading')}
        description={t('languageTime.timezone.description')}
      >
        {timezoneOptions.map((opt) => (
          <SettingsRadioOption
            key={opt.value}
            selected={timezoneMode === opt.value}
            onSelect={() => setPreference('timezoneMode', opt.value)}
            heading={t(opt.titleKey)}
            description={t(opt.descKey)}
          />
        ))}
      </SettingsCardSection>
    </div>
  );
}
