import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import { formatStorefrontPrice, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import type { StorefrontThemeId } from '@/lib/shop/storefrontTheme';
import { ArrowRight } from '../../lucide-react';
import ProductAvailabilityBadge from './ProductAvailabilityBadge';
import ProductMediaFallback from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import { cardImageSizes, type StorefrontCardSharedProps } from './types';

type FeaturedProductShowcaseProps = Omit<StorefrontCardSharedProps, 'href'> & {
  products: StorefrontProduct[];
  productHref: (id: string) => string;
  themeId?: StorefrontThemeId;
  featuredAddedLabel?: string;
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function FeaturedStory({
  product,
  href,
  priceFormat,
  imageFallback,
  shopName,
  copy,
  index,
  total,
  showIcon,
  controls,
}: StorefrontCardSharedProps & {
  product: StorefrontProduct;
  index: number;
  total: number;
  showIcon?: boolean;
  controls?: ReactNode;
}) {
  const padded = String(index + 1).padStart(2, '0');
  const totalPadded = String(total).padStart(2, '0');

  return (
    <article className="sf-spotlight-story" aria-labelledby={`sf-feat-${product.id}`}>
      <a className="sf-card-hit" href={href} aria-label={`${copy.viewProductLabel}: ${product.name}`} />
      <ProductMediaFallback
        image={product.image}
        name={product.name}
        shopName={shopName}
        fallback={imageFallback}
        sizes={cardImageSizes(true)}
        priority={index === 0}
        className="sf-featured-media"
      />
      <div className="sf-featured-copy">
        <div className="sf-featured-copy-head">
          {total > 1 ? (
            <p className="sf-spotlight-index">
              <span className="sf-sr-only">Featured product </span>
              {padded} / {totalPadded}
            </p>
          ) : (
            <span />
          )}
          {controls}
        </div>
        <ProductAvailabilityBadge soldOut={!product.available} />
        <p className="sf-card-category">{CATEGORY_LABELS[product.category]}</p>
        <h2 className="sf-featured-name" id={`sf-feat-${product.id}`}>
          {product.name}
        </h2>
        <p className="sf-card-price">{formatStorefrontPrice(product.pricePence, priceFormat)}</p>
        {product.description ? <p className="sf-featured-desc">{product.description}</p> : null}
        <div className="sf-card-actions shop-card-actions">
          <StorefrontAddToBagButton
            product={product}
            href={href}
            addToBagLabel={copy.addToBagLabel}
            addedLabel={copy.addedLabel}
            chooseOptionsLabel={copy.chooseOptionsLabel}
            soldOutLabel={copy.soldOutLabel}
            showIcon={showIcon}
          />
        </div>
      </div>
    </article>
  );
}

export default function FeaturedProductShowcase({
  products,
  productHref,
  priceFormat,
  imageFallback,
  shopName,
  copy,
  themeId = 'kersivo',
  featuredAddedLabel,
}: FeaturedProductShowcaseProps) {
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const total = products.length;
  const touchStartX = useRef<number | null>(null);
  const isBlackline = themeId === 'blackline';
  const featuredCopy = featuredAddedLabel ? { ...copy, addedLabel: featuredAddedLabel } : copy;

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  if (total === 0) return null;

  const go = (direction: -1 | 1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  const current = products[Math.min(index, total - 1)]!;

  const controls =
    total > 1 ? (
      <div className="sf-featured-rail-controls sf-spotlight-controls">
        <button type="button" className="sf-rail-btn" aria-label="Previous featured product" onClick={() => go(-1)}>
          <ArrowRight width={16} height={16} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
        </button>
        <button type="button" className="sf-rail-btn" aria-label="Next featured product" onClick={() => go(1)}>
          <ArrowRight width={16} height={16} aria-hidden="true" />
        </button>
      </div>
    ) : null;

  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current == null || total < 2) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    go(delta > 0 ? -1 : 1);
  };

  if (isBlackline) {
    return (
      <section
        className="sf-featured sf-spotlight sf-spotlight--unified"
        aria-labelledby={total > 1 ? labelId : undefined}
        aria-label={total > 1 ? undefined : 'Featured product'}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {total > 1 ? (
          <h2 className="sf-sr-only" id={labelId}>
            Featured
          </h2>
        ) : null}
        <FeaturedStory
          product={current}
          href={productHref(current.id)}
          priceFormat={priceFormat}
          imageFallback={imageFallback}
          shopName={shopName}
          copy={featuredCopy}
          index={Math.min(index, total - 1)}
          total={total}
          showIcon
          controls={controls}
        />
      </section>
    );
  }

  if (total === 1) {
    return (
      <section className="sf-featured sf-spotlight" aria-label="Featured product">
        <FeaturedStory
          product={current}
          href={productHref(current.id)}
          priceFormat={priceFormat}
          imageFallback={imageFallback}
          shopName={shopName}
          copy={copy}
          index={0}
          total={1}
        />
      </section>
    );
  }

  return (
    <section className="sf-featured sf-spotlight" aria-labelledby={labelId}>
      <div className="sf-featured-rail-head">
        <h2 className="sf-featured-rail-title" id={labelId}>
          Featured
        </h2>
        {controls}
      </div>
      <div className="sf-spotlight-desktop">
        <FeaturedStory
          product={current}
          href={productHref(current.id)}
          priceFormat={priceFormat}
          imageFallback={imageFallback}
          shopName={shopName}
          copy={copy}
          index={index}
          total={total}
        />
      </div>
      <div
        className="sf-spotlight-mobile"
        tabIndex={0}
        role="region"
        aria-label="Featured products"
        style={{ scrollBehavior: prefersReducedMotion() ? 'auto' : 'smooth' }}
      >
        {products.map((product, productIndex) => (
          <FeaturedStory
            key={product.id}
            product={product}
            href={productHref(product.id)}
            priceFormat={priceFormat}
            imageFallback={imageFallback}
            shopName={shopName}
            copy={copy}
            index={productIndex}
            total={total}
          />
        ))}
      </div>
    </section>
  );
}
