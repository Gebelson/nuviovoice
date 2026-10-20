import { create } from 'zustand';
import { api } from '../api/client';
import type {
  Bot,
  BotCategory,
  BotInstallation,
  BotReview,
  MessageWithUser,
} from '@concord/shared';

interface BotState {
  categories: BotCategory[];
  bots: Bot[];
  total: number;
  search: string;
  selectedCategory: string | null;
  selectedSort: 'featured' | 'popular' | 'newest' | 'top_rated';
  installedSpaceBots: Record<string, Array<BotInstallation & { bot: Bot }>>;
  myBots: Bot[];
  adminQueue: Bot[];
  isLoading: boolean;
  error: string | null;

  // Search & Filter Actions
  setSearch: (search: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedSort: (sort: 'featured' | 'popular' | 'newest' | 'top_rated') => void;

  // Catalog Actions
  loadCategories: () => Promise<void>;
  loadBots: () => Promise<void>;
  loadBot: (slugOrId: string) => Promise<Bot | null>;
  loadReviews: (botId: string) => Promise<BotReview[]>;
  postReview: (botId: string, rating: number, comment?: string) => Promise<boolean>;

  // Space Management Actions
  loadSpaceBots: (spaceId: string) => Promise<Array<BotInstallation & { bot: Bot }>>;
  installBot: (
    spaceId: string,
    botId: string,
    grantedPermissions?: string[]
  ) => Promise<{ success: boolean; bot?: Bot }>;
  uninstallBot: (spaceId: string, botId: string) => Promise<boolean>;
  updatePermissions: (
    spaceId: string,
    botId: string,
    grantedPermissions: string[]
  ) => Promise<boolean>;

  // Developer Portal Actions
  loadMyBots: () => Promise<Bot[]>;
  createBot: (data: any) => Promise<Bot>;
  updateBot: (id: string, data: any) => Promise<Bot>;
  regenerateToken: (id: string) => Promise<string>;
  submitForReview: (id: string) => Promise<boolean>;
  getStats: (id: string) => Promise<any>;

  // Admin Actions
  loadAdminQueue: (status?: string) => Promise<void>;
  adminReview: (id: string, status: string) => Promise<boolean>;
  adminVerify: (id: string, isVerified: boolean) => Promise<boolean>;

  // Slash Command Execution
  executeCommand: (
    channelId: string,
    command: string,
    args?: string
  ) => Promise<MessageWithUser | null>;

  // Realtime updates
  handleBotInstalled: (spaceId: string, bot: Bot) => void;
  handleBotUninstalled: (spaceId: string, botId: string) => void;
}

export const useBotStore = create<BotState>((set, get) => ({
  categories: [],
  bots: [],
  total: 0,
  search: '',
  selectedCategory: null,
  selectedSort: 'featured',
  installedSpaceBots: {},
  myBots: [],
  adminQueue: [],
  isLoading: false,
  error: null,

  setSearch: (search) => {
    set({ search });
    void get().loadBots();
  },

  setSelectedCategory: (selectedCategory) => {
    set({ selectedCategory });
    void get().loadBots();
  },

  setSelectedSort: (selectedSort) => {
    set({ selectedSort });
    void get().loadBots();
  },

  loadCategories: async () => {
    try {
      const res = await api.bots.getCategories();
      set({ categories: res.categories });
    } catch (err: any) {
      console.error('Failed to load bot categories:', err);
    }
  },

  loadBots: async () => {
    const { search, selectedCategory, selectedSort } = get();
    set({ isLoading: true, error: null });
    try {
      const res = await api.bots.getBots({
        search: search.trim() || undefined,
        category: selectedCategory || undefined,
        sort: selectedSort,
        limit: 48,
      });
      set({ bots: res.bots, total: res.total, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar bots', isLoading: false });
    }
  },

  loadBot: async (slugOrId) => {
    try {
      const res = await api.bots.getBot(slugOrId);
      return res.bot;
    } catch (err) {
      console.error(`Failed to load bot ${slugOrId}:`, err);
      return null;
    }
  },

  loadReviews: async (botId) => {
    try {
      const res = await api.bots.getReviews(botId);
      return res.reviews;
    } catch (err) {
      console.error(`Failed to load reviews for bot ${botId}:`, err);
      return [];
    }
  },

  postReview: async (botId, rating, comment) => {
    try {
      await api.bots.postReview(botId, { rating, comment });
      void get().loadBots();
      return true;
    } catch (err) {
      console.error(`Failed to post review for bot ${botId}:`, err);
      return false;
    }
  },

  loadSpaceBots: async (spaceId) => {
    try {
      const res = await api.bots.getSpaceBots(spaceId);
      set((state) => ({
        installedSpaceBots: {
          ...state.installedSpaceBots,
          [spaceId]: res.bots,
        },
      }));
      return res.bots;
    } catch (err) {
      console.error(`Failed to load bots for space ${spaceId}:`, err);
      return [];
    }
  },

  installBot: async (spaceId, botId, grantedPermissions = []) => {
    try {
      const res = await api.bots.installBot(spaceId, botId, { grantedPermissions });
      await get().loadSpaceBots(spaceId);
      return { success: true, bot: res.bot };
    } catch (err: any) {
      console.error(`Failed to install bot ${botId} in space ${spaceId}:`, err);
      return { success: false };
    }
  },

  uninstallBot: async (spaceId, botId) => {
    try {
      await api.bots.uninstallBot(spaceId, botId);
      set((state) => {
        const current = state.installedSpaceBots[spaceId] || [];
        return {
          installedSpaceBots: {
            ...state.installedSpaceBots,
            [spaceId]: current.filter((item) => item.botId !== botId),
          },
        };
      });
      return true;
    } catch (err) {
      console.error(`Failed to uninstall bot ${botId} from space ${spaceId}:`, err);
      return false;
    }
  },

  updatePermissions: async (spaceId, botId, grantedPermissions) => {
    try {
      await api.bots.updatePermissions(spaceId, botId, { grantedPermissions });
      await get().loadSpaceBots(spaceId);
      return true;
    } catch (err) {
      console.error(`Failed to update permissions for bot ${botId}:`, err);
      return false;
    }
  },

  loadMyBots: async () => {
    try {
      const res = await api.bots.getMyBots();
      set({ myBots: res.bots });
      return res.bots;
    } catch (err) {
      console.error('Failed to load developer bots:', err);
      return [];
    }
  },

  createBot: async (data) => {
    const res = await api.bots.createBot(data);
    set((state) => ({ myBots: [res.bot, ...state.myBots] }));
    return res.bot;
  },

  updateBot: async (id, data) => {
    const res = await api.bots.updateBot(id, data);
    set((state) => ({
      myBots: state.myBots.map((b) => (b.id === id ? res.bot : b)),
      bots: state.bots.map((b) => (b.id === id ? res.bot : b)),
    }));
    return res.bot;
  },

  regenerateToken: async (id) => {
    const res = await api.bots.regenerateToken(id);
    set((state) => ({
      myBots: state.myBots.map((b) =>
        b.id === id ? { ...b, botToken: res.botToken } : b
      ),
    }));
    return res.botToken;
  },

  submitForReview: async (id) => {
    try {
      await api.bots.submitForReview(id);
      set((state) => ({
        myBots: state.myBots.map((b) =>
          b.id === id ? { ...b, status: 'pending_review' } : b
        ),
      }));
      return true;
    } catch (err) {
      console.error(`Failed to submit bot ${id} for review:`, err);
      return false;
    }
  },

  getStats: async (id) => {
    return api.bots.getStats(id);
  },

  loadAdminQueue: async (status) => {
    try {
      const res = await api.bots.adminGetQueue({ status });
      set({ adminQueue: res.bots });
    } catch (err) {
      console.error('Failed to load admin bot queue:', err);
    }
  },

  adminReview: async (id, status) => {
    try {
      await api.bots.adminReview(id, { status });
      set((state) => ({
        adminQueue: state.adminQueue.filter((b) => b.id !== id),
      }));
      return true;
    } catch (err) {
      console.error(`Failed to review bot ${id}:`, err);
      return false;
    }
  },

  adminVerify: async (id, isVerified) => {
    try {
      await api.bots.adminVerify(id, { isVerified });
      set((state) => ({
        bots: state.bots.map((b) =>
          b.id === id ? { ...b, isVerified } : b
        ),
      }));
      return true;
    } catch (err) {
      console.error(`Failed to verify bot ${id}:`, err);
      return false;
    }
  },

  executeCommand: async (channelId, command, args) => {
    try {
      const res = await api.bots.executeCommand(channelId, { command, args });
      return res.message;
    } catch (err) {
      console.error(`Failed to execute command ${command}:`, err);
      throw err;
    }
  },

  handleBotInstalled: (spaceId, bot) => {
    set((state) => {
      const current = state.installedSpaceBots[spaceId] || [];
      const exists = current.some((item) => item.botId === bot.id);
      if (exists) return state;

      const newInstall: BotInstallation & { bot: Bot } = {
        id: `binst_${bot.id}_${Date.now()}`,
        botId: bot.id,
        bot,
        spaceId,
        installedBy: '',
        grantedPermissions: bot.requiredPermissions,
        status: 'active',
        installedAt: Date.now(),
        updatedAt: Date.now(),
      };

      return {
        installedSpaceBots: {
          ...state.installedSpaceBots,
          [spaceId]: [...current, newInstall],
        },
      };
    });
  },

  handleBotUninstalled: (spaceId, botId) => {
    set((state) => {
      const current = state.installedSpaceBots[spaceId] || [];
      return {
        installedSpaceBots: {
          ...state.installedSpaceBots,
          [spaceId]: current.filter((item) => item.botId !== botId),
        },
      };
    });
  },
}));
