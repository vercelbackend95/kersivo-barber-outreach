import { describe, expect, it, vi } from 'vitest';
import { runSaasCheckoutWithSingleRotate } from './saasCheckoutPayFlow.client';

function jsonResponse(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('runSaasCheckoutWithSingleRotate', () => {
  it('succeeds on first request without rotating', async () => {
    const start = vi.fn().mockResolvedValue(
      jsonResponse(200, { ok: true, url: 'https://checkout.test/cs', reused: false, state: 'open' }),
    );
    const getAttemptId = vi.fn(() => 'attempt-1');
    const rotateAttemptId = vi.fn(() => 'attempt-2');

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId,
      rotateAttemptId,
    });

    expect(result.attempts).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith('attempt-1');
    expect(rotateAttemptId).not.toHaveBeenCalled();
    expect(result.data.url).toBe('https://checkout.test/cs');
  });

  it('rotates exactly once on CHECKOUT_ATTEMPT_EXPIRED', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, { code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { ok: true, url: 'https://checkout.test/cs2', reused: false, state: 'open' }),
      );
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
    expect(result.response.status).toBe(200);
  });

  it('rotates exactly once on CHECKOUT_ATTEMPT_MISMATCH', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, { code: 'CHECKOUT_ATTEMPT_MISMATCH', rotateAttempt: true }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { ok: true, url: 'https://checkout.test/cs3', reused: false, state: 'open' }),
      );

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'attempt-1',
      rotateAttemptId: () => 'attempt-2',
    });

    expect(result.attempts).toBe(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(result.data.url).toBe('https://checkout.test/cs3');
  });

  it('rotates on CHECKOUT_ATTEMPT_OWNERSHIP_MISMATCH', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          code: 'CHECKOUT_ATTEMPT_OWNERSHIP_MISMATCH',
          rotateAttempt: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { ok: true, url: 'https://checkout.test/cs4', reused: false, state: 'open' }),
      );

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'attempt-1',
      rotateAttemptId: () => 'attempt-2',
    });

    expect(result.attempts).toBe(2);
    expect(result.data.url).toBe('https://checkout.test/cs4');
  });

  it('does not attempt a third request when second is also expired', async () => {
    const start = vi.fn().mockResolvedValue(
      jsonResponse(409, { code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true }),
    );

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'a1',
      rotateAttemptId: () => 'a2',
    });

    expect(start).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.response.status).toBe(409);
  });

  it('surfaces SUBSCRIPTION_ALREADY_EXISTS without rotating', async () => {
    const start = vi.fn().mockResolvedValue(
      jsonResponse(409, { code: 'SUBSCRIPTION_ALREADY_EXISTS', redirectTo: '/admin' }),
    );

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'a1',
      rotateAttemptId: () => 'a2',
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(result.data.redirectTo).toBe('/admin');
  });

  it('handles invalid JSON without infinite retry', async () => {
    const start = vi.fn().mockResolvedValue(
      new Response('not-json', { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    );

    const result = await runSaasCheckoutWithSingleRotate({
      start,
      getAttemptId: () => 'a1',
      rotateAttemptId: () => 'a2',
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(1);
    expect(result.data.error).toBe('Unable to start checkout.');
  });
});
