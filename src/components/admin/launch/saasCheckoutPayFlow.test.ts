import { describe, expect, it, vi } from 'vitest';

/**
 * Mirrors LaunchWizard SaaS pay rotate-once behavior for unit coverage.
 */
export async function runSaasCheckoutWithSingleRotate(input: {
  start: (attemptId: string) => Promise<{ status: number; data: Record<string, unknown> }>;
  getAttemptId: () => string;
  rotateAttemptId: () => string;
}): Promise<{ status: number; data: Record<string, unknown>; attempts: number }> {
  let attempts = 1;
  let attemptId = input.getAttemptId();
  let result = await input.start(attemptId);

  if (
    result.status === 409 &&
    result.data.code === 'CHECKOUT_ATTEMPT_EXPIRED' &&
    result.data.rotateAttempt
  ) {
    attempts += 1;
    attemptId = input.rotateAttemptId();
    result = await input.start(attemptId);
  }

  return { status: result.status, data: result.data, attempts };
}

describe('runSaasCheckoutWithSingleRotate', () => {
  it('retries exactly once on rotateAttempt', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce({
        status: 409,
        data: { code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, url: 'https://checkout.test/cs', reused: false, state: 'open' },
      });
    const getAttemptId = vi.fn(() => 'attempt-1');
    const rotateAttemptId = vi.fn(() => 'attempt-2');

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId,
      rotateAttemptId,
    });

    expect(result.attempts).toBe(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenNthCalledWith(1, 'attempt-1');
    expect(start).toHaveBeenNthCalledWith(2, 'attempt-2');
    expect(result.status).toBe(200);
  });

  it('does not loop forever when expired again', async () => {
    const start = vi.fn().mockResolvedValue({
      status: 409,
      data: { code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true },
    });

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'a1',
      rotateAttemptId: () => 'a2',
    });

    expect(start).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(409);
  });

  it('redirect payload for SUBSCRIPTION_ALREADY_EXISTS is surfaced once', async () => {
    const start = vi.fn().mockResolvedValue({
      status: 409,
      data: { code: 'SUBSCRIPTION_ALREADY_EXISTS', redirectTo: '/admin' },
    });

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'a1',
      rotateAttemptId: () => 'a2',
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(result.data.redirectTo).toBe('/admin');
  });
});
