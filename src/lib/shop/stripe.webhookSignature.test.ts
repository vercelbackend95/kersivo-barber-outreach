import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

describe('verifyStripeWebhookSignature dual secret', () => {
  const prevPlatform = process.env.STRIPE_WEBHOOK_SECRET;
  const prevConnect = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_platform_test';
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect_test';
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = prevPlatform;
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = prevConnect;
  });

  function sign(payload: string, secret: string): string {
    const timestamp = '1700000000';
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
    return `t=${timestamp},v1=${expected}`;
  }

  it('accepts platform webhook secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_platform"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_platform_test'))).toBe(true);
  });

  it('accepts Connect webhook secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_connect"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_connect_test'))).toBe(true);
  });

  it('rejects unknown secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_bad"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_other'))).toBe(false);
  });
});
