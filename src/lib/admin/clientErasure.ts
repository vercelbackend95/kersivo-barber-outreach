import { randomUUID } from 'node:crypto';
import { DepositRefundStatus, EmailOutboundStatus, Prisma } from '@prisma/client';
import { getEffectiveBookingStatus } from '@/lib/booking/operationalStatus';
import {
  isReminderClaimFresh,
  isReminderClaimStale,
  REMINDER_CLAIM_SENTINEL,
  reminderClaimStaleBefore,
} from '@/lib/booking/reminderClaim';
import { lockShopCustomerIdentity } from '@/lib/db/customerIdentityLock';
import { runSerializableTransaction } from '@/lib/db/serializableTransaction';
import { EMAIL_OUTBOX_IN_FLIGHT_ERROR } from '@/lib/email/outbox';
import { captureOpsMessage } from '@/lib/ops/sentry';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import {
  isLegacyPublicNoteImageUrl,
  isPrivateNoteBlobPathname,
} from '@/lib/storage/clientNoteImageUrl';
import { deletePrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';
import { deletePublicBlobObject } from '@/lib/storage/vercelBlob';

export const CLIENT_ERASURE_BLOCKED_CODE = 'CLIENT_ERASURE_BLOCKED_ACTIVE_BOOKING' as const;
export const CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT =
  'CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT' as const;
export const ERASED_CUSTOMER_DISPLAY_NAME = 'Erased customer';

/** Reserved invalid domain — never routes to a real mailbox. */
export const ERASURE_PLACEHOLDER_DOMAIN = 'example.invalid';

export function erasedBookingEmailPlaceholder(bookingId: string): string {
  return `erased+${bookingId.trim()}@${ERASURE_PLACEHOLDER_DOMAIN}`;
}

export function erasedOrderEmailPlaceholder(orderId: string): string {
  return `erased+${orderId.trim()}@${ERASURE_PLACEHOLDER_DOMAIN}`;
}

export type ClientErasureBlockedError = {
  code: typeof CLIENT_ERASURE_BLOCKED_CODE | typeof CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT;
  message: string;
};

export function isClientErasureBlockedError(error: unknown): error is ClientErasureBlockedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as { code?: string }).code === CLIENT_ERASURE_BLOCKED_CODE ||
      (error as { code?: string }).code === CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT)
  );
}

export type ClientErasureDbResult = {
  operationId: string;
  bookingCount: number;
  orderCount: number;
  blobCleanupAttempted: number;
  /** Opaque refs for post-commit cleanup only — never audit these. */
  blobRefs: Array<{ kind: 'public' | 'private'; target: string }>;
};

export type ClientErasureResult = {
  ok: true;
  operationId: string;
  bookingCount: number;
  orderCount: number;
  blobCleanupAttempted: number;
  blobCleanupFailed: number;
  blobCleanupWarning: boolean;
};

/**
 * True when a booking still needs live customer identity for ops/comms/payment.
 * Reuses getEffectiveBookingStatus for BOOKED clock semantics.
 */
export function bookingBlocksClientErasure(input: {
  status: string;
  startAt: Date;
  endAt: Date;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  if (input.status === 'PENDING_PAYMENT') return true;
  if (input.status === 'ARRIVED' || input.status === 'IN_PROGRESS') return true;

  const effective = getEffectiveBookingStatus({
    status: input.status,
    startAt: input.startAt,
    endAt: input.endAt,
    nowMs,
  });

  if (effective === 'IN_PROGRESS') return true;
  if (effective === 'BOOKED' && input.startAt.getTime() > nowMs) return true;
  return false;
}

function throwBlocked(
  code: ClientErasureBlockedError['code'],
  message: string,
): never {
  const error: ClientErasureBlockedError = { code, message };
  throw error;
}

/**
 * Fresh Date(0) → block erasure.
 * Stale Date(0) → clear claim to null (same as provider-failure release).
 * Do NOT write a real sentAt — that would falsely claim delivery.
 *
 * After this CAS + anonymisation (phone null, placeholder email, terminal/past
 * booking), reminder workers cannot select the row for send.
 */
async function resolveReminderClaimsForErasure(
  tx: Prisma.TransactionClient,
  bookings: Array<{
    id: string;
    startAt: Date;
    updatedAt: Date;
    smsReminderSentAt: Date | null;
    emailReminderSentAt: Date | null;
  }>,
  nowMs: number,
): Promise<void> {
  const staleBefore = reminderClaimStaleBefore(nowMs);

  for (const booking of bookings) {
    if (isReminderClaimFresh(booking.smsReminderSentAt, booking.updatedAt, nowMs)) {
      throwBlocked(
        CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
        'A message for this customer is currently being processed. Try again shortly.',
      );
    }
    if (isReminderClaimFresh(booking.emailReminderSentAt, booking.updatedAt, nowMs)) {
      throwBlocked(
        CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
        'A message for this customer is currently being processed. Try again shortly.',
      );
    }

    if (isReminderClaimStale(booking.smsReminderSentAt, booking.updatedAt, nowMs)) {
      const cleared = await tx.booking.updateMany({
        where: {
          id: booking.id,
          smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
          updatedAt: { lte: staleBefore },
        },
        data: {
          smsReminderSentAt: null,
          smsReminderForStartAt: null,
        },
      });
      if (cleared.count === 0) {
        throwBlocked(
          CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
          'A message for this customer is currently being processed. Try again shortly.',
        );
      }
    }

    if (isReminderClaimStale(booking.emailReminderSentAt, booking.updatedAt, nowMs)) {
      const cleared = await tx.booking.updateMany({
        where: {
          id: booking.id,
          emailReminderSentAt: REMINDER_CLAIM_SENTINEL,
          updatedAt: { lte: staleBefore },
        },
        data: {
          emailReminderSentAt: null,
          emailReminderForStartAt: null,
        },
      });
      if (cleared.count === 0) {
        throwBlocked(
          CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
          'A message for this customer is currently being processed. Try again shortly.',
        );
      }
    }
  }
}

/**
 * Lock affected outbound rows, block if any are claimed/in-flight, then hard-delete.
 *
 * Status classification (actual enums only):
 * - Email QUEUED + error=__IN_FLIGHT__ → IN_FLIGHT_BLOCKER
 * - Email QUEUED / FAILED otherwise → SAFE_TO_DELETE
 * - Email SENT → TERMINAL_SAFE_TO_DELETE
 * - Sms QUEUED / FAILED / SENT → SAFE/TERMINAL delete; Booking Date(0) claim gated in resolveReminderClaimsForErasure
 */
async function lockAndDeleteOutboundForBookings(
  tx: Prisma.TransactionClient,
  bookingIds: string[],
): Promise<void> {
  if (bookingIds.length === 0) return;

  const emailRows = await tx.$queryRaw<Array<{ id: string; status: string; error: string | null }>>(
    Prisma.sql`
      SELECT id, status::text AS status, error
      FROM "EmailOutbound"
      WHERE "bookingId" IN (${Prisma.join(bookingIds)})
      FOR UPDATE
    `,
  );

  for (const row of emailRows) {
    if (
      row.status === EmailOutboundStatus.QUEUED &&
      row.error === EMAIL_OUTBOX_IN_FLIGHT_ERROR
    ) {
      throwBlocked(
        CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
        'A message for this customer is currently being processed. Try again shortly.',
      );
    }
  }

  const smsRows = await tx.$queryRaw<Array<{ id: string; status: string }>>(
    Prisma.sql`
      SELECT id, status::text AS status
      FROM "SmsOutbound"
      WHERE "bookingId" IN (${Prisma.join(bookingIds)})
      FOR UPDATE
    `,
  );
  // SmsOutbound has no separate in-flight status; Booking reminder claims gate sends.
  void smsRows;

  await tx.emailOutbound.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await tx.smsOutbound.deleteMany({ where: { bookingId: { in: bookingIds } } });
}

export async function eraseClientPersonalDataInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    clientId: string;
    nowMs?: number;
  },
): Promise<ClientErasureDbResult> {
  const operationId = randomUUID();
  const nowMs = input.nowMs ?? Date.now();

  // Row lock: prevent concurrent booking/order writers from racing on this Client.
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM "Client" WHERE id = ${input.clientId} AND "shopId" = ${input.shopId} FOR UPDATE`,
  );
  if (!locked.length) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  const client = await tx.client.findFirst({
    where: { id: input.clientId, shopId: input.shopId },
    select: {
      id: true,
      shopId: true,
      email: true,
      avatarUrl: true,
      clientNotes: {
        select: {
          id: true,
          images: { select: { url: true } },
        },
      },
    },
  });
  if (!client) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  const bookings = await tx.booking.findMany({
    where: { clientId: client.id },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      updatedAt: true,
      smsReminderSentAt: true,
      emailReminderSentAt: true,
      depositRefund: { select: { status: true } },
    },
  });

  for (const booking of bookings) {
    if (
      bookingBlocksClientErasure({
        status: booking.status,
        startAt: booking.startAt,
        endAt: booking.endAt,
        nowMs,
      })
    ) {
      throwBlocked(
        CLIENT_ERASURE_BLOCKED_CODE,
        'This customer still has an active or unpaid appointment. Finish, cancel, or resolve it before erasing their data.',
      );
    }
    const refundStatus = booking.depositRefund?.status;
    if (
      refundStatus === DepositRefundStatus.REFUND_PENDING ||
      refundStatus === DepositRefundStatus.REFUND_FAILED
    ) {
      throwBlocked(
        CLIENT_ERASURE_BLOCKED_CODE,
        'This customer has an unresolved deposit refund. Resolve the refund before erasing their data.',
      );
    }
  }

  // Lock booking rows so reminder workers cannot reclaim while we classify/neutralise.
  const bookingIds = bookings.map((b) => b.id);
  if (bookingIds.length > 0) {
    await tx.$queryRaw(
      Prisma.sql`
        SELECT id FROM "Booking"
        WHERE id IN (${Prisma.join(bookingIds)})
        FOR UPDATE
      `,
    );
    const lockedBookings = await tx.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        startAt: true,
        updatedAt: true,
        smsReminderSentAt: true,
        emailReminderSentAt: true,
      },
    });
    await resolveReminderClaimsForErasure(tx, lockedBookings, nowMs);
  }
  const blobRefs: ClientErasureDbResult['blobRefs'] = [];

  if (client.avatarUrl?.trim()) {
    blobRefs.push({ kind: 'public', target: client.avatarUrl.trim() });
  }
  for (const note of client.clientNotes) {
    for (const image of note.images) {
      const url = image.url.trim();
      if (!url) continue;
      if (isPrivateNoteBlobPathname(url)) {
        blobRefs.push({ kind: 'private', target: url });
      } else if (isLegacyPublicNoteImageUrl(url) && /^https?:\/\//i.test(url)) {
        blobRefs.push({ kind: 'public', target: url });
      }
    }
  }

  for (const bookingId of bookingIds) {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        fullName: ERASED_CUSTOMER_DISPLAY_NAME,
        email: erasedBookingEmailPlaceholder(bookingId),
        phone: null,
        notes: null,
        clientId: null,
        confirmTokenHash: null,
        confirmTokenExpiresAt: null,
        manageTokenHash: null,
        manageTokenExpiresAt: null,
      },
    });
  }

  if (bookingIds.length > 0) {
    await lockAndDeleteOutboundForBookings(tx, bookingIds);
  }

  // Shared identity lock with Order create paths — linearization point for Order-vs-erasure.
  await lockShopCustomerIdentity(tx, client.shopId, client.email);

  // Orders have no clientId — match only by exact stored Client.email within this shop
  // (same string as upsert key; no new case-normalisation in this change).
  const matchedOrders = await tx.order.findMany({
    where: { shopId: client.shopId, customerEmail: client.email },
    select: { id: true },
  });

  for (const order of matchedOrders) {
    await tx.order.update({
      where: { id: order.id },
      data: { customerEmail: erasedOrderEmailPlaceholder(order.id) },
    });
  }

  await tx.client.delete({ where: { id: client.id } });

  return {
    operationId,
    bookingCount: bookingIds.length,
    orderCount: matchedOrders.length,
    blobCleanupAttempted: blobRefs.length,
    blobRefs,
  };
}

async function cleanupBlobsBestEffort(
  refs: ClientErasureDbResult['blobRefs'],
  context: { shopId: string; operationId: string },
): Promise<number> {
  let failed = 0;
  for (const ref of refs) {
    try {
      if (ref.kind === 'private') {
        await deletePrivateOnboardingFile(ref.target);
      } else if (!isSafePublicClientErasureBlobTarget(ref.target)) {
        // Refuse arbitrary/external URLs — do not delete shared or unknown assets.
        continue;
      } else {
        await deletePublicBlobObject(ref.target);
      }
    } catch (error) {
      failed += 1;
      captureOpsMessage('Client erasure blob cleanup failed', {
        route: 'admin.clients.erase',
        shopId: context.shopId,
        level: 'warning',
        opsAlert: true,
        tags: {
          operationId: context.operationId,
          blobKind: ref.kind,
        },
      });
      console.error('[client-erasure] blob cleanup failed', {
        shopId: context.shopId,
        operationId: context.operationId,
        blobKind: ref.kind,
        error,
      });
    }
  }
  return failed;
}

/** Only Client avatar objects under the known public upload namespace. */
export function isSafePublicClientErasureBlobTarget(urlOrPathname: string): boolean {
  const value = urlOrPathname.trim();
  if (!value) return false;

  const pathOnly = (() => {
    if (!/^https?:\/\//i.test(value)) return value.replace(/^\//, '');
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'blob.vercel-storage.com' && !host.endsWith('.blob.vercel-storage.com')) {
        return null;
      }
      return parsed.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  })();

  return typeof pathOnly === 'string' && pathOnly.startsWith('clients/');
}

export async function eraseClientPersonalData(input: {
  shopId: string;
  clientId: string;
  actorUserId: string | null;
  nowMs?: number;
}): Promise<ClientErasureResult> {
  const dbResult = await runSerializableTransaction((tx) =>
    eraseClientPersonalDataInTransaction(tx, {
      shopId: input.shopId,
      clientId: input.clientId,
      nowMs: input.nowMs,
    }),
  );

  const blobCleanupFailed = await cleanupBlobsBestEffort(dbResult.blobRefs, {
    shopId: input.shopId,
    operationId: dbResult.operationId,
  });

  await recordAccountLifecycleEvent({
    action: ACCOUNT_LIFECYCLE_ACTIONS.CLIENT_DATA_ERASED,
    userId: input.actorUserId,
    email: null,
    shopId: input.shopId,
    meta: {
      operationId: dbResult.operationId,
      bookingCount: dbResult.bookingCount,
      orderCount: dbResult.orderCount,
      blobCleanupAttempted: dbResult.blobCleanupAttempted,
      blobCleanupFailed,
      result: blobCleanupFailed > 0 ? 'ok_with_blob_cleanup_warning' : 'ok',
    },
  });

  return {
    ok: true,
    operationId: dbResult.operationId,
    bookingCount: dbResult.bookingCount,
    orderCount: dbResult.orderCount,
    blobCleanupAttempted: dbResult.blobCleanupAttempted,
    blobCleanupFailed,
    blobCleanupWarning: blobCleanupFailed > 0,
  };
}
