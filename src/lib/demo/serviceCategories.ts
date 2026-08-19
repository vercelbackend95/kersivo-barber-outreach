export type DemoServiceCategory = {
  key: string;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
};

export const DEMO_ALL_CATEGORY_SLUG = 'all';

export const DEMO_SERVICE_CATEGORIES: readonly DemoServiceCategory[] = [
  {
    key: 'cuts & fades',
    slug: 'cuts-fades',
    label: 'Cuts & Fades',
    shortLabel: 'CUTS & FADES',
    description: 'Fades, clipper work and considered scissor cuts.',
  },
  {
    key: 'beard & shave',
    slug: 'beard-shave',
    label: 'Beard & Shave',
    shortLabel: 'BEARD & SHAVE',
    description: 'Beard shaping, line-ups and traditional wet shaves.',
  },
  {
    key: 'hair & beard combos',
    slug: 'hair-beard-combos',
    label: 'Hair & Beard Combos',
    shortLabel: 'COMBOS',
    description: 'Combined hair and beard appointments in one visit.',
  },
  {
    key: 'grooming & care',
    slug: 'grooming-care',
    label: 'Grooming & Care',
    shortLabel: 'GROOMING & CARE',
    description: 'Treatments, colour blending and finishing without a full cut.',
  },
] as const;

export const DEMO_SERVICE_CATEGORY_ORDER = DEMO_SERVICE_CATEGORIES.map((category) => category.key);

export function demoCategorySlugFromKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getDemoServiceCategoryBySlug(slug: string): DemoServiceCategory | undefined {
  const normalized = slug.trim().toLowerCase();
  return DEMO_SERVICE_CATEGORIES.find((category) => category.slug === normalized);
}

export function getDemoServiceCategoryByKey(key: string): DemoServiceCategory | undefined {
  const normalized = key.trim().toLowerCase();
  return DEMO_SERVICE_CATEGORIES.find((category) => category.key === normalized);
}

/** Invalid or empty values fall back to ALL. */
export function parseDemoServiceCategoryParam(raw: string | null | undefined): string {
  const slug = raw?.trim().toLowerCase() ?? '';
  if (!slug || slug === DEMO_ALL_CATEGORY_SLUG) return DEMO_ALL_CATEGORY_SLUG;
  return getDemoServiceCategoryBySlug(slug) ? slug : DEMO_ALL_CATEGORY_SLUG;
}
