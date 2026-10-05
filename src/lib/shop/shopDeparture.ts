import {
  EmailOutboundPurpose,
  Prisma,
  ShopDepartureOrigin,
  ShopDepartureStatus,
  type ShopDeparture,
} from '@prisma/client';
import { prisma } from '../db/client';
import {
  OPERATIONAL_BOOKING_CANDIDATE_STATUSES,
  isOperationalBooking,
} from '../booking/operationalBookings';
import { enqueueEmail } from '../email/outbox';
import { buildShopDepartureConfirmationEmail } from '../email/shopDepartureEmails';
import { ACCOUNT_LIFECYCLE_ACTIONS, recordAccountLifecycleEvent } from '../setup/accountLifecycleAudit';
import { SAAS_EXPORT_RETENTION_DAYS, retentionEndsAtFrom } from '../setup/saasEntitlement';
import { isDemoShopId } from './cardPaymentsGate';
import { loadKersivoAccess, type KersivoAccessDb } from './kersivoAccess';
import {
  SHOP_DEPARTURE_IN_PROGRESS,
  SHOP_DEPARTURE_IN_PROGRESS_MESSAGE,
} from './shopDepartureCopy';

const OPEN_SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const;

export function shopDepartureInProgressResponse(): Response {
  return new Response(
    JSON.stringify({ error: SHOP_DEPARTURE_IN_PROGRESS_MESSAGE, code: SHOP_DEPARTURE_IN_PROGRESS }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Upcoming / in-flight bookings of the shop that still need handling (see isOperationalBooking).
 * Bookings belong to a shop through their barber or service, matching purgeShopData.
 */
export async function countFutureOperationalBookings(
  shopId: string,
  now: Date = new Date(),
  db: KersivoAccessDb = prisma,
): Promise<number> {
  const rows = await db.booking.findMany({
    where: {
      status: { in: [...OPERATIONAL_BOOKING_CANDIDATE_STATUSES] },
      OR: [{ barber: { shopId } }, { service: { shopId } }],
    },
    select: { status: true, startAt: true, endAt: true },
  });
  const nowMs = now.getTime();
  return rows.filter((row) =>
    isOperationalBooking({ status: String(row.status), startAt: row.startAt, endAt: row.endAt, nowMs }),
  ).length;
}

async function lockShop(tx: Prisma.TransactionClient, shopId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Initial lifecycle fields: wind-down while appointments remain, otherwise straight to retention. */
function initialDepartureFields(params: {
  now: Date;
  futureAppointments: number;
  retentionEndsAt: Date;
}): Pick<
  Prisma.ShopDepartureUncheckedCreateInput,
  'status' | 'windDownStartedAt' | 'retentionStartedAt' | 'retentionEndsAt'
> {
  if (params.futureAppointments > 0) {
    return {
      status: ShopDepartureStatus.WINDING_DOWN,
      windDownStartedAt: params.now,
      retentionStartedAt: null,
      retentionEndsAt: null,
    };
  }
  return {
    status: ShopDepartureStatus.RETENTION,
    windDownStartedAt: null,
    retentionStartedAt: params.now,
    retentionEndsAt: params.retentionEndsAt,
  };
}

export type ShopDepartureSummary = {
  status: ShopDepartureStatus;
  origin: ShopDepartureOrigin;
  requestedAt: string;
  futureAppointments: number;
};

function summarize(departure: Pick<ShopDeparture, 'status' | 'origin' | 'requestedAt'>, futureAppointments: number): ShopDepartureSummary {
  return {
    status: departure.status,
    origin: departure.origin,
    requestedAt: departure.requestedAt.toISOString(),
    futureAppointments,
  };
}

export type RequestStarterDepartureResult =
  | { ok: true; created: boolean; departure: ShopDepartureSummary; outboxId: string | null }
  | {
      ok: false;
      code: 'PROTECTED_SHOP' | 'SHOP_NOT_FOUND' | 'FULL_KERSIVO_ACTIVE' | 'NOT_ACTIVE_STARTER';
    };

/**
 * Owner-confirmed "Leave KERSIVO" for an active KERSIVO Starter shop. Shop-scoped only: never
 * touches the user, memberships, other shops, Stripe Connect or existing bookings.
 * Idempotent under the shop row lock (one ShopDeparture per shop, one deduped outbox email).
 */
export async function requestStarterDeparture(
  params: { shopId: string; userId: string | null; email: string },
  options: { db?: typeof prisma; now?: Date } = {},
): Promise<RequestStarterDepartureResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const shopId = params.shopId.trim();
  if (!shopId || isDemoShopId(shopId)) return { ok: false, code: 'PROTECTED_SHOP' };

  const replay = async (): Promise<RequestStarterDepartureResult | null> => {
    const existing = await db.shopDeparture.findUnique({ where: { shopId } });
    if (!existing) return null;
    const futureAppointments = await countFutureOperationalBookings(shopId, now, db);
    return { ok: true, created: false, departure: summarize(existing, futureAppointments), outboxId: null };
  };

  try {
    return await db.$transaction(async (tx): Promise<RequestStarterDepartureResult> => {
      await lockShop(tx, shopId);
      const shop = await tx.shopSettings.findUnique({
        where: { id: shopId },
        select: { id: true, name: true },
      });
      if (!shop) return { ok: false, code: 'SHOP_NOT_FOUND' };

      const existing = await tx.shopDeparture.findUnique({ where: { shopId } });
      if (existing) {
        const futureAppointments = await countFutureOperationalBookings(shopId, now, tx);
        return { ok: true, created: false, departure: summarize(existing, futureAppointments), outboxId: null };
      }

      const access = await loadKersivoAccess(shopId, now, tx);
      if (access.state === 'FULL_KERSIVO') return { ok: false, code: 'FULL_KERSIVO_ACTIVE' };
      if (access.state !== 'FREE_BOOKING') return { ok: false, code: 'NOT_ACTIVE_STARTER' };

      const futureAppointments = await countFutureOperationalBookings(shopId, now, tx);
      const departure = await tx.shopDeparture.create({
        data: {
          shopId,
          origin: ShopDepartureOrigin.DIRECT_STARTER_LEAVE,
          requestedAt: now,
          requestedByUserId: params.userId,
          requestedByEmail: params.email.trim().toLowerCase() || null,
          serviceEndedAt: now,
          ...initialDepartureFields({ now, futureAppointments, retentionEndsAt: retentionEndsAtFrom(now) }),
        },
      });

      let outboxId: string | null = null;
      const to = params.email.trim();
      if (to) {
        const email = buildShopDepartureConfirmationEmail({ shopName: shop.name, futureAppointments });
        const outbox = await enqueueEmail(tx, {
          shopId,
          purpose: EmailOutboundPurpose.SHOP_DEPARTURE_CONFIRMATION,
          to,
          subject: email.subject,
          html: email.html,
          replyTo: email.replyTo,
          dedupeKey: `shop-departure:${shopId}`,
        });
        outboxId = outbox.id;
      }

      return { ok: true, created: true, departure: summarize(departure, futureAppointments), outboxId };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await replay();
    if (!winner) throw error;
    return winner;
  }
}

export async function recordShopDepartureRequested(params: {
  shopId: string;
  userId: string | null;
  email: string | null;
  departure: ShopDepartureSummary;
}): Promise<void> {
  await recordAccountLifecycleEvent({
    action: ACCOUNT_LIFECYCLE_ACTIONS.SHOP_DEPARTURE_REQUESTED,
    userId: params.userId,
    email: params.email,
    shopId: params.shopId,
    meta: {
      origin: params.departure.origin,
      status: params.departure.status,
      futureAppointments: params.departure.futureAppointments,
    },
  });
}

export type ShopDepartureView = {
  departure: ShopDepartureSummary | null;
  /** Direct "Leave KERSIVO" is offered only to active Starter shops. */
  canLeaveDirectly: boolean;
  /** Full owners leave by cancelling Full and choosing "Leave" for after the paid period. */
  fullKersivoActive: boolean;
};

export async function loadShopDepartureView(
  shopId: string,
  now: Date = new Date(),
  db: KersivoAccessDb = prisma,
): Promise<ShopDepartureView> {
  const existing = await db.shopDeparture.findUnique({
    where: { shopId },
    select: { status: true, origin: true, requestedAt: true },
  });
  if (existing) {
    const futureAppointments = await countFutureOperationalBookings(shopId, now, db);
    return { departure: summarize(existing, futureAppointments), canLeaveDirectly: false, fullKersivoActive: false };
  }
  const access = await loadKersivoAccess(shopId, now, db);
  return {
    departure: null,
    canLeaveDirectly: access.state === 'FREE_BOOKING' && !isDemoShopId(shopId),
    fullKersivoActive: access.state === 'FULL_KERSIVO',
  };
}

const POST_FULL_DEPARTURE_PLANS = ['LEAVE', 'CHOICE_REQUIRED', 'UNDECIDED'] as const;

/**
 * Cron: a Full subscription that ended with "Leave" (immediately) or with no Starter choice once
 * the post-Full choice window closed enters the same departure lifecycle. Never activates Starter.
 */
export async function materializePostFullDepartures(
  now: Date = new Date(),
  db: typeof prisma = prisma,
): Promise<{ created: number }> {
  const choiceWindowCutoff = new Date(
    now.getTime() - SAAS_EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const candidates = await db.saasSubscription.findMany({
    where: {
      status: 'CANCELED',
      shopId: { not: null },
      postFullPlan: { in: [...POST_FULL_DEPARTURE_PLANS] },
      OR: [
        { postFullPlan: 'LEAVE' },
        { retentionEndsAt: { lte: now } },
        { retentionEndsAt: null, canceledAt: { lte: choiceWindowCutoff } },
      ],
    },
    select: {
      id: true,
      shopId: true,
      postFullPlan: true,
      canceledAt: true,
      currentPeriodEnd: true,
      retentionEndsAt: true,
      customerEmail: true,
    },
  });
  if (candidates.length === 0) return { created: 0 };

  const shopIds = [...new Set(candidates.map((row) => row.shopId!.trim()).filter(Boolean))];
  const departed = new Set(
    (
      await db.shopDeparture.findMany({ where: { shopId: { in: shopIds } }, select: { shopId: true } })
    ).map((row) => row.shopId),
  );

  let created = 0;
  for (const row of candidates) {
    const shopId = row.shopId?.trim();
    if (!shopId || departed.has(shopId) || isDemoShopId(shopId)) continue;

    try {
      const made = await db.$transaction(async (tx) => {
        const shop = await tx.shopSettings.findUnique({ where: { id: shopId }, select: { id: true } });
        if (!shop) return false;
        await lockShop(tx, shopId);
        if (await tx.shopDeparture.findUnique({ where: { shopId }, select: { id: true } })) return false;

        const open = await tx.saasSubscription.count({
          where: { shopId, status: { in: [...OPEN_SUBSCRIPTION_STATUSES] } },
        });
        if (open > 0) return false;
        const latest = await tx.saasSubscription.findFirst({
          where: { shopId, status: { not: 'PENDING' } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (latest?.id !== row.id) return false;
        const access = await loadKersivoAccess(shopId, now, tx);
        if (access.state !== 'SETUP') return false;

        const isLeave = String(row.postFullPlan) === 'LEAVE';
        const serviceEndedAt = row.canceledAt ?? row.currentPeriodEnd ?? now;
        const retentionEndsAt = isLeave
          ? (row.retentionEndsAt ?? retentionEndsAtFrom(serviceEndedAt))
          : retentionEndsAtFrom(now);
        const futureAppointments = await countFutureOperationalBookings(shopId, now, tx);
        const departure = await tx.shopDeparture.create({
          data: {
            shopId,
            origin: isLeave
              ? ShopDepartureOrigin.FULL_POST_PERIOD_LEAVE
              : ShopDepartureOrigin.NO_POST_FULL_CHOICE,
            requestedAt: now,
            requestedByEmail: row.customerEmail?.trim().toLowerCase() || null,
            saasSubscriptionId: row.id,
            serviceEndedAt,
            ...initialDepartureFields({ now, futureAppointments, retentionEndsAt }),
          },
        });
        return summarize(departure, futureAppointments);
      });
      if (made) {
        created += 1;
        departed.add(shopId);
        await recordShopDepartureRequested({
          shopId,
          userId: null,
          email: row.customerEmail,
          departure: made,
        });
      }
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      console.error('[shop-departure] failed to record post-Full departure', { shopId, error });
    }
  }
  return { created };
}

/** Cron: wind-down ends (→ retention) only once no future operational bookings remain. */
export async function advanceWindingDownDepartures(
  now: Date = new Date(),
  db: typeof prisma = prisma,
): Promise<{ advanced: number }> {
  const windingDown = await db.shopDeparture.findMany({
    where: { status: ShopDepartureStatus.WINDING_DOWN },
    select: { shopId: true },
  });

  let advanced = 0;
  for (const { shopId } of windingDown) {
    try {
      const moved = await db.$transaction(async (tx) => {
        await lockShop(tx, shopId);
        if ((await countFutureOperationalBookings(shopId, now, tx)) > 0) return false;
        const result = await tx.shopDeparture.updateMany({
          where: { shopId, status: ShopDepartureStatus.WINDING_DOWN },
          data: {
            status: ShopDepartureStatus.RETENTION,
            retentionStartedAt: now,
            retentionEndsAt: retentionEndsAtFrom(now),
          },
        });
        return result.count > 0;
      });
      if (moved) advanced += 1;
    } catch (error) {
      console.error('[shop-departure] failed to advance wind-down', { shopId, error });
    }
  }
  return { advanced };
}
