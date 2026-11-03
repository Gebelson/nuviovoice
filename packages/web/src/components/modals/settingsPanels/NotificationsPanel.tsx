import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useUIStore } from '../../../stores/uiStore';
import {
  useUserPreferencesStore,
  type ReactionNotificationScope,
} from '../../../stores/userPreferencesStore';
import { AudioManager } from '../../../audio/AudioManager';
import {
  SettingsHubHeader,
  SettingsCardSection,
  SettingsToggleItem,
  SettingsRelatedShortcut,
  type SubsectionTabItem,
} from './_shared/SettingsPrimitives';

export type NotificationsSubsection =
  | 'overview'
  | 'sounds'
  | 'badges'
  | 'email'
  | 'advanced';

interface NotificationsPanelProps {
  activeSection?: NotificationsSubsection;
  onSelectSection?: (section: NotificationsSubsection) => void;
  onNavigateToSection?: (category: string, section: string) => void;
}

export function NotificationsPanel({
  activeSection = 'overview',
  onSelectSection,
  onNavigateToSection,
}: NotificationsPanelProps) {
  const { t } = useTranslation(['settings', 'common']);
  const addToast = useUIStore((s) => s.addToast);

  const [internalSection, setInternalSection] = useState<NotificationsSubsection>(activeSection);
  useEffect(() => {
    setInternalSection(activeSection);
  }, [activeSection]);

  const currentSection = onSelectSection ? activeSection : internalSection;
  const handleSelectSection = (sec: NotificationsSubsection) => {
    setInternalSection(sec);
    onSelectSection?.(sec);
  };

  // Voice store sound settings
  const soundEffectVolume = useVoiceStore((s) => s.soundEffectVolume);
  const messageSoundAllChannels = useVoiceStore((s) => s.messageSoundAllChannels);
  const setSoundEffectVolume = useVoiceStore((s) => s.setSoundEffectVolume);
  const setMessageSoundAllChannels = useVoiceStore((s) => s.setMessageSoundAllChannels);

  // User preferences store
  const desktopNotificationsEnabled = useUserPreferencesStore((s) => s.desktopNotificationsEnabled);
  const taskbarFlashEnabled = useUserPreferencesStore((s) => s.taskbarFlashEnabled);
  const notifyFriendOnline = useUserPreferencesStore((s) => s.notifyFriendOnline);
  const notifyFriendProfileUpdate = useUserPreferencesStore((s) => s.notifyFriendProfileUpdate);
  const notifySpaceEvents = useUserPreferencesStore((s) => s.notifySpaceEvents);
  const notifyMessageReactions = useUserPreferencesStore((s) => s.notifyMessageReactions);
  const reactionNotificationScope = useUserPreferencesStore((s) => s.reactionNotificationScope);

  const soundNewMessage = useUserPreferencesStore((s) => s.soundNewMessage);
  const soundIncomingCall = useUserPreferencesStore((s) => s.soundIncomingCall);
  const soundVoiceJoinLeave = useUserPreferencesStore((s) => s.soundVoiceJoinLeave);
  const muteAllNotificationSounds = useUserPreferencesStore((s) => s.muteAllNotificationSounds);

  const badgeUnreadIndicator = useUserPreferencesStore((s) => s.badgeUnreadIndicator);
  const badgeMentionCount = useUserPreferencesStore((s) => s.badgeMentionCount);
  const badgeHighlightChannels = useUserPreferencesStore((s) => s.badgeHighlightChannels);

  const emailCommunication = useUserPreferencesStore((s) => s.emailCommunication);
  const emailSocial = useUserPreferencesStore((s) => s.emailSocial);
  const emailUpdates = useUserPreferencesStore((s) => s.emailUpdates);
  const emailTips = useUserPreferencesStore((s) => s.emailTips);
  const emailRecommendations = useUserPreferencesStore((s) => s.emailRecommendations);

  const quietHoursEnabled = useUserPreferencesStore((s) => s.quietHoursEnabled);
  const quietHoursStart = useUserPreferencesStore((s) => s.quietHoursStart);
  const quietHoursEnd = useUserPreferencesStore((s) => s.quietHoursEnd);
  const suppressNotificationsOnStream = useUserPreferencesStore((s) => s.suppressNotificationsOnStream);

  const setPreference = useUserPreferencesStore((s) => s.setPreference);
  const unsubscribeAllMarketingEmails = useUserPreferencesStore((s) => s.unsubscribeAllMarketingEmails);

  const handleDesktopToggle = async (checked: boolean) => {
    setPreference('desktopNotificationsEnabled', checked);
    if (checked && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Non-critical in environments where Notification permission prompt fails
        }
      }
    }
  };

  const handleSoundVolumeChange = (pct: number) => {
    const normalized = Math.max(0, Math.min(1, pct / 100));
    setSoundEffectVolume(normalized);
    try {
      const audioMgr = AudioManager.getInstance() as { setSoundEffectVolume?: (v: number) => void };
      audioMgr.setSoundEffectVolume?.(normalized);
    } catch {
      // Safe fallback in test environment
    }
  };

  const handleTestSound = () => {
    try {
      const audioMgr = AudioManager.getInstance() as { playMessageSound?: () => void };
      audioMgr.playMessageSound?.();
    } catch {
      // Safe fallback
    }
    addToast(t('notifications.sounds.previewPlayedToast'), 'info');
  };

  const handleUnsubscribeMarketing = () => {
    unsubscribeAllMarketingEmails();
    addToast(t('notifications.email.unsubscribedToast'), 'success');
  };

  const subsections: SubsectionTabItem[] = [
    { id: 'overview', title: t('notifications.subsections.overview') },
    { id: 'sounds', title: t('notifications.subsections.sounds') },
    { id: 'badges', title: t('notifications.subsections.badges') },
    { id: 'email', title: t('notifications.subsections.email') },
    { id: 'advanced', title: t('notifications.subsections.advanced') },
  ];

  return (
    <div className="space-y-6">
      <SettingsHubHeader
        categoryLabel={t('hub.categories.notifications')}
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        subsections={subsections}
        activeSubsection={currentSection}
        onSelectSubsection={(id) => handleSelectSection(id as NotificationsSubsection)}
      />

      {currentSection === 'overview' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('notifications.overview.deliveryHeading')}
            description={t('notifications.overview.deliveryDescription')}
          >
            <SettingsToggleItem
              heading={t('notifications.overview.desktop.title')}
              description={t('notifications.overview.desktop.description')}
              checked={desktopNotificationsEnabled}
              onChange={handleDesktopToggle}
            />
            <SettingsToggleItem
              heading={t('notifications.overview.taskbarFlash.title')}
              description={t('notifications.overview.taskbarFlash.description')}
              checked={taskbarFlashEnabled}
              onChange={(val) => setPreference('taskbarFlashEnabled', val)}
            />
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('notifications.overview.eventsHeading')}
            description={t('notifications.overview.eventsDescription')}
          >
            <SettingsToggleItem
              heading={t('notifications.overview.friendOnline.title')}
              description={t('notifications.overview.friendOnline.description')}
              checked={notifyFriendOnline}
              onChange={(val) => setPreference('notifyFriendOnline', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.overview.friendProfile.title')}
              description={t('notifications.overview.friendProfile.description')}
              checked={notifyFriendProfileUpdate}
              onChange={(val) => setPreference('notifyFriendProfileUpdate', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.overview.spaceEvents.title')}
              description={t('notifications.overview.spaceEvents.description')}
              checked={notifySpaceEvents}
              onChange={(val) => setPreference('notifySpaceEvents', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.overview.reactions.title')}
              description={t('notifications.overview.reactions.description')}
              checked={notifyMessageReactions}
              onChange={(val) => setPreference('notifyMessageReactions', val)}
            />
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-txt-primary">
                  {t('notifications.overview.reactionScope.label')}
                </div>
                <p className="text-xs text-txt-tertiary mt-0.5">
                  {t('notifications.overview.reactionScope.description')}
                </p>
              </div>
              <select
                value={reactionNotificationScope}
                disabled={!notifyMessageReactions}
                onChange={(e) =>
                  setPreference(
                    'reactionNotificationScope',
                    e.target.value as ReactionNotificationScope,
                  )
                }
                className="input-standard w-auto min-w-[210px] text-xs disabled:opacity-40"
              >
                <option value="all">{t('notifications.overview.reactionScope.all')}</option>
                <option value="dms_and_mentions">
                  {t('notifications.overview.reactionScope.dmsAndMentions')}
                </option>
                <option value="none">{t('notifications.overview.reactionScope.none')}</option>
              </select>
            </div>
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'sounds' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('notifications.sounds.volumeHeading')}
            description={t('notifications.sounds.volumeDescription')}
          >
            <SettingsToggleItem
              heading={t('notifications.sounds.muteAll.title')}
              description={t('notifications.sounds.muteAll.description')}
              checked={muteAllNotificationSounds}
              onChange={(val) => {
                setPreference('muteAllNotificationSounds', val);
                if (val) {
                  handleSoundVolumeChange(0);
                } else if (soundEffectVolume === 0) {
                  handleSoundVolumeChange(70);
                }
              }}
            />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-txt-primary">
                  {t('notifications.sounds.volumeSliderLabel')}
                </span>
                <span className="text-xs text-txt-tertiary tabular-nums">
                  {Math.round(soundEffectVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                disabled={muteAllNotificationSounds}
                value={Math.round(soundEffectVolume * 100)}
                onChange={(e) => handleSoundVolumeChange(Number(e.target.value))}
                className="w-full accent-accent-mint cursor-pointer disabled:opacity-40"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleTestSound}
                  disabled={muteAllNotificationSounds}
                  className="btn-secondary text-xs disabled:opacity-40"
                >
                  {t('notifications.sounds.previewButton')}
                </button>
              </div>
            </div>
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('notifications.sounds.eventsHeading')}
            description={t('notifications.sounds.eventsDescription')}
          >
            <SettingsToggleItem
              heading={t('notifications.sounds.newMessage.title')}
              description={t('notifications.sounds.newMessage.description')}
              checked={soundNewMessage}
              disabled={muteAllNotificationSounds}
              onChange={(val) => setPreference('soundNewMessage', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.sounds.currentChannel.title')}
              description={t('notifications.sounds.currentChannel.description')}
              checked={messageSoundAllChannels}
              disabled={muteAllNotificationSounds}
              onChange={setMessageSoundAllChannels}
            />
            <SettingsToggleItem
              heading={t('notifications.sounds.incomingCall.title')}
              description={t('notifications.sounds.incomingCall.description')}
              checked={soundIncomingCall}
              disabled={muteAllNotificationSounds}
              onChange={(val) => setPreference('soundIncomingCall', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.sounds.voiceJoinLeave.title')}
              description={t('notifications.sounds.voiceJoinLeave.description')}
              checked={soundVoiceJoinLeave}
              disabled={muteAllNotificationSounds}
              onChange={(val) => setPreference('soundVoiceJoinLeave', val)}
            />
          </SettingsCardSection>

          {onNavigateToSection && (
            <SettingsRelatedShortcut
              heading={t('notifications.sounds.related.heading')}
              description={t('notifications.sounds.related.description')}
              actionText={t('notifications.sounds.related.action')}
              onClick={() => onNavigateToSection('experience', 'voice-video')}
            />
          )}
        </div>
      )}

      {currentSection === 'badges' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('notifications.badges.heading')}
            description={t('notifications.badges.description')}
          >
            <SettingsToggleItem
              heading={t('notifications.badges.unreadIndicator.title')}
              description={t('notifications.badges.unreadIndicator.description')}
              checked={badgeUnreadIndicator}
              onChange={(val) => setPreference('badgeUnreadIndicator', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.badges.mentionCount.title')}
              description={t('notifications.badges.mentionCount.description')}
              checked={badgeMentionCount}
              onChange={(val) => setPreference('badgeMentionCount', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.badges.highlightChannels.title')}
              description={t('notifications.badges.highlightChannels.description')}
              checked={badgeHighlightChannels}
              onChange={(val) => setPreference('badgeHighlightChannels', val)}
            />
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'email' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('notifications.email.heading')}
            description={t('notifications.email.description')}
          >
            <SettingsToggleItem
              heading={t('notifications.email.communication.title')}
              description={t('notifications.email.communication.description')}
              checked={emailCommunication}
              onChange={(val) => setPreference('emailCommunication', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.email.social.title')}
              description={t('notifications.email.social.description')}
              checked={emailSocial}
              onChange={(val) => setPreference('emailSocial', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.email.updates.title')}
              description={t('notifications.email.updates.description')}
              checked={emailUpdates}
              onChange={(val) => setPreference('emailUpdates', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.email.tips.title')}
              description={t('notifications.email.tips.description')}
              checked={emailTips}
              onChange={(val) => setPreference('emailTips', val)}
            />
            <SettingsToggleItem
              heading={t('notifications.email.recommendations.title')}
              description={t('notifications.email.recommendations.description')}
              checked={emailRecommendations}
              onChange={(val) => setPreference('emailRecommendations', val)}
            />
            <div className="p-4 flex items-center justify-between gap-4 bg-surface-base/30">
              <div>
                <div className="text-xs font-semibold text-txt-primary">
                  {t('notifications.email.unsubscribeTitle')}
                </div>
                <p className="text-xs text-txt-tertiary mt-0.5">
                  {t('notifications.email.unsubscribeDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleUnsubscribeMarketing}
                disabled={!emailUpdates && !emailTips && !emailRecommendations}
                className="btn-secondary text-xs shrink-0 disabled:opacity-40"
              >
                {t('notifications.email.unsubscribeButton')}
              </button>
            </div>
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'advanced' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('notifications.advanced.heading')}
            description={t('notifications.advanced.description')}
          >
            <SettingsToggleItem
              heading={t('notifications.advanced.quietHours.title')}
              description={t('notifications.advanced.quietHours.description')}
              checked={quietHoursEnabled}
              onChange={(val) => setPreference('quietHoursEnabled', val)}
            />
            {quietHoursEnabled && (
              <div className="p-4 flex flex-wrap items-center gap-4 bg-surface-base/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-txt-secondary">
                    {t('notifications.advanced.quietHours.startLabel')}
                  </span>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setPreference('quietHoursStart', e.target.value)}
                    className="input-standard w-auto text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-txt-secondary">
                    {t('notifications.advanced.quietHours.endLabel')}
                  </span>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setPreference('quietHoursEnd', e.target.value)}
                    className="input-standard w-auto text-xs"
                  />
                </div>
              </div>
            )}
            <SettingsToggleItem
              heading={t('notifications.advanced.suppressOnStream.title')}
              description={t('notifications.advanced.suppressOnStream.description')}
              checked={suppressNotificationsOnStream}
              onChange={(val) => setPreference('suppressNotificationsOnStream', val)}
            />
          </SettingsCardSection>
        </div>
      )}
    </div>
  );
}
