import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as schema from '../db/schema.js';
import { config } from '../config.js';

export interface PromoteAdminOptions {
  identifier: string; // username or userId
  confirmed: boolean;
  operatorJustification?: string;
}

export interface PromoteAdminResult {
  success: boolean;
  alreadyAdmin: boolean;
  promotedUser?: {
    id: string;
    username: string;
    displayName: string | null;
    createdAt: number;
  };
  message: string;
}

export function promoteAdminAccount(
  db: ReturnType<typeof drizzle<typeof schema>>,
  options: PromoteAdminOptions,
): PromoteAdminResult {
  const { identifier, confirmed, operatorJustification } = options;

  if (!confirmed) {
    throw new Error('Operação cancelada: é necessária a confirmação explícita do proprietário da instância (--confirm-owner).');
  }

  const user = db.select()
    .from(schema.users)
    .where(or(
      eq(schema.users.id, identifier),
      eq(schema.users.username, identifier),
    ))
    .get();

  if (!user) {
    throw new Error(`A conta '${identifier}' não foi encontrada no banco de dados da instância.`);
  }

  if (user.homeInstance) {
    throw new Error(`A conta '${identifier}' é federada/replicada de '${user.homeInstance}'. Apenas contas locais da instância podem receber privilégios administrativos.`);
  }

  if (user.isDeleted === 1) {
    throw new Error(`A conta '${identifier}' está desativada ou excluída e não pode ser promovida.`);
  }

  if (user.isAdmin === 1) {
    return {
      success: true,
      alreadyAdmin: true,
      promotedUser: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      message: `A conta '${user.username}' (ID: ${user.id}) já possui privilégios de administrador global.`,
    };
  }

  // Promote
  db.update(schema.users)
    .set({ isAdmin: 1 })
    .where(eq(schema.users.id, user.id))
    .run();

  // Audit log
  const auditId = 'audit_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  db.insert(schema.securityAuditLogs).values({
    id: auditId,
    adminId: user.id,
    adminUsername: user.username,
    action: 'admin_promotion',
    resourceType: 'user',
    resourceId: user.id,
    justification: operatorJustification || 'Manual CLI owner promotion authorized by instance administrator/owner',
    createdAt: Date.now(),
  }).run();

  return {
    success: true,
    alreadyAdmin: false,
    promotedUser: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    message: `Conta '${user.username}' (ID: ${user.id}) promovida a Administrador Global com sucesso. Registro de auditoria criado: ${auditId}.`,
  };
}

// ─── CLI Entrypoint ──────────────────────────────────────────────────────────

async function runCli() {
  const args = process.argv.slice(2);
  let identifier = 'gebelson';
  let confirmed = false;
  let justification = 'CLI promotion by instance owner';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--username' && args[i + 1]) {
      identifier = args[++i];
    } else if (arg === '--user-id' && args[i + 1]) {
      identifier = args[++i];
    } else if (arg === '--confirm-owner' || arg === '--yes' || arg === '-y') {
      confirmed = true;
    } else if (arg === '--justification' && args[i + 1]) {
      justification = args[++i];
    }
  }

  console.log('====================================================');
  console.log(' NUVIO — Promoção Administrativa Segura por CLI');
  console.log('====================================================');
  console.log(`Identificador alvo: ${identifier}`);
  console.log(`Caminho do Banco:   ${config.dbPath}`);
  console.log('----------------------------------------------------');

  try {
    const sqlite = new Database(config.dbPath);
    const db = drizzle(sqlite, { schema });

    const result = promoteAdminAccount(db, {
      identifier,
      confirmed,
      operatorJustification: justification,
    });

    console.log('[SUCESSO]', result.message);
    if (result.promotedUser) {
      console.log('Detalhes da conta:');
      console.log(` - ID Interno:    ${result.promotedUser.id}`);
      console.log(` - Nome Usuário:  @${result.promotedUser.username}`);
      console.log(` - Nome Exibição: ${result.promotedUser.displayName || 'N/A'}`);
      console.log(` - Já era Admin:  ${result.alreadyAdmin ? 'Sim' : 'Não'}`);
    }
    console.log('====================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('[ERRO]', err instanceof Error ? err.message : String(err));
    if (!confirmed) {
      console.log('\nDica: Adicione o parâmetro --confirm-owner para confirmar a promoção:');
      console.log(`  pnpm --filter @concord/server run promote-admin -- --username ${identifier} --confirm-owner\n`);
    }
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.endsWith('promote-admin.ts') || process.argv[1]?.endsWith('promote-admin.js');
if (isDirectRun) {
  runCli();
}
