import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

import ProductMediaFallback from '@/components/shop/storefront/ProductMediaFallback';
import StorefrontAddToBagButton from '@/components/shop/storefront/StorefrontAddToBagButton';
import StorefrontProductCard from '@/components/shop/storefront/StorefrontProductCard';
import { CATEGORY_LABELS, type CarouselProduct } from '@/lib/shop/carouselProducts';
import { destroyProductRails, initProductRails } from '@/lib/shop/initProductRail';
import { formatGbp } from '@/lib/shop/money';
import { toStorefrontProduct, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import { cn } from '@/lib/utils';
import '@/styles/components/productRail.css';
import '@/styles/components/shop.css';
import '@/styles/components/storefront.css';

export type ProductRailVariant = 'kersivo' | 'blackline' | 'inherit';
export type ProductRailDensity = 'editorial' | 'compact';
export type ProductRailAction = 'none' | 'add-to-cart';

export type ProductRailProps = {
  products: CarouselProduct[];
  className?: string;
  productHrefBase?: string;
  previewMode?: boolean;
  variant?: ProductRailVariant;
  showCategory?: boolean;
  showPrice?: boolean;
  showAction?: ProductRailAction;
  showControls?: boolean;
  showProgress?: boolean;
  density?: ProductRailDensity;
  ariaLabel?: string;
  fallbackBrandMark?: string;
  shopName?: string;
  addToBagLabel?: string;
  addedLabel?: string;
  chooseOptionsLabel?: string;
  soldOutLabel?: string;
  viewProductLabel?: string;
};

function resolveProductHref(
  product: CarouselProduct,
  previewMode: boolean,
  productHrefBase?: string,
): string {
  if (previewMode) return '/shop';
  if (productHrefBase) {
    const base = productHrefBase.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(product.id)}`;
  }
  return `/shop/demo/${encodeURIComponent(product.id)}`;
}

function toStorefrontImage(imageUrl: string | null, name: string) {
  const src = imageUrl?.trim() ?? '';
  return {
    src,
    alt: name,
    width: 800,
    height: 800,
    sizes: '(max-width: 767px) 85vw, (max-width: 1024px) 40vw, 280px',
  };
}

function carouselProductToStorefront(product: CarouselProduct): StorefrontProduct {
  return toStorefrontProduct({
    id: product.id,
    name: product.name,
    pricePence: product.pricePence,
    category: product.category,
    imageUrl: product.imageUrl,
    active: product.available !== false,
    requiresOptions: Boolean(product.requiresOptions),
  });
}

export function ProductRail({
  products,
  className,
  productHrefBase,
  previewMode = false,
  variant = 'kersivo',
  showCategory = true,
  showPrice = true,
  showAction,
  showControls = true,
  showProgress = false,
  density = 'compact',
  ariaLabel = 'Featured products',
  fallbackBrandMark = 'BL',
  shopName = 'Shop',
  addToBagLabel = 'Add to bag',
  addedLabel = 'Added',
  chooseOptionsLabel = 'Choose options',
  soldOutLabel = 'Sold out',
  viewProductLabel = 'View product',
}: ProductRailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const action: ProductRailAction =
    showAction ?? (previewMode || density === 'editorial' ? 'none' : 'add-to-cart');
  const displayProducts = previewMode ? products.slice(0, 10) : products;
  const total = displayProducts.length;
  const imageFallback = variant === 'blackline' ? 'wordmark' : 'initial';
  const showHeader = (showControls || showProgress) && total > 0;
  const useStorefrontCards = variant === 'blackline' && action === 'add-to-cart';

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    initProductRails(root);
    return () => {
      destroyProductRails(root);
    };
  }, [displayProducts.length, density, showControls, showProgress, variant, action]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'product-rail',
        'shop6__carousel',
        `product-rail--${density}`,
        variant === 'blackline' && 'sf-shop--blackline',
        className,
      )}
      data-product-rail-root
      data-shop6-carousel-root
      data-product-rail-variant={variant}
      data-product-rail-density={density}
      tabIndex={0}
    >
      {showHeader ? (
        <div className="product-rail__header">
          {showProgress ? (
            <p
              className="product-rail__progress"
              data-product-rail-status
              aria-live="polite"
              aria-atomic="true"
            >
              {`01 / ${String(total).padStart(2, '0')}`}
            </p>
          ) : (
            <span className="product-rail__header-spacer" aria-hidden="true" />
          )}
          {showControls ? (
            <div className="product-rail__controls shop6__controls" aria-label="Product rail controls">
              <button
                className="product-rail__control shop6__control"
                type="button"
                data-product-rail-prev
                data-shop6-prev
                aria-label="Previous products"
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />
                <span className="product-rail__control-label">Prev</span>
              </button>
              <button
                className="product-rail__control shop6__control"
                type="button"
                data-product-rail-next
                data-shop6-next
                aria-label="Next products"
              >
                <span className="product-rail__control-label">Next</span>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul
        className="product-rail__track shop6__grid"
        aria-label={ariaLabel}
        data-product-rail-track
        data-shop6-carousel
      >
        {total === 0 ? (
          <li className="product-rail__item shop6__item">
            <article className="product-rail__card shop6__card shop6__card--empty">
              <div className="product-rail__body shop6__card-body">
                <p className="product-rail__category shop6__category">Preview</p>
                <h3>The strip appears when products are live</h3>
                <p className="product-rail__price shop6__price">
                  The shop page shows the full demo flow—no commission from us; no payment in the public
                  demo
                </p>
                <a className="btn btn--secondary" href="/shop">
                  View shop
                </a>
              </div>
            </article>
          </li>
        ) : (
          displayProducts.map((product, index) => {
            const href = resolveProductHref(product, previewMode, productHrefBase);
            const categoryLabel = CATEGORY_LABELS[product.category] ?? 'Styling';
            const image = toStorefrontImage(product.imageUrl, product.name);

            if (useStorefrontCards) {
              return (
                <li key={`${product.id}-${index}`} className="product-rail__item shop6__item">
                  <StorefrontProductCard
                    product={carouselProductToStorefront(product)}
                    href={href}
                    priceFormat="demo"
                    imageFallback="wordmark"
                    shopName={shopName}
                    copy={{
                      addToBagLabel,
                      addedLabel,
                      chooseOptionsLabel,
                      soldOutLabel,
                      viewProductLabel,
                    }}
                    priority={index < 2}
                    showAtcIcon
                  />
                </li>
              );
            }

            const media = (
              <div className="product-rail__media shop-media">
                <ProductMediaFallback
                  image={image}
                  name={product.name}
                  shopName={shopName}
                  fallback={imageFallback}
                  brandMark={fallbackBrandMark}
                  priority={index < 2}
                  className="product-rail__sf-media"
                />
              </div>
            );

            if (action === 'none') {
              return (
                <li key={`${product.id}-${index}`} className="product-rail__item shop6__item">
                  <a
                    className="product-rail__card product-rail__card--link shop-card"
                    href={href}
                    data-category={product.category}
                    aria-label={`View ${product.name}`}
                  >
                    {media}
                    <div className="product-rail__body shop-card-body">
                      {showCategory ? (
                        <p className="product-rail__category shop-category">{categoryLabel}</p>
                      ) : null}
                      <h3 className="product-rail__title">{product.name}</h3>
                      {showPrice ? (
                        <p className="product-rail__price shop-price">{formatGbp(product.pricePence)}</p>
                      ) : null}
                      <span className="product-rail__affordance" aria-hidden="true">
                        View
                      </span>
                    </div>
                  </a>
                </li>
              );
            }

            return (
              <li key={`${product.id}-${index}`} className="product-rail__item shop6__item">
                <article className="product-rail__card shop-card" data-category={product.category}>
                  <a href={href} className="shop-media-link" aria-label={`View ${product.name}`}>
                    {media}
                  </a>
                  <div className="product-rail__body shop-card-body">
                    {showCategory ? (
                      <p className="product-rail__category shop-category">{categoryLabel}</p>
                    ) : null}
                    <h3 className="product-rail__title">
                      <a href={href}>{product.name}</a>
                    </h3>
                    {showPrice ? (
                      <p className="product-rail__price shop-price">{formatGbp(product.pricePence)}</p>
                    ) : null}
                    <div className="shop-card-actions product-rail__actions">
                      <StorefrontAddToBagButton
                        product={{
                          id: product.id,
                          name: product.name,
                          pricePence: product.pricePence,
                          image,
                          available: product.available !== false,
                          requiresOptions: Boolean(product.requiresOptions),
                        }}
                        href={href}
                        addToBagLabel={addToBagLabel}
                        addedLabel={addedLabel}
                        chooseOptionsLabel={chooseOptionsLabel}
                        soldOutLabel={soldOutLabel}
                      />
                    </div>
                  </div>
                </article>
              </li>
            );
          })
        )}
      </ul>

      {total > 0 && previewMode ? (
        <>
          <button
            className="feature261-retail-carousel__arrow feature261-retail-carousel__arrow--prev"
            type="button"
            data-product-rail-prev
            data-shop6-prev
            aria-label="Previous products"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="feature261-retail-carousel__arrow feature261-retail-carousel__arrow--next"
            type="button"
            data-product-rail-next
            data-shop6-next
            aria-label="Next products"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <span className="feature261-retail-carousel__cue" aria-hidden="true">
            Scroll products &rarr;
          </span>
        </>
      ) : null}
    </div>
  );
}

export default ProductRail;
