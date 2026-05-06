export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import {
  computeClientStats,
  computeReliabilityScore,
} from './clients/[clientId]/index';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const query = ctx.url.searchParams.get('query')?.trim();

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const clients = await prisma.client.findMany({
    where: {
      shopId: shop.id,
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
      updatedAt: true,
    },
  });

  const nowMs = Date.now();

  const clientsWithStats = await Promise.all(
    clients.map(async (client) => {
      const bookings = await prisma.booking.findMany({
        where: { clientId: client.id },
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
      const stats = computeClientStats(bookings, nowMs);
      const reliabilityScore = computeReliabilityScore(bookings, nowMs);
      return {
        ...client,
        reliabilityScore,
        lastVisitAt: stats.lastVisitAt?.toISOString() ?? null,
        totalSpentPence: stats.totalSpentPence,
        totalBookings: stats.totalBookings,
        completedCount: stats.completedCount,
        noShowCount: stats.noShowCount,
      };
    }),
  );

  return new Response(JSON.stringify({ clients: clientsWithStats }));
};
