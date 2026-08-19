export type StorefrontThemeId = 'kersivo' | 'blackline';

export type StorefrontImageFallback = 'initial' | 'wordmark';

export type StorefrontTheme = {
  id: StorefrontThemeId;
  shopName: string;
  logoUrl?: string | null;
  fulfilmentLabel?: string;
  imageFallback: StorefrontImageFallback;
};

export const KERSIVO_STOREFRONT_THEME: StorefrontTheme = {
  id: 'kersivo',
  shopName: 'KERSIVO',
  fulfilmentLabel: 'Collect in shop',
  imageFallback: 'initial',
};

export const BLACKLINE_STOREFRONT_THEME: StorefrontTheme = {
  id: 'blackline',
  shopName: 'BLACKLINE BARBERS',
  fulfilmentLabel: 'COLLECT IN SHOP',
  imageFallback: 'wordmark',
};

export function storefrontThemeClass(id: StorefrontThemeId): string {
  return `sf-shop sf-shop--${id}`;
}
