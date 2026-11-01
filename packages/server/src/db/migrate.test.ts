import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDefaults, migrateSoundpadEveryonePermissions } from './migrate.js';

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

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  applyMigrations(db);
  return db;
}

describe('ensureDefaults instance epoch', () => {
  it('mints an instance_id when null and is idempotent', () => {
    const db = freshDb();
    ensureDefaults(db);
    const first = (db.prepare('SELECT instance_id FROM instance_settings WHERE id = 1').get() as { instance_id: string }).instance_id;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    ensureDefaults(db);
    const second = (db.prepare('SELECT instance_id FROM instance_settings WHERE id = 1').get() as { instance_id: string }).instance_id;
    expect(second).toBe(first); // stable across boots
  });

  it('mints a different id for a separate fresh DB', () => {
    const a = freshDb(); ensureDefaults(a);
    const b = freshDb(); ensureDefaults(b);
    const idA = (a.prepare('SELECT instance_id FROM instance_settings WHERE id = 1').get() as { instance_id: string }).instance_id;
    const idB = (b.prepare('SELECT instance_id FROM instance_settings WHERE id = 1').get() as { instance_id: string }).instance_id;
    expect(idA).not.toBe(idB);
  });
});

describe('migrateSoundpadEveryonePermissions', () => {
  it('adds USE_SOUNDPAD bit to @everyone role in existing spaces without altering other bits', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT NOT NULL
      );
    `);

    const OLD_PERMS = (1n << 1n) | (1n << 10n); // VIEW_CHANNEL | SEND_MESSAGES
    const CUSTOM_PERMS = (1n << 2n); // MANAGE_CHANNELS
    db.prepare('INSERT INTO roles (id, space_id, name, permissions) VALUES (?, ?, ?, ?)').run(
      'space-1', 'space-1', '@everyone', OLD_PERMS.toString()
    );
    db.prepare('INSERT INTO roles (id, space_id, name, permissions) VALUES (?, ?, ?, ?)').run(
      'custom-role', 'space-1', 'Moderator', CUSTOM_PERMS.toString()
    );

    const updated = migrateSoundpadEveryonePermissions(db);
    expect(updated).toBe(1);

    const everyoneRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get('space-1') as { permissions: string };
    const everyonePerms = BigInt(everyoneRow.permissions);
    const USE_SOUNDPAD = 1n << 27n;
    expect((everyonePerms & USE_SOUNDPAD) === USE_SOUNDPAD).toBe(true);
    expect((everyonePerms & OLD_PERMS) === OLD_PERMS).toBe(true);

    // Custom role must NOT be altered
    const customRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get('custom-role') as { permissions: string };
    expect(customRow.permissions).toBe(CUSTOM_PERMS.toString());

    // Idempotent: running again updates 0 rows
    const rerun = migrateSoundpadEveryonePermissions(db);
    expect(rerun).toBe(0);
  });
});

describe('privacy migrations (friend_discovery_visibility & receive_winks)', () => {
  it('adds friend_discovery_visibility and receive_winks to users table and backfills correctly', () => {
    const db = freshDb();
    db.exec(`
      INSERT INTO users (id, username, password_hash, discoverable, created_at)
      VALUES ('u1', 'alice', 'hash1', 1, 1000);
      INSERT INTO users (id, username, password_hash, discoverable, created_at)
      VALUES ('u2', 'bob', 'hash2', 0, 1000);
    `);

    ensureDefaults(db);

    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    expect(cols.some(c => c.name === 'friend_discovery_visibility')).toBe(true);
    expect(cols.some(c => c.name === 'receive_winks')).toBe(true);

    const alice = db.prepare('SELECT friend_discovery_visibility, receive_winks FROM users WHERE id = ?').get('u1') as any;
    expect(alice.friend_discovery_visibility).toBe('everyone');
    expect(alice.receive_winks).toBe(1);

    const bob = db.prepare('SELECT friend_discovery_visibility, receive_winks FROM users WHERE id = ?').get('u2') as any;
    expect(bob.friend_discovery_visibility).toBe('nobody');
    expect(bob.receive_winks).toBe(1);
  });
});

