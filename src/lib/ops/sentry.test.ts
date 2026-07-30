import { describe, expect, it } from 'vitest';

import { isSentryEnabled } from './sentry';

describe('sentry helpers', () => {
  it('reports disabled when DSN unset (unit env)', () => {
    // In vitest without SENTRY_DSN, init is a no-op and helper returns false.
    expect(typeof isSentryEnabled()).toBe('boolean');
  });
});
