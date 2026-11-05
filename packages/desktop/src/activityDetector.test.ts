import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(__dirname, '..', 'test-temp-dir')),
  },
}));

import {
  REMOTE_URL,
  USER_AGENT,
  setRegisteredGames,
  startActivityDetection,
  stopActivityDetection,
  getCurrentActivity,
  parseProcessList,
  matchActivityFromProcesses,
} from './activityDetector';

describe('activityDetector', () => {
  beforeEach(() => {
    stopActivityDetection();
    setRegisteredGames([]);
  });

  afterEach(() => {
    stopActivityDetection();
  });

  it('points REMOTE_URL to the official Gebelson/nuviovoice repository', () => {
    expect(REMOTE_URL).toBe('https://raw.githubusercontent.com/Gebelson/nuviovoice/main/packages/desktop/resources/games.json');
  });

  it('uses Nuvio-Desktop User-Agent header', () => {
    expect(USER_AGENT).toBe('Nuvio-Desktop/1.0');
  });

  it('parses process lists correctly for Windows tasklist format', () => {
    const stdout = '"cs2.exe","1234","Console","1","1,234,567 K"\n"Discord.exe","5678","Console","1","50,000 K"';
    const processes = parseProcessList(stdout);
    expect(processes.has('cs2.exe')).toBe(true);
    expect(processes.has('discord.exe')).toBe(true);
  });

  it('supports custom registered games through setRegisteredGames', () => {
    setRegisteredGames([
      {
        id: 'custom-indie-game',
        name: 'Super Indie Adventure',
        exeName: 'superindie.exe',
        detectionEnabled: true,
      },
    ]);

    const processes = new Set(['superindie.exe', 'explorer.exe']);
    const match = matchActivityFromProcesses(processes);
    expect(match).toEqual({
      id: 'custom-indie-game',
      name: 'Super Indie Adventure',
      type: 'playing',
    });
  });

  it('allows disabling detection for specific games', () => {
    // When custom game is disabled:
    setRegisteredGames([
      {
        id: 'custom-game',
        name: 'My Game',
        exeName: 'mygame.exe',
        detectionEnabled: false,
      },
    ]);

    const processes = new Set(['mygame.exe']);
    const match = matchActivityFromProcesses(processes);
    expect(match).toBeNull();
  });
});
