import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityStore } from '../../../stores/activityStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import {
  useUserPreferencesStore,
  type ActivityShareScope,
  type ActivityJoinPermission,
  type OverlayCorner,
} from '../../../stores/userPreferencesStore';
import { StreamerChannelsSection } from './StreamerChannelsSection';
import { ConnectedInstances } from '../ConnectedInstances';
import { Toggle } from '../../ui/Toggle';
import {
  SettingsHubHeader,
  SettingsCardSection,
  SettingsToggleItem,
  SettingsRadioOption,
  SettingsInfoCallout,
  type SubsectionTabItem,
} from './_shared/SettingsPrimitives';

export type GamesAppsSubsection =
  | 'registered-games'
  | 'activity-privacy'
  | 'game-overlay'
  | 'connected-apps';

interface GamesAppsPanelProps {
  activeSection?: GamesAppsSubsection;
  onSelectSection?: (section: GamesAppsSubsection) => void;
}

export function GamesAppsPanel({
  activeSection = 'registered-games',
  onSelectSection,
}: GamesAppsPanelProps) {
  const { t } = useTranslation(['settings', 'common']);

  const [internalSection, setInternalSection] = useState<GamesAppsSubsection>(activeSection);
  useEffect(() => {
    setInternalSection(activeSection);
  }, [activeSection]);

  const currentSection = onSelectSection ? activeSection : internalSection;
  const handleSelectSection = (sec: GamesAppsSubsection) => {
    setInternalSection(sec);
    onSelectSection?.(sec);
  };

  // Real activity store state
  const showActivity = useActivityStore((s) => s.showActivity);
  const myActivities = useActivityStore((s) => s.myActivities);
  const setShowActivity = useActivityStore((s) => s.setShowActivity);

  // Real voice store PiP / floating window state
  const pipEnabled = useVoiceStore((s) => s.pipEnabled);
  const pipAlwaysOnTop = useVoiceStore((s) => s.pipAlwaysOnTop);
  const pipAutoOpenOnMinimize = useVoiceStore((s) => s.pipAutoOpenOnMinimize);
  const setPipEnabled = useVoiceStore((s) => s.setPipEnabled);
  const setPipAlwaysOnTop = useVoiceStore((s) => s.setPipAlwaysOnTop);
  const setPipAutoOpenOnMinimize = useVoiceStore((s) => s.setPipAutoOpenOnMinimize);

  // User preferences store
  const registeredGames = useUserPreferencesStore((s) => s.registeredGames);
  const shareActivityElapsed = useUserPreferencesStore((s) => s.shareActivityElapsed);
  const activityShareScope = useUserPreferencesStore((s) => s.activityShareScope);
  const activityJoinPermission = useUserPreferencesStore((s) => s.activityJoinPermission);
  const overlayEnabled = useUserPreferencesStore((s) => s.overlayEnabled);
  const overlayCorner = useUserPreferencesStore((s) => s.overlayCorner);
  const overlayOpacity = useUserPreferencesStore((s) => s.overlayOpacity);
  const overlayVoiceWidgetEnabled = useUserPreferencesStore((s) => s.overlayVoiceWidgetEnabled);
  const overlayShowSpeakingAvatars = useUserPreferencesStore((s) => s.overlayShowSpeakingAvatars);
  const overlayShowParticipantNames = useUserPreferencesStore((s) => s.overlayShowParticipantNames);
  const overlayShowTextNotifications = useUserPreferencesStore((s) => s.overlayShowTextNotifications);
  const authorizedApps = useUserPreferencesStore((s) => s.authorizedApps);

  const setPreference = useUserPreferencesStore((s) => s.setPreference);
  const addRegisteredGame = useUserPreferencesStore((s) => s.addRegisteredGame);
  const toggleRegisteredGameDetection = useUserPreferencesStore((s) => s.toggleRegisteredGameDetection);
  const toggleRegisteredGameOverlay = useUserPreferencesStore((s) => s.toggleRegisteredGameOverlay);
  const removeRegisteredGame = useUserPreferencesStore((s) => s.removeRegisteredGame);
  const revokeAuthorizedApp = useUserPreferencesStore((s) => s.revokeAuthorizedApp);

  const [newGameName, setNewGameName] = useState('');
  const [newGameExe, setNewGameExe] = useState('');

  const handleAddGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    addRegisteredGame(newGameName, newGameExe);
    setNewGameName('');
    setNewGameExe('');
  };

  const currentDetectedGame = myActivities && myActivities.length > 0 ? myActivities[0] : null;

  const subsections: SubsectionTabItem[] = [
    { id: 'registered-games', title: t('gamesApps.subsections.registeredGames') },
    { id: 'activity-privacy', title: t('gamesApps.subsections.activityPrivacy') },
    { id: 'game-overlay', title: t('gamesApps.subsections.gameOverlay') },
    { id: 'connected-apps', title: t('gamesApps.subsections.connectedApps') },
  ];

  const shareScopeOptions: Array<{
    value: ActivityShareScope;
    titleKey:
      | 'gamesApps.activityPrivacy.whereShare.allSpaces.title'
      | 'gamesApps.activityPrivacy.whereShare.smallSpaces.title'
      | 'gamesApps.activityPrivacy.whereShare.friendsOnly.title';
    descKey:
      | 'gamesApps.activityPrivacy.whereShare.allSpaces.description'
      | 'gamesApps.activityPrivacy.whereShare.smallSpaces.description'
      | 'gamesApps.activityPrivacy.whereShare.friendsOnly.description';
  }> = [
    {
      value: 'all_spaces_and_friends',
      titleKey: 'gamesApps.activityPrivacy.whereShare.allSpaces.title',
      descKey: 'gamesApps.activityPrivacy.whereShare.allSpaces.description',
    },
    {
      value: 'small_spaces_and_friends',
      titleKey: 'gamesApps.activityPrivacy.whereShare.smallSpaces.title',
      descKey: 'gamesApps.activityPrivacy.whereShare.smallSpaces.description',
    },
    {
      value: 'friends_only',
      titleKey: 'gamesApps.activityPrivacy.whereShare.friendsOnly.title',
      descKey: 'gamesApps.activityPrivacy.whereShare.friendsOnly.description',
    },
  ];

  const joinOptions: Array<{
    value: ActivityJoinPermission;
    titleKey:
      | 'gamesApps.activityPrivacy.joining.spaceAndFriends.title'
      | 'gamesApps.activityPrivacy.joining.friendsOnly.title'
      | 'gamesApps.activityPrivacy.joining.nobody.title';
    descKey:
      | 'gamesApps.activityPrivacy.joining.spaceAndFriends.description'
      | 'gamesApps.activityPrivacy.joining.friendsOnly.description'
      | 'gamesApps.activityPrivacy.joining.nobody.description';
  }> = [
    {
      value: 'friends_and_space_members',
      titleKey: 'gamesApps.activityPrivacy.joining.spaceAndFriends.title',
      descKey: 'gamesApps.activityPrivacy.joining.spaceAndFriends.description',
    },
    {
      value: 'friends_only',
      titleKey: 'gamesApps.activityPrivacy.joining.friendsOnly.title',
      descKey: 'gamesApps.activityPrivacy.joining.friendsOnly.description',
    },
    {
      value: 'nobody',
      titleKey: 'gamesApps.activityPrivacy.joining.nobody.title',
      descKey: 'gamesApps.activityPrivacy.joining.nobody.description',
    },
  ];

  const cornerOptions: Array<{
    value: OverlayCorner;
    labelKey:
      | 'gamesApps.gameOverlay.widgets.corners.topLeft'
      | 'gamesApps.gameOverlay.widgets.corners.topRight'
      | 'gamesApps.gameOverlay.widgets.corners.bottomLeft'
      | 'gamesApps.gameOverlay.widgets.corners.bottomRight';
  }> = [
    { value: 'top-left', labelKey: 'gamesApps.gameOverlay.widgets.corners.topLeft' },
    { value: 'top-right', labelKey: 'gamesApps.gameOverlay.widgets.corners.topRight' },
    { value: 'bottom-left', labelKey: 'gamesApps.gameOverlay.widgets.corners.bottomLeft' },
    { value: 'bottom-right', labelKey: 'gamesApps.gameOverlay.widgets.corners.bottomRight' },
  ];

  return (
    <div className="space-y-6">
      <SettingsHubHeader
        categoryLabel={t('hub.categories.gamesApps')}
        title={t('gamesApps.title')}
        subtitle={t('gamesApps.subtitle')}
        subsections={subsections}
        activeSubsection={currentSection}
        onSelectSubsection={(id) => handleSelectSection(id as GamesAppsSubsection)}
      />

      {currentSection === 'registered-games' && (
        <div className="space-y-6">
          {/* Jogo atual */}
          <SettingsCardSection
            heading={t('gamesApps.registeredGames.currentGameHeading')}
            description={t('gamesApps.registeredGames.currentGameDescription')}
          >
            <div className="p-4 flex items-center justify-between gap-4">
              {currentDetectedGame ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-mint/15 border border-accent-mint/30 flex items-center justify-center text-accent-mint">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-txt-primary">
                      {currentDetectedGame.name}
                    </div>
                    <div className="text-xs text-accent-mint">
                      {t('gamesApps.registeredGames.detectedStatus')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-txt-tertiary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt-primary">
                      {t('gamesApps.registeredGames.noCurrentGameTitle')}
                    </div>
                    <p className="text-xs text-txt-tertiary mt-0.5">
                      {t('gamesApps.registeredGames.noCurrentGameDescription')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SettingsCardSection>

          {/* Jogos adicionados */}
          <SettingsCardSection
            heading={t('gamesApps.registeredGames.addedGamesHeading')}
            description={t('gamesApps.registeredGames.addedGamesDescription')}
          >
            <form onSubmit={handleAddGame} className="p-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder={t('gamesApps.registeredGames.gameNamePlaceholder')}
                className="input-standard flex-1 min-w-[160px] text-xs"
              />
              <input
                type="text"
                value={newGameExe}
                onChange={(e) => setNewGameExe(e.target.value)}
                placeholder={t('gamesApps.registeredGames.exePlaceholder')}
                className="input-standard w-44 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={!newGameName.trim()}
                className="btn-primary text-xs disabled:opacity-40"
              >
                {t('gamesApps.registeredGames.addButton')}
              </button>
            </form>

            {registeredGames.length === 0 ? (
              <div className="p-4 text-xs text-txt-tertiary">
                {t('gamesApps.registeredGames.emptyList')}
              </div>
            ) : (
              registeredGames.map((game) => (
                <div key={game.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-txt-primary truncate">
                      {game.gameName}
                    </div>
                    <div className="text-xs text-txt-tertiary font-mono truncate">
                      {game.executablePath}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-txt-secondary cursor-pointer">
                      <Toggle
                        enabled={game.detectionEnabled}
                        onChange={() => toggleRegisteredGameDetection(game.id)}
                        ariaLabel={t('gamesApps.registeredGames.detectionToggle')}
                      />
                      <span>{t('gamesApps.registeredGames.detectionToggle')}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-txt-secondary cursor-pointer">
                      <Toggle
                        enabled={game.overlayEnabled}
                        onChange={() => toggleRegisteredGameOverlay(game.id)}
                        ariaLabel={t('gamesApps.registeredGames.overlayToggle')}
                      />
                      <span>{t('gamesApps.registeredGames.overlayToggle')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRegisteredGame(game.id)}
                      className="text-xs text-txt-tertiary hover:text-rose-400 transition-colors px-2 py-1"
                    >
                      {t('common:actions.remove')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'activity-privacy' && (
        <div className="space-y-6">
          {/* Que atividades eu compartilho */}
          <SettingsCardSection
            heading={t('gamesApps.activityPrivacy.whatShareHeading')}
            description={t('gamesApps.activityPrivacy.whatShareDescription')}
          >
            <SettingsToggleItem
              heading={t('privacy.activity.label')}
              description={t('privacy.activity.description')}
              checked={showActivity}
              onChange={setShowActivity}
            />
            <SettingsToggleItem
              heading={t('gamesApps.activityPrivacy.elapsedTime.title')}
              description={t('gamesApps.activityPrivacy.elapsedTime.description')}
              checked={shareActivityElapsed}
              disabled={!showActivity}
              onChange={(val) => setPreference('shareActivityElapsed', val)}
            />
          </SettingsCardSection>

          {/* Onde eu compartilho atividades */}
          <SettingsCardSection
            heading={t('gamesApps.activityPrivacy.whereShare.heading')}
            description={t('gamesApps.activityPrivacy.whereShare.description')}
          >
            {shareScopeOptions.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={activityShareScope === opt.value}
                disabled={!showActivity}
                onSelect={() => setPreference('activityShareScope', opt.value)}
                heading={t(opt.titleKey)}
                description={t(opt.descKey)}
              />
            ))}
          </SettingsCardSection>

          {/* Entrando na atividade */}
          <SettingsCardSection
            heading={t('gamesApps.activityPrivacy.joining.heading')}
            description={t('gamesApps.activityPrivacy.joining.description')}
          >
            {joinOptions.map((opt) => (
              <SettingsRadioOption
                key={opt.value}
                selected={activityJoinPermission === opt.value}
                onSelect={() => setPreference('activityJoinPermission', opt.value)}
                heading={t(opt.titleKey)}
                description={t(opt.descKey)}
              />
            ))}
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'game-overlay' && (
        <div className="space-y-6">
          <SettingsInfoCallout
            heading={t('gamesApps.gameOverlay.architectureNoteTitle')}
            body={t('gamesApps.gameOverlay.architectureNoteBody')}
            tone="info"
          />

          {/* Visão geral */}
          <SettingsCardSection
            heading={t('gamesApps.gameOverlay.overview.heading')}
            description={t('gamesApps.gameOverlay.overview.description')}
          >
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.overview.enableOverlay.title')}
              description={t('gamesApps.gameOverlay.overview.enableOverlay.description')}
              checked={overlayEnabled}
              onChange={(val) => setPreference('overlayEnabled', val)}
            />
            <SettingsToggleItem
              heading={t('voice.pip.showOnSwitch.label')}
              description={t('voice.pip.showOnSwitch.description')}
              checked={pipEnabled}
              onChange={setPipEnabled}
            />
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.overview.alwaysOnTop.title')}
              description={t('gamesApps.gameOverlay.overview.alwaysOnTop.description')}
              checked={pipAlwaysOnTop}
              disabled={!pipEnabled}
              onChange={setPipAlwaysOnTop}
            />
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.overview.autoOpenMinimize.title')}
              description={t('gamesApps.gameOverlay.overview.autoOpenMinimize.description')}
              checked={pipAutoOpenOnMinimize}
              disabled={!pipEnabled}
              onChange={setPipAutoOpenOnMinimize}
            />
          </SettingsCardSection>

          {/* Widgets */}
          <SettingsCardSection
            heading={t('gamesApps.gameOverlay.widgets.heading')}
            description={t('gamesApps.gameOverlay.widgets.description')}
          >
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium text-txt-primary">
                {t('gamesApps.gameOverlay.widgets.cornerLabel')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cornerOptions.map((c) => {
                  const active = overlayCorner === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setPreference('overlayCorner', c.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                        active
                          ? 'bg-accent-primary/15 border-accent-primary/40 text-txt-primary'
                          : 'bg-surface-base/40 border-white/[0.06] text-txt-secondary hover:text-txt-primary'
                      }`}
                    >
                      {t(c.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-txt-primary">
                  {t('gamesApps.gameOverlay.widgets.opacityLabel')}
                </span>
                <span className="text-xs text-txt-tertiary tabular-nums">
                  {overlayOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                value={overlayOpacity}
                onChange={(e) => setPreference('overlayOpacity', Number(e.target.value))}
                className="w-full accent-accent-mint cursor-pointer"
              />
            </div>
          </SettingsCardSection>

          {/* Widget de voz */}
          <SettingsCardSection
            heading={t('gamesApps.gameOverlay.voiceWidget.heading')}
            description={t('gamesApps.gameOverlay.voiceWidget.description')}
          >
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.voiceWidget.enable.title')}
              description={t('gamesApps.gameOverlay.voiceWidget.enable.description')}
              checked={overlayVoiceWidgetEnabled}
              onChange={(val) => setPreference('overlayVoiceWidgetEnabled', val)}
            />
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.voiceWidget.showAvatars.title')}
              description={t('gamesApps.gameOverlay.voiceWidget.showAvatars.description')}
              checked={overlayShowSpeakingAvatars}
              disabled={!overlayVoiceWidgetEnabled}
              onChange={(val) => setPreference('overlayShowSpeakingAvatars', val)}
            />
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.voiceWidget.showNames.title')}
              description={t('gamesApps.gameOverlay.voiceWidget.showNames.description')}
              checked={overlayShowParticipantNames}
              disabled={!overlayVoiceWidgetEnabled}
              onChange={(val) => setPreference('overlayShowParticipantNames', val)}
            />
          </SettingsCardSection>

          {/* Notificações na sobreposição */}
          <SettingsCardSection
            heading={t('gamesApps.gameOverlay.notifications.heading')}
            description={t('gamesApps.gameOverlay.notifications.description')}
          >
            <SettingsToggleItem
              heading={t('gamesApps.gameOverlay.notifications.showAlerts.title')}
              description={t('gamesApps.gameOverlay.notifications.showAlerts.description')}
              checked={overlayShowTextNotifications}
              onChange={(val) => setPreference('overlayShowTextNotifications', val)}
            />
          </SettingsCardSection>
        </div>
      )}

      {currentSection === 'connected-apps' && (
        <div className="space-y-6">
          {/* Conexões de Contas e Canais (Twitch, Kick, YouTube) */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <StreamerChannelsSection />
          </div>

          {/* Conexões de Instâncias Federadas */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h3 className="text-xs font-semibold text-txt-tertiary uppercase tracking-wider mb-3">
              {t('connections.title')}
            </h3>
            <ConnectedInstances />
          </div>

          {/* Aplicativos autorizados */}
          <SettingsCardSection
            heading={t('gamesApps.connectedApps.authorizedHeading')}
            description={t('gamesApps.connectedApps.authorizedDescription')}
          >
            {authorizedApps.length === 0 ? (
              <div className="p-4 text-xs text-txt-tertiary">
                {t('gamesApps.connectedApps.authorizedEmpty')}
              </div>
            ) : (
              authorizedApps.map((app) => (
                <div key={app.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-txt-primary">{app.appName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-txt-secondary">
                        {app.developerName}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {app.scopeKeys.map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 rounded text-[10px] bg-accent-primary/10 text-accent-lavender border border-accent-primary/20"
                        >
                          {t(`gamesApps.connectedApps.scopes.${scope}`)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeAuthorizedApp(app.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 transition-colors"
                  >
                    {t('gamesApps.connectedApps.revokeAction')}
                  </button>
                </div>
              ))
            )}
          </SettingsCardSection>
        </div>
      )}
    </div>
  );
}
