import { describe, expect, it } from 'vitest';

import { evaluateMessagingFailRate } from './opsHealth';

describe('evaluateMessagingFailRate', () => {
  it('does not alert below sample size', () => {
    const result = evaluateMessagingFailRate({
      channel: 'email',
      sent: 2,
      failed: 2,
      consecutiveFailed: 0,
    });
    expect(result.shouldAlert).toBe(false);
  });

  it('alerts when fail rate >= 20% with enough attempts', () => {
    const result = evaluateMessagingFailRate({
      channel: 'email',
      sent: 8,
      failed: 2,
      consecutiveFailed: 0,
    });
    expect(result.failRate).toBe(0.2);
    expect(result.shouldAlert).toBe(true);
  });

  it('alerts on 3 consecutive failures', () => {
    const result = evaluateMessagingFailRate({
      channel: 'sms',
      sent: 100,
      failed: 0,
      consecutiveFailed: 3,
    });
    expect(result.shouldAlert).toBe(true);
  });
});
