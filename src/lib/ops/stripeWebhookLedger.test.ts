import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const upsert = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    stripeWebhookEvent: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
    opsAlertDedupe: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ops/alertSink', () => ({
  notifyOps: vi.fn(async () => ({ sent: false })),
}));

import { markStripeWebhookStatus, recordStripeWebhookReceived } from './stripeWebhookLedger';

/**
 * Pure status transition rules mirrored by markStripeWebhookStatus.
 * (DB integration covered operationally; this guards the PROCESSED lock.)
 */
function nextStatus(
  existing: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED' | null,
  incoming: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED',
): 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED' | 'KEEP' {
  if (existing === 'PROCESSED' && incoming === 'FAILED') return 'KEEP';
  return incoming;
}

describe('stripe webhook ledger status rules', () => {
  it('does not downgrade PROCESSED to FAILED', () => {
    expect(nextStatus('PROCESSED', 'FAILED')).toBe('KEEP');
  });

  it('allows FAILED then PROCESSED on successful retry', () => {
    expect(nextStatus('FAILED', 'PROCESSED')).toBe('PROCESSED');
  });

  it('allows RECEIVED to PROCESSED', () => {
    expect(nextStatus('RECEIVED', 'PROCESSED')).toBe('PROCESSED');
  });
});

describe('recordStripeWebhookReceived', () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    upsert.mockResolvedValue({});
  });

  it('marks PROCESSED and IGNORED as alreadyFinalized', async () => {
    findUnique.mockResolvedValueOnce({ status: 'PROCESSED' });
    await expect(
      recordStripeWebhookReceived({ id: 'evt_1', type: 'invoice.paid' }),
    ).resolves.toEqual({ alreadyFinalized: true, previousStatus: 'PROCESSED' });

    findUnique.mockResolvedValueOnce({ status: 'IGNORED' });
    await expect(
      recordStripeWebhookReceived({ id: 'evt_2', type: 'ping' }),
    ).resolves.toEqual({ alreadyFinalized: true, previousStatus: 'IGNORED' });
  });

  it('allows retry for RECEIVED, FAILED, and missing rows', async () => {
    findUnique.mockResolvedValueOnce({ status: 'RECEIVED' });
    await expect(
      recordStripeWebhookReceived({ id: 'evt_3', type: 'invoice.paid' }),
    ).resolves.toEqual({ alreadyFinalized: false, previousStatus: 'RECEIVED' });

    findUnique.mockResolvedValueOnce({ status: 'FAILED' });
    await expect(
      recordStripeWebhookReceived({ id: 'evt_4', type: 'invoice.paid' }),
    ).resolves.toEqual({ alreadyFinalized: false, previousStatus: 'FAILED' });

    findUnique.mockResolvedValueOnce(null);
    await expect(
      recordStripeWebhookReceived({ id: 'evt_5', type: 'invoice.paid' }),
    ).resolves.toEqual({ alreadyFinalized: false, previousStatus: null });
  });
});

describe('markStripeWebhookStatus PROCESSED lock', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
  });

  it('does not overwrite PROCESSED with FAILED', async () => {
    findUnique.mockResolvedValue({ status: 'PROCESSED', processedAt: new Date() });
    await markStripeWebhookStatus('evt_lock', 'FAILED', { httpStatus: 500, error: 'boom' });
    expect(update).not.toHaveBeenCalled();
  });
});
