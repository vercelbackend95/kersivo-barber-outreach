import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
const captureMessage = vi.fn();
const withScope = vi.fn((cb: (scope: { setTag: (k: string, v: string) => void }) => void) => {
  const tags: Record<string, string> = {};
  cb({
    setTag: (k, v) => {
      tags[k] = v;
    },
  });
  return tags;
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

  it('captureOpsMessage posts when DSN set', async () => {
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
  });

  it('captureOpsException posts when DSN set', async () => {
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    const { captureOpsException } = await import('./sentry');
    const err = new Error('boom');
    captureOpsException(err, { route: 'test', shopId: 'shop_1' });
    expect(captureException).toHaveBeenCalledWith(err);
  });
});
