export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertBookingAccessible } from '@/lib/admin/rbac/scope';
import { prisma } from '../../../../../lib/db/client';

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const scoped = await assertBookingAccessible(access, bookingId);
  if (scoped instanceof Response) return scoped;

  const payload = (await ctx.request.json().catch(() => null)) as { notes?: unknown } | null;
  if (!payload || typeof payload.notes !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid notes payload.' }), { status: 400 });
  }

  const updated = await prisma.booking.update({
    where: { id: scoped.id },
    data: { notes: payload.notes },
    select: { id: true, notes: true, updatedAt: true },
  });

  return new Response(JSON.stringify({ booking: updated }));
};
