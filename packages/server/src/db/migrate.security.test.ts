import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDefaults } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function applyMigrations(db: Database.Database): void {
  const dir = path.resolve(__dirname, '../../drizzle');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    for (const stmt of fs.readFileSync(path.join(dir, f), 'utf8').split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) db.exec(clean);
    }
  }
}

describe('Security Center and Authority Cooperation Database Migration', () => {
  it('creates all security tables correctly', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    ensureDefaults(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(t => t.name);

    expect(tables).toContain('safety_reports');
    expect(tables).toContain('safety_report_evidences');
    expect(tables).toContain('security_cases');
    expect(tables).toContain('evidence_vault');
    expect(tables).toContain('authority_requests');
    expect(tables).toContain('security_alerts');
    expect(tables).toContain('security_audit_logs');

    // Test columns of safety_reports
    const reportCols = (db.prepare('PRAGMA table_info(safety_reports)').all() as { name: string }[]).map(c => c.name);
    expect(reportCols).toContain('protocol');
    expect(reportCols).toContain('reporter_id');
    expect(reportCols).toContain('target_type');
    expect(reportCols).toContain('target_id');
    expect(reportCols).toContain('category');
    expect(reportCols).toContain('priority');
    expect(reportCols).toContain('status');

    // Test columns of safety_report_evidences
    const evCols = (db.prepare('PRAGMA table_info(safety_report_evidences)').all() as { name: string }[]).map(c => c.name);
    expect(evCols).toContain('sha256_hash');
    expect(evCols).toContain('content_snapshot');

    // Test columns of authority_requests
    const authCols = (db.prepare('PRAGMA table_info(authority_requests)').all() as { name: string }[]).map(c => c.name);
    expect(authCols).toContain('protocol_number');
    expect(authCols).toContain('requesting_body');
    expect(authCols).toContain('legal_basis');
    expect(authCols).toContain('request_type');
    expect(authCols).toContain('preservation_until');
  });
});
