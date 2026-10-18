import { eq } from 'drizzle-orm';
import type { PublicSpaceEligibilityResponse } from '@concord/shared';
import { getDb, schema } from '../db/index.js';

export type PublicSpaceEligibilityChecker = (
  userId: string,
) => Promise<PublicSpaceEligibilityResponse> | PublicSpaceEligibilityResponse;

let customEligibilityChecker: PublicSpaceEligibilityChecker | null = null;
const activeCreationLocks = new Set<string>();

/**
 * Extension point for tests or future billing/subscription modules to plug in
 * custom eligibility rules (plans, single purchase, promotional coupon, admin grant, etc.)
 * without modifying route handlers.
 */
export function setPublicSpaceEligibilityChecker(
  checker: PublicSpaceEligibilityChecker | null,
): void {
  customEligibilityChecker = checker;
}

/**
 * Centralized verification of whether a user is allowed to create and publish
 * a Public Space on the Explore page.
 *
 * Currently free for all active native/authenticated users, while keeping the
 * exact verification boundary required for future monetization.
 */
export async function canCreatePublicSpace(
  userId: string,
): Promise<PublicSpaceEligibilityResponse> {
  if (!userId) {
    return {
      allowed: false,
      code: 'unauthorized',
      reason: 'Authentication required to create a public space.',
    };
  }

  const db = getDb();
  const user = db
    .select({
      id: schema.users.id,
      isDeleted: schema.users.isDeleted,
      isAdmin: schema.users.isAdmin,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user || user.isDeleted === 1) {
    return {
      allowed: false,
      code: 'account_deleted',
      reason: 'Active user account required to create a public space.',
    };
  }

  if (customEligibilityChecker) {
    return await customEligibilityChecker(userId);
  }

  return {
    allowed: true,
  };
}

/**
 * Prevents race conditions / concurrent duplicate public space creation requests
 * by the same user so future quota/payment checks cannot be bypassed by parallel calls.
 */
export async function withPublicSpaceCreationLock<T>(
  userId: string,
  fn: () => Promise<T> | T,
): Promise<{ locked: true; result: T } | { locked: false }> {
  if (activeCreationLocks.has(userId)) {
    return { locked: false };
  }
  activeCreationLocks.add(userId);
  try {
    const result = await fn();
    return { locked: true, result };
  } finally {
    activeCreationLocks.delete(userId);
  }
}
