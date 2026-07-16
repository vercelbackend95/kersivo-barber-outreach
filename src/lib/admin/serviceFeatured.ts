import type { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient;

export async function unfeatureOtherServicesInCategory(
  tx: DbClient,
  shopId: string,
  category: string | null | undefined,
  exceptServiceId: string
): Promise<void> {
  const normalized = category?.trim();
  if (!normalized) return;

  await tx.service.updateMany({
    where: {
      shopId,
      id: { not: exceptServiceId },
      featured: true,
      category: { equals: normalized, mode: 'insensitive' }
    },
    data: { featured: false }
  });
}
