import {
  CATEGORY_LABELS,
  createHighlights,
  splitDescription,
  type ProductCategory,
} from '@/lib/shop/productPresentation';

export type { ProductCategory };
export { CATEGORY_LABELS, createHighlights, splitDescription };

export const PRODUCT_CATEGORY_OPTIONS: Array<{ value: ProductCategory; label: string }> = [
  { value: 'STYLING', label: 'Styling' },
  { value: 'HAIR_WASH', label: 'Hair & Scalp' },
  { value: 'BEARD_CARE', label: 'Beard Care' },
  { value: 'SHAVE_AND_SKIN', label: 'Shave & Skin' },
  { value: 'TOOLS', label: 'Tools & Accessories' },
  { value: 'GIFT_SETS', label: 'Sets & Gifts' },
  { value: 'POMADES_AND_CLAYS', label: 'Pomades & Clays' },
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
