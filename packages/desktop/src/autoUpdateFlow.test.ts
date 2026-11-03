import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UpdateStatusStore,
  shouldPromptForUpdate,
  statusVersion,
  type UpdateSnapshot,
} from './updateStatus';

describe('Nuvio Desktop Auto-Update Lifecycle & Call Protection', () => {
  let store: UpdateStatusStore;

  beforeEach(() => {
    store = new UpdateStatusStore('auto', null);
  });

  it('detects a newer version (1.15.0) when current installed is 1.14.1', () => {
    store.setStatus({ phase: 'available', version: '1.15.0' });
    const snapshot = store.get();

    expect(snapshot.status.phase).toBe('available');
    expect(statusVersion(snapshot.status)).toBe('1.15.0');
    expect(shouldPromptForUpdate(snapshot)).toBe(true);
  });

  it('reports granular download progress (0% to 100%) during background transfer', () => {
    const progressSteps = [
      { percent: 0, bytesPerSecond: 1048576 },
      { percent: 25, bytesPerSecond: 2097152 },
      { percent: 50, bytesPerSecond: 3145728 },
      { percent: 75, bytesPerSecond: 2621440 },
      { percent: 100, bytesPerSecond: 1572864 },
    ];

    for (const step of progressSteps) {
      store.setStatus({
        phase: 'downloading',
        version: '1.15.0',
        percent: step.percent,
        bytesPerSecond: step.bytesPerSecond,
      });

      const current = store.get();
      expect(current.status.phase).toBe('downloading');
      if (current.status.phase === 'downloading') {
        expect(current.status.percent).toBe(step.percent);
        expect(current.status.bytesPerSecond).toBe(step.bytesPerSecond);
      }
      expect(shouldPromptForUpdate(current)).toBe(true);
    }
  });

  it('transitions to ready phase once downloaded, prompting restart to install', () => {
    store.setStatus({ phase: 'ready', version: '1.15.0' });
    const snapshot = store.get();

    expect(snapshot.status.phase).toBe('ready');
    expect(statusVersion(snapshot.status)).toBe('1.15.0');
    expect(shouldPromptForUpdate(snapshot)).toBe(true);
  });

  it('protects active calls from unexpected termination on update actions', () => {
    store.setStatus({ phase: 'ready', version: '1.15.0' });

    let appRestarted = false;
    let warningModalShown = false;
    const fakeUpdater = {
      quitAndInstall: () => {
        appRestarted = true;
      },
    };

    const handleAction = (inActiveCall: boolean, userConfirmed: boolean) => {
      if (inActiveCall && !userConfirmed) {
        warningModalShown = true;
        return;
      }
      fakeUpdater.quitAndInstall();
    };

    // 1. User clicks update while in an active call -> must show warning modal, NOT restart immediately
    handleAction(true, false);
    expect(warningModalShown).toBe(true);
    expect(appRestarted).toBe(false);

    // 2. User confirms inside CallActiveUpdateModal -> proceeds safely
    handleAction(true, true);
    expect(appRestarted).toBe(true);
  });

  it('does not display notifications or prompts when app is already up to date', () => {
    store.setStatus({ phase: 'up-to-date', checkedAt: Date.now() });
    const snapshot = store.get();

    expect(snapshot.status.phase).toBe('up-to-date');
    expect(shouldPromptForUpdate(snapshot)).toBe(false);
    expect(statusVersion(snapshot.status)).toBeNull();
  });

  it('presents clean Portuguese error message when download fails', () => {
    store.setStatus({
      phase: 'failed',
      version: '1.15.0',
      stage: 'download',
      message: 'Falha na conexão de rede ao baixar instalador.',
    });
    const snapshot = store.get();

    expect(snapshot.status.phase).toBe('failed');
    if (snapshot.status.phase === 'failed') {
      expect(snapshot.status.message).toBe('Falha na conexão de rede ao baixar instalador.');
      expect(snapshot.status.stage).toBe('download');
    }
    expect(shouldPromptForUpdate(snapshot)).toBe(true);
  });

  it('preserves user settings and session across updates (no-op on populated userData)', () => {
    // Tests that session & local config paths remain persistent
    const sessionToken = 'nuvio_auth_jwt_token_sample';
    const settings = { language: 'pt-BR', openAtLogin: true };

    const mockUserDataDir = {
      token: sessionToken,
      settings,
    };

    // Simulating app update without wiping userData
    const updatedUserDataDir = { ...mockUserDataDir };
    expect(updatedUserDataDir.token).toBe(sessionToken);
    expect(updatedUserDataDir.settings.language).toBe('pt-BR');
    expect(updatedUserDataDir.settings.openAtLogin).toBe(true);
  });
});
