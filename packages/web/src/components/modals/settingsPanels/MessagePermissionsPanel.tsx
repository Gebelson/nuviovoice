import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { useWinkStore } from '../../../stores/winkStore';
import { useFriendRequestNotificationStore } from '../../../stores/friendRequestNotificationStore';
import { useSocialStore } from '../../../stores/socialStore';
import {
  useUserPreferencesStore,
  type ContentFilterAction,
  type SpamFilterMode,
  type GameDmDisplayMode,
} from '../../../stores/userPreferencesStore';
import { api } from '../../../api/client';
import { Avatar } from '../../ui/Avatar';
import { resolveUploadUrl } from '../../../utils/assetUrls';
import { formatRemainingTime } from '../../chat/winkMuteMenuItems';
import {
  SettingsHubHeader,
  SettingsCardSection,
  SettingsToggleItem,
  SettingsRadioOption,
  SettingsRelatedShortcut,
  type SubsectionTabItem,
} from './_shared/SettingsPrimitives';

export type MessagePermissionsSubsection =
  | 'content-filters'
  | 'spam-filters'
  | 'direct-messages'
  | 'friend-requests'
  | 'connected-games'
  | 'ignore-block';

interface MessagePermissionsPanelProps {
  activeSection?: MessagePermissionsSubsection;
  onSelectSection?: (section: MessagePermissionsSubsection) => void;
  onNavigateToSection?: (category: string, section: string) => void;
}

const FILTER_ACTION_KEYS: Array<{
  value: ContentFilterAction;
  labelKey:
    | 'messagePermissions.contentFilters.actions.show'
    | 'messagePermissions.contentFilters.actions.blur'
    | 'messagePermissions.contentFilters.actions.block';
}> = [
  { value: 'show', labelKey: 'messagePermissions.contentFilters.actions.show' },
  { value: 'blur', labelKey: 'messagePermissions.contentFilters.actions.blur' },
  { value: 'block', labelKey: 'messagePermissions.contentFilters.actions.block' },
];

export function MessagePermissionsPanel({
  activeSection = 'content-filters',
  onSelectSection,
  onNavigateToSection,
}: MessagePermissionsPanelProps) {
  const { t } = useTranslation(['settings', 'common']);
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const friends = useSocialStore((s) => s.friends);

  const [internalSection, setInternalSection] = useState<MessagePermissionsSubsection>(activeSection);
  useEffect(() => {
    setInternalSection(activeSection);
  }, [activeSection]);

  const currentSection = onSelectSection ? activeSection : internalSection;
  const handleSelectSection = (sec: MessagePermissionsSubsection) => {
    setInternalSection(sec);
    onSelectSection?.(sec);
  };

  // Preferences state
  const sensitiveMediaFriendsDm = useUserPreferencesStore((s) => s.sensitiveMediaFriendsDm);
  const sensitiveMediaStrangersDm = useUserPreferencesStore((s) => s.sensitiveMediaStrangersDm);
  const sensitiveMediaSpaceChannels = useUserPreferencesStore((s) => s.sensitiveMediaSpaceChannels);
  const graphicMediaFriendsDm = useUserPreferencesStore((s) => s.graphicMediaFriendsDm);
  const graphicMediaStrangersDm = useUserPreferencesStore((s) => s.graphicMediaStrangersDm);
  const graphicMediaSpaceChannels = useUserPreferencesStore((s) => s.graphicMediaSpaceChannels);
  const allowAgeRestrictedSpaces = useUserPreferencesStore((s) => s.allowAgeRestrictedSpaces);
  const spamFilterMode = useUserPreferencesStore((s) => s.spamFilterMode);
  const defaultAllowSpaceMemberDms = useUserPreferencesStore((s) => s.defaultAllowSpaceMemberDms);
  const enableMessageRequests = useUserPreferencesStore((s) => s.enableMessageRequests);
  const friendRequestsEveryone = useUserPreferencesStore((s) => s.friendRequestsEveryone);
  const friendRequestsMutualFriends = useUserPreferencesStore((s) => s.friendRequestsMutualFriends);
  const friendRequestsSpaceMembers = useUserPreferencesStore((s) => s.friendRequestsSpaceMembers);
  const showFriendRequestCustomMessage = useUserPreferencesStore((s) => s.showFriendRequestCustomMessage);
  const allowConnectedGameFriendDms = useUserPreferencesStore((s) => s.allowConnectedGameFriendDms);
  const allowConnectedGameMatchInvites = useUserPreferencesStore((s) => s.allowConnectedGameMatchInvites);
  const gameDmDisplayMode = useUserPreferencesStore((s) => s.gameDmDisplayMode);
  const blockedAccounts = useUserPreferencesStore((s) => s.blockedAccounts);
  const ignoredAccounts = useUserPreferencesStore((s) => s.ignoredAccounts);
  const setPreference = useUserPreferencesStore((s) => s.setPreference);
  const addBlockedAccount = useUserPreferencesStore((s) => s.addBlockedAccount);
  const removeBlockedAccount = useUserPreferencesStore((s) => s.removeBlockedAccount);
  const addIgnoredAccount = useUserPreferencesStore((s) => s.addIgnoredAccount);
  const removeIgnoredAccount = useUserPreferencesStore((s) => s.removeIgnoredAccount);

  // Winks store + backend receiveWinks
  const winkSettings = useWinkStore((s) => s.settings);
  const updateWinkSettings = useWinkStore((s) => s.updateSettings);
  const contactMutes = useWinkStore((s) => s.contactMutes);
  const fetchMutes = useWinkStore((s) => s.fetchMutes);
  const removeContactMute = useWinkStore((s) => s.removeContactMute);

  useEffect(() => {
    void fetchMutes();
  }, [fetchMutes]);

  const mutedContactsList = React.useMemo(() => {
    const now = Date.now();
    return Object.values(contactMutes).filter(m => {
      if (m.muteType === 'indefinite') return true;
      return m.expiresAt ? m.expiresAt > now : false;
    });
  }, [contactMutes]);

  const [receiveWinks, setReceiveWinks] = useState<boolean>(user?.receiveWinks ?? true);
  const [savingWinks, setSavingWinks] = useState(false);

  useEffect(() => {
    if (user) {
      setReceiveWinks(user.receiveWinks ?? true);
    }
  }, [user?.receiveWinks]);

  const handleToggleReceiveWinks = async (checked: boolean) => {
    if (savingWinks) return;
    const prev = receiveWinks;
    setReceiveWinks(checked);
    setSavingWinks(true);
    try {
      const updated = await api.users.update({ receiveWinks: checked });
      useAuthStore.setState({ user: updated });
      addToast(t('privacy.feedback.success'), 'success');
    } catch {
      setReceiveWinks(prev);
      addToast(t('privacy.feedback.error'), 'warning');
    } finally {
      setSavingWinks(false);
    }
  };

  // Friend request notifications store
  const floatingEnabled = useFriendRequestNotificationStore((s) => s.floatingEnabled);
  const soundEnabled = useFriendRequestNotificationStore((s) => s.soundEnabled);
  const hideOnScreenShare = useFriendRequestNotificationStore((s) => s.hideOnScreenShare);
  const setFloatingEnabled = useFriendRequestNotificationStore((s) => s.setFloatingEnabled);
  const setSoundEnabled = useFriendRequestNotificationStore((s) => s.setSoundEnabled);
  const setHideOnScreenShare = useFriendRequestNotificationStore((s) => s.setHideOnScreenShare);

  // Quick block/ignore input state
  const [blockHandleInput, setBlockHandleInput] = useState('');
  const [ignoreHandleInput, setIgnoreHandleInput] = useState('');

  const handleAddBlocked = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = blockHandleInput.trim().replace(/^@/, '');
    if (!handle) return;
    const matchedFriend = friends.find(
      (f) => f.username.toLowerCase() === handle.toLowerCase(),
    );
    addBlockedAccount({
      id: matchedFriend?.id || `blocked-${handle.toLowerCase()}`,
      username: matchedFriend?.username || handle,
      displayName: matchedFriend?.displayName || handle,
      avatar: matchedFriend?.avatar || null,
    });
    setBlockHandleInput('');
  };

  const handleAddIgnored = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = ignoreHandleInput.trim().replace(/^@/, '');
    if (!handle) return;
    const matchedFriend = friends.find(
      (f) => f.username.toLowerCase() === handle.toLowerCase(),
    );
    addIgnoredAccount({
      id: matchedFriend?.id || `ignored-${handle.toLowerCase()}`,
      username: matchedFriend?.username || handle,
      displayName: matchedFriend?.displayName || handle,
      avatar: matchedFriend?.avatar || null,
    });
    setIgnoreHandleInput('');
  };

  const subsections: SubsectionTabItem[] = [
    { id: 'content-filters', title: t('messagePermissions.subsections.contentFilters') },
    { id: 'spam-filters', title: t('messagePermissions.subsections.spamFilters') },
    { id: 'direct-messages', title: t('messagePermissions.subsections.directMessages') },
    { id: 'friend-requests', title: t('messagePermissions.subsections.friendRequests') },
    { id: 'connected-games', title: t('messagePermissions.subsections.connectedGames') },
    {
      id: 'ignore-block',
      title: t('messagePermissions.subsections.ignoreBlock'),
      badge:
        blockedAccounts.length + ignoredAccounts.length + mutedContactsList.length > 0
          ? String(blockedAccounts.length + ignoredAccounts.length + mutedContactsList.length)
          : undefined,
    },
  ];

  const renderContextFilterRow = (
    label: string,
    description: string,
    currentValue: ContentFilterAction,
    onSelect: (val: ContentFilterAction) => void,
  ) => (
    <div className="p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-txt-primary">{label}</div>
        <p className="text-xs text-txt-tertiary mt-0.5">{description}</p>
      </div>
      <div className="inline-flex rounded-lg bg-surface-base/70 border border-white/[0.06] p-0.5">
        {FILTER_ACTION_KEYS.map((action) => {
          const active = currentValue === action.value;
          return (
            <button
              key={action.value}
              type="button"
              onClick={() => onSelect(action.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                active
                  ? 'bg-accent-primary/20 text-txt-primary border border-accent-primary/30'
                  : 'text-txt-tertiary hover:text-txt-primary border border-transparent'
              }`}
            >
              {t(action.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const spamOptions: Array<{
    value: SpamFilterMode;
    titleKey:
      | 'messagePermissions.spamFilters.options.all.title'
      | 'messagePermissions.spamFilters.options.nonFriends.title'
      | 'messagePermissions.spamFilters.options.off.title';
    descKey:
      | 'messagePermissions.spamFilters.options.all.description'
      | 'messagePermissions.spamFilters.options.nonFriends.description'
      | 'messagePermissions.spamFilters.options.off.description';
    recommended?: boolean;
  }> = [
    {
      value: 'all',
      titleKey: 'messagePermissions.spamFilters.options.all.title',
      descKey: 'messagePermissions.spamFilters.options.all.description',
    },
    {
      value: 'non_friends',
      titleKey: 'messagePermissions.spamFilters.options.nonFriends.title',
      descKey: 'messagePermissions.spamFilters.options.nonFriends.description',
      recommended: true,
    },
    {
      value: 'off',
      titleKey: 'messagePermissions.spamFilters.options.off.title',
      descKey: 'messagePermissions.spamFilters.options.off.description',
    },
  ];

  const gameDmOptions: Array<{
    value: GameDmDisplayMode;
    titleKey:
      | 'messagePermissions.connectedGames.displayModes.all.title'
      | 'messagePermissions.connectedGames.displayModes.sameGame.title'
      | 'messagePermissions.connectedGames.displayModes.none.title';
    descKey:
      | 'messagePermissions.connectedGames.displayModes.all.description'
      | 'messagePermissions.connectedGames.displayModes.sameGame.description'
      | 'messagePermissions.connectedGames.displayModes.none.description';
  }> = [
    {
      value: 'all',
      titleKey: 'messagePermissions.connectedGames.displayModes.all.title',
      descKey: 'messagePermissions.connectedGames.displayModes.all.description',
    },
    {
      value: 'same_game',
      titleKey: 'messagePermissions.connectedGames.displayModes.sameGame.title',
      descKey: 'messagePermissions.connectedGames.displayModes.sameGame.description',
    },
    {
      value: 'none',
      titleKey: 'messagePermissions.connectedGames.displayModes.none.title',
      descKey: 'messagePermissions.connectedGames.displayModes.none.description',
    },
  ];

  return (
    <div className="space-y-6">
      <SettingsHubHeader
        categoryLabel={t('hub.categories.messagePermissions')}
        title={t('messagePermissions.title')}
        subtitle={t('messagePermissions.subtitle')}
        subsections={subsections}
        activeSubsection={currentSection}
        onSelectSubsection={(id) => handleSelectSection(id as MessagePermissionsSubsection)}
      />

      {currentSection === 'content-filters' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('messagePermissions.contentFilters.sensitiveHeading')}
            description={t('messagePermissions.contentFilters.sensitiveDescription')}
          >
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.friendsDm.title'),
              t('messagePermissions.contentFilters.contexts.friendsDm.description'),
              sensitiveMediaFriendsDm,
              (val) => setPreference('sensitiveMediaFriendsDm', val),
            )}
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.strangersDm.title'),
              t('messagePermissions.contentFilters.contexts.strangersDm.description'),
              sensitiveMediaStrangersDm,
              (val) => setPreference('sensitiveMediaStrangersDm', val),
            )}
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.spaceChannels.title'),
              t('messagePermissions.contentFilters.contexts.spaceChannels.description'),
              sensitiveMediaSpaceChannels,
              (val) => setPreference('sensitiveMediaSpaceChannels', val),
            )}
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('messagePermissions.contentFilters.graphicHeading')}
            description={t('messagePermissions.contentFilters.graphicDescription')}
          >
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.friendsDm.title'),
              t('messagePermissions.contentFilters.contexts.friendsDm.description'),
              graphicMediaFriendsDm,
              (val) => setPreference('graphicMediaFriendsDm', val),
            )}
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.strangersDm.title'),
              t('messagePermissions.contentFilters.contexts.strangersDm.description'),
              graphicMediaStrangersDm,
              (val) => setPreference('graphicMediaStrangersDm', val),
            )}
            {renderContextFilterRow(
              t('messagePermissions.contentFilters.contexts.spaceChannels.title'),
              t('messagePermissions.contentFilters.contexts.spaceChannels.description'),
              graphicMediaSpaceChannels,
              (val) => setPreference('graphicMediaSpaceChannels', val),
            )}
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('messagePermissions.contentFilters.ageRestriction.heading')}
          >
            <SettingsToggleItem
              heading={t('messagePermissions.contentFilters.ageRestriction.title')}
              description={t('messagePermissions.contentFilters.ageRestriction.description')}
              checked={allowAgeRestrictedSpaces}
              onChange={(val) => setPreference('allowAgeRestrictedSpaces', val)}
            />
          </SettingsCardSection>

          <SettingsRelatedShortcut
            heading={t('messagePermissions.contentFilters.related.heading')}
            description={t('messagePermissions.contentFilters.related.description')}
            actionText={t('messagePermissions.contentFilters.related.action')}
            onClick={() => handleSelectSection('spam-filters')}
          />
        </div>
      )}

      {currentSection === 'spam-filters' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('messagePermissions.spamFilters.heading')}
            description={t('messagePermissions.spamFilters.description')}
          >
            {spamOptions.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={spamFilterMode === opt.value}
                onSelect={() => setPreference('spamFilterMode', opt.value)}
                heading={t(opt.titleKey)}
                description={t(opt.descKey)}
                badgeText={opt.recommended ? t('messagePermissions.spamFilters.recommendedBadge') : undefined}
              />
            ))}
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'direct-messages' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('messagePermissions.directMessages.heading')}
            description={t('messagePermissions.directMessages.description')}
          >
            <SettingsToggleItem
              heading={t('messagePermissions.directMessages.allowSpaceDms.title')}
              description={t('messagePermissions.directMessages.allowSpaceDms.description')}
              checked={defaultAllowSpaceMemberDms}
              onChange={(val) => setPreference('defaultAllowSpaceMemberDms', val)}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.directMessages.messageRequests.title')}
              description={t('messagePermissions.directMessages.messageRequests.description')}
              checked={enableMessageRequests}
              onChange={(val) => setPreference('enableMessageRequests', val)}
            />
          </SettingsCardSection>

          {/* Winks & Interactive Animations */}
          <SettingsCardSection
            heading={t('privacy.winks.sectionTitle')}
            description={t('privacy.winks.description')}
          >
            <SettingsToggleItem
              heading={t('privacy.winks.label')}
              description={t('privacy.winks.description')}
              checked={receiveWinks}
              disabled={savingWinks}
              onChange={handleToggleReceiveWinks}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.directMessages.winksAutoplay.title')}
              description={t('messagePermissions.directMessages.winksAutoplay.description')}
              checked={winkSettings.autoplay}
              onChange={(val) => updateWinkSettings({ autoplay: val })}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.directMessages.winksAudio.title')}
              description={t('messagePermissions.directMessages.winksAudio.description')}
              checked={winkSettings.playAudio}
              onChange={(val) => updateWinkSettings({ playAudio: val })}
            />
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-txt-primary">{t('messagePermissions.directMessages.winksVolume')}</span>
                <span className="text-xs text-txt-tertiary tabular-nums">
                  {Math.round(winkSettings.volume)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(winkSettings.volume)}
                onChange={(e) => updateWinkSettings({ volume: Number(e.target.value) })}
                className="w-full accent-accent-mint cursor-pointer"
              />
            </div>
            <SettingsToggleItem
              heading={t('messagePermissions.directMessages.winksReduceMotion.title')}
              description={t('messagePermissions.directMessages.winksReduceMotion.description')}
              checked={winkSettings.reduceMotion}
              onChange={(val) => updateWinkSettings({ reduceMotion: val })}
            />
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'friend-requests' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('messagePermissions.friendRequests.whoCanSendHeading')}
            description={t('messagePermissions.friendRequests.whoCanSendDescription')}
          >
            <SettingsToggleItem
              heading={t('messagePermissions.friendRequests.everyone.title')}
              description={t('messagePermissions.friendRequests.everyone.description')}
              checked={friendRequestsEveryone}
              onChange={(val) => {
                setPreference('friendRequestsEveryone', val);
                if (val) {
                  setPreference('friendRequestsMutualFriends', true);
                  setPreference('friendRequestsSpaceMembers', true);
                }
              }}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.friendRequests.mutualFriends.title')}
              description={t('messagePermissions.friendRequests.mutualFriends.description')}
              checked={friendRequestsEveryone || friendRequestsMutualFriends}
              onChange={(val) => {
                setPreference('friendRequestsMutualFriends', val);
                if (!val && friendRequestsEveryone) {
                  setPreference('friendRequestsEveryone', false);
                }
              }}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.friendRequests.spaceMembers.title')}
              description={t('messagePermissions.friendRequests.spaceMembers.description')}
              checked={friendRequestsEveryone || friendRequestsSpaceMembers}
              onChange={(val) => {
                setPreference('friendRequestsSpaceMembers', val);
                if (!val && friendRequestsEveryone) {
                  setPreference('friendRequestsEveryone', false);
                }
              }}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.friendRequests.customMessages.title')}
              description={t('messagePermissions.friendRequests.customMessages.description')}
              checked={showFriendRequestCustomMessage}
              onChange={(val) => setPreference('showFriendRequestCustomMessage', val)}
            />
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('privacy.friendNotifications.sectionTitle')}
          >
            <SettingsToggleItem
              heading={t('privacy.friendNotifications.floatingLabel')}
              description={t('privacy.friendNotifications.floatingDescription')}
              checked={floatingEnabled}
              onChange={setFloatingEnabled}
            />
            <SettingsToggleItem
              heading={t('privacy.friendNotifications.soundLabel')}
              description={t('privacy.friendNotifications.soundDescription')}
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />
            <SettingsToggleItem
              heading={t('privacy.friendNotifications.screenShareLabel')}
              description={t('privacy.friendNotifications.screenShareDescription')}
              checked={hideOnScreenShare}
              onChange={setHideOnScreenShare}
            />
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'connected-games' && (
        <div className="space-y-6">
          <SettingsCardSection
            heading={t('messagePermissions.connectedGames.heading')}
            description={t('messagePermissions.connectedGames.description')}
          >
            <SettingsToggleItem
              heading={t('messagePermissions.connectedGames.allowFriendDms.title')}
              description={t('messagePermissions.connectedGames.allowFriendDms.description')}
              checked={allowConnectedGameFriendDms}
              onChange={(val) => setPreference('allowConnectedGameFriendDms', val)}
            />
            <SettingsToggleItem
              heading={t('messagePermissions.connectedGames.allowMatchInvites.title')}
              description={t('messagePermissions.connectedGames.allowMatchInvites.description')}
              checked={allowConnectedGameMatchInvites}
              onChange={(val) => setPreference('allowConnectedGameMatchInvites', val)}
            />
          </SettingsCardSection>

          <SettingsCardSection
            heading={t('messagePermissions.connectedGames.displayModesHeading')}
            description={t('messagePermissions.connectedGames.displayModesDescription')}
          >
            {gameDmOptions.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={gameDmDisplayMode === opt.value}
                onSelect={() => setPreference('gameDmDisplayMode', opt.value)}
                heading={t(opt.titleKey)}
                description={t(opt.descKey)}
              />
            ))}
          </SettingsCardSection>

          {onNavigateToSection && (
            <SettingsRelatedShortcut
              heading={t('messagePermissions.connectedGames.related.heading')}
              description={t('messagePermissions.connectedGames.related.description')}
              actionText={t('messagePermissions.connectedGames.related.action')}
              onClick={() => onNavigateToSection('games-apps', 'connected-apps')}
            />
          )}
        </div>
      )}

      {currentSection === 'ignore-block' && (
        <div className="space-y-6">
          {/* Blocked Accounts */}
          <SettingsCardSection
            heading={t('messagePermissions.ignoreBlock.blockedHeading')}
            description={t('messagePermissions.ignoreBlock.blockedDescription')}
          >
            <form onSubmit={handleAddBlocked} className="p-4 flex items-center gap-2">
              <input
                type="text"
                value={blockHandleInput}
                onChange={(e) => setBlockHandleInput(e.target.value)}
                placeholder={t('messagePermissions.ignoreBlock.inputPlaceholder')}
                className="input-standard flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={!blockHandleInput.trim()}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                {t('messagePermissions.ignoreBlock.blockAction')}
              </button>
            </form>

            {blockedAccounts.length === 0 ? (
              <div className="p-4 text-xs text-txt-tertiary">
                {t('messagePermissions.ignoreBlock.blockedEmpty')}
              </div>
            ) : (
              blockedAccounts.map((acc) => (
                <div key={acc.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={resolveUploadUrl(acc.avatar)}
                      name={acc.displayName || acc.username}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-txt-primary truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-xs text-txt-tertiary font-mono truncate">
                        @{acc.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlockedAccount(acc.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-txt-primary transition-colors"
                  >
                    {t('messagePermissions.ignoreBlock.unblockAction')}
                  </button>
                </div>
              ))
            )}
          </SettingsCardSection>

          {/* Ignored Accounts */}
          <SettingsCardSection
            heading={t('messagePermissions.ignoreBlock.ignoredHeading')}
            description={t('messagePermissions.ignoreBlock.ignoredDescription')}
          >
            <form onSubmit={handleAddIgnored} className="p-4 flex items-center gap-2">
              <input
                type="text"
                value={ignoreHandleInput}
                onChange={(e) => setIgnoreHandleInput(e.target.value)}
                placeholder={t('messagePermissions.ignoreBlock.inputPlaceholder')}
                className="input-standard flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={!ignoreHandleInput.trim()}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                {t('messagePermissions.ignoreBlock.ignoreAction')}
              </button>
            </form>

            {ignoredAccounts.length === 0 ? (
              <div className="p-4 text-xs text-txt-tertiary">
                {t('messagePermissions.ignoreBlock.ignoredEmpty')}
              </div>
            ) : (
              ignoredAccounts.map((acc) => (
                <div key={acc.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={resolveUploadUrl(acc.avatar)}
                      name={acc.displayName || acc.username}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-txt-primary truncate">
                        {acc.displayName}
                      </div>
                      <div className="text-xs text-txt-tertiary font-mono truncate">
                        @{acc.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIgnoredAccount(acc.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-txt-primary transition-colors"
                  >
                    {t('messagePermissions.ignoreBlock.unignoreAction')}
                  </button>
                </div>
              ))
            )}
          </SettingsCardSection>

          {/* Muted Winks */}
          <SettingsCardSection
            heading={t('messagePermissions.ignoreBlock.mutedWinksHeading')}
            description={t('messagePermissions.ignoreBlock.mutedWinksDescription')}
          >
            {mutedContactsList.length === 0 ? (
              <div className="p-4 text-xs text-txt-tertiary">
                {t('messagePermissions.ignoreBlock.mutedWinksEmpty')}
              </div>
            ) : (
              mutedContactsList.map((mute) => {
                const target = mute.targetUser || mute.user;
                const name = target?.displayName || target?.username || mute.targetUserId;
                const username = target?.username ? `@${target.username}` : mute.targetUserId;
                const remainingText = formatRemainingTime(mute.expiresAt);

                return (
                  <div key={mute.targetUserId} className="p-3.5 flex items-center justify-between gap-3 border-b border-white/[0.04] last:border-b-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={resolveUploadUrl(target?.avatar ?? null)}
                        name={name}
                        size={32}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-txt-primary truncate">
                          {name}
                        </div>
                        <div className="text-xs text-txt-tertiary font-mono truncate">
                          {username}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-txt-secondary border border-white/[0.06]">
                        {remainingText}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeContactMute(mute.targetUserId)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-txt-primary transition-colors"
                      >
                        {t('messagePermissions.ignoreBlock.unmuteWinksAction')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </SettingsCardSection>
        </div>
      )}
    </div>
  );
}
