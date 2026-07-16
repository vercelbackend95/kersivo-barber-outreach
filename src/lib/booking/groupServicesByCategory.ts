export const BOOKING_SERVICE_CATEGORY_ORDER = [
  'featured',
  'styling',
  'beard styling',
  'shaving',
  'wellbeing'
] as const;

export const BOOKING_SERVICE_CATEGORY_OTHER = 'other';

export type BookableService = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
  featured?: boolean;
};

export type ServiceCategoryGroup = {
  category: string;
  label: string;
  services: BookableService[];
};

const CATEGORY_LABELS: Record<string, string> = {
  featured: 'Featured',
  styling: 'Styling',
  'beard styling': 'Beard styling',
  shaving: 'Shaving',
  wellbeing: 'Wellbeing',
  [BOOKING_SERVICE_CATEGORY_OTHER]: 'Other'
};

const KNOWN_CATEGORY_KEYS = new Map(
  BOOKING_SERVICE_CATEGORY_ORDER.map((category) => [category.toLowerCase(), category])
);

function compareDisplayOrder(left: BookableService, right: BookableService): number {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
}

function compareServicesInCategory(left: BookableService, right: BookableService): number {
  const leftFeatured = left.featured ? 1 : 0;
  const rightFeatured = right.featured ? 1 : 0;
  if (leftFeatured !== rightFeatured) return rightFeatured - leftFeatured;
  return compareDisplayOrder(left, right);
}

export function formatServiceCategoryLabel(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return CATEGORY_LABELS[BOOKING_SERVICE_CATEGORY_OTHER];

  const canonical = KNOWN_CATEGORY_KEYS.get(normalized) ?? normalized;
  if (CATEGORY_LABELS[canonical]) return CATEGORY_LABELS[canonical];

  return canonical
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveCategoryKey(category: string | null | undefined): string {
  const trimmed = category?.trim();
  if (!trimmed) return BOOKING_SERVICE_CATEGORY_OTHER;

  return KNOWN_CATEGORY_KEYS.get(trimmed.toLowerCase()) ?? trimmed.toLowerCase();
}

export function groupServicesByCategory(services: BookableService[]): ServiceCategoryGroup[] {
  const grouped = new Map<string, BookableService[]>();

  for (const service of services) {
    const key = resolveCategoryKey(service.category);
    const bucket = grouped.get(key) ?? [];
    bucket.push(service);
    grouped.set(key, bucket);
  }

  const orderedKeys: string[] = [];

  for (const category of BOOKING_SERVICE_CATEGORY_ORDER) {
    if (grouped.has(category)) orderedKeys.push(category);
  }

  const unknownKeys = [...grouped.keys()]
    .filter((key) => key !== BOOKING_SERVICE_CATEGORY_OTHER && !orderedKeys.includes(key))
    .sort((left, right) => formatServiceCategoryLabel(left).localeCompare(formatServiceCategoryLabel(right), 'en', { sensitivity: 'base' }));

  orderedKeys.push(...unknownKeys);

  if (grouped.has(BOOKING_SERVICE_CATEGORY_OTHER)) {
    orderedKeys.push(BOOKING_SERVICE_CATEGORY_OTHER);
  }

  return orderedKeys.map((category) => ({
    category,
    label: formatServiceCategoryLabel(category),
    services: [...(grouped.get(category) ?? [])].sort(compareServicesInCategory)
  }));
}
