import type { CartItem } from '@/lib/shop/cartStore';
import type { ResolvedRetailCartItem } from '@/lib/shop/resolveRetailCart';

export type CheckoutLineItem = {
  productId: string;
  name: string;
  imageUrl?: string;
  imageAlt?: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
};

export type NormalizedCheckoutMedia = {
  src: string;
  alt: string;
};

export function normalizeCheckoutMedia(input: {
  imageUrl?: string | null;
  name: string;
  imageAlt?: string | null;
}): NormalizedCheckoutMedia {
  const src = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  const alt =
    (typeof input.imageAlt === 'string' && input.imageAlt.trim()) ||
    (typeof input.name === 'string' && input.name.trim()) ||
    'Product';
  return { src, alt };
}

export function cartItemToCheckoutLine(item: CartItem): CheckoutLineItem {
  const media = normalizeCheckoutMedia({
    imageUrl: item.imageUrl,
    name: item.name,
  });
  return {
    productId: item.productId,
    name: item.name,
    imageUrl: media.src || undefined,
    imageAlt: media.alt,
    quantity: item.quantity,
    unitPrice: item.pricePence,
  };
}

export function resolvedRetailItemToCheckoutLine(item: ResolvedRetailCartItem): CheckoutLineItem {
  const media = normalizeCheckoutMedia({
    imageUrl: item.imageUrl,
    name: item.name,
  });
  return {
    productId: item.productId,
    name: item.name,
    imageUrl: media.src || undefined,
    imageAlt: media.alt,
    quantity: item.quantity,
    unitPrice: item.unitPricePence,
  };
}

export function formatCheckoutUnitPrice(unitPricePence: number, formatter: (pence: number) => string) {
  return formatter(Math.max(0, Math.floor(unitPricePence)));
}
