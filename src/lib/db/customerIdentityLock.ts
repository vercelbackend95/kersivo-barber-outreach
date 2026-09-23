import type { Prisma } from '@prisma/client';

const LOCK_ACTION = 'shop-customer-identity';

/**
 * Stable 31-bit positive int for pg_advisory_xact_lock(int4).
 * Same shopId + exact email string → same key; different shop or email → different key.
 * Hash collisions only cause extra serialization, never cross-tenant mutation.
 */
export function shopCustomerIdentityAdvisoryLockKey(shopId: string, email: string): number {
  let hash = 2166136261;
  const input = `${LOCK_ACTION}\0${shopId.trim()}\0${email.trim()}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 1;
}

/**
 * Transaction-scoped Postgres advisory lock for shop + customer email identity.
 * Must be acquired by Client erasure (before Order scan) and by every Order create
 * that writes customerEmail, using the exact same email string semantics as that write.
 * Released automatically on commit/rollback. Does not log or return the hash.
 */
export async function lockShopCustomerIdentity(
  tx: Prisma.TransactionClient,
  shopId: string,
  email: string,
): Promise<void> {
  const id = shopId.trim();
  const mail = email.trim();
  if (!id || !mail) {
    throw new Error('shopId and email are required for customer identity lock');
  }
  const lockId = shopCustomerIdentityAdvisoryLockKey(id, mail);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
}
