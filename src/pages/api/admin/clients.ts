export const prerender = false;

import type { APIRoute } from 'astro';
import { canViewClientEmail } from '../../../lib/admin/rbac/scope';
import { prisma } from '../../../lib/db/client';
import { getEffectiveBookingStatus } from '../../../lib/booking/operationalStatus';
import {
  computeClientStats,
  computeReliabilityScore,
} from './clients/[clientId]/index';
import {
  adminProductCapabilityEnforced,
  requireAdminPermissionAndCapability,
} from '@/lib/admin/productCapability';
import {
  hasKersivoCapability,
  loadKersivoAccess,
} from '@/lib/shop/kersivoAccess';

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermissionAndCapability(ctx, 'clients.read', 'CLIENTS_CORE');
  if (access instanceof Response) return access;

  const query = ctx.url.searchParams.get('query')?.trim();
  const showEmail = canViewClientEmail(access);
  const productAccess = adminProductCapabilityEnforced(access)
    ? await loadKersivoAccess(access.shopId)
    : null;
  const advancedClients =
    productAccess === null || hasKersivoCapability(productAccess, 'CLIENTS');

  const clients = await prisma.client.findMany({
    where: {
      shopId: access.shopId,
      ...(query
        ? {
            OR: [
              ...(showEmail ? [{ email: { contains: query, mode: 'insensitive' as const } }] : []),
              { fullName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
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
  const now = new Date(nowMs);
  const coreHistoryFloor = new Date(nowMs - 90 * 24 * 60 * 60 * 1000);
  const clientIds = clients.map((client) => client.id);
  const bookings = clientIds.length > 0
    ? await prisma.booking.findMany({
        where: {
          clientId: { in: clientIds },
          ...(advancedClients
            ? {}
            : {
                OR: [
                  { startAt: { gte: coreHistoryFloor, lt: now } },
                  { startAt: { gte: now } },
                ],
              }),
        },
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
      const clientBookings = bookingsByClientId.get(client.id) ?? [];

      if (!advancedClients) {
        let lastVisitAt: Date | null = null;
        let nextBookingAt: Date | null = null;

        for (const booking of clientBookings) {
          const effectiveStatus = getEffectiveBookingStatus({
            status: booking.status,
            startAt: booking.startAt,
            endAt: booking.endAt,
            nowMs,
          });
          if (
            booking.startAt.getTime() < nowMs &&
            booking.startAt >= coreHistoryFloor &&
            effectiveStatus === 'COMPLETED' &&
            (!lastVisitAt || booking.startAt > lastVisitAt)
          ) {
            lastVisitAt = booking.startAt;
          }
          if (
            booking.startAt.getTime() >= nowMs &&
            (effectiveStatus === 'BOOKED' || effectiveStatus === 'RESCHEDULED') &&
            (!nextBookingAt || booking.startAt < nextBookingAt)
          ) {
            nextBookingAt = booking.startAt;
          }
        }

        return {
          id: client.id,
          fullName: client.fullName,
          email: showEmail ? client.email : null,
          phone: client.phone,
          updatedAt: client.updatedAt,
          lastVisitAt: lastVisitAt?.toISOString() ?? null,
          nextBookingAt: nextBookingAt?.toISOString() ?? null,
        };
      }

      const stats = computeClientStats(clientBookings, nowMs);
      const reliabilityScore = computeReliabilityScore(clientBookings, nowMs);
      const base = {
        ...client,
        email: showEmail ? client.email : null,
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
    mode: advancedClients ? 'advanced' : 'core',
    financialsHidden: !advancedClients || access.role === 'BARBER',
    emailHidden: !showEmail,
  }));
};
