import { beforeEach, describe, expect, it } from 'vitest';
import {
  useUserPreferencesStore,
  applyExperiencePreferencesToDocument,
} from './userPreferencesStore';

describe('userPreferencesStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useUserPreferencesStore.setState({
      surfaceTheme: 'obsidian',
      messageDensity: 'balanced',
      showAvatarsInCompact: true,
      highContrastMode: false,
      alwaysUnderlineLinks: false,
      colorSaturation: 100,
      blockedAccounts: [],
      ignoredAccounts: [],
      registeredGames: [],
    });
    document.documentElement.removeAttribute('data-surface-theme');
    document.documentElement.removeAttribute('data-message-density');
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-underline-links');
  });

  it('updates preferences and applies DOM attributes', () => {
    const store = useUserPreferencesStore.getState();

    store.setPreference('surfaceTheme', 'midnight_contrast');
    expect(document.documentElement.dataset.surfaceTheme).toBe('midnight_contrast');

    store.setPreference('messageDensity', 'compact');
    expect(document.documentElement.dataset.messageDensity).toBe('compact');

    store.setPreference('highContrastMode', true);
    expect(document.documentElement.dataset.highContrast).toBe('true');

    store.setPreference('alwaysUnderlineLinks', true);
    expect(document.documentElement.dataset.underlineLinks).toBe('true');

    store.setPreference('colorSaturation', 80);
    expect(document.documentElement.style.getPropertyValue('--nuvio-saturation')).toBe('80%');
  });

  it('manages blocked and ignored accounts', () => {
    const store = useUserPreferencesStore.getState();

    store.addBlockedAccount({
      id: 'acc-1',
      username: 'troll',
      displayName: 'Troll User',
      avatar: null,
      addedAt: 0,
    });

    expect(useUserPreferencesStore.getState().blockedAccounts).toHaveLength(1);
    expect(useUserPreferencesStore.getState().blockedAccounts[0].username).toBe('troll');

    store.removeBlockedAccount('acc-1');
    expect(useUserPreferencesStore.getState().blockedAccounts).toHaveLength(0);

    store.addIgnoredAccount({
      id: 'acc-2',
      username: 'spammer',
      displayName: 'Spam Account',
      avatar: null,
      addedAt: 0,
    });

    expect(useUserPreferencesStore.getState().ignoredAccounts).toHaveLength(1);
    store.removeIgnoredAccount('acc-2');
    expect(useUserPreferencesStore.getState().ignoredAccounts).toHaveLength(0);
  });

  it('manages manually registered games', () => {
    const store = useUserPreferencesStore.getState();

    store.addRegisteredGame('Dead Cells', 'deadcells.exe');
    const games = useUserPreferencesStore.getState().registeredGames;
    expect(games).toHaveLength(1);
    expect(games[0].gameName).toBe('Dead Cells');
    expect(games[0].executablePath).toBe('deadcells.exe');
    expect(games[0].detectionEnabled).toBe(true);

    const gameId = games[0].id;
    store.toggleRegisteredGameDetection(gameId);
    expect(useUserPreferencesStore.getState().registeredGames[0].detectionEnabled).toBe(false);

    store.toggleRegisteredGameOverlay(gameId);
    expect(useUserPreferencesStore.getState().registeredGames[0].overlayEnabled).toBe(false);

    store.removeRegisteredGame(gameId);
    expect(useUserPreferencesStore.getState().registeredGames).toHaveLength(0);
  });

  it('revokes authorized applications', () => {
    const store = useUserPreferencesStore.getState();
    expect(store.authorizedApps.length).toBeGreaterThan(0);

    const targetId = store.authorizedApps[0].id;
    store.revokeAuthorizedApp(targetId);
    expect(useUserPreferencesStore.getState().authorizedApps.some((a) => a.id === targetId)).toBe(false);
  });
});
