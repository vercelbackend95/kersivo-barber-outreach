export const PRODUCT_CATEGORY_VALUES = [
  'STYLING',
  'HAIR_WASH',
  'BEARD_CARE',
  'SHAVE_AND_SKIN',
  'TOOLS',
  'GIFT_SETS',
  'POMADES_AND_CLAYS',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORY_VALUES)[number];

/** Merchandising labels for storefront and admin. */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  STYLING: 'Styling',
  HAIR_WASH: 'Hair & Scalp',
  BEARD_CARE: 'Beard Care',
  SHAVE_AND_SKIN: 'Shave & Skin',
  TOOLS: 'Tools & Accessories',
  GIFT_SETS: 'Sets & Gifts',
  POMADES_AND_CLAYS: 'Pomades & Clays',
};

/** Compact chip labels for storefront filters */
export const SHOP_FILTER_LABELS: Record<ProductCategory, string> = {
  STYLING: 'Styling',
  HAIR_WASH: 'Hair',
  BEARD_CARE: 'Beard',
  SHAVE_AND_SKIN: 'Shave',
  TOOLS: 'Tools',
  GIFT_SETS: 'Sets',
  POMADES_AND_CLAYS: 'Pomades',
};

export const CATEGORY_DESCRIPTIONS: Partial<Record<ProductCategory, string>> = {
  STYLING: 'Hold, texture and finish for the cut.',
  HAIR_WASH: 'Wash and scalp care before the style.',
  BEARD_CARE: 'Oil, balm and wash for facial hair.',
  SHAVE_AND_SKIN: 'Shave cream, balm and face care.',
  TOOLS: 'Combs, brushes and chair-side kit.',
  GIFT_SETS: 'Ready-to-collect bundles.',
  POMADES_AND_CLAYS: 'Classic pomades and clays.',
};

const DESCRIPTION_HIGHLIGHTS = [
  { label: 'Strong hold', keywords: ['strong hold', 'firm hold', 'high hold'] },
  { label: 'Matte finish', keywords: ['matte', 'natural finish'] },
  { label: 'Beard care', keywords: ['beard', 'facial hair'] },
  { label: 'Daily use', keywords: ['daily', 'everyday'] },
  { label: 'Water-based', keywords: ['water-based', 'water based'] },
];

export function splitDescription(rawDescription: string | null) {
  const cleaned = rawDescription?.replace(/\s+/g, ' ').trim() ?? '';
  if (!cleaned) {
    return {
      intro: 'Barber-curated product selected for reliable daily performance and clean in-shop pickup.',
      details: '',
    };
  }

  if (cleaned.length <= 150) {
    return { intro: cleaned, details: '' };
  }

  const firstSentence = cleaned.match(/^.*?[.!?](\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 70 && firstSentence.length <= 190) {
    return {
      intro: firstSentence,
      details: cleaned.slice(firstSentence.length).trim(),
    };
  }

  const cutoff = cleaned.lastIndexOf(' ', 150);
  const splitPoint = cutoff > 90 ? cutoff : 150;

  return {
    intro: `${cleaned.slice(0, splitPoint).trim()}…`,
    details: cleaned,
  };
}

export function createHighlights(description: string | null, category: string) {
  const text = (description ?? '').toLowerCase();
  const highlights = new Set<string>();

  for (const entry of DESCRIPTION_HIGHLIGHTS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) {
      highlights.add(entry.label);
    }
  }

  if (category === 'BEARD_CARE') {
    highlights.add('Beard care');
  }

  if (category === 'SHAVE_AND_SKIN') {
    highlights.add('Shave & skin');
  }

  if (category === 'POMADES_AND_CLAYS' || category === 'STYLING') {
    highlights.add('Daily styling');
  }

  highlights.add('Ready for pickup');

  return Array.from(highlights).slice(0, 4);
}

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORY_VALUES as readonly string[]).includes(value);
}
