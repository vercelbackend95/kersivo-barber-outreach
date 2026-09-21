import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailCount = vi.fn();
const smsCount = vi.fn();
const smsFindMany = vi.fn();
const webhookFindMany = vi.fn();
const refundFindMany = vi.fn();
const emailFindMany = vi.fn();
const notifyOpsDurable = vi.fn();
const captureOpsMessage = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    emailOutbound: {
      count: (...args: unknown[]) => emailCount(...args),
      findMany: (...args: unknown[]) => emailFindMany(...args),
    },
    smsOutbound: {
      count: (...args: unknown[]) => smsCount(...args),
      findMany: (...args: unknown[]) => smsFindMany(...args),
    },
    stripeWebhookEvent: {
      findMany: (...args: unknown[]) => webhookFindMany(...args),
    },
    bookingDepositRefund: {
      findMany: (...args: unknown[]) => refundFindMany(...args),
    },
  },
}));

vi.mock('@/lib/ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

vi.mock('@/lib/ops/opsLog', () => ({
  opsLog: vi.fn(),
}));

import { evaluateMessagingFailRate, runOpsHealthChecks } from './opsHealth';

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

describe('runOpsHealthChecks Sentry dual-delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    // collectMessagingFailRates currently hard-codes email zeros; SMS uses counts + findMany.
    smsCount.mockResolvedValue(0);
    smsFindMany.mockResolvedValue([
      { status: 'FAILED' },
      { status: 'FAILED' },
      { status: 'FAILED' },
    ]);
    webhookFindMany.mockResolvedValue([
      {
        id: 'evt_stuck',
        type: 'checkout.session.completed',
        error: 'boom',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    refundFindMany.mockResolvedValue([
      {
        id: 'ref_1',
        bookingId: 'book_1',
        shopId: 'shop_1',
        status: 'REFUND_FAILED',
        attempts: 5,
        lastError: 'provider down',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    emailFindMany.mockResolvedValue([
      {
        id: 'email_1',
        shopId: 'shop_1',
        bookingId: 'book_1',
        purpose: 'BOOKING_CONFIRMATION',
        status: 'FAILED',
        attempts: 5,
        error: 'deliver failed to user@example.com',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
  });

  it('fires Slack and Sentry for stuck webhook/refund/email and SMS fail rate', async () => {
    const summary = await runOpsHealthChecks(new Date('2026-01-01T01:00:00Z'));

    expect(notifyOpsDurable).toHaveBeenCalled();
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'SMS outbound failure rate high',
      expect.objectContaining({ level: 'warning' }),
    );
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Stripe webhook stuck FAILED',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ eventId: 'evt_stuck' }),
      }),
    );
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Deposit refund stuck',
      expect.objectContaining({
        level: 'error',
        shopId: 'shop_1',
        tags: expect.objectContaining({ bookingId: 'book_1' }),
      }),
    );
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Transactional email stuck',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ emailOutboundId: 'email_1' }),
      }),
    );

    const sentryJson = JSON.stringify(captureOpsMessage.mock.calls);
    expect(sentryJson).not.toMatch(/user@example\.com/);
    expect(sentryJson).not.toContain('provider down');
    expect(sentryJson).not.toContain('deliver failed');
    expect(summary.stuckRefundCount).toBe(1);
  });
});
