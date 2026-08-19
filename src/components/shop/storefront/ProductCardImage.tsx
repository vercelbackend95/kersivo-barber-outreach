import ProductMediaFallback from './ProductMediaFallback';
import type { StorefrontImage } from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';

type ProductCardImageProps = {
  image: StorefrontImage;
  name: string;
  shopName: string;
  fallback: StorefrontImageFallback;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

export default function ProductCardImage(props: ProductCardImageProps) {
  return <ProductMediaFallback {...props} decorative />;
}
