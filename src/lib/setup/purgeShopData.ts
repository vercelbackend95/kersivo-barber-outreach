import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Deletes a shop and related data that does not cascade cleanly
 * (bookings, orders with Restrict product FKs).
 */
export async function purgeShopData(tx: Tx, shopId: string): Promise<void> {
  await tx.booking.deleteMany({
    where: {
      OR: [{ barber: { shopId } }, { service: { shopId } }],
    },
  });
  await tx.order.deleteMany({ where: { shopId } });
  await tx.shopSettings.delete({ where: { id: shopId } });
}
