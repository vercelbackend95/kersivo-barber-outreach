import type { SaasSubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { StripeSession } from '@/lib/shop/stripe';

export {
  parseCheckoutAttemptId,
  saasCheckoutIdempotencyKey,
  SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY,
} from '@/lib/setup/saasCheckoutAttempt';

export const BLOCKING_SAAS_STATUSES = ['ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const;

export type BlockingSaasStatus = (typeof BLOCKING_SAAS_STATUSES)[number];

export type SaasCheckoutSessionState = 'open' | 'complete' | 'expired' | 'unknown';

export type SaasCheckoutSuccessPayload = {
  ok: true;
  url: string;
  reused: boolean;
  state: 'open' | 'complete';
};

export type ResolveExistingCheckoutOutcome =
  | { kind: 'open'; url: string; sessionId: string }
  | { kind: 'complete'; url: string; sessionId: string }
  | { kind: 'expired'; sessionId: string }
  | { kind: 'lookup_failed'; error: unknown };

const SHOP_CHECKOUT_LOCK_ACTION = 'saas-subscription-checkout';
/** Allow one Stripe round-trip inside the advisory lock. */
const SHOP_CHECKOUT_TX_TIMEOUT_MS = 25_000;
const SHOP_CHECKOUT_TX_MAX_WAIT_MS = 10_000;

export function isBlockingSaasStatus(
  status: SaasSubscriptionStatus | string | null | undefined,
): status is BlockingSaasStatus {
  return BLOCKING_SAAS_STATUSES.includes(String(status) as BlockingSaasStatus);
}

export function classifyStripeCheckoutSession(
  session: Pick<StripeSession, 'status' | 'payment_status' | 'url'>,
): SaasCheckoutSessionState {
  const status = (session.status ?? '').toLowerCase();
  const paymentStatus = (session.payment_status ?? '').toLowerCase();

  if (status === 'complete' || paymentStatus === 'paid') return 'complete';
  if (status === 'expired') return 'expired';
  if (status === 'open') return 'open';
  return 'unknown';
}

export function setupSuccessUrlForSession(sessionId: string): string {
  return `/setup/success?session_id=${encodeURIComponent(sessionId)}`;
}

export function saasCheckoutSuccess(input: {
  url: string;
  reused: boolean;
  state: 'open' | 'complete';
}): SaasCheckoutSuccessPayload {
  return {
    ok: true,
    url: input.url,
    reused: input.reused,
    state: input.state,
  };
}

/**
 * Stable 31-bit positive int for pg_advisory_xact_lock(int4).
 * Same hashing approach as durableRateLimit (not shared to avoid coupling).
 */
export function saasShopCheckoutAdvisoryLockKey(shopId: string): number {
  let hash = 2166136261;
  const input = `${SHOP_CHECKOUT_LOCK_ACTION}\0${shopId.trim()}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 1;
}

export async function resolveExistingCheckoutOutcome(input: {
  sessionId: string;
  retrieve: (sessionId: string) => Promise<StripeSession>;
}): Promise<ResolveExistingCheckoutOutcome> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return { kind: 'lookup_failed', error: new Error('Missing stripeSessionId') };
  }

  try {
    const session = await input.retrieve(sessionId);
    const state = classifyStripeCheckoutSession(session);

    if (state === 'complete') {
      return {
        kind: 'complete',
        url: setupSuccessUrlForSession(sessionId),
        sessionId,
      };
    }

    if (state === 'expired') {
      return { kind: 'expired', sessionId };
    }

    if (state === 'open') {
      const url = typeof session.url === 'string' ? session.url.trim() : '';
      if (!url) {
        return { kind: 'lookup_failed', error: new Error('Open session missing URL') };
      }
      return { kind: 'open', url, sessionId };
    }

    return { kind: 'lookup_failed', error: new Error(`Unreliable session status: ${state}`) };
  } catch (error) {
    return { kind: 'lookup_failed', error };
  }
}

export async function withSaasShopCheckoutLock<T>(
  shopId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const id = shopId.trim();
  if (!id) throw new Error('shopId is required for SaaS checkout lock');
  const lockId = saasShopCheckoutAdvisoryLockKey(id);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
      return fn();
    },
    {
      maxWait: SHOP_CHECKOUT_TX_MAX_WAIT_MS,
      timeout: SHOP_CHECKOUT_TX_TIMEOUT_MS,
    },
  );
}

export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
