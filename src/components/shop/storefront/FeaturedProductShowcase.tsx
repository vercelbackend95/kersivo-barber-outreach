import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
  type TransitionEvent,
} from 'react';
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
export const FEATURED_AUTOPLAY_MS = 6000;

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
  progressFooter,
  presentation = 'default',
  headingId,
  interactive = true,
  showCounter = true,
}: StorefrontCardSharedProps & {
  product: StorefrontProduct;
  index: number;
  total: number;
  showIcon?: boolean;
  progressFooter?: ReactNode;
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
          ) : null}
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
      {progressFooter}
    </article>
  );
}

function FeaturedProgressNav({
  products,
  activeIndex,
  progressPaused,
  progressToken,
  reducedMotion,
  onSelect,
}: {
  products: StorefrontProduct[];
  activeIndex: number;
  progressPaused: boolean;
  progressToken: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}) {
  const total = products.length;

  return (
    <div className="sf-spotlight-progress" role="group" aria-label="Featured products">
      <div className="sf-spotlight-progress-track">
        {products.map((product, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <button
              key={product.id}
              type="button"
              className="sf-spotlight-progress-seg"
              aria-label={`Show featured product ${index + 1} of ${total}: ${product.name}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(index)}
            >
              <span className="sf-spotlight-progress-rail" aria-hidden="true">
                <span
                  key={isActive ? `active-${progressToken}` : `seg-${index}-${isComplete ? 'done' : 'idle'}`}
                  className={[
                    'sf-spotlight-progress-fill',
                    isComplete ? 'is-complete' : '',
                    isActive ? 'is-active' : '',
                    isActive && progressPaused ? 'is-paused' : '',
                    isActive && reducedMotion ? 'is-static' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </span>
            </button>
          );
        })}
      </div>
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
  const rootRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const transitioningRef = useRef(false);
  const logicalIndexRef = useRef(0);
  const progressPausedRef = useRef(false);
  const remainingMsRef = useRef(FEATURED_AUTOPLAY_MS);
  const tickStartedAtRef = useRef(0);
  const [visualIndex, setVisualIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [locked, setLocked] = useState(false);
  const [announce, setAnnounce] = useState(products[0]?.name ?? '');
  const [progressToken, setProgressToken] = useState(0);
  const [inView, setInView] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [pointerPaused, setPointerPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const logicalIndex = (() => {
    if (visualIndex <= 0) return total - 1;
    if (visualIndex >= total + 1) return 0;
    return visualIndex - 1;
  })();
  logicalIndexRef.current = logicalIndex;

  const restartProgress = useCallback(() => {
    remainingMsRef.current = FEATURED_AUTOPLAY_MS;
    setProgressToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (visualIndex > total + 1) setVisualIndex(1);
  }, [total, visualIndex]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || total < 2) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.35 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [total]);

  useEffect(() => {
    const onVisibility = () => setDocHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const src = products[(logicalIndex + 1) % total]?.image?.src?.trim();
    if (!src) return;
    const image = new Image();
    image.src = src;
  }, [logicalIndex, products, total]);

  const jumpWithoutAnimation = useCallback((nextVisual: number) => {
    setAnimate(false);
    setVisualIndex(nextVisual);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        transitioningRef.current = false;
        setLocked(false);
        restartProgress();
      });
    });
  }, [restartProgress]);

  const goBy = useCallback(
    (direction: -1 | 1) => {
      if (total < 2) return;
      if (transitioningRef.current) return;

      if (prefersReducedMotion()) {
        const nextLogical = (logicalIndexRef.current + direction + total) % total;
        setVisualIndex(nextLogical + 1);
        setAnnounce(products[nextLogical]?.name ?? '');
        restartProgress();
        return;
      }

      transitioningRef.current = true;
      setLocked(true);
      setVisualIndex((current) => current + direction);
    },
    [products, restartProgress, total],
  );

  const goTo = useCallback(
    (targetLogical: number) => {
      if (total < 2) return;
      if (targetLogical < 0 || targetLogical >= total) return;
      if (transitioningRef.current) return;

      const currentLogical = logicalIndexRef.current;
      if (targetLogical === currentLogical) {
        restartProgress();
        return;
      }

      const forward = (targetLogical - currentLogical + total) % total;
      const backward = (currentLogical - targetLogical + total) % total;
      const useForward = forward <= backward;
      const steps = useForward ? forward : backward;
      const direction = (useForward ? 1 : -1) as -1 | 1;

      if (prefersReducedMotion()) {
        setVisualIndex(targetLogical + 1);
        setAnnounce(products[targetLogical]?.name ?? '');
        restartProgress();
        return;
      }

      transitioningRef.current = true;
      setLocked(true);
      setVisualIndex((current) => current + direction * steps);
    },
    [products, restartProgress, total],
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
    restartProgress();
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
    goBy(delta > 0 ? -1 : 1);
  };

  const progressPaused =
    reducedMotion ||
    !inView ||
    docHidden ||
    pointerPaused ||
    locked;
  progressPausedRef.current = progressPaused;

  // JS timer kept in lockstep with CSS fill (--featured-autoplay-ms / FEATURED_AUTOPLAY_MS)
  useEffect(() => {
    if (total < 2 || reducedMotion || progressPaused) return;
    tickStartedAtRef.current = Date.now();
    const delay = Math.max(0, remainingMsRef.current);
    const timer = window.setTimeout(() => {
      if (progressPausedRef.current) return;
      remainingMsRef.current = FEATURED_AUTOPLAY_MS;
      goBy(1);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - tickStartedAtRef.current;
      remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    };
  }, [goBy, progressPaused, progressToken, reducedMotion, total]);

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

  const progressNav =
    total > 1 ? (
      <FeaturedProgressNav
        products={products}
        activeIndex={logicalIndex}
        progressPaused={progressPaused}
        progressToken={progressToken}
        reducedMotion={reducedMotion}
        onSelect={goTo}
      />
    ) : null;

  const rootStyle = {
    ['--featured-autoplay-ms' as string]: `${FEATURED_AUTOPLAY_MS}ms`,
  } as CSSProperties;

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
      ref={rootRef}
      className="sf-featured sf-spotlight sf-spotlight--unified"
      aria-labelledby={labelId}
      style={rootStyle}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPointerPaused(true)}
      onMouseLeave={() => setPointerPaused(false)}
      onFocusCapture={() => setPointerPaused(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setPointerPaused(false);
      }}
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
                  progressFooter={isActiveReal ? progressNav : null}
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
