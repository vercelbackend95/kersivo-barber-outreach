import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';
import type { StorefrontPriceFormat, StorefrontProduct } from '@/lib/shop/storefrontCatalog';

export type StorefrontCopy = {
  addToBagLabel: string;
  addedLabel: string;
  viewProductLabel: string;
  chooseOptionsLabel: string;
  soldOutLabel: string;
};

export const DEFAULT_STOREFRONT_COPY: StorefrontCopy = {
  addToBagLabel: 'Add',
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
    return '(max-width: 767px) 92vw, (max-width: 1199px) 46vw, 560px';
  }
  return '(max-width: 359px) 92vw, (max-width: 1023px) 46vw, (max-width: 1439px) 30vw, 280px';
}

export type { StorefrontProduct };
