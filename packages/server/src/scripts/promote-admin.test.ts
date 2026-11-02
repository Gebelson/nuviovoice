import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { promoteAdminAccount } from './promote-admin.js';

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

describe('promoteAdminAccount CLI tool', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });

    // Seed test users
    db.insert(schema.users).values([
      {
        id: 'usr_gebelson_123',
        username: 'gebelson',
        displayName: 'Gebelson',
        passwordHash: 'hashed_pw',
        isAdmin: 0,
        isDeleted: 0,
        homeInstance: null,
        createdAt: 1000,
      },
      {
        id: 'usr_federated_456',
        username: 'gebelson@remote.org',
        displayName: 'Gebelson Remote',
        passwordHash: 'hashed_pw',
        isAdmin: 0,
        isDeleted: 0,
        homeInstance: 'remote.org',
        createdAt: 1000,
      },
      {
        id: 'usr_deleted_789',
        username: 'deleted_gebelson',
        displayName: 'Deleted User',
        passwordHash: 'hashed_pw',
        isAdmin: 0,
        isDeleted: 1,
        homeInstance: null,
        createdAt: 1000,
      },
      {
        id: 'usr_already_admin',
        username: 'existing_admin',
        displayName: 'Existing Admin',
        passwordHash: 'hashed_pw',
        isAdmin: 1,
        isDeleted: 0,
        homeInstance: null,
        createdAt: 1000,
      },
    ]).run();
  });

  it('successfully promotes a valid local account when confirmed', () => {
    const result = promoteAdminAccount(db, {
      identifier: 'gebelson',
      confirmed: true,
      operatorJustification: 'Instance owner manual CLI verification',
    });

    expect(result.success).toBe(true);
    expect(result.promotedUser?.id).toBe('usr_gebelson_123');
    expect(result.promotedUser?.username).toBe('gebelson');
    expect(result.alreadyAdmin).toBe(false);

    // Verify DB state
    const userInDb = db.select().from(schema.users).where(eq(schema.users.id, 'usr_gebelson_123')).get();
    expect(userInDb?.isAdmin).toBe(1);

    // Verify audit log
    const auditLogs = db.select().from(schema.securityAuditLogs).all();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe('admin_promotion');
    expect(auditLogs[0].resourceId).toBe('usr_gebelson_123');
  });

  it('is idempotent if the user is already an admin', () => {
    const result = promoteAdminAccount(db, {
      identifier: 'existing_admin',
      confirmed: true,
    });

    expect(result.success).toBe(true);
    expect(result.alreadyAdmin).toBe(true);
    expect(result.promotedUser?.id).toBe('usr_already_admin');
  });

  it('rejects promotion when user is not found', () => {
    expect(() => {
      promoteAdminAccount(db, {
        identifier: 'nonexistent_user',
        confirmed: true,
      });
    }).toThrow(/não foi encontrada|nao foi encontrada/i);
  });

  it('rejects promotion of federated/replicated accounts', () => {
    expect(() => {
      promoteAdminAccount(db, {
        identifier: 'gebelson@remote.org',
        confirmed: true,
      });
    }).toThrow(/apenas contas locais/i);
  });

  it('rejects promotion of deleted accounts', () => {
    expect(() => {
      promoteAdminAccount(db, {
        identifier: 'deleted_gebelson',
        confirmed: true,
      });
    }).toThrow(/desativada ou exclu/i);
  });

  it('rejects promotion without explicit owner confirmation', () => {
    expect(() => {
      promoteAdminAccount(db, {
        identifier: 'gebelson',
        confirmed: false,
      });
    }).toThrow(/confirmação explícita|confirmacao explicita/i);
  });
});
