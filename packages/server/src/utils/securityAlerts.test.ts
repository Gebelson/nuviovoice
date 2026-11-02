import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import {
  checkFriendRequestSpike,
  checkReportCluster,
  checkRapidSpaceJoinSpike,
  evaluateUserBehaviorSignals,
} from './securityAlerts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;

function applyMigrations(dbInstance: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const stmt of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) dbInstance.exec(clean);
    }
  }
}

describe('Behavioral Security Alerts Engine', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    applyMigrations(sqlite);
    sqlite.pragma('foreign_keys = OFF');

    db = drizzle(sqlite, { schema });

    // Seed test users
    sqlite.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      'target_user', 'spammer', 'hash', Date.now()
    );
  });

  afterEach(() => {
    sqlite.close();
  });

  it('detects friend request spikes and generates factual technical explanation', () => {
    const now = Date.now();
    // Insert 12 friend requests in last 2 minutes
    for (let i = 0; i < 12; i++) {
      sqlite.prepare('INSERT INTO friend_requests (id, from_id, to_id, created_at) VALUES (?, ?, ?, ?)').run(
        `fr_${i}`, 'target_user', `recipient_${i}`, now - i * 10000
      );
    }

    const res = checkFriendRequestSpike('target_user', db, { threshold: 10, windowMs: 5 * 60 * 1000 });
    expect(res.triggered).toBe(true);
    expect(res.alertType).toBe('friend_request_spike');
    expect(res.technicalExplanation).toContain('12 solicitações de amizade');

    // For another user with 0 requests
    const safeRes = checkFriendRequestSpike('safe_user', db, { threshold: 10 });
    expect(safeRes.triggered).toBe(false);
  });

  it('detects high report volume received', () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      sqlite.prepare(`
        INSERT INTO safety_reports (id, protocol, reporter_id, target_type, target_id, category, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`rep_${i}`, `REP-${now}-${i}`, `user_${i}`, 'user', 'target_user', 'harassment', 'high', 'pending', now - 1000, now);
    }

    const res = checkReportCluster('target_user', db, { threshold: 3 });
    expect(res.triggered).toBe(true);
    expect(res.alertType).toBe('high_report_volume');
    expect(res.technicalExplanation).toContain('4 denúncias distintas');
  });

  it('detects rapid space joins', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      sqlite.prepare('INSERT INTO spaces (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)').run(
        `space_${i}`, `Space ${i}`, 'target_user', now
      );
      sqlite.prepare('INSERT INTO space_members (space_id, user_id, joined_at) VALUES (?, ?, ?)').run(
        `space_${i}`, 'target_user', now - i * 5000
      );
    }

    const res = checkRapidSpaceJoinSpike('target_user', db, { threshold: 8 });
    expect(res.triggered).toBe(true);
    expect(res.alertType).toBe('rapid_space_joins');
    expect(res.technicalExplanation).toContain('10 espaços');
  });

  it('evaluates user signals and persists alert to database without duplication', () => {
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      sqlite.prepare('INSERT INTO friend_requests (id, from_id, to_id, created_at) VALUES (?, ?, ?, ?)').run(
        `fr_${i}`, 'target_user', `recipient_${i}`, now - i * 10000
      );
    }

    const triggered = evaluateUserBehaviorSignals('target_user', db, 'spammer');
    expect(triggered.length).toBeGreaterThan(0);

    const alerts = sqlite.prepare('SELECT * FROM security_alerts WHERE subject_user_id = ?').all('target_user') as any[];
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('friend_request_spike');

    // Calling again does not insert a duplicate alert
    evaluateUserBehaviorSignals('target_user', db, 'spammer');
    const alertsAfter = sqlite.prepare('SELECT * FROM security_alerts WHERE subject_user_id = ?').all('target_user') as any[];
    expect(alertsAfter.length).toBe(1);
  });
});
