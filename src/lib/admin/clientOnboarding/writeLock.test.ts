import { describe, it, expect } from 'vitest';
import { clientOnboardingWriteAdvisoryLockKey } from './writeLock';

describe('clientOnboardingWriteAdvisoryLockKey', () => {
  it('is stable for the same shopId', () => {
    expect(clientOnboardingWriteAdvisoryLockKey('shop_a')).toBe(
      clientOnboardingWriteAdvisoryLockKey('shop_a'),
    );
  });

  it('differs across shops', () => {
    expect(clientOnboardingWriteAdvisoryLockKey('shop_a')).not.toBe(
      clientOnboardingWriteAdvisoryLockKey('shop_b'),
    );
  });

  it('returns a non-negative 31-bit int', () => {
    const key = clientOnboardingWriteAdvisoryLockKey('shop_1');
    expect(key).toBeGreaterThanOrEqual(0);
    expect(key).toBeLessThan(2 ** 31);
  });
});
