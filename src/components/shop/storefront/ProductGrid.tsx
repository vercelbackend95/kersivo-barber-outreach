import type { CSSProperties } from 'react';
import StorefrontProductCard from './StorefrontProductCard';
import { storefrontProductHref, type StorefrontPriceFormat, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';
import { DEFAULT_STOREFRONT_COPY, type StorefrontCopy } from './types';

type ProductGridProps = {
  products: StorefrontProduct[];
  productHrefPrefix: string;
  priceFormat: StorefrontPriceFormat;
  imageFallback: StorefrontImageFallback;
  shopName: string;
  copy?: StorefrontCopy;
  highlightProductId?: string | null;
  itemIdPrefix?: string;
  filterKey?: string;
};

export default function ProductGrid({
  products,
  productHrefPrefix,
  priceFormat,
  imageFallback,
  shopName,
  copy = DEFAULT_STOREFRONT_COPY,
  highlightProductId,
  itemIdPrefix,
  filterKey,
}: ProductGridProps) {
  return (
    <ul className="sf-grid" aria-label="Products" data-filter-key={filterKey || undefined} key={filterKey}>
      {products.map((product, index) => (
        <li
          key={product.id}
          id={itemIdPrefix ? `${itemIdPrefix}${product.id}` : undefined}
          className="sf-grid-item"
          data-product-item
          data-product-id={product.id}
          data-product-category={product.category}
          style={{ '--sf-stagger': String(Math.min(index, 6)) } as CSSProperties}
        >
          <StorefrontProductCard
            product={product}
            href={storefrontProductHref(productHrefPrefix, product.id)}
            priceFormat={priceFormat}
            imageFallback={imageFallback}
            shopName={shopName}
            copy={copy}
            priority={index < 2}
            highlight={highlightProductId === product.id}
          />
        </li>
      ))}
    </ul>
  );
}
