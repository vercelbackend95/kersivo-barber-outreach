import { afterEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
});

import {
  clearSaasCheckoutAttemptId,
  getOrCreateSaasCheckoutAttemptId,
  rotateSaasCheckoutAttemptId,
} from './saasCheckoutAttempt.client';
import { SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY } from './saasCheckoutAttempt';

describe('saasCheckoutAttempt.client', () => {
  afterEach(() => {
    store.clear();
  });

  it('reuses one attempt id across calls', () => {
    const first = getOrCreateSaasCheckoutAttemptId();
    const second = getOrCreateSaasCheckoutAttemptId();
    expect(first).toBe(second);
    expect(store.get(SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY)).toBe(first);
  });

  it('rotate replaces the stored attempt', () => {
    const first = getOrCreateSaasCheckoutAttemptId();
    const rotated = rotateSaasCheckoutAttemptId();
    expect(rotated).not.toBe(first);
    expect(getOrCreateSaasCheckoutAttemptId()).toBe(rotated);
  });

  it('clear removes the key', () => {
    getOrCreateSaasCheckoutAttemptId();
    clearSaasCheckoutAttemptId();
    expect(store.has(SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY)).toBe(false);
  });
});
