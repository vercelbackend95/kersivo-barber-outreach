import type { AdminAccess } from '@/lib/admin/auth';
import { accessCan } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';

/** Barber role without linked roster row cannot use booking/client data APIs. */
export function requireLinkedBarber(access: AdminAccess): Response | null {
  if (access.role !== 'BARBER') return null;
  if (access.barberId) return null;
  return new Response(
    JSON.stringify({
      error: 'Your account is not linked to a barber roster seat. Ask the shop owner to link you.',
      code: 'BARBER_NOT_LINKED',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Ensures a booking in this shop is visible/mutable for the actor.
 * OWNER/MANAGER with bookings.manage: any shop booking.
 * BARBER (or self-only): must match access.barberId.
 */
export async function assertBookingAccessible(
  access: AdminAccess,
  bookingId: string,
): Promise<{ id: string; barberId: string; clientId: string | null } | Response> {
  const linked = requireLinkedBarber(access);
  if (linked) return linked;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, service: { shopId: access.shopId } },
    select: { id: true, barberId: true, clientId: true },
  });

  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404 });
  }

  if (accessCan(access, 'bookings.manage')) {
    return booking;
  }

  if (access.barberId && booking.barberId === access.barberId) {
    return booking;
  }

  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}

/** Prisma where fragment for shop-scoped client queries (no linked-seat requirement). */
export function clientWhereForAccess(access: AdminAccess): { shopId: string } {
  return { shopId: access.shopId };
}

export async function resolveClientIdsForBarber(
  shopId: string,
  barberId: string,
): Promise<string[]> {
  const rows = await prisma.booking.findMany({
    where: { barberId, service: { shopId }, clientId: { not: null } },
    select: { clientId: true },
    distinct: ['clientId'],
  });
  return rows.map((r) => r.clientId).filter((id): id is string => Boolean(id));
}

export async function assertClientAccessible(
  access: AdminAccess,
  clientId: string,
): Promise<{ id: string } | Response> {
  // Shop membership is enough to read clients; linked seat is only required for chair mutations.
  const client = await prisma.client.findFirst({
    where: { id: clientId, shopId: access.shopId },
    select: { id: true },
  });
  if (!client) {
    return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
  }

  // Barber may open any client in their shop (financial fields stripped at profile API).
  return client;
}
