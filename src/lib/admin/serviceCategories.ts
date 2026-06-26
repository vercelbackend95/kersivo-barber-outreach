import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';

export const DEFAULT_SERVICE_CATEGORIES = [
  'featured',
  'styling',
  'beard styling',
  'shaving',
  'wellbeing'
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
    (error instanceof Error && error.message.includes('customServiceCategories') &&
      error.message.includes('does not exist')) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2022')
  );
}

async function loadShopCustomCategories(db: DbClient): Promise<string[]> {
  try {
    const shop = await db.shopSettings.findFirstOrThrow({
      select: { customServiceCategories: true }
    });
    return shop.customServiceCategories;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7636/ingest/cd40da78-1e4e-4e73-9293-9e83626fa943', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '27ceaf' },
      body: JSON.stringify({
        sessionId: '27ceaf',
        hypothesisId: 'H1-H3',
        location: 'serviceCategories.ts:loadShopCustomCategories',
        message: 'loadShopCustomCategories failed',
        data: {
          name: error instanceof Error ? error.name : typeof error,
          code: typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null,
          snippet: error instanceof Error ? error.message.slice(0, 240) : String(error)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    if (isMissingCustomCategoriesColumn(error)) {
      return [];
    }
    if (isUnknownCustomCategoriesField(error)) {
      throw new Error(
        'Prisma client is out of date. Stop the dev server, run npm run prisma:generate, then restart.'
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
  fromServices: Array<string | null | undefined>
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

export async function loadMergedServiceCategories(db: DbClient = prisma): Promise<string[]> {
  const [custom, services] = await Promise.all([
    loadShopCustomCategories(db),
    db.service.findMany({ where: { category: { not: null } }, select: { category: true } })
  ]);

  return mergeServiceCategories(
    custom,
    services.map((service) => service.category)
  );
}

export async function ensureCustomServiceCategory(
  category: string,
  db: DbClient = prisma
): Promise<string[]> {
  const normalized = normalizeServiceCategory(category);
  if (!normalized || isDefaultServiceCategory(normalized)) {
    return loadMergedServiceCategories(db);
  }

  const existingCustom = await loadShopCustomCategories(db);
  const key = normalized.toLowerCase();
  if (existingCustom.some((entry) => entry.toLowerCase() === key)) {
    return loadMergedServiceCategories(db);
  }

  try {
    const shop = await db.shopSettings.findFirstOrThrow({ select: { id: true } });
    await db.shopSettings.update({
      where: { id: shop.id },
      data: { customServiceCategories: [...existingCustom, normalized] }
    });
  } catch (error) {
    if (isMissingCustomCategoriesColumn(error) || isUnknownCustomCategoriesField(error)) {
      return loadMergedServiceCategories(db);
    }
    throw error;
  }

  return loadMergedServiceCategories(db);
}
