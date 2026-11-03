import { create } from 'zustand';
import { api } from '../api/client';
import type {
  OpportunityItem,
  OpportunityFilters,
  CreateOpportunityRequest,
  ApplyOpportunityRequest,
  NegotiateOpportunityRequest,
  ProfessionalProfile,
  OpportunityApplication,
  OpportunityNegotiation,
  OpportunityApplicationMessage,
} from '@concord/shared';

interface OpportunityState {
  // Catalog
  opportunities: OpportunityItem[];
  total: number;
  filters: OpportunityFilters;
  isLoading: boolean;
  error: string | null;
  selectedOpportunity: OpportunityItem | null;
  myOpportunities: OpportunityItem[];
  favorites: OpportunityItem[];
  favoriteIds: Set<string>;

  // Inbox & Proposals
  applications: OpportunityApplication[];
  applicationCounts: { received: number; sent: number; pending: number; unlocked: number };
  activeApplication: OpportunityApplication | null;
  activeMessages: OpportunityApplicationMessage[];
  activeNegotiations: OpportunityNegotiation[];
  activeOpportunity: OpportunityItem | null;
  activeApplicantProfile: any | null;
  isMessagesLoading: boolean;
  applicationRole: 'recipient' | 'applicant';
  applicationFilterStatus: string;
  applicationFilterType: string;

  receivedApplications: OpportunityApplication[];
  sentApplications: OpportunityApplication[];
  selectedApplicationId: string | null;
  isApplicationsLoading: boolean;
  selectApplication: (id: string | null) => Promise<void>;
  fetchReceivedApplications: () => Promise<void>;
  fetchSentApplications: () => Promise<void>;
  updateOpportunityStatus: (id: string, status: 'published' | 'paused' | 'closed') => Promise<void>;

  // Profile
  myProfile: ProfessionalProfile | null;
  isLoadingProfile: boolean;

  // Actions
  fetchOpportunities: (customFilters?: Partial<OpportunityFilters>) => Promise<void>;
  setFilters: (newFilters: Partial<OpportunityFilters>) => void;
  resetFilters: () => void;
  fetchOpportunityById: (id: string) => Promise<OpportunityItem | null>;
  fetchMyOpportunities: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  createOpportunity: (data: CreateOpportunityRequest) => Promise<OpportunityItem>;
  updateOpportunity: (id: string, data: Partial<CreateOpportunityRequest>) => Promise<OpportunityItem>;
  pauseOpportunity: (id: string) => Promise<void>;
  closeOpportunity: (id: string) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;

  fetchMyProfile: () => Promise<void>;
  updateMyProfile: (data: Partial<ProfessionalProfile>) => Promise<ProfessionalProfile>;

  setApplicationRole: (role: 'recipient' | 'applicant') => void;
  setApplicationFilterStatus: (status: string) => void;
  setApplicationFilterType: (type: string) => void;
  fetchApplications: () => Promise<void>;
  applyToOpportunity: (id: string, data: ApplyOpportunityRequest) => Promise<OpportunityApplication>;
  openApplication: (id: string) => Promise<void>;
  closeActiveApplication: () => void;
  acceptApplication: (id: string) => Promise<void>;
  rejectApplication: (id: string) => Promise<void>;
  withdrawApplication: (id: string) => Promise<void>;

  sendApplicationMessage: (content: string, attachments?: any[]) => Promise<void>;
  proposeNegotiation: (data: NegotiateOpportunityRequest) => Promise<void>;
  acceptNegotiation: (id: string) => Promise<void>;
  declineNegotiation: (id: string) => Promise<void>;

  // WebSocket listeners
  onApplicationCreated: (event: any) => void;
  onChatUnlocked: (event: { applicationId: string; unlockedAt: number }) => void;
  onApplicationMessageCreated: (event: { message: OpportunityApplicationMessage }) => void;
  onNegotiationUpdated: (event: any) => void;
}

const defaultFilters: OpportunityFilters = {
  sort: 'recent',
  limit: 24,
  offset: 0,
};

export const useOpportunityStore = create<OpportunityState>((set, get) => ({
  opportunities: [],
  total: 0,
  filters: defaultFilters,
  isLoading: false,
  error: null,
  selectedOpportunity: null,
  myOpportunities: [],
  favorites: [],
  favoriteIds: new Set<string>(),

  applications: [],
  applicationCounts: { received: 0, sent: 0, pending: 0, unlocked: 0 },
  activeApplication: null,
  activeMessages: [],
  activeNegotiations: [],
  activeOpportunity: null,
  activeApplicantProfile: null,
  isMessagesLoading: false,
  applicationRole: 'recipient',
  applicationFilterStatus: 'all',
  applicationFilterType: 'all',
  receivedApplications: [],
  sentApplications: [],
  selectedApplicationId: null,
  isApplicationsLoading: false,

  myProfile: null,
  isLoadingProfile: false,

  fetchOpportunities: async (customFilters) => {
    set({ isLoading: true, error: null });
    const current = { ...get().filters, ...(customFilters || {}) };
    set({ filters: current });
    try {
      const res = await api.opportunities.list(current);
      set({ opportunities: res.opportunities, total: res.total, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Erro ao carregar oportunidades', isLoading: false });
    }
  },

  setFilters: (newFilters) => {
    const updated = { ...get().filters, ...newFilters, offset: 0 };
    get().fetchOpportunities(updated);
  },

  resetFilters: () => {
    get().fetchOpportunities(defaultFilters);
  },

  fetchOpportunityById: async (id) => {
    try {
      const res = await api.opportunities.get(id);
      set({ selectedOpportunity: res.opportunity });
      return res.opportunity;
    } catch (err) {
      return null;
    }
  },

  fetchMyOpportunities: async () => {
    try {
      const res = await api.opportunities.my();
      set({ myOpportunities: res.opportunities });
    } catch {}
  },

  fetchFavorites: async () => {
    try {
      const res = await api.opportunities.listFavorites();
      const favSet = new Set(res.opportunities.map((o) => o.id));
      set({ favorites: res.opportunities, favoriteIds: favSet });
    } catch {}
  },

  toggleFavorite: async (id) => {
    try {
      const res = await api.opportunities.favorite(id);
      const nextSet = new Set(get().favoriteIds);
      if (res.isFavorite) {
        nextSet.add(id);
      } else {
        nextSet.delete(id);
      }
      set({
        favoriteIds: nextSet,
        opportunities: get().opportunities.map((o) => (o.id === id ? { ...o, isFavorite: res.isFavorite } : o)),
      });
      return res.isFavorite;
    } catch {
      return false;
    }
  },

  createOpportunity: async (data) => {
    const res = await api.opportunities.create(data);
    set((state) => ({
      opportunities: [res.opportunity, ...state.opportunities],
      myOpportunities: [res.opportunity, ...state.myOpportunities],
    }));
    return res.opportunity;
  },

  updateOpportunity: async (id, data) => {
    const res = await api.opportunities.update(id, data);
    set((state) => ({
      opportunities: state.opportunities.map((o) => (o.id === id ? res.opportunity : o)),
      myOpportunities: state.myOpportunities.map((o) => (o.id === id ? res.opportunity : o)),
      selectedOpportunity: state.selectedOpportunity?.id === id ? res.opportunity : state.selectedOpportunity,
    }));
    return res.opportunity;
  },

  pauseOpportunity: async (id) => {
    const res = await api.opportunities.pause(id);
    set((state) => ({
      myOpportunities: state.myOpportunities.map((o) => (o.id === id ? { ...o, status: res.status as any } : o)),
      opportunities: state.opportunities.map((o) => (o.id === id ? { ...o, status: res.status as any } : o)),
    }));
  },

  closeOpportunity: async (id) => {
    await api.opportunities.close(id);
    set((state) => ({
      myOpportunities: state.myOpportunities.map((o) => (o.id === id ? { ...o, status: 'closed' } : o)),
      opportunities: state.opportunities.map((o) => (o.id === id ? { ...o, status: 'closed' } : o)),
    }));
  },

  deleteOpportunity: async (id) => {
    await api.opportunities.delete(id);
    set((state) => ({
      myOpportunities: state.myOpportunities.filter((o) => o.id !== id),
      opportunities: state.opportunities.filter((o) => o.id !== id),
    }));
  },

  fetchMyProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const res = await api.opportunities.getMyProfile();
      set({ myProfile: res.profile, isLoadingProfile: false });
    } catch {
      set({ isLoadingProfile: false });
    }
  },

  updateMyProfile: async (data) => {
    const res = await api.opportunities.updateMyProfile(data);
    set({ myProfile: res.profile });
    return res.profile;
  },

  setApplicationRole: (role) => {
    set({ applicationRole: role });
    get().fetchApplications();
  },

  setApplicationFilterStatus: (status) => {
    set({ applicationFilterStatus: status });
    get().fetchApplications();
  },

  setApplicationFilterType: (type) => {
    set({ applicationFilterType: type });
    get().fetchApplications();
  },

  fetchApplications: async () => {
    const { applicationRole, applicationFilterStatus, applicationFilterType } = get();
    try {
      const res = await api.opportunities.listApplications({
        as: applicationRole,
        status: applicationFilterStatus !== 'all' ? applicationFilterStatus : undefined,
        type: applicationFilterType !== 'all' ? applicationFilterType : undefined,
      });
      set({ applications: res.applications, applicationCounts: res.counts });
    } catch {}
  },

  applyToOpportunity: async (id, data) => {
    const res = await api.opportunities.apply(id, data);
    set((state) => ({
      applications: [res.application, ...state.applications],
      applicationCounts: {
        ...state.applicationCounts,
        sent: state.applicationCounts.sent + 1,
      },
    }));
    return res.application;
  },

  openApplication: async (id) => {
    set({ isMessagesLoading: true });
    try {
      const res = await api.opportunities.getApplication(id);
      set({
        activeApplication: res.application,
        activeOpportunity: res.opportunity,
        activeApplicantProfile: res.applicantProfile,
        activeMessages: res.messages,
        activeNegotiations: res.negotiations,
        isMessagesLoading: false,
      });
    } catch {
      set({ isMessagesLoading: false });
    }
  },

  closeActiveApplication: () => {
    set({
      activeApplication: null,
      activeMessages: [],
      activeNegotiations: [],
      activeOpportunity: null,
      activeApplicantProfile: null,
    });
  },

  acceptApplication: async (id) => {
    const res = await api.opportunities.acceptApplication(id);
    set((state) => ({
      activeApplication: state.activeApplication?.id === id ? { ...state.activeApplication, status: 'chat_unlocked' } : state.activeApplication,
      applications: state.applications.map((a) => (a.id === id ? { ...a, status: 'chat_unlocked' } : a)),
      applicationCounts: {
        ...state.applicationCounts,
        pending: Math.max(0, state.applicationCounts.pending - 1),
        unlocked: state.applicationCounts.unlocked + 1,
      },
    }));
    // Re-fetch messages to show unlock banner
    get().openApplication(id);
  },

  rejectApplication: async (id) => {
    await api.opportunities.rejectApplication(id);
    set((state) => ({
      activeApplication: state.activeApplication?.id === id ? { ...state.activeApplication, status: 'rejected' } : state.activeApplication,
      applications: state.applications.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)),
      applicationCounts: {
        ...state.applicationCounts,
        pending: Math.max(0, state.applicationCounts.pending - 1),
      },
    }));
    get().openApplication(id);
  },

  withdrawApplication: async (id) => {
    await api.opportunities.withdrawApplication(id);
    set((state) => ({
      activeApplication: state.activeApplication?.id === id ? { ...state.activeApplication, status: 'withdrawn' } : state.activeApplication,
      applications: state.applications.map((a) => (a.id === id ? { ...a, status: 'withdrawn' } : a)),
    }));
  },

  sendApplicationMessage: async (content, attachments) => {
    const app = get().activeApplication;
    if (!app) return;
    const res = await api.opportunities.sendMessage(app.id, content, attachments);
    set((state) => ({
      activeMessages: [...state.activeMessages, res.message],
    }));
  },

  proposeNegotiation: async (data) => {
    const app = get().activeApplication;
    if (!app) return;
    const res = await api.opportunities.negotiate(app.id, data);
    set((state) => ({
      activeNegotiations: [res.negotiation, ...state.activeNegotiations],
    }));
    get().openApplication(app.id);
  },

  acceptNegotiation: async (id) => {
    const res = await api.opportunities.acceptNegotiation(id);
    set((state) => ({
      activeNegotiations: state.activeNegotiations.map((n) => (n.id === id ? res.negotiation : n)),
    }));
    const app = get().activeApplication;
    if (app) get().openApplication(app.id);
  },

  declineNegotiation: async (id) => {
    const res = await api.opportunities.declineNegotiation(id);
    set((state) => ({
      activeNegotiations: state.activeNegotiations.map((n) => (n.id === id ? res.negotiation : n)),
    }));
    const app = get().activeApplication;
    if (app) get().openApplication(app.id);
  },

  selectApplication: async (id: string | null) => {
    set({ selectedApplicationId: id });
    if (id) {
      await get().openApplication(id);
    } else {
      get().closeActiveApplication();
    }
  },

  fetchReceivedApplications: async () => {
    set({ isApplicationsLoading: true });
    try {
      const res = await api.opportunities.listApplications({ as: 'recipient' });
      set({
        receivedApplications: res.applications,
        applicationCounts: res.counts,
        isApplicationsLoading: false,
      });
    } catch {
      set({ isApplicationsLoading: false });
    }
  },

  fetchSentApplications: async () => {
    set({ isApplicationsLoading: true });
    try {
      const res = await api.opportunities.listApplications({ as: 'applicant' });
      set({
        sentApplications: res.applications,
        isApplicationsLoading: false,
      });
    } catch {
      set({ isApplicationsLoading: false });
    }
  },

  updateOpportunityStatus: async (id: string, status: 'published' | 'paused' | 'closed') => {
    if (status === 'paused') {
      await get().pauseOpportunity(id);
    } else if (status === 'closed') {
      await get().closeOpportunity(id);
    } else {
      await get().updateOpportunity(id, { status: 'published' });
    }
  },

  onApplicationCreated: (_event) => {
    set((state) => ({
      applicationCounts: {
        ...state.applicationCounts,
        received: state.applicationCounts.received + 1,
        pending: state.applicationCounts.pending + 1,
      },
    }));
    get().fetchApplications();
  },

  onChatUnlocked: (event) => {
    const { activeApplication } = get();
    if (activeApplication && activeApplication.id === event.applicationId) {
      set({
        activeApplication: {
          ...activeApplication,
          status: 'chat_unlocked',
          unlockedAt: event.unlockedAt,
        },
      });
      get().openApplication(event.applicationId);
    }
    get().fetchApplications();
  },

  onApplicationMessageCreated: (event) => {
    const { activeApplication, activeMessages } = get();
    if (activeApplication && activeApplication.id === event.message.applicationId) {
      // Avoid duplicate append
      if (!activeMessages.some((m) => m.id === event.message.id)) {
        set({ activeMessages: [...activeMessages, event.message] });
      }
    }
  },

  onNegotiationUpdated: (event) => {
    const { activeApplication } = get();
    if (activeApplication && activeApplication.id === event.applicationId) {
      get().openApplication(event.applicationId);
    }
  },
}));
