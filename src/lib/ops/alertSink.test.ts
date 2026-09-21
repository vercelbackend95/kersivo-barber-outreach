import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  formatSlackPayload,
  notifyOps,
  resetOpsAlertMemoryCooldown,
  sanitizeOpsText,
} from './alertSink';

describe('notifyOps', () => {
  beforeEach(() => {
    resetOpsAlertMemoryCooldown();
  });

  it('no-ops when webhook URL is unset', async () => {
    const fetchImpl = vi.fn();
    const result = await notifyOps(
      {
        severity: 'critical',
        title: 'Test',
        body: 'Body',
        dedupeKey: 'k1',
      },
      { fetchImpl, webhookUrl: '' },
    );
    expect(result).toEqual({ sent: false, skippedReason: 'no_webhook' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts Slack payload and dedupes within cooldown', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true } as Response);
    const now = { ms: 1_000_000 };

    const first = await notifyOps(
      {
        severity: 'warning',
        title: 'Webhook failed',
        body: 'evt_123 stuck',
        dedupeKey: 'webhook:evt_123',
        fields: { status: 'FAILED' },
      },
      { fetchImpl, webhookUrl: 'https://hooks.slack.test/x', nowMs: () => now.ms },
    );
    expect(first.sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();

    const second = await notifyOps(
      {
        severity: 'warning',
        title: 'Webhook failed',
        body: 'evt_123 stuck',
        dedupeKey: 'webhook:evt_123',
      },
      { fetchImpl, webhookUrl: 'https://hooks.slack.test/x', nowMs: () => now.ms + 60_000 },
    );
    expect(second).toEqual({ sent: false, skippedReason: 'deduped' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns send_failed when Slack responds non-OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const result = await notifyOps(
      {
        severity: 'critical',
        title: 'Down',
        body: 'synthetic',
        dedupeKey: 'synthetic:1',
      },
      { fetchImpl, webhookUrl: 'https://hooks.slack.test/x' },
    );
    expect(result).toEqual({ sent: false, skippedReason: 'send_failed' });
  });

  it('redacts customer email and phone from outbound Slack payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);
    await notifyOps(
      {
        severity: 'critical',
        title: 'Delivery failed for customer@example.com',
        body: 'Provider rejected +44 7700 900123 / 07700900123',
        dedupeKey: 'email:failed:out_abc',
        fields: {
          emailOutboundId: 'out_abc',
          shopId: 'shop_1',
          bookingId: 'book_9',
          purpose: 'BOOKING_CONFIRMATION',
          attempts: 6,
          status: 'FAILED',
          leak: 'customer@example.com called 07700900123',
        },
      },
      { fetchImpl, webhookUrl: 'https://hooks.slack.test/x' },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = String(fetchImpl.mock.calls[0]?.[1]?.body ?? '');
    expect(body).not.toContain('customer@example.com');
    expect(body).not.toContain('07700900123');
    expect(body).not.toContain('+44 7700 900123');
    expect(body).toContain('[redacted-email]');
    expect(body).toContain('[redacted-phone]');
    expect(body).toContain('out_abc');
    expect(body).toContain('shop_1');
    expect(body).toContain('book_9');
    expect(body).toContain('BOOKING_CONFIRMATION');
    expect(body).toContain('6');
    expect(body).toContain('FAILED');
  });
});

describe('sanitizeOpsText / formatSlackPayload', () => {
  it('preserves operational ids while redacting PII in field strings', () => {
    expect(sanitizeOpsText('ok out_1 shop_1')).toBe('ok out_1 shop_1');
    const payload = formatSlackPayload({
      severity: 'info',
      title: 'Ok',
      body: 'stable',
      dedupeKey: 'k',
      fields: {
        emailOutboundId: 'out_1',
        attempts: 3,
        flagged: false,
        note: 'mail customer@example.com',
      },
    });
    const text = String(payload.text);
    expect(text).toContain('out_1');
    expect(text).toContain('3');
    expect(text).toContain('false');
    expect(text).not.toContain('customer@example.com');
    expect(text).toContain('[redacted-email]');
  });
});
