import { create } from 'zustand';
import type { DiscoverUser, User } from '@concord/shared';
import { api } from '../api/client';
import { useInstanceStore, waitForAutoConnect } from './instanceStore';
import { normalizeUserAssets } from '../utils/assetUrls';
import { updateIsAbout, userKey, type IdentityFields } from '../utils/identity';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaggedDiscoverUser extends DiscoverUser {
  _instanceOrigin: string; // '' = home instance
}

interface DiscoverState {
  users: TaggedDiscoverUser[];
  searchQuery: string;
  isLoading: boolean;
  total: number;
  error: string | null;

  fetchUsers: (query?: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  updateRelationship: (userId: string, origin: string, relationship: DiscoverUser['relationship'], requestId?: string) => void;
  /** Drop any discover card representing a user who just became a friend. */
  removeFriendUser: (user: IdentityFields, origin: string) => void;
  /** Drop the cards the deleted user's `user_updated` row (issued by `origin`) is about (`updateIsAbout`). */
  removeDeletedUser: (user: IdentityFields, origin: string) => void;
  reset: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useDiscoverStore = create<DiscoverState>((set) => ({
  users: [],
  searchQuery: '',
  isLoading: false,
  total: 0,
  error: null,

  fetchUsers: async (query?: string) => {
    set({ isLoading: true, error: null });

    await waitForAutoConnect();

    // Lazy imports — avoids pulling spaceStore's transitive dependency chain
    // (voiceStore → AudioManager) into test environments.
    const [{ useSpaceStore }, { useSocialStore, friendEntryOf }, { isMe }] = await Promise.all([
      import('./spaceStore'),
      import('./socialStore'),
      import('./authStore'),
    ]);

    try {
      const instances = useInstanceStore.getState().instances;
      const connectedInstances = instances.filter(i => i.status === 'connected');

      const results = await Promise.allSettled([
        api.social.discover(query).then(res => ({ ...res, origin: '' })),
        ...connectedInstances.map(inst =>
          inst.api.social.discover(query).then(res => ({ ...res, origin: inst.origin }))
        ),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ users: DiscoverUser[]; total: number; origin: string }>[];

      if (fulfilled.length === 0) {
        set({ isLoading: false, error: 'Failed to reach any instance for discovery' });
        return;
      }

      const currentFriends = useSocialStore.getState().friends;
      const allUsers: TaggedDiscoverUser[] = [];
      const seen = new Set<string>();
      let totalSum = 0;

      for (const result of fulfilled) {
        const { users, total, origin } = result.value;
        let excludedInPage = 0;

        for (const user of users) {
          // Never display the authenticated user or users who are already friends
          if (
            user.relationship === 'friends' ||
            isMe(user, origin) ||
            Boolean(friendEntryOf(currentFriends, user, origin))
          ) {
            excludedInPage++;
            continue;
          }
          const key = `${user.id}:${origin}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (origin) normalizeUserAssets(user as unknown as { avatar?: string | null; banner?: string | null }, origin);
          allUsers.push({ ...user, _instanceOrigin: origin });
          // DiscoverUser carries the identity/avatar fields the cache needs; cast to User.
          useSpaceStore.getState().upsertUserView(user as unknown as User, origin);
        }

        totalSum += Math.max(0, total - excludedInPage);
      }

      set({
        users: allUsers,
        total: totalSum,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to discover users',
      });
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  updateRelationship: (userId: string, origin: string, relationship: DiscoverUser['relationship'], requestId?: string) => {
    if (relationship === 'friends') {
      set((state) => {
        const target = state.users.find(u => u.id === userId && u._instanceOrigin === origin);
        const targetKey = target ? userKey(target, target._instanceOrigin) : null;
        const filtered = state.users.filter(u => {
          if (u.id === userId && u._instanceOrigin === origin) return false;
          if (targetKey && userKey(u, u._instanceOrigin) === targetKey) return false;
          return true;
        });
        if (filtered.length === state.users.length) return state;
        return {
          users: filtered,
          total: Math.max(0, state.total - (state.users.length - filtered.length)),
        };
      });
      return;
    }

    set((state) => ({
      users: state.users.map(u =>
        u.id === userId && u._instanceOrigin === origin
          ? {
              ...u,
              relationship,
              ...(requestId !== undefined ? { requestId } : relationship === 'none' ? { requestId: undefined } : {}),
            }
          : u
      ),
    }));
  },

  removeFriendUser: (user: IdentityFields, origin: string) => {
    const targetKey = userKey(user, origin);
    set((state) => {
      const filtered = state.users.filter(
        u => userKey(u, u._instanceOrigin) !== targetKey && !updateIsAbout(u, u._instanceOrigin, user, origin),
      );
      if (filtered.length === state.users.length) return state;
      return {
        users: filtered,
        total: Math.max(0, state.total - (state.users.length - filtered.length)),
      };
    });
  },

  removeDeletedUser: (user: IdentityFields, origin: string) => {
    set((state) => {
      const filtered = state.users.filter(u => !updateIsAbout(u, u._instanceOrigin, user, origin));
      if (filtered.length === state.users.length) return state;
      return {
        users: filtered,
        total: Math.max(0, state.total - (state.users.length - filtered.length)),
      };
    });
  },

  reset: () => set({
    users: [],
    searchQuery: '',
    isLoading: false,
    total: 0,
    error: null,
  }),
}));
