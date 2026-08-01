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

  function sign(
    payload: string,
    secret: string,
    timestampSec = Math.floor(Date.now() / 1000),
    extraV1?: string,
  ): string {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestampSec}.${payload}`, 'utf8')
      .digest('hex');
    const parts = [`t=${timestampSec}`, `v1=${expected}`];
    if (extraV1) parts.push(`v1=${extraV1}`);
    return parts.join(',');
  }

  it('accepts platform webhook secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_platform"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_platform_test'))).toEqual({
      ok: true,
    });
  });

  it('accepts Connect webhook secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_connect"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_connect_test'))).toEqual({
      ok: true,
    });
  });

  it('rejects unknown secret', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_bad"}';
    expect(verifyStripeWebhookSignature(payload, sign(payload, 'whsec_other'))).toEqual({
      ok: false,
      reason: 'signature_mismatch',
    });
  });

  it('accepts signatures within tolerance', async () => {
    const { verifyStripeWebhookSignature, STRIPE_WEBHOOK_TOLERANCE_SECONDS } = await import(
      './stripe'
    );
    const payload = '{"id":"evt_fresh"}';
    const nowMs = Date.UTC(2026, 7, 1, 12, 0, 0);
    const t = Math.floor(nowMs / 1000) - (STRIPE_WEBHOOK_TOLERANCE_SECONDS - 1);
    expect(
      verifyStripeWebhookSignature(payload, sign(payload, 'whsec_platform_test', t), { nowMs }),
    ).toEqual({ ok: true });
  });

  it('rejects timestamps older than tolerance', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_old"}';
    const nowMs = Date.UTC(2026, 7, 1, 12, 0, 0);
    const t = Math.floor(nowMs / 1000) - 301;
    expect(
      verifyStripeWebhookSignature(payload, sign(payload, 'whsec_platform_test', t), { nowMs }),
    ).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('rejects timestamps too far in the future', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_future"}';
    const nowMs = Date.UTC(2026, 7, 1, 12, 0, 0);
    const t = Math.floor(nowMs / 1000) + 301;
    expect(
      verifyStripeWebhookSignature(payload, sign(payload, 'whsec_platform_test', t), { nowMs }),
    ).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('rejects malformed headers', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    expect(verifyStripeWebhookSignature('{}', 'nope')).toEqual({
      ok: false,
      reason: 'malformed_header',
    });
    expect(verifyStripeWebhookSignature('{}', 't=123')).toEqual({
      ok: false,
      reason: 'malformed_header',
    });
  });

  it('accepts when any of multiple v1 signatures matches', async () => {
    const { verifyStripeWebhookSignature } = await import('./stripe');
    const payload = '{"id":"evt_rotate"}';
    const t = Math.floor(Date.now() / 1000);
    const good = crypto
      .createHmac('sha256', 'whsec_platform_test')
      .update(`${t}.${payload}`, 'utf8')
      .digest('hex');
    const header = `t=${t},v1=deadbeef,v1=${good}`;
    expect(verifyStripeWebhookSignature(payload, header)).toEqual({ ok: true });
  });
});
