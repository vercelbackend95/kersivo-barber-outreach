export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireLinkedBarber } from '@/lib/admin/rbac/scope';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;
  const linked = requireLinkedBarber(access);
  if (linked) return linked;
  if (isDemoShopId(access.shopId)) return json({ error: 'Demo shop is read-only.' }, 403);

  const product = await requireAdminProductCapability(access, 'MANUAL_BOOKINGS');
  if (product instanceof Response) return product;

  const barberWhere =
    access.role === 'BARBER'
      ? { shopId: access.shopId, id: access.barberId ?? '__missing__', active: true }
      : { shopId: access.shopId, active: true };

  const [services, barbers] = await Promise.all([
    prisma.service.findMany({
      where: { shopId: access.shopId, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.barber.findMany({
      where: barberWhere,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ]);

  const links =
    barbers.length > 0
      ? await prisma.barberService.findMany({
          where: { barberId: { in: barbers.map((barber) => barber.id) } },
          select: { barberId: true, serviceId: true },
        })
      : [];

  const serviceIdsByBarber = new Map<string, string[]>();
  for (const link of links) {
    const current = serviceIdsByBarber.get(link.barberId) ?? [];
    current.push(link.serviceId);
    serviceIdsByBarber.set(link.barberId, current);
  }

  return json({
    services,
    barbers: barbers.map((barber) => ({
      ...barber,
      serviceIds: serviceIdsByBarber.get(barber.id) ?? [],
    })),
    fixedBarberId: access.role === 'BARBER' ? access.barberId : null,
  });
};
