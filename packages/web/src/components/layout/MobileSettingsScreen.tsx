import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../api/client';
import {
  AccountPanel,
  DataPrivacyPanel,
  MessagePermissionsPanel,
  NotificationsPanel,
  AppearancePanel,
  AccessibilityPanel,
  LanguageTimePanel,
  GamesAppsPanel,
  ChatPanel,
  VoicePanel,
  ConnectionsPanel,
  PrivacyPanel,
  KeybindsPanel,
  DesktopPanel,
  DesktopDownloadPanel,
  SettingsPanelSuspense,
} from '../modals/lazySettingsPanels';
import { MobileScreenHeader } from './MobileScreenHeader';
import { TransferIndicator } from './TransferIndicator';
import { isElectron } from '../../platform/platform';
import { useInstanceUpdateBadge } from '../../hooks/useInstanceUpdateBadge';

interface MobileSettingsScreenProps {
  initialPanel?: string;
}

type PanelTitleKey =
  | 'settings:nav.tabs.account'
  | 'settings:hub.categories.dataPrivacy'
  | 'settings:hub.categories.messagePermissions'
  | 'settings:hub.categories.notifications'
  | 'settings:hub.categories.gamesApps'
  | 'settings:nav.tabs.appearance'
  | 'settings:experience.subsections.accessibility'
  | 'settings:experience.subsections.languageTime'
  | 'settings:nav.tabs.chat'
  | 'settings:nav.tabs.voice'
  | 'settings:nav.tabs.privacy'
  | 'settings:nav.tabs.connections'
  | 'settings:nav.tabs.keybinds'
  | 'settings:nav.tabs.desktop';

const panelConfig: Record<
  string,
  { titleKey: PanelTitleKey; body: (instanceVersion: string | null) => React.ReactNode }
> = {
  account: { titleKey: 'settings:nav.tabs.account', body: () => <AccountPanel /> },
  'data-privacy': { titleKey: 'settings:hub.categories.dataPrivacy', body: () => <DataPrivacyPanel /> },
  'message-permissions': { titleKey: 'settings:hub.categories.messagePermissions', body: () => <MessagePermissionsPanel /> },
  notifications: { titleKey: 'settings:hub.categories.notifications', body: () => <NotificationsPanel /> },
  'games-apps': { titleKey: 'settings:hub.categories.gamesApps', body: () => <GamesAppsPanel /> },
  appearance: { titleKey: 'settings:nav.tabs.appearance', body: () => <AppearancePanel /> },
  accessibility: { titleKey: 'settings:experience.subsections.accessibility', body: () => <AccessibilityPanel /> },
  'language-time': { titleKey: 'settings:experience.subsections.languageTime', body: () => <LanguageTimePanel /> },
  chat: { titleKey: 'settings:nav.tabs.chat', body: () => <ChatPanel /> },
  voice: { titleKey: 'settings:nav.tabs.voice', body: () => <VoicePanel /> },
  privacy: { titleKey: 'settings:nav.tabs.privacy', body: () => <PrivacyPanel /> },
  connections: { titleKey: 'settings:nav.tabs.connections', body: () => <ConnectionsPanel /> },
  keybinds: { titleKey: 'settings:nav.tabs.keybinds', body: () => <KeybindsPanel /> },
  desktop: {
    titleKey: 'settings:nav.tabs.desktop',
    body: (instanceVersion) =>
      isElectron() ? <DesktopPanel /> : <DesktopDownloadPanel version={instanceVersion} />,
  },
};

const sectionIcons: Record<string, React.ReactNode> = {
  account: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  'data-privacy': (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'message-permissions': (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  notifications: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  appearance: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.439.44 1.151 0 1.59l-2.879 2.879M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  ),
  accessibility: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'language-time': (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'games-apps': (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  ),
  voice: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  ),
  privacy: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  connections: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.122a4.5 4.5 0 00-6.364-6.364L4.5 6.325a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  instance: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
    </svg>
  ),
  keybinds: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
    </svg>
  ),
  desktop: (
    <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 01-9 9m0 0a9 9 0 01-9-9" />
    </svg>
  ),
};

export function MobileSettingsScreen({ initialPanel }: MobileSettingsScreenProps) {
  const { t } = useTranslation(['mobile', 'settings', 'common']);
  const pushMobileScreen = useUIStore((s) => s.pushMobileScreen);
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const updateBadge = useInstanceUpdateBadge();

  const needsInstanceVersion = initialPanel === 'desktop' && !isElectron();
  const [instanceVersion, setInstanceVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!needsInstanceVersion) return;
    let cancelled = false;
    api.instance.info()
      .then((info) => { if (!cancelled) setInstanceVersion(info.version); })
      .catch(() => { /* Non-critical: without a version every link falls back to the releases listing. */ });
    return () => { cancelled = true; };
  }, [needsInstanceVersion]);

  if (initialPanel) {
    const panel = panelConfig[initialPanel];
    if (!panel) return null;
    if (initialPanel === 'instance' && !isAdmin) return null;

    return (
      <div className="flex flex-col h-full bg-surface-base">
        <MobileScreenHeader title={t(panel.titleKey)} rightActions={<TransferIndicator />} />
        <div className="flex-1 overflow-y-auto p-4">
          <SettingsPanelSuspense key={initialPanel}>{panel.body(instanceVersion)}</SettingsPanelSuspense>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'account', label: t('settings:nav.tabs.account') },
    { id: 'data-privacy', label: t('settings:hub.categories.dataPrivacy') },
    { id: 'message-permissions', label: t('settings:hub.categories.messagePermissions') },
    { id: 'notifications', label: t('settings:hub.categories.notifications') },
    { id: 'appearance', label: t('settings:nav.tabs.appearance') },
    { id: 'voice', label: t('settings:nav.tabs.voice') },
    { id: 'accessibility', label: t('settings:experience.subsections.accessibility') },
    { id: 'language-time', label: t('settings:experience.subsections.languageTime') },
    { id: 'games-apps', label: t('settings:hub.categories.gamesApps') },
    { id: 'privacy', label: t('settings:nav.tabs.privacy') },
    { id: 'connections', label: t('settings:nav.tabs.connections') },
    ...(isElectron() ? [{ id: 'keybinds', label: t('settings:nav.tabs.keybinds') }] : []),
    { id: 'desktop', label: t('settings:nav.tabs.desktop') },
    ...(isAdmin ? [{ id: 'instance', label: t('settings:nav.tabs.instance'), dot: updateBadge }] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-surface-base">
      <MobileScreenHeader title={t('common:labels.settings')} rightActions={<TransferIndicator />} />
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => pushMobileScreen(`settings-${section.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-interactive-hover text-left transition-colors"
          >
            {sectionIcons[section.id]}
            <span className="text-sm text-txt-primary flex-1">{section.label}</span>
            {section.dot && <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" />}
            <svg className="w-4 h-4 text-txt-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
