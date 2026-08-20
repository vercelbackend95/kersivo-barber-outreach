import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
  type TransitionEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import { formatStorefrontPrice, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import type { StorefrontThemeId } from '@/lib/shop/storefrontTheme';
import { ArrowRight } from '../../lucide-react';
import ProductAvailabilityBadge from './ProductAvailabilityBadge';
import ProductMediaFallback, { type ProductMediaPresentation } from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import { cardImageSizes, type StorefrontCardSharedProps } from './types';

type FeaturedProductShowcaseProps = Omit<StorefrontCardSharedProps, 'href'> & {
  products: StorefrontProduct[];
  productHref: (id: string) => string;
  themeId?: StorefrontThemeId;
  featuredAddedLabel?: string;
};

const SWIPE_THRESHOLD = 40;

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
  presentation = 'default',
  headingId,
  interactive = true,
  showCounter = true,
}: StorefrontCardSharedProps & {
  product: StorefrontProduct;
  index: number;
  total: number;
  showIcon?: boolean;
  controls?: ReactNode;
  presentation?: ProductMediaPresentation;
  headingId?: string;
  interactive?: boolean;
  showCounter?: boolean;
}) {
  const padded = String(index + 1).padStart(2, '0');
  const totalPadded = String(total).padStart(2, '0');
  const titleId = headingId ?? `sf-feat-${product.id}`;

  return (
    <article
      className="sf-spotlight-story"
      aria-labelledby={interactive ? titleId : undefined}
      aria-hidden={interactive ? undefined : true}
      {...(!interactive ? { inert: true } : {})}
    >
      {interactive ? (
        <a className="sf-card-hit" href={href} aria-label={`${copy.viewProductLabel}: ${product.name}`} />
      ) : (
        <span className="sf-card-hit" aria-hidden="true" />
      )}
      <ProductMediaFallback
        image={product.image}
        name={product.name}
        shopName={shopName}
        fallback={imageFallback}
        sizes={cardImageSizes(true)}
        priority={index === 0 && interactive}
        className="sf-featured-media"
        presentation={presentation}
        decorative={!interactive}
      />
      <div className="sf-featured-copy">
        <div className="sf-featured-copy-head">
          {showCounter && total > 1 ? (
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
        <h2 className="sf-featured-name" id={titleId}>
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

function SpotlightNav({
  viewportId,
  locked,
  onPrev,
  onNext,
}: {
  viewportId: string;
  locked: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="sf-spotlight-nav" role="group" aria-label="Featured products">
      <button
        type="button"
        className="sf-spotlight-nav-btn"
        aria-label="Previous featured product"
        aria-controls={viewportId}
        disabled={locked}
        onClick={onPrev}
      >
        <ChevronLeft width={18} height={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="sf-spotlight-nav-btn"
        aria-label="Next featured product"
        aria-controls={viewportId}
        disabled={locked}
        onClick={onNext}
      >
        <ChevronRight width={18} height={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

function BlacklineFeaturedCarousel({
  products,
  productHref,
  priceFormat,
  imageFallback,
  shopName,
  copy,
}: {
  products: StorefrontProduct[];
  productHref: (id: string) => string;
  priceFormat: StorefrontCardSharedProps['priceFormat'];
  imageFallback: StorefrontCardSharedProps['imageFallback'];
  shopName: string;
  copy: StorefrontCardSharedProps['copy'];
}) {
  const labelId = useId();
  const viewportId = useId();
  const total = products.length;
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const transitioningRef = useRef(false);
  const [visualIndex, setVisualIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [locked, setLocked] = useState(false);
  const [announce, setAnnounce] = useState(products[0]?.name ?? '');

  const logicalIndex = (() => {
    if (visualIndex <= 0) return total - 1;
    if (visualIndex >= total + 1) return 0;
    return visualIndex - 1;
  })();

  useEffect(() => {
    if (visualIndex > total + 1) setVisualIndex(1);
  }, [total, visualIndex]);

  const jumpWithoutAnimation = useCallback((nextVisual: number) => {
    setAnimate(false);
    setVisualIndex(nextVisual);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        transitioningRef.current = false;
        setLocked(false);
      });
    });
  }, []);

  const go = useCallback(
    (direction: -1 | 1) => {
      if (total < 2) return;
      if (transitioningRef.current) return;

      if (prefersReducedMotion()) {
        const nextLogical = (logicalIndex + direction + total) % total;
        setVisualIndex(nextLogical + 1);
        setAnnounce(products[nextLogical]?.name ?? '');
        return;
      }

      transitioningRef.current = true;
      setLocked(true);
      setVisualIndex((current) => current + direction);
    },
    [logicalIndex, products, total],
  );

  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== trackRef.current) return;
    if (event.propertyName !== 'transform') return;
    if (visualIndex === 0) {
      jumpWithoutAnimation(total);
      setAnnounce(products[total - 1]?.name ?? '');
      return;
    }
    if (visualIndex === total + 1) {
      jumpWithoutAnimation(1);
      setAnnounce(products[0]?.name ?? '');
      return;
    }
    transitioningRef.current = false;
    setLocked(false);
    setAnnounce(products[logicalIndex]?.name ?? '');
  };

  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current == null || total < 2) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    go(delta > 0 ? -1 : 1);
  };

  const slides: Array<{
    key: string;
    product: StorefrontProduct;
    logical: number;
    isClone: boolean;
    headingId: string;
  }> = [];

  if (total > 0) {
    const last = products[total - 1]!;
    slides.push({
      key: `clone-last-${last.id}`,
      product: last,
      logical: total - 1,
      isClone: true,
      headingId: `sf-feat-clone-last-${last.id}`,
    });
    products.forEach((product, productIndex) => {
      slides.push({
        key: product.id,
        product,
        logical: productIndex,
        isClone: false,
        headingId: `sf-feat-${product.id}`,
      });
    });
    const first = products[0]!;
    slides.push({
      key: `clone-first-${first.id}`,
      product: first,
      logical: 0,
      isClone: true,
      headingId: `sf-feat-clone-first-${first.id}`,
    });
  }

  const nav =
    total > 1 ? (
      <SpotlightNav viewportId={viewportId} locked={locked} onPrev={() => go(-1)} onNext={() => go(1)} />
    ) : null;

  if (total === 1) {
    const only = products[0]!;
    return (
      <section className="sf-featured sf-spotlight sf-spotlight--unified" aria-label="Featured product">
        <FeaturedStory
          product={only}
          href={productHref(only.id)}
          priceFormat={priceFormat}
          imageFallback={imageFallback}
          shopName={shopName}
          copy={copy}
          index={0}
          total={1}
          showIcon
          presentation="featured-product"
        />
      </section>
    );
  }

  return (
    <section
      className="sf-featured sf-spotlight sf-spotlight--unified"
      aria-labelledby={labelId}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <h2 className="sf-sr-only" id={labelId}>
        Featured
      </h2>
      <span className="sf-sr-only" aria-live="polite">
        {announce}
      </span>
      <div className="sf-spotlight-viewport" id={viewportId}>
        <div
          ref={trackRef}
          className={`sf-spotlight-track${animate ? ' is-animated' : ''}`}
          style={{ transform: `translate3d(-${visualIndex * 100}%, 0, 0)` }}
          onTransitionEnd={onTransitionEnd}
        >
          {slides.map((slide) => {
            const isActiveReal = !slide.isClone && slide.logical === logicalIndex;
            return (
              <div key={slide.key} className="sf-spotlight-slide">
                <FeaturedStory
                  product={slide.product}
                  href={productHref(slide.product.id)}
                  priceFormat={priceFormat}
                  imageFallback={imageFallback}
                  shopName={shopName}
                  copy={copy}
                  index={slide.logical}
                  total={total}
                  showIcon
                  presentation="featured-product"
                  headingId={slide.headingId}
                  interactive={isActiveReal}
                  showCounter={isActiveReal}
                  controls={isActiveReal ? nav : null}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
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

  if (isBlackline) {
    return (
      <BlacklineFeaturedCarousel
        products={products}
        productHref={productHref}
        priceFormat={priceFormat}
        imageFallback={imageFallback}
        shopName={shopName}
        copy={featuredCopy}
      />
    );
  }

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
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    go(delta > 0 ? -1 : 1);
  };

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
    <section
      className="sf-featured sf-spotlight"
      aria-labelledby={labelId}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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
