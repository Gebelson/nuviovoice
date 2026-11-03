import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProfileVisibilityScope =
  | 'all_friends_and_spaces'
  | 'friends_and_small_spaces'
  | 'friends_only';

export type ContentFilterAction = 'show' | 'blur' | 'block';

export type SpamFilterMode = 'all' | 'non_friends' | 'off';

export type GameDmDisplayMode = 'all' | 'same_game' | 'none';

export type ReactionNotificationScope = 'all' | 'dms_and_mentions' | 'none';

export type SurfaceThemePreset = 'obsidian' | 'midnight_contrast' | 'amethyst_glass';

export type MessageDensityPreset = 'comfortable' | 'balanced' | 'compact';

export type TimeFormatOption = '24h' | '12h';

export type DateFormatOption = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export type TimezoneModeOption = 'auto' | 'utc';

export type ActivityShareScope =
  | 'all_spaces_and_friends'
  | 'small_spaces_and_friends'
  | 'friends_only';

export type ActivityJoinPermission =
  | 'friends_and_space_members'
  | 'friends_only'
  | 'nobody';

export type OverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ModeratedAccountEntry {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  addedAt: number;
}

export interface RegisteredGameEntry {
  id: string;
  gameName: string;
  executablePath: string;
  detectionEnabled: boolean;
  overlayEnabled: boolean;
  addedAt: number;
}

export interface AuthorizedAppEntry {
  id: string;
  appName: string;
  developerName: string;
  scopeKeys: Array<'profile_read' | 'spaces_read' | 'activity_status' | 'stream_link'>;
  authorizedAt: number;
}

export interface UserPreferencesState {
  // 2. Data & Privacy
  useDataToOperate: boolean;
  useDataToPersonalize: boolean;
  allowSponsoredContent: boolean;
  allowThirdPartyIntegrationData: boolean;
  lastDataExportRequestedAt: number | null;
  profileVisibility: ProfileVisibilityScope;
  notifyFriendsOnProfileUpdate: boolean;
  persistentVoiceVerificationCodes: boolean;

  // 3. Message Permissions
  sensitiveMediaFriendsDm: ContentFilterAction;
  sensitiveMediaStrangersDm: ContentFilterAction;
  sensitiveMediaSpaceChannels: ContentFilterAction;
  graphicMediaFriendsDm: ContentFilterAction;
  graphicMediaStrangersDm: ContentFilterAction;
  graphicMediaSpaceChannels: ContentFilterAction;
  allowAgeRestrictedSpaces: boolean;
  spamFilterMode: SpamFilterMode;
  defaultAllowSpaceMemberDms: boolean;
  enableMessageRequests: boolean;
  friendRequestsEveryone: boolean;
  friendRequestsMutualFriends: boolean;
  friendRequestsSpaceMembers: boolean;
  showFriendRequestCustomMessage: boolean;
  allowConnectedGameFriendDms: boolean;
  allowConnectedGameMatchInvites: boolean;
  gameDmDisplayMode: GameDmDisplayMode;
  blockedAccounts: ModeratedAccountEntry[];
  ignoredAccounts: ModeratedAccountEntry[];

  // 4. Notifications
  desktopNotificationsEnabled: boolean;
  taskbarFlashEnabled: boolean;
  notifyFriendOnline: boolean;
  notifyFriendProfileUpdate: boolean;
  notifySpaceEvents: boolean;
  notifyMessageReactions: boolean;
  reactionNotificationScope: ReactionNotificationScope;
  soundNewMessage: boolean;
  soundIncomingCall: boolean;
  soundVoiceJoinLeave: boolean;
  muteAllNotificationSounds: boolean;
  badgeUnreadIndicator: boolean;
  badgeMentionCount: boolean;
  badgeHighlightChannels: boolean;
  emailCommunication: boolean;
  emailSocial: boolean;
  emailUpdates: boolean;
  emailTips: boolean;
  emailRecommendations: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  suppressNotificationsOnStream: boolean;

  // 5. Experience
  surfaceTheme: SurfaceThemePreset;
  messageDensity: MessageDensityPreset;
  showAvatarsInCompact: boolean;
  highContrastMode: boolean;
  alwaysUnderlineLinks: boolean;
  colorSaturation: number;
  highlightSpeakingIndicator: boolean;
  timeFormat: TimeFormatOption;
  dateFormat: DateFormatOption;
  timezoneMode: TimezoneModeOption;

  // 6. Games & Apps
  registeredGames: RegisteredGameEntry[];
  shareActivityElapsed: boolean;
  activityShareScope: ActivityShareScope;
  activityJoinPermission: ActivityJoinPermission;
  overlayEnabled: boolean;
  overlayCorner: OverlayCorner;
  overlayOpacity: number;
  overlayVoiceWidgetEnabled: boolean;
  overlayShowSpeakingAvatars: boolean;
  overlayShowParticipantNames: boolean;
  overlayShowTextNotifications: boolean;
  authorizedApps: AuthorizedAppEntry[];

  // Actions
  setPreference: <K extends keyof UserPreferencesValues>(
    key: K,
    value: UserPreferencesValues[K],
  ) => void;
  requestDataArchive: () => void;
  addBlockedAccount: (account: Omit<ModeratedAccountEntry, 'addedAt'>) => void;
  removeBlockedAccount: (id: string) => void;
  addIgnoredAccount: (account: Omit<ModeratedAccountEntry, 'addedAt'>) => void;
  removeIgnoredAccount: (id: string) => void;
  addRegisteredGame: (gameName: string, executablePath: string) => void;
  toggleRegisteredGameDetection: (id: string) => void;
  toggleRegisteredGameOverlay: (id: string) => void;
  removeRegisteredGame: (id: string) => void;
  revokeAuthorizedApp: (id: string) => void;
  unsubscribeAllMarketingEmails: () => void;
}

type UserPreferencesValues = Omit<
  UserPreferencesState,
  | 'setPreference'
  | 'requestDataArchive'
  | 'addBlockedAccount'
  | 'removeBlockedAccount'
  | 'addIgnoredAccount'
  | 'removeIgnoredAccount'
  | 'addRegisteredGame'
  | 'toggleRegisteredGameDetection'
  | 'toggleRegisteredGameOverlay'
  | 'removeRegisteredGame'
  | 'revokeAuthorizedApp'
  | 'unsubscribeAllMarketingEmails'
>;

export function applyExperiencePreferencesToDocument(state: {
  surfaceTheme: SurfaceThemePreset;
  messageDensity: MessageDensityPreset;
  highContrastMode: boolean;
  alwaysUnderlineLinks: boolean;
  colorSaturation: number;
}): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.surfaceTheme = state.surfaceTheme;
  root.dataset.messageDensity = state.messageDensity;
  if (state.highContrastMode) {
    root.dataset.highContrast = 'true';
  } else {
    delete root.dataset.highContrast;
  }
  if (state.alwaysUnderlineLinks) {
    root.dataset.underlineLinks = 'true';
  } else {
    delete root.dataset.underlineLinks;
  }
  root.style.setProperty('--nuvio-saturation', `${state.colorSaturation}%`);
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      // 2. Data & Privacy
      useDataToOperate: true,
      useDataToPersonalize: true,
      allowSponsoredContent: false,
      allowThirdPartyIntegrationData: false,
      lastDataExportRequestedAt: null,
      profileVisibility: 'all_friends_and_spaces',
      notifyFriendsOnProfileUpdate: true,
      persistentVoiceVerificationCodes: true,

      // 3. Message Permissions
      sensitiveMediaFriendsDm: 'blur',
      sensitiveMediaStrangersDm: 'blur',
      sensitiveMediaSpaceChannels: 'blur',
      graphicMediaFriendsDm: 'blur',
      graphicMediaStrangersDm: 'block',
      graphicMediaSpaceChannels: 'blur',
      allowAgeRestrictedSpaces: false,
      spamFilterMode: 'non_friends',
      defaultAllowSpaceMemberDms: true,
      enableMessageRequests: true,
      friendRequestsEveryone: true,
      friendRequestsMutualFriends: true,
      friendRequestsSpaceMembers: true,
      showFriendRequestCustomMessage: true,
      allowConnectedGameFriendDms: true,
      allowConnectedGameMatchInvites: true,
      gameDmDisplayMode: 'all',
      blockedAccounts: [],
      ignoredAccounts: [],

      // 4. Notifications
      desktopNotificationsEnabled: true,
      taskbarFlashEnabled: true,
      notifyFriendOnline: false,
      notifyFriendProfileUpdate: false,
      notifySpaceEvents: true,
      notifyMessageReactions: true,
      reactionNotificationScope: 'dms_and_mentions',
      soundNewMessage: true,
      soundIncomingCall: true,
      soundVoiceJoinLeave: true,
      muteAllNotificationSounds: false,
      badgeUnreadIndicator: true,
      badgeMentionCount: true,
      badgeHighlightChannels: true,
      emailCommunication: true,
      emailSocial: true,
      emailUpdates: true,
      emailTips: false,
      emailRecommendations: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      suppressNotificationsOnStream: true,

      // 5. Experience
      surfaceTheme: 'obsidian',
      messageDensity: 'balanced',
      showAvatarsInCompact: true,
      highContrastMode: false,
      alwaysUnderlineLinks: false,
      colorSaturation: 100,
      highlightSpeakingIndicator: true,
      timeFormat: '24h',
      dateFormat: 'DD/MM/YYYY',
      timezoneMode: 'auto',

      // 6. Games & Apps
      registeredGames: [],
      shareActivityElapsed: true,
      activityShareScope: 'all_spaces_and_friends',
      activityJoinPermission: 'friends_only',
      overlayEnabled: true,
      overlayCorner: 'top-right',
      overlayOpacity: 90,
      overlayVoiceWidgetEnabled: true,
      overlayShowSpeakingAvatars: true,
      overlayShowParticipantNames: true,
      overlayShowTextNotifications: true,
      authorizedApps: [
        {
          id: 'nuvio-live-bridge',
          appName: 'Nuvio Live Stream Bridge',
          developerName: 'Nuvio Official',
          scopeKeys: ['profile_read', 'stream_link', 'activity_status'],
          authorizedAt: 1760000000000,
        },
      ],

      setPreference: (key, value) => {
        set({ [key]: value } as Partial<UserPreferencesState>);
        const next = get();
        applyExperiencePreferencesToDocument({
          surfaceTheme: next.surfaceTheme,
          messageDensity: next.messageDensity,
          highContrastMode: next.highContrastMode,
          alwaysUnderlineLinks: next.alwaysUnderlineLinks,
          colorSaturation: next.colorSaturation,
        });
      },

      requestDataArchive: () => {
        set({ lastDataExportRequestedAt: Date.now() });
      },

      addBlockedAccount: (account) => {
        set((state) => {
          if (state.blockedAccounts.some((a) => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase())) {
            return state;
          }
          return {
            blockedAccounts: [
              { ...account, addedAt: Date.now() },
              ...state.blockedAccounts,
            ],
          };
        });
      },

      removeBlockedAccount: (id) => {
        set((state) => ({
          blockedAccounts: state.blockedAccounts.filter((a) => a.id !== id),
        }));
      },

      addIgnoredAccount: (account) => {
        set((state) => {
          if (state.ignoredAccounts.some((a) => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase())) {
            return state;
          }
          return {
            ignoredAccounts: [
              { ...account, addedAt: Date.now() },
              ...state.ignoredAccounts,
            ],
          };
        });
      },

      removeIgnoredAccount: (id) => {
        set((state) => ({
          ignoredAccounts: state.ignoredAccounts.filter((a) => a.id !== id),
        }));
      },

      addRegisteredGame: (gameName, executablePath) => {
        const trimmedName = gameName.trim();
        if (!trimmedName) return;
        set((state) => ({
          registeredGames: [
            {
              id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              gameName: trimmedName,
              executablePath: executablePath.trim() || `${trimmedName.toLowerCase().replace(/\s+/g, '')}.exe`,
              detectionEnabled: true,
              overlayEnabled: true,
              addedAt: Date.now(),
            },
            ...state.registeredGames,
          ],
        }));
      },

      toggleRegisteredGameDetection: (id) => {
        set((state) => ({
          registeredGames: state.registeredGames.map((g) =>
            g.id === id ? { ...g, detectionEnabled: !g.detectionEnabled } : g,
          ),
        }));
      },

      toggleRegisteredGameOverlay: (id) => {
        set((state) => ({
          registeredGames: state.registeredGames.map((g) =>
            g.id === id ? { ...g, overlayEnabled: !g.overlayEnabled } : g,
          ),
        }));
      },

      removeRegisteredGame: (id) => {
        set((state) => ({
          registeredGames: state.registeredGames.filter((g) => g.id !== id),
        }));
      },

      revokeAuthorizedApp: (id) => {
        set((state) => ({
          authorizedApps: state.authorizedApps.filter((app) => app.id !== id),
        }));
      },

      unsubscribeAllMarketingEmails: () => {
        set({
          emailUpdates: false,
          emailTips: false,
          emailRecommendations: false,
        });
      },
    }),
    {
      name: 'nuvio-user-preferences-v1',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyExperiencePreferencesToDocument({
            surfaceTheme: state.surfaceTheme,
            messageDensity: state.messageDensity,
            highContrastMode: state.highContrastMode,
            alwaysUnderlineLinks: state.alwaysUnderlineLinks,
            colorSaturation: state.colorSaturation,
          });
        }
      },
    },
  ),
);
