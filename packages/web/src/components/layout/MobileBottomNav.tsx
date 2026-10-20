import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { isIncomingRequest, useSocialStore } from '../../stores/socialStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInstanceUpdateBadge } from '../../hooks/useInstanceUpdateBadge';
import { useHubUpdateState } from '../../hooks/useHubUpdateState';

export function MobileBottomNav() {
  const { t } = useTranslation('mobile');
  const mobileScreen = useUIStore((s) => s.mobileScreen);
  const mobileStack = useUIStore((s) => s.mobileStack);
  const setMobileTab = useUIStore((s) => s.setMobileTab);
  const navigate = useNavigate();
  const location = useLocation();

  // Badge data
  const unreadChannels = useChatStore((s) => s.unreadChannels);
  const voiceChannelIds = useSpaceStore((s) => s.voiceChannelIds);
  const dmChannels = useSpaceStore((s) => s.dmChannels);
  const readStates = useChatStore((s) => s.readStates);
  const requests = useSocialStore((s) => s.requests);
  const updateBadge = useInstanceUpdateBadge();
  // The Backspace row lives on the You screen, so its dot surfaces here.
  const hubUpdated = useHubUpdateState().state === 'updated';

  // Hide when any screen is pushed (chat, settings, friends, etc.)
  if (mobileStack.length > 0) return null;

  // Compute unread DM count
  const unreadDmCount = dmChannels.filter((dm) => {
    const lastMsgId = dm.lastMessage?.id;
    const readState = readStates.get(dm.id);
    return lastMsgId && (!readState || readState < lastMsgId);
  }).length;

  // Compute whether any space has unread text channels
  const hasUnreadSpaces = Array.from(unreadChannels).some((chId) => !voiceChannelIds.has(chId));

  // Pending friend requests — filter for incoming only
  const pendingIncoming = requests.filter((r) => r.status === 'pending' && isIncomingRequest(r));

  const isTabActive = (tabId: 'spaces' | 'dms' | 'explore' | 'store' | 'you') => {
    if (tabId === 'explore') {
      return location.pathname.startsWith('/explore') || mobileScreen === 'explore';
    }
    if (tabId === 'store') {
      return location.pathname.startsWith('/store') || mobileScreen === 'store';
    }
    if (tabId === 'dms') {
      return (
        (location.pathname.startsWith('/channels/@me') && mobileScreen !== 'you') ||
        (mobileScreen === 'dms' &&
          !location.pathname.startsWith('/explore') &&
          !location.pathname.startsWith('/store'))
      );
    }
    if (tabId === 'you') {
      return mobileScreen === 'you';
    }
    if (tabId === 'spaces') {
      return (
        mobileScreen === 'spaces' &&
        !location.pathname.startsWith('/explore') &&
        !location.pathname.startsWith('/store') &&
        !location.pathname.startsWith('/channels/@me')
      );
    }
    return false;
  };

  const handleTab = (tab: 'spaces' | 'dms' | 'explore' | 'store' | 'you') => {
    setMobileTab(tab);
    if (tab === 'dms') {
      navigate('/channels/@me');
    } else if (tab === 'spaces') {
      const { currentSpaceId, lastSelectedSpaceId } = useSpaceStore.getState();
      const target = currentSpaceId ?? lastSelectedSpaceId;
      if (target) navigate(`/channels/${target}`);
      else navigate('/');
    } else if (tab === 'explore') {
      navigate('/explore');
    } else if (tab === 'store') {
      navigate('/store');
    }
  };

  const tabs = [
    {
      id: 'spaces' as const,
      label: t('nav.spaces'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
      badge: hasUnreadSpaces ? ('dot' as const) : null,
    },
    {
      id: 'dms' as const,
      label: t('nav.dms'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
      badge: unreadDmCount > 0 ? unreadDmCount : null,
    },
    {
      id: 'explore' as const,
      label: t('nav.explore'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
        </svg>
      ),
      badge: null,
    },
    {
      id: 'store' as const,
      label: t('nav.store'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.651V9.35m0 0a3.001 3.001 0 003.75-.614A2.993 2.993 0 009 9.35c.828 0 1.579-.336 2.125-.879A2.993 2.993 0 0013.25 9.35c.828 0 1.579-.336 2.125-.879A3.001 3.001 0 0019.125 9.35m-16.5 0L4.47 4.19A1.5 1.5 0 015.932 3h12.136a1.5 1.5 0 011.462 1.19l1.845 5.16" />
        </svg>
      ),
      badge: null,
    },
    {
      id: 'you' as const,
      label: t('nav.you'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      badge: (pendingIncoming.length > 0 || updateBadge || hubUpdated) ? ('dot' as const) : null,
    },
  ];

  return (
    <nav
      className="glass-bubble flex items-center justify-around shrink-0 px-1"
      style={{
        paddingBottom: 'var(--safe-bottom)',
        height: 'calc(58px + var(--safe-bottom))',
      }}
    >
      {tabs.map((tab) => {
        const active = isTabActive(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => handleTab(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            className={`flex items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] relative transition-colors ${
              active ? 'text-accent-primary' : 'text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <div className="relative flex items-center justify-center">
              {tab.icon}
              {tab.badge === 'dot' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-notification rounded-full" />
              )}
              {typeof tab.badge === 'number' && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-notification text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
