import {
  ProductRail,
  type ProductRailProps,
} from '@/components/shop/ProductRail';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';

export type { CarouselProduct };

export interface ShopProductCarouselProps {
  products: CarouselProduct[];
  className?: string;
  showControls?: boolean;
  previewMode?: boolean;
}

/** @deprecated Prefer ProductRail — thin compatibility wrapper for existing consumers. */
export function ShopProductCarousel({
  products,
  className,
  showControls = true,
  previewMode = false,
}: ShopProductCarouselProps) {
  const railProps: ProductRailProps = {
    products,
    className,
    showControls,
    previewMode,
    variant: 'legacy',
    density: 'compact',
    showAction: previewMode ? 'none' : 'add-to-cart',
    showProgress: false,
    ariaLabel: 'Featured products',
  };

  return <ProductRail {...railProps} />;
}
