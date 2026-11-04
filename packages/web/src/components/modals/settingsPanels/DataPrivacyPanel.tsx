import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendDiscoveryVisibility } from '@concord/shared';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import {
  useUserPreferencesStore,
  type ProfileVisibilityScope,
} from '../../../stores/userPreferencesStore';
import { api } from '../../../api/client';
import {
  SettingsHubHeader,
  SettingsCardSection,
  SettingsToggleItem,
  SettingsRadioOption,
  SettingsRelatedShortcut,
  SettingsInfoCallout,
  type SubsectionTabItem,
} from './_shared/SettingsPrimitives';

export type DataPrivacySubsection = 'data-usage' | 'profile-privacy' | 'voice-encryption';

interface DataPrivacyPanelProps {
  activeSection?: DataPrivacySubsection;
  onSelectSection?: (section: DataPrivacySubsection) => void;
  onNavigateToSection?: (category: string, section: string) => void;
}

const DISCOVERY_VISIBILITY_OPTIONS: Array<{
  value: FriendDiscoveryVisibility;
  labelKey: 'privacy.discovery.everyoneLabel' | 'privacy.discovery.mutualFriendsLabel' | 'privacy.discovery.nobodyLabel';
  descKey: 'privacy.discovery.everyoneDesc' | 'privacy.discovery.mutualFriendsDesc' | 'privacy.discovery.nobodyDesc';
}> = [
  {
    value: 'everyone',
    labelKey: 'privacy.discovery.everyoneLabel',
    descKey: 'privacy.discovery.everyoneDesc',
  },
  {
    value: 'mutual_friends',
    labelKey: 'privacy.discovery.mutualFriendsLabel',
    descKey: 'privacy.discovery.mutualFriendsDesc',
  },
  {
    value: 'nobody',
    labelKey: 'privacy.discovery.nobodyLabel',
    descKey: 'privacy.discovery.nobodyDesc',
  },
];

const PROFILE_VISIBILITY_OPTIONS: Array<{
  value: ProfileVisibilityScope;
  titleKey:
    | 'dataPrivacy.profilePrivacy.visibility.all.title'
    | 'dataPrivacy.profilePrivacy.visibility.smallSpaces.title'
    | 'dataPrivacy.profilePrivacy.visibility.friendsOnly.title';
  descKey:
    | 'dataPrivacy.profilePrivacy.visibility.all.description'
    | 'dataPrivacy.profilePrivacy.visibility.smallSpaces.description'
    | 'dataPrivacy.profilePrivacy.visibility.friendsOnly.description';
}> = [
  {
    value: 'all_friends_and_spaces',
    titleKey: 'dataPrivacy.profilePrivacy.visibility.all.title',
    descKey: 'dataPrivacy.profilePrivacy.visibility.all.description',
  },
  {
    value: 'friends_and_small_spaces',
    titleKey: 'dataPrivacy.profilePrivacy.visibility.smallSpaces.title',
    descKey: 'dataPrivacy.profilePrivacy.visibility.smallSpaces.description',
  },
  {
    value: 'friends_only',
    titleKey: 'dataPrivacy.profilePrivacy.visibility.friendsOnly.title',
    descKey: 'dataPrivacy.profilePrivacy.visibility.friendsOnly.description',
  },
];

export function DataPrivacyPanel({
  activeSection = 'data-usage',
  onSelectSection,
  onNavigateToSection,
}: DataPrivacyPanelProps) {
  const { t } = useTranslation(['settings', 'common']);
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);

  const [internalSection, setInternalSection] = useState<DataPrivacySubsection>(activeSection);
  useEffect(() => {
    setInternalSection(activeSection);
  }, [activeSection]);

  const currentSection = onSelectSection ? activeSection : internalSection;
  const handleSelectSection = (sec: DataPrivacySubsection) => {
    setInternalSection(sec);
    onSelectSection?.(sec);
  };

  // Preferences store state
  const useDataToOperate = useUserPreferencesStore((s) => s.useDataToOperate);
  const useDataToPersonalize = useUserPreferencesStore((s) => s.useDataToPersonalize);
  const allowSponsoredContent = useUserPreferencesStore((s) => s.allowSponsoredContent);
  const allowThirdPartyIntegrationData = useUserPreferencesStore((s) => s.allowThirdPartyIntegrationData);
  const lastDataExportRequestedAt = useUserPreferencesStore((s) => s.lastDataExportRequestedAt);
  const profileVisibility = useUserPreferencesStore((s) => s.profileVisibility);
  const notifyFriendsOnProfileUpdate = useUserPreferencesStore((s) => s.notifyFriendsOnProfileUpdate);
  const persistentVoiceVerificationCodes = useUserPreferencesStore((s) => s.persistentVoiceVerificationCodes);
  const setPreference = useUserPreferencesStore((s) => s.setPreference);
  const requestDataArchive = useUserPreferencesStore((s) => s.requestDataArchive);

  // Synced backend discovery setting
  const [discoveryVisibility, setDiscoveryVisibility] = useState<FriendDiscoveryVisibility>(
    user?.friendDiscoveryVisibility ?? 'everyone',
  );
  const [savingDiscovery, setSavingDiscovery] = useState(false);

  useEffect(() => {
    if (user) {
      setDiscoveryVisibility(user.friendDiscoveryVisibility ?? 'everyone');
    }
  }, [user?.friendDiscoveryVisibility]);

  const handleDiscoveryChange = async (value: FriendDiscoveryVisibility) => {
    if (value === discoveryVisibility || savingDiscovery) return;
    const prev = discoveryVisibility;
    setDiscoveryVisibility(value);
    setSavingDiscovery(true);
    try {
      const updated = await api.users.update({ friendDiscoveryVisibility: value });
      useAuthStore.setState({ user: updated });
      addToast(t('privacy.feedback.success'), 'success');
    } catch {
      setDiscoveryVisibility(prev);
      addToast(t('privacy.feedback.error'), 'warning');
    } finally {
      setSavingDiscovery(false);
    }
  };

  const handleRequestData = () => {
    requestDataArchive();
    addToast(t('dataPrivacy.dataUsage.requestData.toastSuccess'), 'success');
  };

  const subsections: SubsectionTabItem[] = [
    { id: 'data-usage', title: t('dataPrivacy.subsections.dataUsage') },
    { id: 'profile-privacy', title: t('dataPrivacy.subsections.profilePrivacy') },
    { id: 'voice-encryption', title: t('dataPrivacy.subsections.voiceEncryption') },
  ];

  return (
    <div className="space-y-6">
      <SettingsHubHeader
        categoryLabel={t('hub.categories.dataPrivacy')}
        title={t('dataPrivacy.title')}
        subtitle={t('dataPrivacy.subtitle')}
        subsections={subsections}
        activeSubsection={currentSection}
        onSelectSubsection={(id) => handleSelectSection(id as DataPrivacySubsection)}
      />

      {currentSection === 'data-usage' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('dataPrivacy.dataUsage.heading')}
            description={t('dataPrivacy.dataUsage.description')}
          >
            <SettingsToggleItem
              heading={t('dataPrivacy.dataUsage.operate.title')}
              description={t('dataPrivacy.dataUsage.operate.description')}
              checked={useDataToOperate}
              onChange={(val) => setPreference('useDataToOperate', val)}
            />
            <SettingsToggleItem
              heading={t('dataPrivacy.dataUsage.personalize.title')}
              description={t('dataPrivacy.dataUsage.personalize.description')}
              checked={useDataToPersonalize}
              onChange={(val) => setPreference('useDataToPersonalize', val)}
            />
            <SettingsToggleItem
              heading={t('dataPrivacy.dataUsage.sponsored.title')}
              description={t('dataPrivacy.dataUsage.sponsored.description')}
              checked={allowSponsoredContent}
              onChange={(val) => setPreference('allowSponsoredContent', val)}
            />
            <SettingsToggleItem
              heading={t('dataPrivacy.dataUsage.thirdParty.title')}
              description={t('dataPrivacy.dataUsage.thirdParty.description')}
              checked={allowThirdPartyIntegrationData}
              onChange={(val) => setPreference('allowThirdPartyIntegrationData', val)}
            />
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('dataPrivacy.dataUsage.requestData.heading')}
            description={t('dataPrivacy.dataUsage.requestData.description')}
          >
            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="text-sm font-medium text-txt-primary">
                  {t('dataPrivacy.dataUsage.requestData.cardTitle')}
                </div>
                <p className="text-xs text-txt-tertiary leading-relaxed">
                  {t('dataPrivacy.dataUsage.requestData.cardBody')}
                </p>
                {lastDataExportRequestedAt && (
                  <p className="text-[11px] text-accent-mint font-medium pt-1">
                    {t('dataPrivacy.dataUsage.requestData.requestedStatus')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRequestData}
                className="btn-secondary text-xs shrink-0"
              >
                {t('dataPrivacy.dataUsage.requestData.button')}
              </button>
            </div>
          </SettingsCardSection>

          <SettingsInfoCallout
            heading={t('dataPrivacy.dataUsage.transparencyTitle')}
            body={t('dataPrivacy.dataUsage.transparencyBody')}
            tone="info"
          />

          <div className="p-4 rounded-lg border border-white/[0.08] bg-surface-elevated/40 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-txt-primary">
                Política de Privacidade Oficial
              </div>
              <p className="text-xs text-txt-tertiary leading-relaxed">
                Consulte as diretrizes de tratamento de dados, bases legais e direitos do titular pela LGPD.
              </p>
            </div>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Visualizar</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {currentSection === 'profile-privacy' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('dataPrivacy.profilePrivacy.visibility.heading')}
            description={t('dataPrivacy.profilePrivacy.visibility.description')}
          >
            {PROFILE_VISIBILITY_OPTIONS.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={profileVisibility === opt.value}
                onSelect={() => setPreference('profileVisibility', opt.value)}
                heading={t(opt.titleKey)}
                description={t(opt.descKey)}
              />
            ))}
            <SettingsToggleItem
              heading={t('dataPrivacy.profilePrivacy.notifyFriends.title')}
              description={t('dataPrivacy.profilePrivacy.notifyFriends.description')}
              checked={notifyFriendsOnProfileUpdate}
              onChange={(val) => setPreference('notifyFriendsOnProfileUpdate', val)}
            />
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('privacy.discovery.sectionTitle')}
            description={t('privacy.discovery.description')}
          >
            {DISCOVERY_VISIBILITY_OPTIONS.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={discoveryVisibility === opt.value}
                disabled={savingDiscovery}
                onSelect={() => handleDiscoveryChange(opt.value)}
                heading={t(opt.labelKey)}
                description={t(opt.descKey)}
              />
            ))}
          </SettingsCardSection>

          {onNavigateToSection && (
            <SettingsRelatedShortcut
              heading={t('dataPrivacy.profilePrivacy.related.heading')}
              description={t('dataPrivacy.profilePrivacy.related.description')}
              actionText={t('dataPrivacy.profilePrivacy.related.action')}
              onClick={() => onNavigateToSection('message-permissions', 'friend-requests')}
            />
          )}
        </div>
      )}

      {currentSection === 'voice-encryption' && (
        <div className="space-y-6">
          <SettingsInfoCallout
            heading={t('dataPrivacy.voiceEncryption.architectureTitle')}
            body={t('dataPrivacy.voiceEncryption.architectureBody')}
            tone="mint"
          />

          <SettingsCardSection
            heading={t('dataPrivacy.voiceEncryption.heading')}
            description={t('dataPrivacy.voiceEncryption.description')}
          >
            <SettingsToggleItem
              heading={t('dataPrivacy.voiceEncryption.persistentCodes.title')}
              description={t('dataPrivacy.voiceEncryption.persistentCodes.description')}
              checked={persistentVoiceVerificationCodes}
              onChange={(val) => setPreference('persistentVoiceVerificationCodes', val)}
            />
            <div className="p-4 space-y-2 bg-surface-base/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-primary">
                  {t('dataPrivacy.voiceEncryption.verifiedPeersTitle')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent-mint/15 text-accent-mint">
                  {t('dataPrivacy.voiceEncryption.protocolBadge')}
                </span>
              </div>
              <p className="text-xs text-txt-tertiary leading-relaxed">
                {t('dataPrivacy.voiceEncryption.verifiedPeersEmpty')}
              </p>
            </div>
          </SettingsCardSection>
        </div>
      )}
    </div>
  );
}
