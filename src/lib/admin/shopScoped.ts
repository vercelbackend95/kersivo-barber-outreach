import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/** Prisma where clause: booking belongs to the admin's shop via barber.shopId. */
export function bookingWhereForShop(
  bookingId: string,
  shopId: string,
): Prisma.BookingWhereInput {
  return { id: bookingId, barber: { shopId } };
}

/** Load a barber that belongs to shopId, or null. */
export async function findShopBarber(barberId: string, shopId: string) {
  return prisma.barber.findFirst({
    where: { id: barberId, shopId },
    select: { id: true, shopId: true, name: true },
  });
}

/** Load a service that belongs to shopId, or null. */
export async function findShopService(serviceId: string, shopId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, shopId },
    select: {
      id: true,
      shopId: true,
      name: true,
      pricePence: true,
      durationMinutes: true,
      bufferMinutes: true,
      isActive: true,
    },
  });
}
