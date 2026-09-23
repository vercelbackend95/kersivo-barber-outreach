import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export const SHOP_MEDIA_MUTATION_BLOCKED_CODE = 'SHOP_MEDIA_MUTATION_BLOCKED' as const;

export class ShopMediaMutationBlockedError extends Error {
  readonly code = SHOP_MEDIA_MUTATION_BLOCKED_CODE;

  constructor(message = 'Shop media updates are blocked because account/shop purge has started.') {
    super(message);
    this.name = 'ShopMediaMutationBlockedError';
  }
}

export function isShopMediaMutationBlockedError(error: unknown): error is ShopMediaMutationBlockedError {
  return (
    error instanceof ShopMediaMutationBlockedError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === SHOP_MEDIA_MUTATION_BLOCKED_CODE)
  );
}

/** Cheap pre-put / pre-write gate (no row lock). */
export async function assertShopAllowsPublicMediaMutation(
  shopId: string,
  db: Pick<typeof prisma, 'shopSettings'> = prisma,
): Promise<void> {
  const shop = await db.shopSettings.findUnique({
    where: { id: shopId },
    select: { id: true, purgeStartedAt: true },
  });
  if (!shop || shop.purgeStartedAt != null) {
    throw new ShopMediaMutationBlockedError();
  }
}

/**
 * Acquire ShopSettings row lock requiring purgeStartedAt IS NULL, then run associate.
 * Must be called AFTER Blob PUT (do not hold this lock during network upload).
 */
export async function lockShopForPublicMediaAssociation(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<void> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT id
      FROM "ShopSettings"
      WHERE id = ${shopId}
        AND "purgeStartedAt" IS NULL
      FOR UPDATE
    `,
  );
  if (locked.length === 0) {
    throw new ShopMediaMutationBlockedError();
  }
}

/**
 * Short association transaction: FOR UPDATE shop (purgeStartedAt null) then associate.
 */
export async function runWithShopMediaAssociationLock<T>(
  shopId: string,
  associate: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockShopForPublicMediaAssociation(tx, shopId);
    return associate(tx);
  });
}
