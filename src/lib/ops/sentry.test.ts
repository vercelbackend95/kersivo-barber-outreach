import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
const captureMessage = vi.fn();
let lastTags: Record<string, string> = {};

const withScope = vi.fn((cb: (scope: { setTag: (k: string, v: string) => void }) => void) => {
  lastTags = {};
  cb({
    setTag: (k, v) => {
      lastTags[k] = v;
    },
  });
});

vi.mock('@sentry/astro', () => ({
  withScope,
  captureException,
  captureMessage,
}));

describe('sentry helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    captureException.mockClear();
    captureMessage.mockClear();
    withScope.mockClear();
    lastTags = {};
    delete process.env.SENTRY_DSN;
  });

  it('reports disabled when DSN unset (unit env)', async () => {
    const { isSentryEnabled } = await import('./sentry');
    expect(isSentryEnabled()).toBe(false);
  });

  it('captureOpsMessage is a no-op when DSN unset', async () => {
    const { captureOpsMessage } = await import('./sentry');
    captureOpsMessage('ops test', { level: 'error', shopId: 'shop_1' });
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('captureOpsMessage posts when DSN set and always sets opsAlert=true', async () => {
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    const { captureOpsMessage } = await import('./sentry');
    captureOpsMessage('Retail order amount mismatch', {
      level: 'error',
      route: 'finalizeRetailOrder',
      shopId: 'shop_1',
      tags: { orderId: 'ord_1' },
    });
    expect(withScope).toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledWith('Retail order amount mismatch', 'error');
    expect(lastTags).toMatchObject({
      route: 'finalizeRetailOrder',
      shopId: 'shop_1',
      orderId: 'ord_1',
      opsAlert: 'true',
    });
  });

  it('captureOpsMessage ignores caller override of opsAlert', async () => {
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    const { captureOpsMessage } = await import('./sentry');
    captureOpsMessage('Synthetic booking check failed', {
      level: 'error',
      tags: { opsAlert: 'false', failedStep: 'homepage' },
    });
    expect(lastTags.opsAlert).toBe('true');
    expect(lastTags.failedStep).toBe('homepage');
  });

  it('captureOpsException without opsAlert leaves tag unset', async () => {
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    const { captureOpsException } = await import('./sentry');
    const err = new Error('boom');
    captureOpsException(err, {
      route: '/api/example',
      tags: { status: '500', method: 'GET' },
    });
    expect(captureException).toHaveBeenCalledWith(err);
    expect(lastTags.opsAlert).toBeUndefined();
    expect(lastTags.route).toBe('/api/example');
    expect(lastTags.status).toBe('500');
  });

  it('captureOpsException with opsAlert=true sets deterministic tag', async () => {
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    const { captureOpsException } = await import('./sentry');
    const err = new Error('double charge');
    captureOpsException(err, {
      route: 'confirmPaidDeposit',
      shopId: 'shop_1',
      opsAlert: true,
      tags: { bookingId: 'book_1', opsAlert: 'false' },
    });
    expect(captureException).toHaveBeenCalledWith(err);
    expect(lastTags).toMatchObject({
      route: 'confirmPaidDeposit',
      shopId: 'shop_1',
      bookingId: 'book_1',
      opsAlert: 'true',
    });
  });
});
