export type ProductCategory =
  | 'POMADES_AND_CLAYS'
  | 'BEARD_CARE'
  | 'HAIR_WASH'
  | 'STYLING'
  | 'TOOLS'
  | 'GIFT_SETS';

export const PRODUCT_CATEGORY_OPTIONS: Array<{ value: ProductCategory; label: string }> = [
  { value: 'POMADES_AND_CLAYS', label: 'Pomades & Clays' },
  { value: 'BEARD_CARE', label: 'Beard Care' },
  { value: 'HAIR_WASH', label: 'Hair Wash' },
  { value: 'STYLING', label: 'Styling' },
  { value: 'TOOLS', label: 'Tools' },
  { value: 'GIFT_SETS', label: 'Gift Sets' },
];

/** Short labels used on the public PDP overline */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  POMADES_AND_CLAYS: 'Pomades',
  BEARD_CARE: 'Beard care',
  HAIR_WASH: 'Hair wash',
  STYLING: 'Styling',
  TOOLS: 'Tools',
  GIFT_SETS: 'Gift sets',
};

const DESCRIPTION_HIGHLIGHTS = [
  { label: 'Strong hold', keywords: ['strong hold', 'firm hold', 'high hold'] },
  { label: 'Matte finish', keywords: ['matte', 'natural finish'] },
  { label: 'Beard care', keywords: ['beard', 'facial hair'] },
  { label: 'Daily use', keywords: ['daily', 'everyday'] },
  { label: 'Water-based', keywords: ['water-based', 'water based'] },
];

export function formatGbp(pricePence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}

export function parseGbpToPence(value: string) {
  const cleaned = value.replace(/[£\s]/g, '').replace(/,/g, '.').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100);
}

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

export function createHighlights(description: string | null, category: ProductCategory) {
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

export async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error && typeof payload.error === 'object') {
      const flatten = payload.error as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
      const fieldMessages = Object.values(flatten.fieldErrors ?? {})
        .flat()
        .filter((message): message is string => Boolean(message));
      const formMessages = (flatten.formErrors ?? []).filter(Boolean);
      const first = fieldMessages[0] ?? formMessages[0];
      if (first) return first;
    }
    return 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}
