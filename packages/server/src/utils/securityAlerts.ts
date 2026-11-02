import { eq, and, sql, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { schema } from '../db/index.js';
import { generateSnowflake } from './snowflake.js';

function nextId(): string {
  try {
    return generateSnowflake();
  } catch {
    return randomUUID();
  }
}

export interface SecuritySignalResult {
  triggered: boolean;
  alertType?: string;
  severity?: 'low' | 'medium' | 'high' | 'urgent';
  technicalExplanation?: string;
}

export function checkFriendRequestSpike(
  userId: string,
  db: any,
  options: { windowMs?: number; threshold?: number } = {}
): SecuritySignalResult {
  const windowMs = options.windowMs ?? 5 * 60 * 1000; // 5 min
  const threshold = options.threshold ?? 10;
  const since = Date.now() - windowMs;

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.friendRequests)
    .where(
      and(
        eq(schema.friendRequests.fromId, userId),
        sql`${schema.friendRequests.createdAt} >= ${since}`
      )
    )
    .get();

  const count = countRow?.count ?? 0;
  if (count >= threshold) {
    return {
      triggered: true,
      alertType: 'friend_request_spike',
      severity: count >= threshold * 2 ? 'high' : 'medium',
      technicalExplanation: `Conta enviou ${count} solicitações de amizade nos últimos ${Math.round(windowMs / 60000)} minutos (limiar: ${threshold}).`,
    };
  }

  return { triggered: false };
}

export function checkReportCluster(
  userId: string,
  db: any,
  options: { windowMs?: number; threshold?: number } = {}
): SecuritySignalResult {
  const windowMs = options.windowMs ?? 24 * 60 * 60 * 1000; // 24 hours
  const threshold = options.threshold ?? 3;
  const since = Date.now() - windowMs;

  // Check safety_reports with targetType 'user' and targetId = userId, or where targetId is a message by this user
  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.safetyReports)
    .where(
      and(
        eq(schema.safetyReports.targetId, userId),
        sql`${schema.safetyReports.createdAt} >= ${since}`
      )
    )
    .get();

  const count = countRow?.count ?? 0;
  if (count >= threshold) {
    return {
      triggered: true,
      alertType: 'high_report_volume',
      severity: 'high',
      technicalExplanation: `Conta foi alvo de ${count} denúncias distintas nas últimas 24 horas (limiar: ${threshold}).`,
    };
  }

  return { triggered: false };
}

export function checkRapidSpaceJoinSpike(
  userId: string,
  db: any,
  options: { windowMs?: number; threshold?: number } = {}
): SecuritySignalResult {
  const windowMs = options.windowMs ?? 10 * 60 * 1000; // 10 min
  const threshold = options.threshold ?? 8;
  const since = Date.now() - windowMs;

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.spaceMembers)
    .where(
      and(
        eq(schema.spaceMembers.userId, userId),
        sql`${schema.spaceMembers.joinedAt} >= ${since}`
      )
    )
    .get();

  const count = countRow?.count ?? 0;
  if (count >= threshold) {
    return {
      triggered: true,
      alertType: 'rapid_space_joins',
      severity: 'medium',
      technicalExplanation: `Conta ingressou em ${count} espaços nos últimos ${Math.round(windowMs / 60000)} minutos (limiar: ${threshold}).`,
    };
  }

  return { triggered: false };
}

export function evaluateUserBehaviorSignals(
  userId: string,
  db: any,
  username?: string | null
): SecuritySignalResult[] {
  const signals = [
    checkFriendRequestSpike(userId, db),
    checkReportCluster(userId, db),
    checkRapidSpaceJoinSpike(userId, db),
  ];

  const triggered = signals.filter((s) => s.triggered);

  for (const sig of triggered) {
    if (!sig.alertType || !sig.technicalExplanation) continue;

    // Check if an active alert for this user and alertType already exists created in the last 2 hours
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const existing = db
      .select()
      .from(schema.securityAlerts)
      .where(
        and(
          eq(schema.securityAlerts.subjectUserId, userId),
          eq(schema.securityAlerts.alertType, sig.alertType),
          eq(schema.securityAlerts.status, 'active'),
          sql`${schema.securityAlerts.createdAt} >= ${twoHoursAgo}`
        )
      )
      .get();

    if (!existing) {
      db.insert(schema.securityAlerts)
        .values({
          id: nextId(),
          alertType: sig.alertType,
          severity: sig.severity || 'medium',
          subjectUserId: userId,
          subjectUsername: username || null,
          technicalExplanation: sig.technicalExplanation,
          status: 'active',
          createdAt: Date.now(),
        })
        .run();
    }
  }

  return triggered;
}
