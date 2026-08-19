import { useEffect, useId, useState } from 'react';
import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import { formatStorefrontPrice, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import ProductAvailabilityBadge from './ProductAvailabilityBadge';
import ProductMediaFallback from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import { cardImageSizes, type StorefrontCardSharedProps } from './types';

type FeaturedProductShowcaseProps = Omit<StorefrontCardSharedProps, 'href'> & {
  products: StorefrontProduct[];
  productHref: (id: string) => string;
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
}: StorefrontCardSharedProps & {
  product: StorefrontProduct;
  index: number;
  total: number;
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
        decorative
      />
      <div className="sf-featured-copy">
        {total > 1 ? (
          <p className="sf-spotlight-index" aria-hidden="true">
            {padded} / {totalPadded}
          </p>
        ) : null}
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
}: FeaturedProductShowcaseProps) {
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const total = products.length;

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  if (total === 0) return null;

  const go = (direction: -1 | 1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  const current = products[Math.min(index, total - 1)]!;

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
        <div className="sf-featured-rail-controls sf-spotlight-controls">
          <button type="button" className="sf-rail-btn" aria-label="Previous featured product" onClick={() => go(-1)}>
            ←
          </button>
          <button type="button" className="sf-rail-btn" aria-label="Next featured product" onClick={() => go(1)}>
            →
          </button>
        </div>
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
