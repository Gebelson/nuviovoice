import { Fragment, useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { api } from '../../api/client';
import type { InstanceInfoResponse } from '@concord/shared';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import {
  AccountPanel,
  DataPrivacyPanel,
  MessagePermissionsPanel,
  NotificationsPanel,
  AppearancePanel,
  AccessibilityPanel,
  LanguageTimePanel,
  GamesAppsPanel,
  VoicePanel,
  DesktopPanel,
  DesktopDownloadPanel,
  InstancePanel,
  KeybindsPanel,
  SettingsPanelSuspense,
} from './lazySettingsPanels';
import type { DataPrivacySubsection } from './settingsPanels/DataPrivacyPanel';
import type { MessagePermissionsSubsection } from './settingsPanels/MessagePermissionsPanel';
import type { NotificationsSubsection } from './settingsPanels/NotificationsPanel';
import type { GamesAppsSubsection } from './settingsPanels/GamesAppsPanel';
import { isElectron } from '../../platform/platform';
import { useInstanceUpdateBadge } from '../../hooks/useInstanceUpdateBadge';
import { useUpdateStore } from '../../stores/updateStore';
import { SettingsSectionsProvider, useSettingsSectionsContext } from './SettingsSectionsContext';
import { SettingsHubHeader, type SubsectionTabItem } from './settingsPanels/_shared/SettingsPrimitives';

export const USER_SETTINGS_TABS = [
  { id: 'account', group: 'user', label: 'settings:hub.categories.account' },
  { id: 'data-privacy', group: 'user', label: 'settings:hub.categories.dataPrivacy' },
  { id: 'message-permissions', group: 'user', label: 'settings:hub.categories.messagePermissions' },
  { id: 'notifications', group: 'user', label: 'settings:hub.categories.notifications' },
  { id: 'experience', group: 'app', label: 'settings:hub.categories.experience' },
  { id: 'games-apps', group: 'app', label: 'settings:hub.categories.gamesApps' },
  { id: 'instance', group: 'admin', label: 'settings:nav.tabs.instance' },
] as const;

export type HubCategoryId = (typeof USER_SETTINGS_TABS)[number]['id'];

export type LegacyOrHubSettingsTab =
  | HubCategoryId
  | 'appearance'
  | 'chat'
  | 'voice'
  | 'privacy'
  | 'connections'
  | 'keybinds'
  | 'desktop'
  | 'accessibility'
  | 'language-time';

export type UserSettingsTab = LegacyOrHubSettingsTab;

type TabGroup = (typeof USER_SETTINGS_TABS)[number]['group'];

const GROUP_HEADINGS = {
  user: 'settings:nav.userSettings',
  app: 'settings:nav.appSettings',
  admin: 'settings:nav.administration',
} as const satisfies Record<TabGroup, string>;

const GROUP_ORDER: readonly TabGroup[] = ['user', 'app', 'admin'];

export type ExperienceSubsection =
  | 'voice-video'
  | 'appearance'
  | 'accessibility'
  | 'keybinds'
  | 'desktop'
  | 'language-time';

export interface ResolvedSettingsTarget {
  category: HubCategoryId;
  section: string;
}

export function resolveSettingsTarget(
  rawTab: unknown,
  rawSection: unknown,
  isAdmin: boolean,
): ResolvedSettingsTarget {
  if (typeof rawTab !== 'string') {
    return { category: 'account', section: 'account' };
  }

  switch (rawTab) {
    case 'account':
      return { category: 'account', section: 'account' };
    case 'data-privacy':
      return {
        category: 'data-privacy',
        section: typeof rawSection === 'string' ? rawSection : 'data-usage',
      };
    case 'privacy':
      return { category: 'data-privacy', section: 'profile-privacy' };
    case 'message-permissions':
      return {
        category: 'message-permissions',
        section: typeof rawSection === 'string' ? rawSection : 'content-filters',
      };
    case 'chat':
      return { category: 'message-permissions', section: 'direct-messages' };
    case 'notifications':
      return {
        category: 'notifications',
        section: typeof rawSection === 'string' ? rawSection : 'overview',
      };
    case 'experience':
      return {
        category: 'experience',
        section: typeof rawSection === 'string' ? rawSection : 'appearance',
      };
    case 'appearance':
      return { category: 'experience', section: 'appearance' };
    case 'voice':
      return { category: 'experience', section: 'voice-video' };
    case 'accessibility':
      return { category: 'experience', section: 'accessibility' };
    case 'keybinds':
      return { category: 'experience', section: 'keybinds' };
    case 'desktop':
    case 'system':
      return { category: 'experience', section: 'desktop' };
    case 'language-time':
      return { category: 'experience', section: 'language-time' };
    case 'games-apps':
      return {
        category: 'games-apps',
        section: typeof rawSection === 'string' ? rawSection : 'registered-games',
      };
    case 'connections':
      return { category: 'games-apps', section: 'connected-apps' };
    case 'instance':
      return isAdmin
        ? { category: 'instance', section: 'instance' }
        : { category: 'account', section: 'account' };
    default:
      return { category: 'account', section: 'account' };
  }
}

export function SidebarSubLinks() {
  const ctx = useSettingsSectionsContext();
  if (!ctx || ctx.sections.length === 0) return null;

  return (
    <div className="overflow-hidden">
      {ctx.sections.map((section) => (
        <button
          key={section.id}
          onClick={() => ctx.scrollToSection(section.id)}
          className={`w-full flex items-center gap-1.5 text-left pl-6 pr-2 py-1 text-xs rounded-md transition-colors ${
            ctx.activeSection === section.id
              ? 'text-txt-primary'
              : 'text-txt-tertiary hover:text-txt-secondary'
          }`}
          aria-current={ctx.activeSection === section.id ? 'true' : undefined}
        >
          <span className="flex-1 min-w-0 truncate">{section.label}</span>
          {section.badgeCount !== undefined && section.badgeCount > 0 && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber">
              {section.badgeCount}
            </span>
          )}
          {section.badgeDot === true && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-amber" />
          )}
        </button>
      ))}
    </div>
  );
}

function SettingsScrollContainer({ children }: { children: React.ReactNode }) {
  const ctx = useSettingsSectionsContext();
  return (
    <div ref={ctx?.scrollContainerRef} className="flex-1 min-w-0 overflow-y-auto scrollbar-thin py-6">
      {children}
    </div>
  );
}

const DEFAULT_SECTION_BY_CATEGORY: Record<HubCategoryId, string> = {
  account: 'account',
  'data-privacy': 'data-usage',
  'message-permissions': 'content-filters',
  notifications: 'overview',
  experience: 'appearance',
  'games-apps': 'registered-games',
  instance: 'instance',
};

export function UserSettingsModal() {
  const { t } = useTranslation(['settings', 'common']);
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const closeModal = useUIStore((s) => s.closeModal);
  const isMobile = useUIStore((s) => s.isMobile);
  const isAdmin = Boolean(useAuthStore((s) => s.user?.isAdmin));
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateBadge = useInstanceUpdateBadge();
  const desktopSnapshot = useUpdateStore((s) => s.snapshot);
  const isDesktop = isElectron();
  const desktopPhase = desktopSnapshot?.status.phase;
  const hasDesktopUpdate = isDesktop && (desktopPhase === 'ready' || desktopPhase === 'available');

  const initialTarget = resolveSettingsTarget(modalData?.tab, modalData?.section, isAdmin);
  const [activeCategory, setActiveCategory] = useState<HubCategoryId>(initialTarget.category);
  const [activeSection, setActiveSection] = useState<string>(initialTarget.section);
  const [mobileView, setMobileView] = useState<'tabs' | 'content'>('tabs');
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfoResponse | null>(null);

  const isOpen = activeModal === 'userSettings';

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api.instance.info()
      .then((info) => { if (!cancelled) setInstanceInfo(info); })
      .catch(() => { /* Non-critical */ });
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const requestedTab = modalData?.tab;
      const target = resolveSettingsTarget(requestedTab, modalData?.section, isAdmin);
      const hasExplicitValidTarget =
        typeof requestedTab === 'string' &&
        (requestedTab === 'account' || target.category !== 'account' || target.section !== 'account');
      setActiveCategory(target.category);
      setActiveSection(target.section);
      setMobileView(hasExplicitValidTarget ? 'content' : 'tabs');
    }
  }, [isOpen, modalData?.tab, modalData?.section, isAdmin]);

  const handleLogout = () => {
    logout();
    closeModal();
  };

  const navigateHub = (category: HubCategoryId, section?: string) => {
    const resolvedSection = section ?? DEFAULT_SECTION_BY_CATEGORY[category];
    setActiveCategory(category);
    setActiveSection(resolvedSection);
    if (isMobile) setMobileView('content');
  };

  const categorySubsections: Record<HubCategoryId, Array<{ id: string; label: string }>> = {
    account: [],
    'data-privacy': [
      { id: 'data-usage', label: t('settings:dataPrivacy.subsections.dataUsage') },
      { id: 'profile-privacy', label: t('settings:dataPrivacy.subsections.profilePrivacy') },
      { id: 'voice-encryption', label: t('settings:dataPrivacy.subsections.voiceEncryption') },
    ],
    'message-permissions': [
      { id: 'content-filters', label: t('settings:messagePermissions.subsections.contentFilters') },
      { id: 'spam-filters', label: t('settings:messagePermissions.subsections.spamFilters') },
      { id: 'direct-messages', label: t('settings:messagePermissions.subsections.directMessages') },
      { id: 'friend-requests', label: t('settings:messagePermissions.subsections.friendRequests') },
      { id: 'connected-games', label: t('settings:messagePermissions.subsections.connectedGames') },
      { id: 'ignore-block', label: t('settings:messagePermissions.subsections.ignoreBlock') },
    ],
    notifications: [
      { id: 'overview', label: t('settings:notifications.subsections.overview') },
      { id: 'sounds', label: t('settings:notifications.subsections.sounds') },
      { id: 'badges', label: t('settings:notifications.subsections.badges') },
      { id: 'email', label: t('settings:notifications.subsections.email') },
      { id: 'advanced', label: t('settings:notifications.subsections.advanced') },
    ],
    experience: [
      { id: 'voice-video', label: t('settings:nav.tabs.voice') },
      { id: 'appearance', label: t('settings:nav.tabs.appearance') },
      { id: 'accessibility', label: t('settings:experience.subsections.accessibility') },
      { id: 'keybinds', label: t('settings:nav.tabs.keybinds') },
      { id: 'desktop', label: t('settings:nav.tabs.desktop') },
      { id: 'language-time', label: t('settings:experience.subsections.languageTime') },
    ],
    'games-apps': [
      { id: 'registered-games', label: t('settings:gamesApps.subsections.registeredGames') },
      { id: 'activity-privacy', label: t('settings:gamesApps.subsections.activityPrivacy') },
      { id: 'game-overlay', label: t('settings:gamesApps.subsections.gameOverlay') },
      { id: 'connected-apps', label: t('settings:gamesApps.subsections.connectedApps') },
    ],
    instance: [],
  };

  const tabClass = (target: HubCategoryId) =>
    `w-full min-w-0 truncate text-left px-3 py-2 rounded-md text-sm transition-colors ${
      activeCategory === target
        ? 'bg-interactive-selected text-txt-primary font-medium'
        : 'text-txt-tertiary hover:text-txt-secondary hover:bg-interactive-hover'
    }`;

  const renderNav = (layout: 'desktop' | 'mobile'): ReactNode =>
    GROUP_ORDER.filter((group) => group !== 'admin' || isAdmin).map((group, index) => (
      <Fragment key={group}>
        {index > 0 && <div className="border-t border-white/[0.04] my-2 mx-2" />}
        <div className="text-[10px] font-semibold text-txt-tertiary uppercase tracking-wider px-3 py-1">
          {t(GROUP_HEADINGS[group])}
        </div>
        {USER_SETTINGS_TABS.filter((entry) => entry.group === group).map((entry) => {
          const subs = categorySubsections[entry.id];
          const isCatActive = activeCategory === entry.id;
          const showSubs = isCatActive || entry.id === 'experience';

          if (entry.id === 'instance' && layout === 'desktop') {
            return (
              <Fragment key={entry.id}>
                <button
                  onClick={() => navigateHub(entry.id)}
                  className={`${tabClass(entry.id)} flex items-center gap-1.5`}
                  aria-current={isCatActive ? 'page' : undefined}
                >
                  <span className="flex-1 min-w-0 truncate">{t(entry.label)}</span>
                  {updateBadge && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-amber" />}
                </button>
                {isCatActive && <SidebarSubLinks />}
              </Fragment>
            );
          }

          return (
            <Fragment key={entry.id}>
              <button
                onClick={() => navigateHub(entry.id)}
                className={`${tabClass(entry.id)} flex items-center justify-between`}
                aria-current={isCatActive ? 'page' : undefined}
              >
                <span className="truncate">{t(entry.label)}</span>
              </button>
              {showSubs && subs.length > 0 && (
                <div className="ml-3 pl-2.5 border-l border-white/[0.06] my-0.5 space-y-0.5">
                  {subs.map((sub) => {
                    const isSubActive = isCatActive && activeSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => navigateHub(entry.id, sub.id)}
                        className={`w-full flex items-center justify-between text-left px-2.5 py-1 rounded text-xs transition-colors ${
                          isSubActive
                            ? 'text-accent-primary font-medium bg-accent-primary/[0.08]'
                            : 'text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.03]'
                        }`}
                        aria-current={isSubActive ? 'true' : undefined}
                      >
                        <span className="truncate">{sub.label}</span>
                        {sub.id === 'desktop' && hasDesktopUpdate && (
                          <span
                            className={`shrink-0 w-2 h-2 rounded-full ${
                              desktopPhase === 'ready'
                                ? 'bg-status-online animate-pulse'
                                : 'bg-accent-primary'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Fragment>
          );
        })}
      </Fragment>
    ));

  const experienceTabs: SubsectionTabItem[] = [
    { id: 'voice-video', title: t('settings:nav.tabs.voice') },
    { id: 'appearance', title: t('settings:nav.tabs.appearance') },
    { id: 'accessibility', title: t('settings:experience.subsections.accessibility') },
    { id: 'keybinds', title: t('settings:nav.tabs.keybinds') },
    { id: 'desktop', title: t('settings:nav.tabs.desktop') },
    { id: 'language-time', title: t('settings:experience.subsections.languageTime') },
  ];

  const renderPanel = (): ReactNode => {
    switch (activeCategory) {
      case 'account':
        return (
          <AccountPanel
            onNavigateToAppearance={() => navigateHub('experience', 'appearance')}
          />
        );
      case 'data-privacy':
        return (
          <DataPrivacyPanel
            activeSection={activeSection as DataPrivacySubsection}
            onSelectSection={(sec) => setActiveSection(sec)}
            onNavigateToSection={(cat, sec) => navigateHub(cat as HubCategoryId, sec)}
          />
        );
      case 'message-permissions':
        return (
          <MessagePermissionsPanel
            activeSection={activeSection as MessagePermissionsSubsection}
            onSelectSection={(sec) => setActiveSection(sec)}
            onNavigateToSection={(cat, sec) => navigateHub(cat as HubCategoryId, sec)}
          />
        );
      case 'notifications':
        return (
          <NotificationsPanel
            activeSection={activeSection as NotificationsSubsection}
            onSelectSection={(sec) => setActiveSection(sec)}
            onNavigateToSection={(cat, sec) => navigateHub(cat as HubCategoryId, sec)}
          />
        );
      case 'experience':
        return (
          <div className="space-y-6">
            <SettingsHubHeader
              categoryLabel={t('settings:hub.categories.experience')}
              title={t('settings:experience.title')}
              subtitle={t('settings:experience.subtitle')}
              subsections={experienceTabs}
              activeSubsection={activeSection}
              onSelectSubsection={(sec) => setActiveSection(sec as ExperienceSubsection)}
            />
            {activeSection === 'voice-video' && <VoicePanel />}
            {activeSection === 'appearance' && <AppearancePanel />}
            {activeSection === 'accessibility' && <AccessibilityPanel />}
            {activeSection === 'keybinds' && <KeybindsPanel />}
            {activeSection === 'desktop' &&
              (isElectron() ? (
                <DesktopPanel />
              ) : (
                <DesktopDownloadPanel version={instanceInfo?.version ?? null} />
              ))}
            {activeSection === 'language-time' && <LanguageTimePanel />}
          </div>
        );
      case 'games-apps':
        return (
          <GamesAppsPanel
            activeSection={activeSection as GamesAppsSubsection}
            onSelectSection={(sec) => setActiveSection(sec)}
          />
        );
      case 'instance':
        return isAdmin ? <InstancePanel /> : null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} size="settings" mobileStyle="fullscreen">
      <SettingsSectionsProvider>
        <div className="flex h-full">
          {/* Desktop Sidebar */}
          <div className="hidden desktop:flex w-60 flex-shrink-0 flex-col p-4 gap-3">
            {/* User card */}
            <div className="glass-bubble rounded-lg p-3 flex items-center gap-3">
              <Avatar
                src={user?.avatar}
                name={user?.displayName || user?.username || ''}
                size={36}
                userId={user?.id}
                avatarColor={user?.avatarColor}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-txt-primary truncate">
                  {user?.displayName || user?.username}
                </div>
                <div className="text-xs text-txt-tertiary truncate">@{user?.username}</div>
              </div>
            </div>

            {/* Nav list */}
            <div className="glass-bubble rounded-lg p-2 flex-1 flex flex-col overflow-y-auto scrollbar-thin">
              {renderNav('desktop')}

              <div className="flex-1" />

              <div className="border-t border-white/[0.04] my-2 mx-2" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-txt-danger hover:bg-accent-rose/10 transition-colors"
              >
                {t('settings:nav.logOut')}
              </button>
            </div>
          </div>

          {/* Mobile: Tab list */}
          {isMobile && mobileView === 'tabs' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Mobile user card */}
              <div className="glass-bubble rounded-lg p-3 flex items-center gap-3">
                <Avatar
                  src={user?.avatar}
                  name={user?.displayName || user?.username || ''}
                  size={36}
                  userId={user?.id}
                  avatarColor={user?.avatarColor}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-txt-primary truncate">
                    {user?.displayName || user?.username}
                  </div>
                  <div className="text-xs text-txt-tertiary truncate">@{user?.username}</div>
                </div>
              </div>

              <div className="glass-bubble rounded-lg p-2 space-y-0.5">
                {renderNav('mobile')}

                <div className="border-t border-white/[0.04] my-2 mx-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-txt-danger hover:bg-accent-rose/10 transition-colors"
                >
                  {t('settings:nav.logOut')}
                </button>
              </div>
            </div>
          )}

          {/* Content area (desktop always, mobile only when viewing content) */}
          {(!isMobile || mobileView === 'content') && (
            <SettingsScrollContainer>
              <div className="px-6 max-w-[680px] mx-auto">
                {/* Mobile back button */}
                {isMobile && (
                  <button
                    onClick={() => setMobileView('tabs')}
                    className="flex items-center gap-1.5 text-txt-tertiary hover:text-txt-secondary mb-4 text-sm"
                    aria-label={t('settings:nav.backToMenu')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                    {t('common:labels.settings')}
                  </button>
                )}
                <SettingsPanelSuspense key={`${activeCategory}:${activeSection}`}>
                  {renderPanel()}
                </SettingsPanelSuspense>
              </div>
            </SettingsScrollContainer>
          )}
        </div>
      </SettingsSectionsProvider>
    </Modal>
  );
}
