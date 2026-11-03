/**
 * Which item of the DM sidebar's home block is selected.
 *
 * Centralized, mutually-exclusive navigation resolvers for:
 * 1. The secondary sidebar items (Friends, Opportunities, Store, Download Nuvio).
 * 2. The primary Space rail `@me` item (Direct Messages home).
 */

export type HomeNavItem = 'friends' | 'explore' | 'backspace' | 'download' | 'store' | 'opportunities';

/**
 * Normalizes a pathname by stripping query strings, hash fragments, and trailing slashes.
 */
export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const beforeHash = pathname.split('#')[0] ?? '';
  const base = beforeHash.split('?')[0] ?? '';
  if (base.length > 1 && base.endsWith('/')) {
    return base.slice(0, -1);
  }
  return base || '/';
}

/**
 * Returns which secondary navigation item (in ChannelSidebar / DM sidebar) is active.
 * Mutually exclusive: at most one item can be active at a time.
 * If in a DM conversation (/channels/@me/:channelId), or in a space, or on an unrelated page, returns null.
 */
export function activeHomeNavItem(pathname: string, currentChannelId: string | null = null): HomeNavItem | null {
  const path = normalizePathname(pathname);

  // Exact standalone pages
  if (path === '/explore') return 'explore';
  if (path === '/backspace') return 'backspace';
  if (path === '/download') return 'download';

  // Section prefixes
  if (path === '/store' || path.startsWith('/store/') || path === '/developers' || path.startsWith('/developers/')) {
    return 'store';
  }
  if (path === '/opportunities' || path.startsWith('/opportunities/')) {
    return 'opportunities';
  }

  // Friends is ONLY active when specifically on the DM home route (/channels/@me or /)
  // and no DM conversation is currently open.
  const isDmHomePath = path === '/channels/@me' || path === '/';
  const hasNoChannel = !currentChannelId;
  const isDirectConversation = path.startsWith('/channels/@me/') && path !== '/channels/@me';

  if (isDmHomePath && hasNoChannel && !isDirectConversation) {
    return 'friends';
  }

  // No generic fallback to 'friends'! Unknown paths, spaces, livestreams, or DM conversations return null.
  return null;
}

/**
 * Determines whether the main Nuvio icon (@me button in SpaceSidebar) is active.
 *
 * It is active ONLY when:
 * 1. The user is in Friends: /channels/@me (or /)
 * 2. The user is in an active Direct Message conversation: /channels/@me/:channelId
 * 3. Or on legacy /backspace
 *
 * It is MUTUALLY EXCLUSIVE with:
 * - Oportunidades (/opportunities) -> Nuvio icon is inactive (gray)
 * - Loja (/store, /developers) -> Nuvio icon is inactive (gray)
 * - Baixar Nuvio (/download) -> Nuvio icon is inactive (gray)
 * - Explore (/explore) -> Explore icon is active, Nuvio icon is inactive
 * - Spaces (/channels/:spaceId) -> Space icon is active, Nuvio icon is inactive
 * - Live streams (/live/:channelId) -> Stream icon is active, Nuvio icon is inactive
 */
export function isDirectMessagesRailActive(pathname: string): boolean {
  const path = normalizePathname(pathname);

  // Never active on distinct standalone sections
  if (
    path === '/download' ||
    path === '/explore' ||
    path === '/store' ||
    path.startsWith('/store/') ||
    path === '/developers' ||
    path.startsWith('/developers/') ||
    path === '/opportunities' ||
    path.startsWith('/opportunities/') ||
    path.startsWith('/live/')
  ) {
    return false;
  }

  // Never active when inside a space (/channels/:spaceId where spaceId !== '@me')
  if (path.startsWith('/channels/') && !path.startsWith('/channels/@me')) {
    return false;
  }

  // Active on DM home and DM conversations
  return path.startsWith('/channels/@me') || path === '/' || path === '/backspace';
}
