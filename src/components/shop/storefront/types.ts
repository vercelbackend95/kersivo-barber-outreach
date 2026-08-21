import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';
import type { StorefrontPriceFormat, StorefrontProduct } from '@/lib/shop/storefrontCatalog';

export type StorefrontCopy = {
  addToBagLabel: string;
  /** Optional short visible ATC label (e.g. "Add"); aria always uses addToBagLabel. */
  addToBagShortLabel?: string;
  addedLabel: string;
  viewProductLabel: string;
  chooseOptionsLabel: string;
  soldOutLabel: string;
};

export const DEFAULT_STOREFRONT_COPY: StorefrontCopy = {
  addToBagLabel: 'Add to bag',
  addedLabel: 'Added',
  viewProductLabel: 'View product',
  chooseOptionsLabel: 'Choose options',
  soldOutLabel: 'Sold out',
};

export type StorefrontCardSharedProps = {
  href: string;
  priceFormat: StorefrontPriceFormat;
  imageFallback: StorefrontImageFallback;
  shopName: string;
  copy: StorefrontCopy;
  priority?: boolean;
};

export function cardImageSizes(featured = false): string {
  if (featured) {
    return '(max-width: 767px) 92vw, (max-width: 1199px) 55vw, 640px';
  }
  return '(max-width: 359px) 92vw, (max-width: 767px) 46vw, (max-width: 1023px) 31vw, 25vw';
}

export type { StorefrontProduct };
