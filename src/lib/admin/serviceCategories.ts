import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';

export const DEFAULT_SERVICE_CATEGORIES = [
  'featured',
  'styling',
  'beard styling',
  'shaving',
  'wellbeing',
] as const;

export const SERVICE_CATEGORY_MAX_LENGTH = 80;

type DbClient = typeof prisma | Prisma.TransactionClient;

function isUnknownCustomCategoriesField(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('customServiceCategories') &&
    error.message.includes('Unknown field')
  );
}

function isMissingCustomCategoriesColumn(error: unknown): boolean {
  return (
    (error instanceof Error &&
      error.message.includes('customServiceCategories') &&
      error.message.includes('does not exist')) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2022')
  );
}

async function loadShopCustomCategories(shopId: string, db: DbClient): Promise<string[]> {
  try {
    const shop = await db.shopSettings.findUniqueOrThrow({
      where: { id: shopId },
      select: { customServiceCategories: true },
    });
    return shop.customServiceCategories;
  } catch (error) {
    if (isMissingCustomCategoriesColumn(error)) {
      return [];
    }
    if (isUnknownCustomCategoriesField(error)) {
      throw new Error(
        'Prisma client is out of date. Stop the dev server, run npm run prisma:generate, then restart.',
      );
    }
    throw error;
  }
}

export function normalizeServiceCategory(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, SERVICE_CATEGORY_MAX_LENGTH);
}

export function isDefaultServiceCategory(category: string): boolean {
  const key = category.trim().toLowerCase();
  return DEFAULT_SERVICE_CATEGORIES.some((entry) => entry.toLowerCase() === key);
}

export function mergeServiceCategories(
  custom: string[],
  fromServices: Array<string | null | undefined>,
): string[] {
  const seen = new Map<string, string>();

  const add = (category: string | null | undefined) => {
    const normalized = normalizeServiceCategory(category ?? '');
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  };

  for (const category of DEFAULT_SERVICE_CATEGORIES) add(category);
  for (const category of custom) add(category);
  for (const category of fromServices) add(category);

  return Array.from(seen.values());
}

export async function loadMergedServiceCategories(
  shopId: string,
  db: DbClient = prisma,
): Promise<string[]> {
  const [custom, services] = await Promise.all([
    loadShopCustomCategories(shopId, db),
    db.service.findMany({
      where: { shopId, category: { not: null } },
      select: { category: true },
    }),
  ]);

  return mergeServiceCategories(
    custom,
    services.map((service) => service.category),
  );
}

export async function ensureCustomServiceCategory(
  shopId: string,
  category: string,
  db: DbClient = prisma,
): Promise<string[]> {
  const normalized = normalizeServiceCategory(category);
  if (!normalized || isDefaultServiceCategory(normalized)) {
    return loadMergedServiceCategories(shopId, db);
  }

  const existingCustom = await loadShopCustomCategories(shopId, db);
  const key = normalized.toLowerCase();
  if (existingCustom.some((entry) => entry.toLowerCase() === key)) {
    return loadMergedServiceCategories(shopId, db);
  }

  try {
    await db.shopSettings.update({
      where: { id: shopId },
      data: { customServiceCategories: [...existingCustom, normalized] },
    });
  } catch (error) {
    if (isMissingCustomCategoriesColumn(error) || isUnknownCustomCategoriesField(error)) {
      return loadMergedServiceCategories(shopId, db);
    }
    throw error;
  }

  return loadMergedServiceCategories(shopId, db);
}
