export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import {
  computeClientStats,
  computeReliabilityScore,
} from './clients/[clientId]/index';

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.read');
  if (access instanceof Response) return access;

  const query = ctx.url.searchParams.get('query')?.trim();

  const clients = await prisma.client.findMany({
    where: {
      shopId: access.shopId,
      ...(query ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      tags: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });

  const nowMs = Date.now();
  const clientIds = clients.map((client) => client.id);
  const bookings = clientIds.length > 0
    ? await prisma.booking.findMany({
        where: { clientId: { in: clientIds } },
        orderBy: [{ clientId: 'asc' }, { startAt: 'desc' }],
        select: {
          clientId: true,
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
      })
    : [];
  const bookingsByClientId = new Map<string, Array<Omit<(typeof bookings)[number], 'clientId'>>>();
  for (const booking of bookings) {
    if (!booking.clientId) continue;
    const { clientId, ...bookingForStats } = booking;
    const bucket = bookingsByClientId.get(clientId) ?? [];
    bucket.push(bookingForStats);
    bookingsByClientId.set(clientId, bucket);
  }

  const clientsWithStats = clients.map((client) => {
      const bookings = bookingsByClientId.get(client.id) ?? [];
      const stats = computeClientStats(bookings, nowMs);
      const reliabilityScore = computeReliabilityScore(bookings, nowMs);
      const base = {
        ...client,
        reliabilityScore,
        lastVisitAt: stats.lastVisitAt?.toISOString() ?? null,
        totalBookings: stats.totalBookings,
        completedCount: stats.completedCount,
        noShowCount: stats.noShowCount,
      };
      if (access.role === 'BARBER') return base;
      return {
        ...base,
        totalSpentPence: stats.totalSpentPence,
      };
    });

  return new Response(JSON.stringify({
    clients: clientsWithStats,
    financialsHidden: access.role === 'BARBER',
  }));
};
