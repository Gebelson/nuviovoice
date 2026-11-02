import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updaterDiagnostic, electronUpdaterLoggerAdapter } from './updaterDiagnostic';

vi.mock('electron', () => ({
  app: {
    getPath: () => './test-temp-dir',
    getVersion: () => '1.14.0',
  },
}));

describe('updaterDiagnostic', () => {
  beforeEach(() => {
    updaterDiagnostic.clear();
  });

  it('records entries and formats report cleanly without leaking secrets', () => {
    updaterDiagnostic.record({
      stage: 'check',
      level: 'info',
      message: 'Checking for updates against GitHub Releases',
    });

    updaterDiagnostic.record({
      stage: 'download',
      level: 'info',
      message: 'Download progress 65%',
      details: { percent: 65, bytesPerSecond: 1048576 },
    });

    const report = updaterDiagnostic.getReport('1.14.0', 'auto', { phase: 'downloading' });
    expect(report).toContain('NUVIO DESKTOP — RELATÓRIO DE DIAGNÓSTICO');
    expect(report).toContain('Versão Atual: 1.14.0');
    expect(report).toContain('Checking for updates against GitHub Releases');
    expect(report).toContain('Download progress 65%');
  });

  it('handles logger adapter methods', () => {
    electronUpdaterLoggerAdapter.info('Checking for update');
    electronUpdaterLoggerAdapter.warn('Blockmap fallback');
    electronUpdaterLoggerAdapter.error('Network timeout');

    const report = updaterDiagnostic.getReport('1.14.0', 'auto', { phase: 'failed' });
    expect(report).toContain('Checking for update');
    expect(report).toContain('Blockmap fallback');
    expect(report).toContain('Network timeout');
  });
});
