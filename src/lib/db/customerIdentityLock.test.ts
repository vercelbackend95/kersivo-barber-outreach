import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeRaw = vi.fn();

vi.mock('./client', () => ({
  prisma: {},
}));

import {
  lockShopCustomerIdentity,
  shopCustomerIdentityAdvisoryLockKey,
} from './customerIdentityLock';

describe('shopCustomerIdentityAdvisoryLockKey', () => {
  it('is deterministic for the same shopId + email', () => {
    const a = shopCustomerIdentityAdvisoryLockKey('shop-1', 'a@example.com');
    const b = shopCustomerIdentityAdvisoryLockKey('shop-1', 'a@example.com');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0x7fffffff);
  });

  it('differs across shops and emails', () => {
    const base = shopCustomerIdentityAdvisoryLockKey('shop-1', 'a@example.com');
    expect(shopCustomerIdentityAdvisoryLockKey('shop-2', 'a@example.com')).not.toBe(base);
    expect(shopCustomerIdentityAdvisoryLockKey('shop-1', 'b@example.com')).not.toBe(base);
  });

  it('trims whitespace consistently', () => {
    expect(shopCustomerIdentityAdvisoryLockKey(' shop-1 ', ' a@example.com ')).toBe(
      shopCustomerIdentityAdvisoryLockKey('shop-1', 'a@example.com'),
    );
  });
});

describe('lockShopCustomerIdentity', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(undefined);
  });

  it('issues parameterised pg_advisory_xact_lock with the identity key', async () => {
    const tx = { $executeRaw: executeRaw };
    await lockShopCustomerIdentity(tx as never, 'shop-1', 'cust@example.com');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const call = executeRaw.mock.calls[0] ?? [];
    const joined = call
      .map((part) => {
        if (part && typeof part === 'object' && 'strings' in (part as object)) {
          return String((part as { strings?: string[] }).strings?.join?.('') ?? part);
        }
        return String(part);
      })
      .join('');
    expect(joined).toMatch(/pg_advisory_xact_lock/i);
    const expectedKey = shopCustomerIdentityAdvisoryLockKey('shop-1', 'cust@example.com');
    const flatValues = call.flatMap((part) => {
      if (part && typeof part === 'object' && Array.isArray((part as { values?: unknown[] }).values)) {
        return (part as { values: unknown[] }).values;
      }
      return [part];
    });
    expect(flatValues).toContain(expectedKey);
  });

  it('rejects empty shopId or email', async () => {
    const tx = { $executeRaw: executeRaw };
    await expect(lockShopCustomerIdentity(tx as never, '', 'a@b.com')).rejects.toThrow(/required/);
    await expect(lockShopCustomerIdentity(tx as never, 'shop-1', '  ')).rejects.toThrow(/required/);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
