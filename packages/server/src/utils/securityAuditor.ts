import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { generateSnowflake } from './snowflake.js';

export interface SecurityAuditParams {
  adminId: string;
  adminUsername?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  caseId?: string | null;
  justification: string;
  ip?: string | null;
}

export function recordSecurityAudit(params: SecurityAuditParams): void {
  const db = getDb();
  let id: string;
  try {
    id = generateSnowflake();
  } catch {
    id = randomUUID();
  }

  db.insert(schema.securityAuditLogs)
    .values({
      id,
      adminId: params.adminId,
      adminUsername: params.adminUsername || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      caseId: params.caseId || null,
      justification: params.justification,
      ip: params.ip || null,
      createdAt: Date.now(),
    })
    .run();
}
