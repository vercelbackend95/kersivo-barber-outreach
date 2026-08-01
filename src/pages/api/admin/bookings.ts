import type { APIRoute } from 'astro';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { ADMIN_BOOKING_HISTORY_PAGE_SIZE } from '../../../lib/admin/bookingHistoryPageSize';
import { requireAdminContext } from '../../../lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireLinkedBarber, canViewClientEmail } from '@/lib/admin/rbac/scope';
import { prisma } from '../../../lib/db/client';
import { getEffectiveBookingStatus } from '../../../lib/booking/operationalStatus';
import { BookingStatus, Prisma } from '@prisma/client';

const ADMIN_TIMEZONE = 'Europe/London';

const BOOKING_STATUS_VALUES = new Set<string>(Object.values(BookingStatus));

function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUS_VALUES.has(value);
}

function parseBookingStatusFilter(
  raw: string | null,
): { ok: true; status: BookingStatus | undefined } | { ok: false } {
  if (raw === null || raw === '') return { ok: true, status: undefined };
  if (isBookingStatus(raw)) return { ok: true, status: raw };
  return { ok: false };
}

function getLondonDayRange(date: string) {
    const startAt = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return {
    gte: startAt,
    lt: new Date(startAt.getTime() + 24 * 60 * 60 * 1000)

  };
}
function getTodayRangeInLondon() {
  const todayInLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return getLondonDayRange(todayInLondon);
}


function withHistoricalServiceName<T extends { serviceNameAtBooking?: string | null; service?: { name?: string | null } | null }>(booking: T): T {
  if (!booking.serviceNameAtBooking || !booking.service) return booking;
  return { ...booking, service: { ...booking.service, name: booking.serviceNameAtBooking } };
}

function withClientTags<
  T extends { client?: { tags?: string[] | null; avatarUrl?: string | null } | null }
>(booking: T): Omit<T, 'client'> & { clientTags: string[]; clientAvatarUrl: string | null } {
  const { client, ...rest } = booking;
  return {
    ...rest,
    clientTags: Array.isArray(client?.tags)
      ? client.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [],
    clientAvatarUrl: client?.avatarUrl ?? null,
  };
}

function withClientEmailVisibility<T extends { email?: string | null }>(
  booking: T,
  showEmail: boolean,
): T {
  if (showEmail) return booking;
  return { ...booking, email: null };
}

function withEffectiveBookingStatus<
  T extends { status: string; startAt: Date | string; endAt: Date | string }
>(booking: T): Omit<T, 'status'> & { status: string } {
  return {
    ...booking,
    status: getEffectiveBookingStatus({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
    }),
  };
}

const DEPOSIT_REFUND_SELECT = {
  status: true,
  amountPence: true,
  stripeRefundId: true,
  attempts: true,
  lastError: true,
} as const;

const BOOKING_LIST_SELECT = {
  id: true,
  serviceId: true,
  barberId: true,
  fullName: true,
  email: true,
  phone: true,
  clientId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  rescheduledAt: true,
  paymentRequired: true,
  depositAmountPence: true,
  paymentStatus: true,
  depositRefundedAt: true,
  depositForfeitedAt: true,
  totalPricePence: true,
  serviceNameAtBooking: true,
  servicePricePenceAtBooking: true,
  barber: { select: { name: true } },
  service: { select: { name: true } },
  client: { select: { tags: true, avatarUrl: true } },
  depositRefund: { select: DEPOSIT_REFUND_SELECT },
} satisfies Prisma.BookingSelect;

const BOOKING_LIST_LEGACY_SELECT = {
  id: true,
  serviceId: true,
  barberId: true,
  fullName: true,
  email: true,
  phone: true,
  clientId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  rescheduledAt: true,
  paymentRequired: true,
  depositAmountPence: true,
  paymentStatus: true,
  depositRefundedAt: true,
  depositForfeitedAt: true,
  totalPricePence: true,
  barber: { select: { name: true } },
  service: { select: { name: true } },
  client: { select: { tags: true, avatarUrl: true } },
  depositRefund: { select: DEPOSIT_REFUND_SELECT },
} satisfies Prisma.BookingSelect;

type BookingListRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_LIST_SELECT }>;
type BookingListLegacyRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_LIST_LEGACY_SELECT }>;
type BookingListQueryRow = BookingListRow | BookingListLegacyRow;

function isMissingHistoricalColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2022'
    && String(error.meta?.column ?? '').includes('Booking.serviceNameAtBooking');
}

function isMissingDepositRefundRelationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2021' && error.code !== 'P2022') return false;
  const haystack = `${error.message} ${String(error.meta?.table ?? '')} ${String(error.meta?.column ?? '')}`;
  return /BookingDepositRefund|depositRefund/i.test(haystack);
}

const BOOKING_LIST_SELECT_WITHOUT_REFUND = {
  id: true,
  serviceId: true,
  barberId: true,
  fullName: true,
  email: true,
  phone: true,
  clientId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  rescheduledAt: true,
  paymentRequired: true,
  depositAmountPence: true,
  paymentStatus: true,
  totalPricePence: true,
  serviceNameAtBooking: true,
  servicePricePenceAtBooking: true,
  barber: { select: { name: true } },
  service: { select: { name: true } },
  client: { select: { tags: true, avatarUrl: true } },
} satisfies Prisma.BookingSelect;

async function findBookingsWithFallback(args: {
  where: Prisma.BookingWhereInput;
  orderBy?: Prisma.BookingFindManyArgs['orderBy'];
  take?: number;
}): Promise<BookingListQueryRow[]> {
  try {
    return await prisma.booking.findMany({
      ...args,
      select: BOOKING_LIST_SELECT
    });
  } catch (error) {
    if (isMissingDepositRefundRelationError(error)) {
      // Pre-migration DBs: omit refund relation; UI treats null as "no refund state".
      const rows = await prisma.booking.findMany({
        ...args,
        select: BOOKING_LIST_SELECT_WITHOUT_REFUND,
      });
      return rows as unknown as BookingListQueryRow[];
    }
    if (!isMissingHistoricalColumnError(error)) throw error;
    try {
      return await prisma.booking.findMany({
        ...args,
        select: BOOKING_LIST_LEGACY_SELECT
      });
    } catch (legacyError) {
      if (!isMissingDepositRefundRelationError(legacyError)) throw legacyError;
      const rows = await prisma.booking.findMany({
        ...args,
        select: BOOKING_LIST_SELECT_WITHOUT_REFUND,
      });
      return rows as unknown as BookingListQueryRow[];
    }
  }
}



export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;
  const linked = requireLinkedBarber(access);
  if (linked) return linked;
  const shopId = access.shopId;
  const selfBarberId =
    access.role === 'BARBER' && access.barberId ? access.barberId : null;
  const showEmail = canViewClientEmail(access);
  const view = ctx.url.searchParams.get('view');

  if (view === 'history') {
    const barberId = ctx.url.searchParams.get('barberId');
    const from = ctx.url.searchParams.get('from');
    const to = ctx.url.searchParams.get('to');
    const searchQ = ctx.url.searchParams.get('q')?.trim();
    const limit = Math.min(
      Math.max(
        Number(ctx.url.searchParams.get('limit') || ADMIN_BOOKING_HISTORY_PAGE_SIZE),
        1
      ),
      100
    );
    const cursor = ctx.url.searchParams.get('cursor');
    const [cursorStartAt, cursorId] = cursor ? cursor.split('|') : [null, null];
    const startAtFilter = from && to
      ? { gte: getLondonDayRange(from).gte, lt: getLondonDayRange(to).lt }

      : undefined;

    const andConditions: Prisma.BookingWhereInput[] = [{ barber: { shopId } }];
    // Shop-wide for Barber (and Owner/Manager). Optional colleague filter via ?barberId=.
    if (barberId && barberId !== 'all') andConditions.push({ barberId });
    if (startAtFilter) andConditions.push({ startAt: startAtFilter });
    if (cursorStartAt && cursorId) {
      andConditions.push({
        OR: [
          { startAt: { lt: new Date(cursorStartAt) } },
          { startAt: new Date(cursorStartAt), id: { lt: cursorId } }
        ]
      });
    }
    if (searchQ) {
      andConditions.push({
        OR: [
          { fullName: { contains: searchQ, mode: 'insensitive' } },
          ...(showEmail ? [{ email: { contains: searchQ, mode: 'insensitive' as const } }] : []),
          { phone: { contains: searchQ, mode: 'insensitive' } },
          { id: { contains: searchQ, mode: 'insensitive' } },
          { notes: { contains: searchQ, mode: 'insensitive' } },
          { barber: { name: { contains: searchQ, mode: 'insensitive' } } },
          { service: { name: { contains: searchQ, mode: 'insensitive' } } }
        ]
      });
    }

    const bookings = await findBookingsWithFallback({
      where: andConditions.length ? { AND: andConditions } : {},
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    });

    const hasMore = bookings.length > limit;
    const page = hasMore ? bookings.slice(0, limit) : bookings;
    const nextCursor = hasMore
      ? `${page[page.length - 1]?.startAt.toISOString() ?? ''}|${page[page.length - 1]?.id ?? ''}`
      : null;

    return new Response(JSON.stringify({
      bookings: page
        .map(withHistoricalServiceName)
        .map(withEffectiveBookingStatus)
        .map(withClientTags)
        .map((b) => withClientEmailVisibility(b, showEmail)),
      hasMore,
      cursor: nextCursor,
      emailHidden: !showEmail,
    }));
  }
  if (view === 'stats') {
    const barberId = selfBarberId ?? ctx.url.searchParams.get('barberId');
    if (!barberId) {
      return new Response(JSON.stringify({ error: 'Missing barberId.' }), { status: 400 });
    }

    const totalBookingsServed = await prisma.booking.count({
      where: {
        barberId,
        barber: { shopId },
        status: { in: [BookingStatus.BOOKED, BookingStatus.EXPIRED, BookingStatus.RESCHEDULED] }
      }
    });

    return new Response(JSON.stringify({ totalBookingsServed }));
  }



  const q = ctx.url.searchParams.get('q');
  const statusParam = ctx.url.searchParams.get('status');
  const date = ctx.url.searchParams.get('date');
  const range = ctx.url.searchParams.get('range');

  const parsedStatus = parseBookingStatusFilter(statusParam);
  if (!parsedStatus.ok) {
    return new Response(JSON.stringify({ error: 'Invalid booking status.' }), { status: 400 });
  }

  const startAtRange = range === 'today'
    ? getTodayRangeInLondon()
    : date
      ? getLondonDayRange(date)

      : undefined;

  const bookings = await findBookingsWithFallback({
    where: {
      barber: { shopId },
      status: parsedStatus.status,
      OR: q
        ? [
            { fullName: { contains: q, mode: 'insensitive' } },
            ...(showEmail ? [{ email: { contains: q, mode: 'insensitive' as const } }] : []),
            { phone: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
      startAt: startAtRange
    },
    orderBy: { startAt: 'asc' }
  });

  return new Response(
    JSON.stringify({
      bookings: bookings
        .map(withHistoricalServiceName)
        .map(withEffectiveBookingStatus)
        .map(withClientTags)
        .map((b) => withClientEmailVisibility(b, showEmail)),
      emailHidden: !showEmail,
    }),
  );
};
