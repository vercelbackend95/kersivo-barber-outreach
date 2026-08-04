import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeRaw = vi.fn(async () => undefined);
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import {
  classifyStripeCheckoutSession,
  guestCheckoutMatchesWorkspace,
  isBlockingSaasStatus,
  isPrismaUniqueConflict,
  normalizeSaasCheckoutIdentity,
  parseCheckoutAttemptId,
  resolveExistingCheckoutOutcome,
  saasCheckoutIdempotencyKey,
  saasCheckoutSuccess,
  saasShopCheckoutAdvisoryLockKey,
  SHOP_CHECKOUT_TX_MAX_WAIT_MS,
  SHOP_CHECKOUT_TX_TIMEOUT_MS,
  withSaasShopCheckoutLock,
} from './saasCheckoutGuard';

describe('parseCheckoutAttemptId', () => {
  it('accepts UUID and normalizes to lowercase', () => {
    expect(parseCheckoutAttemptId('550E8400-E29B-41D4-A716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('rejects missing or invalid values', () => {
    expect(parseCheckoutAttemptId(undefined)).toBeNull();
    expect(parseCheckoutAttemptId('')).toBeNull();
    expect(parseCheckoutAttemptId('not-a-uuid')).toBeNull();
  });
});

describe('saasCheckoutIdempotencyKey', () => {
  it('is deterministic for an attempt id', () => {
    expect(saasCheckoutIdempotencyKey('550e8400-e29b-41d4-a716-446655440000')).toBe(
      'kersivo_saas_subscription_checkout_550e8400-e29b-41d4-a716-446655440000',
    );
  });
});

describe('isBlockingSaasStatus', () => {
  it('blocks ACTIVE PAST_DUE SUSPENDED only', () => {
    expect(isBlockingSaasStatus('ACTIVE')).toBe(true);
    expect(isBlockingSaasStatus('PAST_DUE')).toBe(true);
    expect(isBlockingSaasStatus('SUSPENDED')).toBe(true);
    expect(isBlockingSaasStatus('PENDING')).toBe(false);
    expect(isBlockingSaasStatus('CANCELED')).toBe(false);
  });
});

describe('normalizeSaasCheckoutIdentity', () => {
  it('trims and collapses whitespace then lowercases', () => {
    expect(normalizeSaasCheckoutIdentity('  Fade   Studio ')).toBe('fade studio');
    expect(normalizeSaasCheckoutIdentity('Owner@Example.COM')).toBe('owner@example.com');
  });
});

describe('guestCheckoutMatchesWorkspace', () => {
  it('matches normalized email and shopName', () => {
    expect(
      guestCheckoutMatchesWorkspace({
        recordEmail: '  Owner@Example.COM ',
        accessEmail: 'owner@example.com',
        recordShopName: '  Fade   Studio ',
        workspaceShopName: 'fade studio',
      }),
    ).toBe(true);
  });

  it('rejects mismatched email', () => {
    expect(
      guestCheckoutMatchesWorkspace({
        recordEmail: 'other@example.com',
        accessEmail: 'owner@example.com',
        recordShopName: 'Fade Studio',
        workspaceShopName: 'Fade Studio',
      }),
    ).toBe(false);
  });

  it('rejects mismatched shopName', () => {
    expect(
      guestCheckoutMatchesWorkspace({
        recordEmail: 'owner@example.com',
        accessEmail: 'owner@example.com',
        recordShopName: 'Other Shop',
        workspaceShopName: 'Fade Studio',
      }),
    ).toBe(false);
  });

  it('rejects empty email', () => {
    expect(
      guestCheckoutMatchesWorkspace({
        recordEmail: '   ',
        accessEmail: 'owner@example.com',
        recordShopName: 'Fade Studio',
        workspaceShopName: 'Fade Studio',
      }),
    ).toBe(false);
  });

  it('rejects empty shopName', () => {
    expect(
      guestCheckoutMatchesWorkspace({
        recordEmail: 'owner@example.com',
        accessEmail: 'owner@example.com',
        recordShopName: '',
        workspaceShopName: 'Fade Studio',
      }),
    ).toBe(false);
  });
});

describe('classifyStripeCheckoutSession', () => {
  it('classifies open complete expired and paid', () => {
    expect(classifyStripeCheckoutSession({ status: 'open', url: 'https://x' })).toBe('open');
    expect(classifyStripeCheckoutSession({ status: 'complete' })).toBe('complete');
    expect(classifyStripeCheckoutSession({ status: 'open', payment_status: 'paid' })).toBe(
      'complete',
    );
    expect(classifyStripeCheckoutSession({ status: 'expired' })).toBe('expired');
    expect(classifyStripeCheckoutSession({ status: 'weird' })).toBe('unknown');
  });
});

describe('resolveExistingCheckoutOutcome', () => {
  it('returns open with url', async () => {
    const outcome = await resolveExistingCheckoutOutcome({
      sessionId: 'cs_1',
      retrieve: async () => ({
        id: 'cs_1',
        status: 'open',
        url: 'https://checkout.test/cs_1',
        amount_total: 3900,
        currency: 'gbp',
      }),
    });
    expect(outcome).toEqual({ kind: 'open', url: 'https://checkout.test/cs_1', sessionId: 'cs_1' });
  });

  it('returns complete success url', async () => {
    const outcome = await resolveExistingCheckoutOutcome({
      sessionId: 'cs_2',
      retrieve: async () => ({
        id: 'cs_2',
        status: 'complete',
        payment_status: 'paid',
        amount_total: 3900,
        currency: 'gbp',
      }),
    });
    expect(outcome).toEqual({
      kind: 'complete',
      url: '/setup/success?session_id=cs_2',
      sessionId: 'cs_2',
    });
  });

  it('returns expired', async () => {
    const outcome = await resolveExistingCheckoutOutcome({
      sessionId: 'cs_3',
      retrieve: async () => ({ id: 'cs_3', status: 'expired', amount_total: null, currency: 'gbp' }),
    });
    expect(outcome).toEqual({ kind: 'expired', sessionId: 'cs_3' });
  });

  it('returns lookup_failed on retrieve error', async () => {
    const outcome = await resolveExistingCheckoutOutcome({
      sessionId: 'cs_4',
      retrieve: async () => {
        throw new Error('stripe down');
      },
    });
    expect(outcome.kind).toBe('lookup_failed');
  });
});

describe('saasCheckoutSuccess', () => {
  it('builds unified success payload', () => {
    expect(saasCheckoutSuccess({ url: 'https://x', reused: true, state: 'open' })).toEqual({
      ok: true,
      url: 'https://x',
      reused: true,
      state: 'open',
    });
  });
});

describe('saasShopCheckoutAdvisoryLockKey', () => {
  it('is stable for the same shopId', () => {
    expect(saasShopCheckoutAdvisoryLockKey('shop-1')).toBe(
      saasShopCheckoutAdvisoryLockKey('shop-1'),
    );
    expect(saasShopCheckoutAdvisoryLockKey('shop-1')).not.toBe(
      saasShopCheckoutAdvisoryLockKey('shop-2'),
    );
  });
});

describe('isPrismaUniqueConflict', () => {
  it('detects P2002', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
    expect(isPrismaUniqueConflict(new Error('nope'))).toBe(false);
  });
});

describe('withSaasShopCheckoutLock', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(undefined);
    transaction.mockReset();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) => {
      const tx = { $executeRaw: executeRaw };
      return fn(tx);
    });
  });

  it('acquires advisory lock on tx before invoking callback with the same tx', async () => {
    const order: string[] = [];
    executeRaw.mockImplementation(async () => {
      order.push('lock');
    });

    const result = await withSaasShopCheckoutLock('shop-1', async (tx) => {
      order.push('callback');
      expect(tx.$executeRaw).toBe(executeRaw);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(order).toEqual(['lock', 'callback']);
    expect(transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0][1]).toEqual({
      maxWait: SHOP_CHECKOUT_TX_MAX_WAIT_MS,
      timeout: SHOP_CHECKOUT_TX_TIMEOUT_MS,
    });
  });

  it('propagates callback errors', async () => {
    await expect(
      withSaasShopCheckoutLock('shop-1', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('rejects empty shopId', async () => {
    await expect(withSaasShopCheckoutLock('  ', async () => null)).rejects.toThrow(
      'shopId is required',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
