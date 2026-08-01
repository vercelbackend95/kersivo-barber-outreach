import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOutboundPurpose, EmailOutboundStatus, Prisma } from '@prisma/client';

const createOutbound = vi.fn();
const findUniqueOutbound = vi.fn();
const findManyOutbound = vi.fn();
const updateOutbound = vi.fn();
const updateManyOutbound = vi.fn();
const sendRenderedEmail = vi.fn();
const notifyOpsDurable = vi.fn();
const captureOpsException = vi.fn();
const isEmailDeliveryConfigured = vi.fn(() => true);

vi.mock('../db/client', () => ({
  prisma: {
    emailOutbound: {
      create: (...args: unknown[]) => createOutbound(...args),
      findUnique: (...args: unknown[]) => findUniqueOutbound(...args),
      findMany: (...args: unknown[]) => findManyOutbound(...args),
      update: (...args: unknown[]) => updateOutbound(...args),
      updateMany: (...args: unknown[]) => updateManyOutbound(...args),
    },
  },
}));

vi.mock('./sender', () => ({
  sendRenderedEmail: (...args: unknown[]) => sendRenderedEmail(...args),
  isEmailDeliveryConfigured: () => isEmailDeliveryConfigured(),
}));

vi.mock('../ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

vi.mock('../ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
}));

import {
  deliverOutboxEmail,
  enqueueEmail,
  processDueEmailOutbox,
  tryDeliverOutboxEmail,
} from './outbox';

function queuedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out_1',
    shopId: 'shop_1',
    bookingId: 'book_1',
    toEmail: 'client@example.com',
    subject: 'Your booking is confirmed',
    purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
    provider: 'resend',
    providerMessageId: null,
    status: EmailOutboundStatus.QUEUED,
    error: null,
    payload: {
      to: 'client@example.com',
      subject: 'Your booking is confirmed',
      html: '<p>confirmed</p><a href="https://kersivo.co.uk/book/cancel?token=secret">cancel</a>',
    },
    attempts: 0,
    maxAttempts: 6,
    nextAttemptAt: new Date(0),
    lastAttemptAt: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('enqueueEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a QUEUED row with payload and nextAttemptAt inside the tx client', async () => {
    const created = queuedRow();
    createOutbound.mockResolvedValue(created);
    const tx = {
      emailOutbound: { create: (...args: unknown[]) => createOutbound(...args) },
    };

    const row = await enqueueEmail(tx as never, {
      shopId: 'shop_1',
      bookingId: 'book_1',
      purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
      to: 'Client@Example.com',
      subject: 'Your booking is confirmed',
      html: '<p>ok</p>',
    });

    expect(row.id).toBe('out_1');
    expect(createOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 'shop_1',
          bookingId: 'book_1',
          toEmail: 'client@example.com',
          status: EmailOutboundStatus.QUEUED,
          attempts: 0,
          payload: expect.objectContaining({
            to: 'client@example.com',
            subject: 'Your booking is confirmed',
            html: '<p>ok</p>',
          }),
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('deliverOutboxEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    isEmailDeliveryConfigured.mockReturnValue(true);
  });

  it('marks SENT and clears payload on successful Resend send', async () => {
    const row = queuedRow();
    findUniqueOutbound.mockResolvedValue(row);
    updateManyOutbound.mockResolvedValue({ count: 1 });
    sendRenderedEmail.mockResolvedValue({ messageId: 'msg_1' });
    updateOutbound.mockResolvedValue({
      ...row,
      status: EmailOutboundStatus.SENT,
      providerMessageId: 'msg_1',
      attempts: 1,
      payload: null,
      sentAt: new Date(),
      nextAttemptAt: null,
    });

    const result = await deliverOutboxEmail('out_1');

    expect(result.status).toBe('sent');
    expect(sendRenderedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Your booking is confirmed',
        html: expect.stringContaining('token=secret'),
      }),
    );
    expect(updateOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out_1' },
        data: expect.objectContaining({
          status: EmailOutboundStatus.SENT,
          providerMessageId: 'msg_1',
          payload: Prisma.DbNull,
          nextAttemptAt: null,
        }),
      }),
    );
  });

  it('keeps QUEUED with backoff when Resend throws', async () => {
    const row = queuedRow();
    findUniqueOutbound.mockResolvedValue(row);
    updateManyOutbound.mockResolvedValue({ count: 1 });
    sendRenderedEmail.mockRejectedValue(new Error('Resend returned an error response.'));
    updateOutbound.mockResolvedValue({
      ...row,
      status: EmailOutboundStatus.QUEUED,
      attempts: 1,
      error: 'Resend returned an error response.',
    });

    const result = await deliverOutboxEmail('out_1');

    expect(result.status).toBe('queued');
    expect(notifyOpsDurable).not.toHaveBeenCalled();
    expect(updateOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailOutboundStatus.QUEUED,
          attempts: 1,
          nextAttemptAt: expect.any(Date),
          error: 'Resend returned an error response.',
        }),
      }),
    );
  });

  it('marks FAILED and alerts when attempts are exhausted', async () => {
    const row = queuedRow({ attempts: 5, maxAttempts: 6 });
    findUniqueOutbound.mockResolvedValue(row);
    updateManyOutbound.mockResolvedValue({ count: 1 });
    sendRenderedEmail.mockRejectedValue(new Error('timeout'));
    updateOutbound.mockResolvedValue({
      ...row,
      status: EmailOutboundStatus.FAILED,
      attempts: 6,
      nextAttemptAt: null,
      error: 'timeout',
    });

    const result = await deliverOutboxEmail('out_1');

    expect(result.status).toBe('failed');
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        dedupeKey: 'email:failed:out_1',
      }),
    );
    expect(captureOpsException).toHaveBeenCalled();
    expect(updateOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailOutboundStatus.FAILED,
          attempts: 6,
          nextAttemptAt: null,
        }),
      }),
    );
  });

  it('skips double-claim when another worker already claimed the row', async () => {
    const row = queuedRow();
    findUniqueOutbound
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, status: EmailOutboundStatus.QUEUED, attempts: 1 });
    updateManyOutbound.mockResolvedValue({ count: 0 });

    const result = await deliverOutboxEmail('out_1');

    expect(result.status).toBe('queued');
    expect(sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('tryDeliverOutboxEmail never throws when deliver fails hard', async () => {
    findUniqueOutbound.mockRejectedValue(new Error('db down'));
    await expect(tryDeliverOutboxEmail('out_1')).resolves.toBeUndefined();
  });
});

describe('processDueEmailOutbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('drains due rows and aggregates statuses', async () => {
    findManyOutbound.mockResolvedValue([{ id: 'out_1' }, { id: 'out_2' }]);

    const sentRow = queuedRow({ id: 'out_1' });
    const failRow = queuedRow({ id: 'out_2', attempts: 5 });

    findUniqueOutbound.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'out_1') return sentRow;
      return failRow;
    });
    updateManyOutbound.mockResolvedValue({ count: 1 });
    sendRenderedEmail
      .mockResolvedValueOnce({ messageId: 'm1' })
      .mockRejectedValueOnce(new Error('boom'));
    updateOutbound
      .mockResolvedValueOnce({
        ...sentRow,
        status: EmailOutboundStatus.SENT,
        attempts: 1,
        payload: null,
      })
      .mockResolvedValueOnce({
        ...failRow,
        status: EmailOutboundStatus.FAILED,
        attempts: 6,
        nextAttemptAt: null,
      });

    const summary = await processDueEmailOutbox(new Date());

    expect(summary).toEqual({
      scanned: 2,
      sent: 1,
      queued: 0,
      failed: 1,
      skipped: 0,
    });
    expect(findManyOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
          payload: { not: Prisma.DbNull },
        }),
        take: 25,
      }),
    );
  });
});
