import { describe, expect, it, vi, beforeEach } from 'vitest';

import { notifyOps, resetOpsAlertMemoryCooldown } from './alertSink';

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
});
