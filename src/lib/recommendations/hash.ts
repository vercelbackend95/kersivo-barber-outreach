import { createHash } from 'node:crypto';

import { normalizeServiceCategory } from '@/lib/admin/serviceCategories';

export type ServiceSemanticInput = {
  name: string;
  description?: string | null;
  category?: string | null;
};

export type ProductSemanticInput = {
  name: string;
  description?: string | null;
  category: string;
};

function normalizeText(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  return trimmed.normalize('NFC').toLowerCase();
}

function normalizeServiceCategoryForHash(category: string | null | undefined): string {
  const normalized = normalizeServiceCategory(category ?? '');
  return normalized ? normalized.toLowerCase() : '';
}

function normalizeProductCategoryForHash(category: string): string {
  return category.trim().toUpperCase();
}

function hashCanonicalPayload(payload: Record<string, unknown>): string {
  const sorted = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

export function computeServiceSemanticHash(input: ServiceSemanticInput): string {
  return hashCanonicalPayload({
    v: 1,
    name: normalizeText(input.name),
    description: normalizeText(input.description),
    category: normalizeServiceCategoryForHash(input.category),
  });
}

export function computeProductSemanticHash(input: ProductSemanticInput): string {
  return hashCanonicalPayload({
    v: 1,
    name: normalizeText(input.name),
    description: normalizeText(input.description),
    category: normalizeProductCategoryForHash(input.category),
  });
}

export function serviceSemanticFieldsChanged(
  before: ServiceSemanticInput,
  after: ServiceSemanticInput,
): boolean {
  return computeServiceSemanticHash(before) !== computeServiceSemanticHash(after);
}

export function productSemanticFieldsChanged(
  before: ProductSemanticInput,
  after: ProductSemanticInput,
): boolean {
  return computeProductSemanticHash(before) !== computeProductSemanticHash(after);
}
