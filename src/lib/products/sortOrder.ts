import type { Prisma } from '@prisma/client';

const PRODUCT_SORT_ORDER_MIN = 0;
const PRODUCT_SORT_ORDER_MAX = 9999;
/** Temp sortOrders outside 0..9999 and create's `-1 - count` range to avoid unique collisions. */
const PRODUCT_SORT_ORDER_TEMP_BASE = -1_000_000;

type ProductOrderRecord = {
  id: string;
  sortOrder: number;
  updatedAt: Date;
  createdAt: Date;
};

type ReorderPositionOptions = {
  productIds: string[];
  productId: string;
  requestedSortOrder: number;
};

export function normalizeRequestedProductSortOrder(value: unknown, fallback = PRODUCT_SORT_ORDER_MIN): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(PRODUCT_SORT_ORDER_MAX, Math.max(PRODUCT_SORT_ORDER_MIN, Math.trunc(numericValue)));
}

export function moveProductIdToSortOrder({ productIds, productId, requestedSortOrder }: ReorderPositionOptions): string[] {
  const dedupedIds = Array.from(new Set(productIds));
  const currentIndex = dedupedIds.indexOf(productId);

  if (currentIndex === -1) {
    throw new Error('Product not found in current order.');
  }

  const remainingIds = dedupedIds.filter((id) => id !== productId);
  const clampedSortOrder = Math.min(remainingIds.length, Math.max(PRODUCT_SORT_ORDER_MIN, requestedSortOrder));

  remainingIds.splice(clampedSortOrder, 0, productId);
  return remainingIds;
}

function sortProductsForOrder(products: ProductOrderRecord[]): ProductOrderRecord[] {
  return [...products].sort((left, right) => (
    left.sortOrder - right.sortOrder
    || right.updatedAt.getTime() - left.updatedAt.getTime()
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id)
  ));
}

export async function listNormalizedProductIds(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<string[]> {
  const products = await tx.product.findMany({
    where: { shopId },
    select: { id: true, sortOrder: true, updatedAt: true, createdAt: true }
  });

  return sortProductsForOrder(products).map((product) => product.id);
}

export async function persistProductOrder(
  tx: Prisma.TransactionClient,
  shopId: string,
  orderedIds: string[]
): Promise<void> {
  const normalizedIds = Array.from(new Set(orderedIds));
  const existingProducts = await tx.product.findMany({
    where: { shopId },
    select: { id: true }
  });

  if (existingProducts.length !== normalizedIds.length) {
    throw new Error('Product order payload does not match the current shop catalog.');
  }

  const existingIds = new Set(existingProducts.map((product) => product.id));
  if (normalizedIds.some((id) => !existingIds.has(id))) {
    throw new Error('Product order payload contains invalid ids.');
  }

  // Two parallel phases keep @@unique([shopId, sortOrder]) without 2N sequential round-trips
  // (which time out interactive transactions on serverless Postgres).
  await Promise.all(
    normalizedIds.map((id, index) =>
      tx.product.update({
        where: { id },
        data: { sortOrder: PRODUCT_SORT_ORDER_TEMP_BASE - index },
      }),
    ),
  );

  await Promise.all(
    normalizedIds.map((id, index) =>
      tx.product.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function reorderProductWithinShop(
  tx: Prisma.TransactionClient,
  shopId: string,
  productId: string,
  requestedSortOrder: number
): Promise<number> {
  const normalizedIds = await listNormalizedProductIds(tx, shopId);
  const clampedSortOrder = normalizeRequestedProductSortOrder(requestedSortOrder, normalizedIds.length);
  const nextOrder = moveProductIdToSortOrder({
    productIds: normalizedIds,
    productId,
    requestedSortOrder: clampedSortOrder
  });

  await persistProductOrder(tx, shopId, nextOrder);
  return nextOrder.indexOf(productId);
}

export async function insertProductIntoShopOrder(
  tx: Prisma.TransactionClient,
  shopId: string,
  productId: string,
  requestedSortOrder: number
): Promise<number> {
  const normalizedIds = await listNormalizedProductIds(tx, shopId);
  const clampedSortOrder = Math.min(
    normalizedIds.length,
    normalizeRequestedProductSortOrder(requestedSortOrder, normalizedIds.length)
  );
  const nextOrder = normalizedIds.filter((id) => id !== productId);
  nextOrder.splice(clampedSortOrder, 0, productId);

  await persistProductOrder(tx, shopId, nextOrder);
  return clampedSortOrder;
}

export async function normalizeProductOrderAfterDeletion(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<void> {
  const normalizedIds = await listNormalizedProductIds(tx, shopId);
  if (normalizedIds.length === 0) {
    return;
  }

  await persistProductOrder(tx, shopId, normalizedIds);
}
