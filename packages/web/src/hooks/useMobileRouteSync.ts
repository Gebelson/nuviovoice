import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

/** Restore the route below settings when scaling mounts the mobile shell. */
export function useMobileRouteSync(pathname: string): void {
  useEffect(() => {
    if (pathname === '/explore' || pathname.startsWith('/explore/')) {
      if (useUIStore.getState().mobileScreen !== 'explore') {
        useUIStore.setState({ mobileScreen: 'explore', mobileStack: [] });
      }
      return;
    }
    if (pathname === '/store' || pathname.startsWith('/store/')) {
      if (useUIStore.getState().mobileScreen !== 'store') {
        useUIStore.setState({ mobileScreen: 'store', mobileStack: [] });
      }
      return;
    }

    const match = pathname.match(/^\/channels\/([^/]+)\/([^/]+)$/);
    if (!match) {
      if (pathname === '/channels/@me' || pathname.startsWith('/channels/@me/')) {
        const current = useUIStore.getState().mobileScreen;
        if (current === 'explore' || current === 'store') {
          useUIStore.setState({ mobileScreen: 'dms' });
        }
      }
      return;
    }
    const params = { spaceId: match[1]!, channelId: match[2]! };
    const { mobileStack: stack, pushMobileScreen } = useUIStore.getState();
    const matchesRoute = (entry: (typeof stack)[number] | undefined) =>
      entry?.screen === 'channel-chat' && entry.params?.spaceId === params.spaceId
      && entry.params?.channelId === params.channelId;
    if (stack.at(-1)?.screen === 'settings-appearance') {
      // InterfaceScaleSection currently hands off only the appearance panel
      // when scale crosses into mobile; extend this if it hands off others.
      // Read the stack on every effect run, including StrictMode replay. The
      // existing settings history entry already has the channel URL beneath it.
      if (!stack.some(matchesRoute)) {
        useUIStore.setState({ mobileStack: [
          ...stack.slice(0, -1), { screen: 'channel-chat', params }, stack.at(-1)!,
        ] });
      }
      return;
    }
    if (!matchesRoute(stack.at(-1))) pushMobileScreen('channel-chat', params);
    // Stack changes alone must not push chat over unrelated screens.
  }, [pathname]);
}
