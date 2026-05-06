export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { getEffectiveBookingStatus } from '../../../../../lib/booking/operationalStatus';

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

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
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const client = await prisma.client.findFirst({
    where: { id: clientId, shopId: shop.id },
  });

  if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });

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

  return new Response(
    JSON.stringify({
      client,
      stats,
      reliabilityScore,
    }),
  );
};

export const PATCH: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const payload = (await ctx.request.json().catch(() => null)) as {
    notes?: unknown;
    tags?: unknown;
  } | null;

  if (!payload) return new Response(JSON.stringify({ error: 'Invalid payload.' }), { status: 400 });

  const data: { notes?: string; tags?: string[] } = {};

  if (typeof payload.notes === 'string') data.notes = payload.notes;
  if (Array.isArray(payload.tags) && payload.tags.every((t) => typeof t === 'string')) {
    data.tags = payload.tags as string[];
  }

  if (Object.keys(data).length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update.' }), { status: 400 });
  }

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const updated = await prisma.client.updateMany({
    where: { id: clientId, shopId: shop.id },
    data,
  });

  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, notes: true, tags: true, updatedAt: true },
  });

  return new Response(JSON.stringify({ client }));
};
