import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface DiagnosticLogEntry {
  timestamp: string;
  stage: 'check' | 'available' | 'download' | 'verify' | 'install' | 'idle';
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

class UpdaterDiagnosticManager {
  private inMemoryLogs: DiagnosticLogEntry[] = [];
  private logFilePath: string | null = null;
  private maxLogs = 150;

  private getLogFilePath(): string {
    if (!this.logFilePath) {
      try {
        const userData = app.getPath('userData');
        const logDir = path.join(userData, 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        this.logFilePath = path.join(logDir, 'updater.log');
      } catch {
        this.logFilePath = path.join(process.cwd(), 'updater.log');
      }
    }
    return this.logFilePath;
  }

  record(entry: Omit<DiagnosticLogEntry, 'timestamp'>): void {
    const fullEntry: DiagnosticLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.inMemoryLogs.push(fullEntry);
    if (this.inMemoryLogs.length > this.maxLogs) {
      this.inMemoryLogs.shift();
    }

    try {
      const filePath = this.getLogFilePath();
      const line = `[${fullEntry.timestamp}] [${fullEntry.level.toUpperCase()}] [${fullEntry.stage.toUpperCase()}] ${fullEntry.message}${
        fullEntry.details ? ' ' + JSON.stringify(fullEntry.details) : ''
      }\n`;
      fs.appendFileSync(filePath, line, 'utf8');

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 256 * 1024) {
          const content = fs.readFileSync(filePath, 'utf8');
          const half = content.slice(Math.floor(content.length / 2));
          fs.writeFileSync(filePath, half, 'utf8');
        }
      }
    } catch {
      // Ignore disk write errors in test or restricted environments
    }
  }

  getReport(currentVersion: string, capability: string, currentStatus: unknown): string {
    const sanitize = (text: string) => {
      const userProfile = process.env.USERPROFILE || process.env.HOME || '';
      if (userProfile && text) {
        return text.split(userProfile).join('~');
      }
      return text;
    };

    const header = [
      '==================================================',
      '        NUVIO DESKTOP — RELATÓRIO DE DIAGNÓSTICO',
      '==================================================',
      `Gerado em: ${new Date().toISOString()}`,
      `Versão Atual: ${currentVersion || app.getVersion()}`,
      `Plataforma: ${process.platform} (${process.arch})`,
      `Capacidade de Atualização: ${capability}`,
      `Estado Atual: ${JSON.stringify(currentStatus)}`,
      '--------------------------------------------------',
      'HISTÓRICO DE EVENTOS DO ATUALIZADOR:',
    ];

    const lines = this.inMemoryLogs.map((log) => {
      let line = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.stage}] ${log.message}`;
      if (log.details) {
        line += `\n  Detalhes: ${JSON.stringify(log.details, null, 2)}`;
      }
      return sanitize(line);
    });

    if (lines.length === 0) {
      lines.push('(Nenhum evento registrado nesta sessão)');
    }

    return header.concat(lines).join('\n');
  }

  clear(): void {
    this.inMemoryLogs = [];
  }
}

export const updaterDiagnostic = new UpdaterDiagnosticManager();

export const electronUpdaterLoggerAdapter = {
  info(message: string): void {
    updaterDiagnostic.record({ stage: 'idle', level: 'info', message: String(message) });
  },
  warn(message: string): void {
    updaterDiagnostic.record({ stage: 'idle', level: 'warn', message: String(message) });
  },
  error(message: string): void {
    updaterDiagnostic.record({ stage: 'idle', level: 'error', message: String(message) });
  },
  debug(_message: string): void {
    // Suppress verbose debug noise
  },
};
