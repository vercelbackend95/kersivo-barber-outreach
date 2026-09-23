import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepositRefundStatus } from '@prisma/client';

const runSerializableTransaction = vi.fn();
const recordAccountLifecycleEvent = vi.fn();
const captureOpsMessage = vi.fn();
const deletePublicBlobObject = vi.fn();
const deletePrivateOnboardingFile = vi.fn();
const lockShopCustomerIdentity = vi.fn();

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: (...args: unknown[]) => runSerializableTransaction(...args),
}));

vi.mock('@/lib/db/customerIdentityLock', () => ({
  lockShopCustomerIdentity: (...args: unknown[]) => lockShopCustomerIdentity(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    CLIENT_DATA_ERASED: 'CLIENT_DATA_ERASED',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

vi.mock('@/lib/storage/vercelBlob', () => ({
  deletePublicBlobObject: (...args: unknown[]) => deletePublicBlobObject(...args),
}));

vi.mock('@/lib/storage/privateOnboardingBlob', () => ({
  deletePrivateOnboardingFile: (...args: unknown[]) => deletePrivateOnboardingFile(...args),
}));

import {
  bookingBlocksClientErasure,
  canonicalRetailCustomerEmail,
  CLIENT_ERASURE_BLOCKED_CODE,
  CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
  eraseClientPersonalData,
  eraseClientPersonalDataInTransaction,
  erasedBookingEmailPlaceholder,
  erasedOrderEmailPlaceholder,
  ERASED_CUSTOMER_DISPLAY_NAME,
  isClientErasureBlockedError,
  isSafePublicClientErasureBlobTarget,
} from './clientErasure';
import { EMAIL_OUTBOX_IN_FLIGHT_ERROR } from '@/lib/email/outbox';
import { EmailOutboundPurpose } from '@prisma/client';
import {
  REMINDER_CLAIM_SENTINEL,
  REMINDER_CLAIM_STALE_MS,
} from '@/lib/booking/reminderClaim';

function pastCompletedWindow(nowMs: number) {
  return {
    startAt: new Date(nowMs - 3 * 60 * 60 * 1000),
    endAt: new Date(nowMs - 2 * 60 * 60 * 1000),
  };
}

function futureWindow(nowMs: number) {
  return {
    startAt: new Date(nowMs + 60 * 60 * 1000),
    endAt: new Date(nowMs + 90 * 60 * 1000),
  };
}

function emailOutboundSqlKind(sql: { strings?: string[]; values?: unknown[] } | string): 'booking' | 'retail' | 'other' {
  const text = String((sql as { strings?: string[] })?.strings?.join?.(' ') ?? sql);
  if (!text.includes('"EmailOutbound"')) return 'other';
  if (text.includes('"bookingId"')) return 'booking';
  if (text.includes('"toEmail"')) return 'retail';
  return 'other';
}

type SimulatedEmailOutboundRow = {
  id: string;
  shopId: string;
  purpose: string;
  toEmail: string;
  bookingId: string | null;
  status: string;
  error: string | null;
};

/** Interprets the retail FOR UPDATE Prisma.sql placeholders: shopId, purpose, toEmail. */
function retailOutboxLockParams(sql: { strings?: string[]; values?: unknown[] }) {
  const values = sql.values ?? [];
  return {
    shopId: String(values[0] ?? ''),
    purpose: values[1] as string,
    toEmail: String(values[2] ?? ''),
  };
}

/**
 * Mutates `rows` like Prisma deleteMany AND-matching.
 * Supports bookingId:{in} and retail {shopId,purpose,toEmail}.
 */
function applySimulatedEmailOutboundDeleteMany(
  rows: SimulatedEmailOutboundRow[],
  where: Record<string, unknown>,
): number {
  const bookingIn =
    where.bookingId &&
    typeof where.bookingId === 'object' &&
    where.bookingId !== null &&
    'in' in (where.bookingId as object)
      ? new Set((where.bookingId as { in: string[] }).in)
      : null;

  let removed = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]!;
    let match = true;
    if (bookingIn) {
      match = row.bookingId != null && bookingIn.has(row.bookingId);
    } else {
      if ('shopId' in where && row.shopId !== where.shopId) match = false;
      if ('purpose' in where && row.purpose !== where.purpose) match = false;
      if ('toEmail' in where && row.toEmail !== where.toEmail) match = false;
      if ('bookingId' in where) {
        match = match && row.bookingId === where.bookingId;
      }
    }
    if (match) {
      rows.splice(i, 1);
      removed += 1;
    }
  }
  return removed;
}

describe('canonicalRetailCustomerEmail', () => {
  it('matches retail writer trim+lower semantics', () => {
    expect(canonicalRetailCustomerEmail('  Alex.Customer@Example.com ')).toBe(
      'alex.customer@example.com',
    );
    expect(canonicalRetailCustomerEmail('alex@customer.example')).toBe('alex@customer.example');
  });
});

describe('erasure placeholders', () => {
  it('uses reserved example.invalid domain and never kersivo.co.uk', () => {
    expect(erasedBookingEmailPlaceholder('bk-1')).toBe('erased+bk-1@example.invalid');
    expect(erasedOrderEmailPlaceholder('ord-9')).toBe('erased+ord-9@example.invalid');
    expect(erasedBookingEmailPlaceholder('bk-1')).not.toContain('kersivo');
  });

  it('placeholder emails cannot collide with real customer upsert keys', () => {
    const real = 'customer@example.com';
    expect(erasedBookingEmailPlaceholder('bk-1')).not.toBe(real);
    expect(erasedBookingEmailPlaceholder('bk-1').endsWith('@example.invalid')).toBe(true);
  });
});

describe('isSafePublicClientErasureBlobTarget', () => {
  it('allows clients/ pathname and vercel blob URLs under clients/', () => {
    expect(isSafePublicClientErasureBlobTarget('clients/c1-avatar.webp')).toBe(true);
    expect(
      isSafePublicClientErasureBlobTarget(
        'https://abc.public.blob.vercel-storage.com/clients/c1-avatar.webp',
      ),
    ).toBe(true);
  });

  it('rejects external hosts and non-client namespaces', () => {
    expect(isSafePublicClientErasureBlobTarget('https://evil.example/clients/x.webp')).toBe(false);
    expect(isSafePublicClientErasureBlobTarget('barbers/b1.webp')).toBe(false);
    expect(isSafePublicClientErasureBlobTarget('https://cdn.example/logo.png')).toBe(false);
  });
});

describe('bookingBlocksClientErasure', () => {
  const nowMs = Date.parse('2026-09-23T12:00:00.000Z');

  it('blocks PENDING_PAYMENT', () => {
    expect(
      bookingBlocksClientErasure({
        status: 'PENDING_PAYMENT',
        ...futureWindow(nowMs),
        nowMs,
      }),
    ).toBe(true);
  });

  it('blocks ARRIVED and IN_PROGRESS', () => {
    expect(
      bookingBlocksClientErasure({
        status: 'ARRIVED',
        ...pastCompletedWindow(nowMs),
        nowMs,
      }),
    ).toBe(true);
    expect(
      bookingBlocksClientErasure({
        status: 'IN_PROGRESS',
        ...pastCompletedWindow(nowMs),
        nowMs,
      }),
    ).toBe(true);
  });

  it('blocks future BOOKED appointments', () => {
    expect(
      bookingBlocksClientErasure({
        status: 'BOOKED',
        ...futureWindow(nowMs),
        nowMs,
      }),
    ).toBe(true);
  });

  it('allows historical COMPLETED / cancelled / no-show', () => {
    const window = pastCompletedWindow(nowMs);
    for (const status of ['COMPLETED', 'CANCELLED_BY_SHOP', 'CANCELLED_BY_CLIENT', 'NO_SHOW', 'BOOKED']) {
      expect(bookingBlocksClientErasure({ status, ...window, nowMs })).toBe(false);
    }
  });
});

describe('eraseClientPersonalDataInTransaction', () => {
  const nowMs = Date.parse('2026-09-23T12:00:00.000Z');
  const past = pastCompletedWindow(nowMs);

  let queryRaw: ReturnType<typeof vi.fn>;
  let clientFindFirst: ReturnType<typeof vi.fn>;
  let bookingFindMany: ReturnType<typeof vi.fn>;
  let bookingUpdate: ReturnType<typeof vi.fn>;
  let bookingUpdateMany: ReturnType<typeof vi.fn>;
  let orderFindMany: ReturnType<typeof vi.fn>;
  let orderUpdate: ReturnType<typeof vi.fn>;
  let clientDelete: ReturnType<typeof vi.fn>;
  let emailOutboundDeleteMany: ReturnType<typeof vi.fn>;
  let smsOutboundDeleteMany: ReturnType<typeof vi.fn>;
  let tx: {
    $queryRaw: ReturnType<typeof vi.fn>;
    client: { findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    booking: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    order: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    emailOutbound: { deleteMany: ReturnType<typeof vi.fn> };
    smsOutbound: { deleteMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    lockShopCustomerIdentity.mockReset();
    lockShopCustomerIdentity.mockResolvedValue(undefined);

    queryRaw = vi.fn(async (sql: { strings?: string[] }) => {
      const text = String(sql?.strings?.join?.(' ') ?? sql);
      if (text.includes('"Client"')) return [{ id: 'client-1' }];
      const outboundKind = emailOutboundSqlKind(sql);
      if (outboundKind === 'booking') {
        return [{ id: 'em-booking-1', status: 'SENT', error: null }];
      }
      if (outboundKind === 'retail') {
        return [{ id: 'em-retail-1', status: 'SENT', error: null }];
      }
      if (text.includes('"SmsOutbound"')) return [{ id: 'sm-1', status: 'SENT' }];
      return [];
    });
    clientFindFirst = vi.fn().mockResolvedValue({
      id: 'client-1',
      shopId: 'shop-1',
      email: 'alex@customer.example',
      avatarUrl: 'https://abc.public.blob.vercel-storage.com/clients/client-1-avatar.webp',
      clientNotes: [
        {
          id: 'note-1',
          images: [
            { url: 'client-notes/shop-1/client-1/note-1-0.webp' },
            { url: 'https://blob.example/legacy-note.webp' },
          ],
        },
      ],
    });
    bookingFindMany = vi.fn().mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        startAt: past.startAt,
        endAt: past.endAt,
        updatedAt: new Date(nowMs - 60_000),
        smsReminderSentAt: null,
        emailReminderSentAt: null,
        depositRefund: {
          status: DepositRefundStatus.REFUNDED,
          stripeRefundId: 're_keep',
        },
      },
    ]);
    bookingUpdate = vi.fn().mockResolvedValue({});
    bookingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    orderFindMany = vi.fn().mockResolvedValue([{ id: 'ord-1' }]);
    orderUpdate = vi.fn().mockResolvedValue({});
    clientDelete = vi.fn().mockResolvedValue({});
    emailOutboundDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    smsOutboundDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    tx = {
      $queryRaw: queryRaw,
      client: { findFirst: clientFindFirst, delete: clientDelete },
      booking: {
        findMany: bookingFindMany,
        update: bookingUpdate,
        updateMany: bookingUpdateMany,
      },
      order: { findMany: orderFindMany, update: orderUpdate },
      emailOutbound: { deleteMany: emailOutboundDeleteMany },
      smsOutbound: { deleteMany: smsOutboundDeleteMany },
    };
  });

  it('locks the Client row with FOR UPDATE before reading the graph', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(queryRaw).toHaveBeenCalled();
    const sqlArg = queryRaw.mock.calls[0]?.[0];
    expect(String(sqlArg?.strings?.join?.(' ') ?? sqlArg)).toMatch(/FOR UPDATE/i);
  });

  it('acquires shop customer identity lock before Order scan', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(tx, 'shop-1', 'alex@customer.example');
    const lockOrder = lockShopCustomerIdentity.mock.invocationCallOrder[0] ?? 0;
    const orderFindOrder = orderFindMany.mock.invocationCallOrder[0] ?? 0;
    expect(lockOrder).toBeLessThan(orderFindOrder);
  });

  it('locks outbound rows FOR UPDATE then deletes terminal/safe rows', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    const rawSqls = queryRaw.mock.calls.map((c) => String(c[0]?.strings?.join?.(' ') ?? c[0]));
    expect(rawSqls.some((s) => /EmailOutbound[\s\S]*FOR UPDATE/i.test(s))).toBe(true);
    expect(rawSqls.some((s) => /SmsOutbound[\s\S]*FOR UPDATE/i.test(s))).toBe(true);
    expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ['bk-1'] } },
    });
    expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
      where: {
        shopId: 'shop-1',
        purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
        toEmail: 'alex@customer.example',
      },
    });
    expect(smsOutboundDeleteMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ['bk-1'] } },
    });
  });

  it('blocks when booking-linked EmailOutbound is claimed in-flight', async () => {
    queryRaw.mockImplementation(async (sql: { strings?: string[] }) => {
      const text = String(sql?.strings?.join?.(' ') ?? sql);
      if (text.includes('"Client"')) return [{ id: 'client-1' }];
      if (emailOutboundSqlKind(sql) === 'booking') {
        return [{ id: 'em-1', status: 'QUEUED', error: EMAIL_OUTBOX_IN_FLIGHT_ERROR }];
      }
      if (emailOutboundSqlKind(sql) === 'retail') {
        return [{ id: 'em-retail-1', status: 'SENT', error: null }];
      }
      if (text.includes('"SmsOutbound"')) return [];
      return [];
    });

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isClientErasureBlockedError(error)).toBe(true);
      if (isClientErasureBlockedError(error)) {
        expect(error.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
        expect(error.message).not.toMatch(/@|phone|\+44/i);
      }
      return true;
    });
    expect(clientDelete).not.toHaveBeenCalled();
    expect(emailOutboundDeleteMany).not.toHaveBeenCalled();
  });

  it('CASE A: recent SMS Date(0) claim blocks erasure (409) with no mutation', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        ...past,
        updatedAt: new Date(nowMs - 60_000),
        smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(isClientErasureBlockedError(e)).toBe(true);
      if (isClientErasureBlockedError(e)) {
        expect(e.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
      }
      return true;
    });
    expect(bookingUpdateMany).not.toHaveBeenCalled();
    expect(bookingUpdate).not.toHaveBeenCalled();
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it('CASE A: recent email Date(0) claim blocks erasure (409)', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        ...past,
        updatedAt: new Date(nowMs - 30_000),
        smsReminderSentAt: null,
        emailReminderSentAt: REMINDER_CLAIM_SENTINEL,
        depositRefund: null,
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(isClientErasureBlockedError(e)).toBe(true);
      if (isClientErasureBlockedError(e)) {
        expect(e.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
      }
      return true;
    });
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it('CASE B: stale SMS Date(0) is cleared to null (not fake-sent); erasure proceeds', async () => {
    const staleUpdatedAt = new Date(nowMs - REMINDER_CLAIM_STALE_MS - 60_000);
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        ...past,
        updatedAt: staleUpdatedAt,
        smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);
    bookingUpdateMany.mockResolvedValue({ count: 1 });

    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'bk-1',
        smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
        updatedAt: { lte: new Date(nowMs - REMINDER_CLAIM_STALE_MS) },
      },
      data: {
        smsReminderSentAt: null,
        smsReminderForStartAt: null,
      },
    });
    expect(bookingUpdate).toHaveBeenCalled();
    expect(clientDelete).toHaveBeenCalled();
  });

  it('CASE B: stale email Date(0) is cleared to null (not fake-sent); erasure proceeds', async () => {
    const staleUpdatedAt = new Date(nowMs - REMINDER_CLAIM_STALE_MS - 1);
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        ...past,
        updatedAt: staleUpdatedAt,
        smsReminderSentAt: null,
        emailReminderSentAt: REMINDER_CLAIM_SENTINEL,
        depositRefund: null,
      },
    ]);
    bookingUpdateMany.mockResolvedValue({ count: 1 });

    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'bk-1',
        emailReminderSentAt: REMINDER_CLAIM_SENTINEL,
        updatedAt: { lte: new Date(nowMs - REMINDER_CLAIM_STALE_MS) },
      },
      data: {
        emailReminderSentAt: null,
        emailReminderForStartAt: null,
      },
    });
    expect(clientDelete).toHaveBeenCalled();
  });

  it('CASE C: stale CAS lose (worker reclaimed first) → erasure 409, no anonymise', async () => {
    const staleUpdatedAt = new Date(nowMs - REMINDER_CLAIM_STALE_MS - 1);
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-1',
        status: 'COMPLETED',
        ...past,
        updatedAt: staleUpdatedAt,
        smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);
    bookingUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(isClientErasureBlockedError(e)).toBe(true);
      if (isClientErasureBlockedError(e)) {
        expect(e.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
      }
      return true;
    });
    expect(bookingUpdate).not.toHaveBeenCalled();
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it('locks Booking rows FOR UPDATE before classifying reminder claims', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    const rawSqls = queryRaw.mock.calls.map((c) => String(c[0]?.strings?.join?.(' ') ?? c[0]));
    expect(rawSqls.some((s) => /"Booking"[\s\S]*FOR UPDATE/i.test(s))).toBe(true);
  });

  it('anonymise clears phone and uses placeholder email (reminder workers cannot deliver)', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    const anonymise = bookingUpdate.mock.calls[0]?.[0]?.data;
    expect(anonymise.phone).toBeNull();
    expect(anonymise.email).toBe(erasedBookingEmailPlaceholder('bk-1'));
    expect(anonymise.email.endsWith('@example.invalid')).toBe(true);
  });

  it('anonymises historical booking PII, clears tokens, deletes outbound, anonymises orders, deletes client', async () => {
    const result = await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: {
        fullName: ERASED_CUSTOMER_DISPLAY_NAME,
        email: erasedBookingEmailPlaceholder('bk-1'),
        phone: null,
        notes: null,
        clientId: null,
        confirmTokenHash: null,
        confirmTokenExpiresAt: null,
        manageTokenHash: null,
        manageTokenExpiresAt: null,
      },
    });

    expect(orderFindMany).toHaveBeenCalledWith({
      where: { shopId: 'shop-1', customerEmail: 'alex@customer.example' },
      select: { id: true },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { customerEmail: erasedOrderEmailPlaceholder('ord-1') },
    });

    expect(clientDelete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
    expect(result.bookingCount).toBe(1);
    expect(result.orderCount).toBe(1);
    expect(result.blobCleanupAttempted).toBe(3);
    expect(result.blobRefs).toEqual([
      {
        kind: 'public',
        target: 'https://abc.public.blob.vercel-storage.com/clients/client-1-avatar.webp',
      },
      { kind: 'private', target: 'client-notes/shop-1/client-1/note-1-0.webp' },
      { kind: 'public', target: 'https://blob.example/legacy-note.webp' },
    ]);
  });

  it('deletes matching retail SHOP_ORDER_CONFIRMATION for QUEUED / FAILED / SENT', async () => {
    for (const status of ['QUEUED', 'FAILED', 'SENT'] as const) {
      emailOutboundDeleteMany.mockClear();
      queryRaw.mockImplementation(async (sql: { strings?: string[] }) => {
        const text = String(sql?.strings?.join?.(' ') ?? sql);
        if (text.includes('"Client"')) return [{ id: 'client-1' }];
        if (emailOutboundSqlKind(sql) === 'booking') return [];
        if (emailOutboundSqlKind(sql) === 'retail') {
          return [{ id: `em-${status}`, status, error: null }];
        }
        if (text.includes('"SmsOutbound"')) return [];
        if (text.includes('"Booking"')) return [{ id: 'bk-1' }];
        return [];
      });

      await eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      });

      expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
        where: {
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'alex@customer.example',
        },
      });
    }
  });

  it('blocks when matching retail SHOP_ORDER_CONFIRMATION is in-flight', async () => {
    queryRaw.mockImplementation(async (sql: { strings?: string[] }) => {
      const text = String(sql?.strings?.join?.(' ') ?? sql);
      if (text.includes('"Client"')) return [{ id: 'client-1' }];
      if (emailOutboundSqlKind(sql) === 'booking') {
        return [{ id: 'em-booking', status: 'SENT', error: null }];
      }
      if (emailOutboundSqlKind(sql) === 'retail') {
        return [{ id: 'em-retail', status: 'QUEUED', error: EMAIL_OUTBOX_IN_FLIGHT_ERROR }];
      }
      if (text.includes('"SmsOutbound"')) return [];
      if (text.includes('"Booking"')) return [{ id: 'bk-1' }];
      return [];
    });

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isClientErasureBlockedError(error)).toBe(true);
      if (isClientErasureBlockedError(error)) {
        expect(error.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
      }
      return true;
    });

    expect(clientDelete).not.toHaveBeenCalled();
    // Booking outbound may have been deleted before retail lock; retail delete must not run.
    const retailDeletes = emailOutboundDeleteMany.mock.calls.filter(
      (c) => c[0]?.where?.purpose === EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
    );
    expect(retailDeletes).toHaveLength(0);
  });

  it('scopes retail outbox FOR UPDATE by shopId, SHOP_ORDER_CONFIRMATION, and canonical toEmail', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    const retailCall = queryRaw.mock.calls.find((c) => emailOutboundSqlKind(c[0]) === 'retail');
    expect(retailCall).toBeTruthy();
    const sql = retailCall![0] as { strings: string[]; values: unknown[] };
    const text = sql.strings.join(' ');
    expect(text).toMatch(/"shopId"/);
    expect(text).toMatch(/"toEmail"/);
    expect(text).toMatch(/FOR UPDATE/i);
    expect(text).not.toMatch(/bookingId IS NULL/i);
    expect(sql.values).toContain('shop-1');
    expect(sql.values).toContain('alex@customer.example');
    expect(sql.values).toContain(EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION);
  });

  it('case-variant Client.email matches lowercased retail Order + outbox; locks both identities', async () => {
    clientFindFirst.mockResolvedValue({
      id: 'client-1',
      shopId: 'shop-1',
      email: 'Alex.Customer@Example.com',
      avatarUrl: null,
      clientNotes: [],
    });
    bookingFindMany.mockResolvedValue([]);
    orderFindMany.mockResolvedValue([{ id: 'ord-cased' }]);

    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(tx, 'shop-1', 'Alex.Customer@Example.com');
    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(tx, 'shop-1', 'alex.customer@example.com');
    expect(lockShopCustomerIdentity).toHaveBeenCalledTimes(2);

    expect(orderFindMany).toHaveBeenCalledWith({
      where: { shopId: 'shop-1', customerEmail: 'alex.customer@example.com' },
      select: { id: true },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-cased' },
      data: { customerEmail: erasedOrderEmailPlaceholder('ord-cased') },
    });
    expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
      where: {
        shopId: 'shop-1',
        purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
        toEmail: 'alex.customer@example.com',
      },
    });
  });

  it('does not acquire the retail identity lock twice when Client.email is already canonical', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    expect(lockShopCustomerIdentity).toHaveBeenCalledTimes(1);
    expect(lockShopCustomerIdentity).toHaveBeenCalledWith(tx, 'shop-1', 'alex@customer.example');
  });

  it('retail outbox delete predicate does not use bare bookingId IS NULL', async () => {
    await eraseClientPersonalDataInTransaction(tx as never, {
      shopId: 'shop-1',
      clientId: 'client-1',
      nowMs,
    });

    for (const call of emailOutboundDeleteMany.mock.calls) {
      const where = call[0]?.where ?? {};
      expect(where).not.toEqual(expect.objectContaining({ bookingId: null }));
      if (where.purpose === EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION) {
        expect(where).toEqual({
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'alex@customer.example',
        });
      }
    }
  });

  it('throws CLIENT_NOT_FOUND when lock misses (cross-tenant / missing)', async () => {
    queryRaw.mockResolvedValue([]);
    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'other-shop-client',
        nowMs,
      }),
    ).rejects.toThrow('CLIENT_NOT_FOUND');
    expect(bookingUpdate).not.toHaveBeenCalled();
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it('blocks future active booking', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-future',
        status: 'BOOKED',
        ...futureWindow(nowMs),
        smsReminderSentAt: null,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isClientErasureBlockedError(error)).toBe(true);
      if (isClientErasureBlockedError(error)) {
        expect(error.code).toBe(CLIENT_ERASURE_BLOCKED_CODE);
      }
      return true;
    });
  });

  it('blocks PENDING_PAYMENT', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-pay',
        status: 'PENDING_PAYMENT',
        ...futureWindow(nowMs),
        smsReminderSentAt: null,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((e: unknown) => isClientErasureBlockedError(e));
  });

  it('blocks ARRIVED / IN_PROGRESS', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-arrived',
        status: 'ARRIVED',
        ...past,
        smsReminderSentAt: null,
        emailReminderSentAt: null,
        depositRefund: null,
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((e: unknown) => isClientErasureBlockedError(e));
  });

  it('blocks unresolved refund pending/failed', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-ref',
        status: 'COMPLETED',
        ...past,
        smsReminderSentAt: null,
        emailReminderSentAt: null,
        depositRefund: { status: DepositRefundStatus.REFUND_PENDING },
      },
    ]);

    await expect(
      eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isClientErasureBlockedError(error)).toBe(true);
      return true;
    });
  });

  describe('retail outbox isolation (in-memory fixture)', () => {
    function wireSimulatedRetailOutbox(rows: SimulatedEmailOutboundRow[]) {
      queryRaw.mockImplementation(async (sql: { strings?: string[]; values?: unknown[] }) => {
        const text = String(sql?.strings?.join?.(' ') ?? sql);
        if (text.includes('"Client"')) return [{ id: 'client-1' }];
        if (emailOutboundSqlKind(sql) === 'booking') {
          return [];
        }
        if (emailOutboundSqlKind(sql) === 'retail') {
          expect(text).not.toMatch(/bookingId/i);
          const { shopId, purpose, toEmail } = retailOutboxLockParams(sql);
          expect(shopId).toBeTruthy();
          expect(purpose).toBe(EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION);
          expect(toEmail).toBeTruthy();
          return rows
            .filter(
              (r) =>
                r.shopId === shopId &&
                r.purpose === purpose &&
                r.toEmail === toEmail,
            )
            .map((r) => ({ id: r.id, status: r.status, error: r.error }));
        }
        return [];
      });

      emailOutboundDeleteMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        // Production retail deletes must never use bare bookingId:null.
        expect(where).not.toEqual(expect.objectContaining({ bookingId: null }));
        if ('purpose' in where) {
          expect(where).toEqual({
            shopId: expect.any(String),
            purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
            toEmail: expect.any(String),
          });
        }
        const count = applySimulatedEmailOutboundDeleteMany(rows, where);
        return { count };
      });
    }

    function setupTargetClient(email = 'target@example.com') {
      clientFindFirst.mockResolvedValue({
        id: 'client-1',
        shopId: 'shop-1',
        email,
        avatarUrl: null,
        clientNotes: [],
      });
      bookingFindMany.mockResolvedValue([]);
      orderFindMany.mockResolvedValue([]);
    }

    it('does not delete same-shop SHOP_ORDER_CONFIRMATION for a different toEmail', async () => {
      const rows: SimulatedEmailOutboundRow[] = [
        {
          id: 'em-other-customer',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'other@example.com',
          bookingId: null,
          status: 'SENT',
          error: null,
        },
        {
          id: 'em-target',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'QUEUED',
          error: null,
        },
      ];
      setupTargetClient('target@example.com');
      wireSimulatedRetailOutbox(rows);

      await eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      });

      expect(rows.map((r) => r.id)).toEqual(['em-other-customer']);
      expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
        where: {
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
        },
      });
    });

    it('does not delete SHOP_ORDER_CONFIRMATION for the same email in another shop', async () => {
      const rows: SimulatedEmailOutboundRow[] = [
        {
          id: 'em-shop-2',
          shopId: 'shop-2',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'SENT',
          error: null,
        },
        {
          id: 'em-shop-1',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'FAILED',
          error: null,
        },
      ];
      setupTargetClient('target@example.com');
      wireSimulatedRetailOutbox(rows);

      await eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      });

      expect(rows.map((r) => r.id)).toEqual(['em-shop-2']);
      expect(emailOutboundDeleteMany).toHaveBeenCalledWith({
        where: {
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
        },
      });
    });

    it('does not delete same-shop CLIENT_ONBOARDING_INTERNAL even when toEmail matches and bookingId is null', async () => {
      const rows: SimulatedEmailOutboundRow[] = [
        {
          id: 'em-onboarding-internal',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.CLIENT_ONBOARDING_INTERNAL,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'SENT',
          error: null,
        },
        {
          id: 'em-retail',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'SENT',
          error: null,
        },
      ];
      setupTargetClient('target@example.com');
      wireSimulatedRetailOutbox(rows);

      await eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      });

      expect(rows.map((r) => r.id)).toEqual(['em-onboarding-internal']);
      expect(
        rows.some((r) => r.purpose === EmailOutboundPurpose.CLIENT_ONBOARDING_INTERNAL),
      ).toBe(true);
    });

    it('does not delete same-shop CLIENT_ONBOARDING_CUSTOMER_CONFIRMATION even when toEmail matches and bookingId is null', async () => {
      const rows: SimulatedEmailOutboundRow[] = [
        {
          id: 'em-onboarding-customer',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.CLIENT_ONBOARDING_CUSTOMER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'QUEUED',
          error: null,
        },
        {
          id: 'em-retail',
          shopId: 'shop-1',
          purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
          toEmail: 'target@example.com',
          bookingId: null,
          status: 'QUEUED',
          error: null,
        },
      ];
      setupTargetClient('target@example.com');
      wireSimulatedRetailOutbox(rows);

      await eraseClientPersonalDataInTransaction(tx as never, {
        shopId: 'shop-1',
        clientId: 'client-1',
        nowMs,
      });

      expect(rows.map((r) => r.id)).toEqual(['em-onboarding-customer']);
      expect(
        rows.some(
          (r) => r.purpose === EmailOutboundPurpose.CLIENT_ONBOARDING_CUSTOMER_CONFIRMATION,
        ),
      ).toBe(true);
    });
  });
});

describe('eraseClientPersonalData (post-commit blobs + audit)', () => {
  beforeEach(() => {
    runSerializableTransaction.mockReset();
    recordAccountLifecycleEvent.mockReset();
    captureOpsMessage.mockReset();
    deletePublicBlobObject.mockReset();
    deletePrivateOnboardingFile.mockReset();
  });

  it('cleans public avatar and private note blobs after DB commit; audit omits PII and paths', async () => {
    runSerializableTransaction.mockResolvedValue({
      operationId: 'op-1',
      bookingCount: 2,
      orderCount: 1,
      blobCleanupAttempted: 2,
      blobRefs: [
        { kind: 'public', target: 'https://abc.public.blob.vercel-storage.com/clients/c1.webp' },
        { kind: 'private', target: 'client-notes/shop-1/client-1/n.webp' },
      ],
    });
    deletePublicBlobObject.mockResolvedValue(undefined);
    deletePrivateOnboardingFile.mockResolvedValue(undefined);

    const result = await eraseClientPersonalData({
      shopId: 'shop-1',
      clientId: 'client-1',
      actorUserId: 'user-owner',
    });

    expect(result.blobCleanupWarning).toBe(false);
    expect(deletePublicBlobObject).toHaveBeenCalledWith(
      'https://abc.public.blob.vercel-storage.com/clients/c1.webp',
    );
    expect(deletePrivateOnboardingFile).toHaveBeenCalledWith(
      'client-notes/shop-1/client-1/n.webp',
    );

    expect(recordAccountLifecycleEvent).toHaveBeenCalledWith({
      action: 'CLIENT_DATA_ERASED',
      userId: 'user-owner',
      email: null,
      shopId: 'shop-1',
      meta: {
        operationId: 'op-1',
        bookingCount: 2,
        orderCount: 1,
        blobCleanupAttempted: 2,
        blobCleanupFailed: 0,
        result: 'ok',
      },
    });

    const serialized = JSON.stringify(recordAccountLifecycleEvent.mock.calls[0]?.[0]);
    expect(serialized).not.toMatch(/alex@|customer\.example|clients\/c1|client-notes\//);
    expect(serialized).not.toContain('client-1');
  });

  it('skips unsafe public blob URLs and keeps DB erasure successful on blob failure', async () => {
    runSerializableTransaction.mockResolvedValue({
      operationId: 'op-2',
      bookingCount: 0,
      orderCount: 0,
      blobCleanupAttempted: 2,
      blobRefs: [
        { kind: 'public', target: 'https://evil.example/shared-logo.png' },
        { kind: 'public', target: 'https://abc.public.blob.vercel-storage.com/clients/a.webp' },
      ],
    });
    deletePublicBlobObject.mockRejectedValue(new Error('provider down'));

    const result = await eraseClientPersonalData({
      shopId: 'shop-1',
      clientId: 'client-1',
      actorUserId: 'user-owner',
    });

    expect(result.ok).toBe(true);
    expect(deletePublicBlobObject).toHaveBeenCalledTimes(1);
    expect(deletePublicBlobObject).toHaveBeenCalledWith(
      'https://abc.public.blob.vercel-storage.com/clients/a.webp',
    );
    expect(result.blobCleanupWarning).toBe(true);
  });

  it('supports rebook semantics: historical booking stays detached; real email can form a new Client', async () => {
    const bookingId = 'bk-hist';
    const placeholder = erasedBookingEmailPlaceholder(bookingId);
    const realEmail = 'returning@customer.example';
    expect(placeholder).not.toBe(realEmail);
    expect(placeholder).toContain('@example.invalid');
  });
});
