export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { assertClientAccessible, canViewClientEmail } from '@/lib/admin/rbac/scope';
import { shouldIncludeTestActivityInAnalytics } from '@/lib/admin/analyticsMode';
import { orderAnalyticsWhere } from '@/lib/booking/sandboxBookings';
import { getEffectiveBookingStatus } from '@/lib/booking/operationalStatus';
import { prisma } from '@/lib/db/client';

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;
const PAID_ORDER_STATUSES = ['PAID', 'READY_FOR_PICKUP', 'COLLECTED'] as const;

type ScoredBooking = {
  status: string;
  startAt: Date;
  endAt: Date;
  updatedAt: Date;
  paymentRequired: boolean;
  paymentStatus: string | null;
  totalPricePence: number | null;
  serviceNameAtBooking: string | null;
  service: { name: string } | null;
};

type ClientStats = {
  totalBookings: number;
  completedCount: number;
  noShowCount: number;
  lastVisitAt: Date | null;
  totalSpentPence: number;
  avgSpendPence: number;
  favouriteService: string | null;
};

type RetailOrderItem = {
  nameSnapshot: string;
  quantity: number;
};

type RetailOrderRow = {
  id: string;
  status: string;
  totalPence: number;
  paidAt: Date | null;
  createdAt: Date;
  items: RetailOrderItem[];
};

type RetailStats = {
  productsBought: number;
  avgSpendPence: number;
};

type LastOrderPreview = {
  id: string;
  status: string;
  totalPence: number;
  paidAt: string | null;
  createdAt: string;
  items: RetailOrderItem[];
};

export function computeRetailStats(orders: Array<{ totalPence: number; items: RetailOrderItem[] }>): RetailStats {
  const productsBought = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const totalSpentPence = orders.reduce((sum, order) => sum + order.totalPence, 0);
  const avgSpendPence = orders.length > 0 ? Math.round(totalSpentPence / orders.length) : 0;
  return { productsBought, avgSpendPence };
}

export function toLastOrderPreview(order: RetailOrderRow | undefined): LastOrderPreview | null {
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    totalPence: order.totalPence,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      quantity: item.quantity,
    })),
  };
}

function withEffectiveStatus(booking: ScoredBooking, nowMs: number) {
  return {
    ...booking,
    effectiveStatus: getEffectiveBookingStatus({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      nowMs,
    }),
  };
}

export function computeReliabilityScore(bookings: ScoredBooking[], nowMs = Date.now()): number {
  let score = 50;

  const completedDates: Date[] = [];
  const scoredBookings = bookings.map((booking) => withEffectiveStatus(booking, nowMs));

  for (const b of scoredBookings) {
    if (b.effectiveStatus === 'COMPLETED') {
      score += 5;
      completedDates.push(b.startAt);
      if (b.paymentRequired && b.paymentStatus === 'PAID') score += 8;
    } else if (b.effectiveStatus === 'NO_SHOW') {
      score -= 30;
    } else if (b.effectiveStatus === 'CANCELLED_BY_CLIENT') {
      const hoursBeforeStart = (b.startAt.getTime() - b.updatedAt.getTime()) / MS_PER_HOUR;
      score -= hoursBeforeStart < 12 ? 20 : 10;
    }
  }

  // On-time streak: last 5 bookings (already ordered desc) all completed
  const last5 = scoredBookings.slice(0, 5);
  if (last5.length === 5 && last5.every((b) => b.effectiveStatus === 'COMPLETED')) score += 10;

  if (completedDates.length >= 3) {
    const sorted = [...completedDates].sort((a, b) => a.getTime() - b.getTime());
    let totalGapWeeks = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGapWeeks += (sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_WEEK;
    }
    const avgGapWeeks = totalGapWeeks / (sorted.length - 1);
    if (avgGapWeeks >= 2 && avgGapWeeks <= 4) score += 10;

    const lastVisit = sorted[sorted.length - 1];
    if ((Date.now() - lastVisit.getTime()) / MS_PER_DAY > 90) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function computeClientStats(bookings: ScoredBooking[], nowMs = Date.now()): ClientStats {
  const withStatus = bookings.map((booking) => withEffectiveStatus(booking, nowMs));
  const completedBookings = withStatus.filter((b) => b.effectiveStatus === 'COMPLETED');
  const noShowCount = withStatus.filter((b) => b.effectiveStatus === 'NO_SHOW').length;
  const totalSpentPence = completedBookings.reduce((sum, b) => sum + (b.totalPricePence ?? 0), 0);
  const avgSpendPence = completedBookings.length > 0 ? Math.round(totalSpentPence / completedBookings.length) : 0;
  const lastVisitAt = completedBookings.reduce<Date | null>((latest, booking) => {
    if (!latest) return booking.startAt;
    return booking.startAt.getTime() > latest.getTime() ? booking.startAt : latest;
  }, null);

  const serviceFreq: Record<string, number> = {};
  for (const b of completedBookings) {
    const name = b.serviceNameAtBooking ?? b.service?.name ?? '';
    if (name) serviceFreq[name] = (serviceFreq[name] ?? 0) + 1;
  }
  const favouriteService = Object.entries(serviceFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalBookings: withStatus.length,
    completedCount: completedBookings.length,
    noShowCount,
    lastVisitAt,
    totalSpentPence,
    avgSpendPence,
    favouriteService,
  };
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.read');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const client = await prisma.client.findFirst({
    where: { id: clientId, shopId: access.shopId },
  });

  if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });

  const isBarber = access.role === 'BARBER';
  const showEmail = canViewClientEmail(access);

  const allBookings = await prisma.booking.findMany({
    where: { clientId },
    orderBy: { startAt: 'desc' },
    select: {
      status: true,
      startAt: true,
      endAt: true,
      updatedAt: true,
      paymentRequired: true,
      paymentStatus: true,
      totalPricePence: true,
      serviceNameAtBooking: true,
      service: { select: { name: true } },
    },
  });

  const stats = computeClientStats(allBookings);
  const reliabilityScore = computeReliabilityScore(allBookings);

  const clientPayload = {
    id: client.id,
    shopId: client.shopId,
    fullName: client.fullName,
    email: showEmail ? client.email : null,
    phone: client.phone,
    avatarUrl: client.avatarUrl,
    tags: client.tags,
    notes: isBarber ? null : client.notes,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };

  if (isBarber) {
    return new Response(
      JSON.stringify({
        client: clientPayload,
        stats: {
          totalBookings: stats.totalBookings,
          completedCount: stats.completedCount,
          noShowCount: stats.noShowCount,
          lastVisitAt: stats.lastVisitAt,
          totalSpentPence: 0,
          avgSpendPence: 0,
          favouriteService: stats.favouriteService,
        },
        reliabilityScore,
        retailStats: { productsBought: 0, avgSpendPence: 0 },
        lastOrder: null,
        financialsHidden: true,
        emailHidden: true,
      }),
    );
  }

  const includeTestActivity = await shouldIncludeTestActivityInAnalytics(access.shopId);
  const retailOrders = await prisma.order.findMany({
    where: {
      shopId: access.shopId,
      customerEmail: { equals: client.email, mode: 'insensitive' },
      status: { in: [...PAID_ORDER_STATUSES] },
      ...orderAnalyticsWhere(includeTestActivity),
    },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      totalPence: true,
      paidAt: true,
      createdAt: true,
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
        },
      },
    },
  });

  const retailStats = computeRetailStats(retailOrders);
  const lastOrder = toLastOrderPreview(retailOrders[0]);

  return new Response(
    JSON.stringify({
      client: clientPayload,
      stats,
      reliabilityScore,
      retailStats,
      lastOrder,
      financialsHidden: false,
      emailHidden: false,
    }),
  );
};

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.write');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const shopId = access.shopId;

  const contentType = ctx.request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await ctx.request.formData();
    const avatar = form.get('avatar');

    if (!(avatar instanceof File) || avatar.size === 0) {
      return new Response(JSON.stringify({ error: 'Choose an image to upload.' }), { status: 400 });
    }

    let avatarUrl: string;
    try {
      const { storeAdminAvatar } = await import('../../../../../lib/storage/storeAdminAvatar');
      avatarUrl = await storeAdminAvatar(avatar, 'clients', clientId);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Could not upload avatar.' }),
        { status: 400 },
      );
    }

    const updated = await prisma.client.updateMany({
      where: { id: clientId, shopId },
      data: { avatarUrl },
    });

    if (updated.count === 0) {
      return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, fullName: true, email: true, phone: true, notes: true, tags: true, avatarUrl: true, updatedAt: true },
    });

    if (!client) {
      return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
    }

    return new Response(
      JSON.stringify({
        client: {
          ...client,
          email: canViewClientEmail(access) ? client.email : null,
          notes: access.role === 'BARBER' ? null : client.notes,
        },
        emailHidden: !canViewClientEmail(access),
      }),
    );
  }

  const payload = (await ctx.request.json().catch(() => null)) as {
    tags?: unknown;
    avatarUrl?: unknown;
  } | null;

  if (!payload) return new Response(JSON.stringify({ error: 'Invalid payload.' }), { status: 400 });

  const data: { tags?: string[]; avatarUrl?: string | null } = {};

  if (Array.isArray(payload.tags) && payload.tags.every((t) => typeof t === 'string')) {
    if (access.role === 'BARBER') {
      return new Response(
        JSON.stringify({ error: 'Barbers cannot change client tags.' }),
        { status: 403 },
      );
    }
    data.tags = payload.tags as string[];
  }
  if (typeof payload.avatarUrl === 'string') {
    data.avatarUrl = payload.avatarUrl.trim() ? payload.avatarUrl.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update.' }), { status: 400 });
  }

  const updated = await prisma.client.updateMany({
    where: { id: clientId, shopId },
    data,
  });

  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, tags: true, avatarUrl: true, updatedAt: true },
  });

  return new Response(JSON.stringify({ client }));
};
