import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, or, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from '../db/schema.js';
import { ensureDefaults } from '../db/migrate.js';
import { generateSnowflake, setWorkerId } from '../utils/snowflake.js';

function resolveDefaultDbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const candidates = [
    path.resolve(process.cwd(), 'data/concord.db'),
    path.resolve(process.cwd(), '../../data/concord.db'),
    path.resolve(import.meta.dirname ?? '.', '../../../data/concord.db'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).size > 0) return c;
  }
  return candidates[0]!;
}

export interface GrantOfficialOptions {
  identifier: string; // username or userId
  confirmed: boolean;
  operatorJustification?: string;
  createIfMissing?: boolean;
}

export interface GrantOfficialResult {
  success: boolean;
  verificationId: string;
  targetUser: {
    id: string;
    username: string;
    displayName: string | null;
    verificationCategory: string | null;
    verificationStatus: string;
  };
  message: string;
}

export function grantOfficialTeamBadge(
  db: ReturnType<typeof drizzle<typeof schema>>,
  options: GrantOfficialOptions,
): GrantOfficialResult {
  const { identifier, confirmed, operatorJustification, createIfMissing } = options;

  if (!confirmed) {
    throw new Error('Operação cancelada: confirmação explícita obrigatória (--confirm ou --confirm-owner).');
  }

  const trimmedJustification = operatorJustification?.trim() || 'Concessão administrativa oficial de equipe Nuvio para mantenedor/fundador.';

  const cleanIdentifier = identifier.replace(/^@/, '').trim();
  if (!cleanIdentifier) {
    throw new Error('Identificador de conta inválido ou vazio.');
  }

  let user = db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.id, cleanIdentifier), eq(schema.users.username, cleanIdentifier)))
    .get();

  if (!user && createIfMissing) {
    const newId = generateSnowflake();
    const now = Date.now();
    const randomHash = crypto.randomBytes(32).toString('hex');
    db.insert(schema.users)
      .values({
        id: newId,
        username: cleanIdentifier,
        displayName: cleanIdentifier === 'gebelson' ? 'Gebelson' : cleanIdentifier,
        passwordHash: randomHash,
        isAdmin: 1,
        status: 'online',
        homeInstance: null,
        homeUserId: null,
        verificationStatus: 'none',
        createdAt: now,
      })
      .run();

    user = db.select().from(schema.users).where(eq(schema.users.id, newId)).get();
  }

  if (!user) {
    throw new Error(
      `A conta "${cleanIdentifier}" não foi encontrada no banco desta instância. Certifique-se de que a conta foi criada ou utilize --create-if-missing para criá-la localmente.`
    );
  }

  // Enforce local instance homing
  if (user.homeInstance) {
    throw new Error(
      `A conta @${user.username} (ID: ${user.id}) é federada (origem: ${user.homeInstance}). Selos de Equipe Oficial Nuvio são restritos a contas locais da instância.`
    );
  }

  const now = Date.now();
  const verifId = generateSnowflake();
  const auditId = generateSnowflake();

  // Revoke any previous verified rows for target
  db.update(schema.entityVerifications)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedReason: 'Substituído por concessão de equipe oficial Nuvio',
    })
    .where(
      and(
        eq(schema.entityVerifications.targetType, 'user'),
        eq(schema.entityVerifications.targetId, user.id)
      )
    )
    .run();

  // Insert official grant record
  db.insert(schema.entityVerifications)
    .values({
      id: verifId,
      targetType: 'user',
      targetId: user.id,
      category: 'official',
      status: 'verified',
      method: 'official_grant',
      publicLabel: user.displayName || user.username,
      approvedByAdminId: user.id,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Update user table
  db.update(schema.users)
    .set({
      verificationStatus: 'verified',
      verificationCategory: 'official',
      profileUpdatedAt: now,
    })
    .where(eq(schema.users.id, user.id))
    .run();

  // Record audit log
  db.insert(schema.verificationAuditLogs)
    .values({
      id: auditId,
      action: 'official_granted',
      adminId: user.id,
      adminUsername: user.username,
      targetType: 'user',
      targetId: user.id,
      category: 'official',
      justification: trimmedJustification,
      metadata: JSON.stringify({
        grantedTo: user.username,
        userId: user.id,
        displayName: user.displayName,
        method: 'cli_grant_official',
      }),
      createdAt: now,
    })
    .run();

  const updatedUser = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;

  return {
    success: true,
    verificationId: verifId,
    targetUser: {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      verificationCategory: updatedUser.verificationCategory,
      verificationStatus: updatedUser.verificationStatus,
    },
    message: `Selo oficial de Equipe Nuvio concedido com sucesso para @${updatedUser.username} (ID: ${updatedUser.id}) e registrado na auditoria!`,
  };
}

export function runCli(): void {
  const args = process.argv.slice(2);
  let identifier = 'gebelson';
  let confirmed = false;
  let createIfMissing = false;
  let justification = 'Concessão oficial de equipe Nuvio via CLI.';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--username' || arg === '-u' || arg === '--id') {
      identifier = args[++i] || 'gebelson';
    } else if (arg === '--confirm' || arg === '--confirm-owner' || arg === '-y') {
      confirmed = true;
    } else if (arg === '--create-if-missing') {
      createIfMissing = true;
    } else if (arg === '--justification' || arg === '-j' || arg === '--reason') {
      justification = args[++i] || justification;
    }
  }

  console.log('====================================================');
  console.log(' NUVIO — Concessão Oficial de Selo de Equipe');
  console.log('====================================================');
  const dbPath = resolveDefaultDbPath();
  console.log(`Identificador alvo: ${identifier}`);
  console.log(`Caminho do Banco:   ${dbPath}`);
  console.log(`Justificativa:      ${justification}`);
  console.log('----------------------------------------------------');

  try {
    try { setWorkerId(1); } catch { /* ignore if already set */ }
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite, { schema });

    const migrationsFolder = path.resolve(import.meta.dirname ?? '.', '../../drizzle');
    if (fs.existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder });
      ensureDefaults(sqlite);
    }

    const result = grantOfficialTeamBadge(db, {
      identifier,
      confirmed,
      operatorJustification: justification,
      createIfMissing,
    });

    console.log('[SUCESSO]', result.message);
    console.log('Detalhes:');
    console.log(` - ID Interno:            ${result.targetUser.id}`);
    console.log(` - Usuário:               @${result.targetUser.username}`);
    console.log(` - Nome de Exibição:      ${result.targetUser.displayName || 'N/A'}`);
    console.log(` - Categoria Verificação: ${result.targetUser.verificationCategory}`);
    console.log(` - Status Verificação:    ${result.targetUser.verificationStatus}`);
    console.log(` - ID Verificação:        ${result.verificationId}`);
    console.log('====================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('[ERRO]', err instanceof Error ? err.message : String(err));
    if (!confirmed) {
      console.log('\nDica: Adicione o parâmetro --confirm para confirmar a concessão:');
      console.log(`  pnpm --filter @concord/server run grant-official-team -- --username ${identifier} --confirm\n`);
    }
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1]?.endsWith('grant-official-team.ts') || process.argv[1]?.endsWith('grant-official-team.js');
if (isDirectRun) {
  runCli();
}
