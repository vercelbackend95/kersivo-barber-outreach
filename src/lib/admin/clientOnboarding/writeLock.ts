import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

const LOCK_ACTION = 'client-onboarding-write';
/** Allow blob finalize + a few queries inside the lock. */
export const CLIENT_ONBOARDING_WRITE_TX_TIMEOUT_MS = 25_000;
export const CLIENT_ONBOARDING_WRITE_TX_MAX_WAIT_MS = 10_000;

/** Stable 31-bit positive int for pg_advisory_xact_lock(int4). */
export function clientOnboardingWriteAdvisoryLockKey(shopId: string): number {
  let hash = 2166136261;
  const input = `${LOCK_ACTION}\0${shopId.trim()}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 1;
}

/**
 * Serialize all ClientOnboarding mutations for one shop (draft/assets/profiles/submit).
 */
export async function withClientOnboardingWriteLock<T>(
  shopId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const id = shopId.trim();
  if (!id) throw new Error('shopId is required for client onboarding write lock');
  const lockId = clientOnboardingWriteAdvisoryLockKey(id);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
      return fn(tx);
    },
    {
      maxWait: CLIENT_ONBOARDING_WRITE_TX_MAX_WAIT_MS,
      timeout: CLIENT_ONBOARDING_WRITE_TX_TIMEOUT_MS,
    },
  );
}
