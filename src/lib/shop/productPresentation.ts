export type ProductCategory =
  | 'POMADES_AND_CLAYS'
  | 'BEARD_CARE'
  | 'HAIR_WASH'
  | 'STYLING'
  | 'TOOLS'
  | 'GIFT_SETS';

/** Short labels for storefront overlines / filters */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  POMADES_AND_CLAYS: 'Pomades',
  BEARD_CARE: 'Beard care',
  HAIR_WASH: 'Hair wash',
  STYLING: 'Styling',
  TOOLS: 'Tools',
  GIFT_SETS: 'Gift sets',
};

/** Compact chip labels for storefront filters */
export const SHOP_FILTER_LABELS: Record<ProductCategory, string> = {
  POMADES_AND_CLAYS: 'Pomades',
  BEARD_CARE: 'Beard',
  HAIR_WASH: 'Wash',
  STYLING: 'Styling',
  TOOLS: 'Tools',
  GIFT_SETS: 'Sets',
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

  if (category === 'POMADES_AND_CLAYS' || category === 'STYLING') {
    highlights.add('Daily styling');
  }

  highlights.add('Ready for pickup');

  return Array.from(highlights).slice(0, 4);
}

export function isProductCategory(value: string): value is ProductCategory {
  return value in CATEGORY_LABELS;
}
