import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent,
  type TransitionEvent,
} from 'react';
import { CATEGORY_LABELS } from '@/lib/shop/productPresentation';
import { formatStorefrontPrice, type StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import ProductAvailabilityBadge from './ProductAvailabilityBadge';
import ProductMediaFallback, { type ProductMediaPresentation } from './ProductMediaFallback';
import StorefrontAddToBagButton from './StorefrontAddToBagButton';
import { cardImageSizes, type StorefrontCardSharedProps } from './types';

type FeaturedProductShowcaseProps = Omit<StorefrontCardSharedProps, 'href'> & {
  products: StorefrontProduct[];
  productHref: (id: string) => string;
  featuredAddedLabel?: string;
};

const SWIPE_THRESHOLD = 40;
export const FEATURED_AUTOPLAY_MS = 6000;
const FINE_HOVER_MQ = '(hover: hover) and (pointer: fine)';
const DESKTOP_PROGRESS_MQ = '(min-width: 768px)';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeMediaQuery(query: string, onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function useMediaQuery(query: string, serverSnapshot = false) {
  return useSyncExternalStore(
    (onChange) => (typeof window === 'undefined' ? () => {} : subscribeMediaQuery(query, onChange)),
    () => (typeof window === 'undefined' ? serverSnapshot : window.matchMedia(query).matches),
    () => serverSnapshot,
  );
}

function preloadFeaturedImages(products: StorefrontProduct[]) {
  for (const product of products) {
    const src = product.image?.src?.trim();
    if (!src) continue;
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    void image.decode?.().catch(() => undefined);
  }
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
  presentation = 'default',
  headingId,
  interactive = true,
}: StorefrontCardSharedProps & {
  product: StorefrontProduct;
  index: number;
  total: number;
  presentation?: ProductMediaPresentation;
  headingId?: string;
  interactive?: boolean;
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
          {total > 1 ? (
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
          />
        </div>
      </div>
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
  const interactive = useMediaQuery(DESKTOP_PROGRESS_MQ, false);
  const total = products.length;

  return (
    <div
      className={`sf-spotlight-progress${interactive ? '' : ' sf-spotlight-progress--static'}`}
      role={interactive ? 'group' : 'presentation'}
      aria-label={interactive ? 'Featured products' : undefined}
    >
      <div className="sf-spotlight-progress-track">
        {products.map((product, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          const fill = (
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
          );

          if (!interactive) {
            return (
              <div key={product.id} className="sf-spotlight-progress-seg" aria-hidden="true">
                {fill}
              </div>
            );
          }

          return (
            <button
              key={product.id}
              type="button"
              className="sf-spotlight-progress-seg"
              aria-label={`Show featured product ${index + 1} of ${total}: ${product.name}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(index)}
            >
              {fill}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StorefrontFeaturedCarousel({
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
  const touchStartY = useRef<number | null>(null);
  const swipeActiveRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const transitioningRef = useRef(false);
  const logicalIndexRef = useRef(0);
  const progressPausedRef = useRef(false);
  const remainingMsRef = useRef(FEATURED_AUTOPLAY_MS);
  const tickStartedAtRef = useRef(0);
  const timerGenerationRef = useRef(0);
  const [visualIndex, setVisualIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [locked, setLocked] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [announce, setAnnounce] = useState(products[0]?.name ?? '');
  const [progressToken, setProgressToken] = useState(0);
  const [inView, setInView] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const fineHover = useMediaQuery(FINE_HOVER_MQ, false);

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
    if (!inView || total < 1) return;
    preloadFeaturedImages(products);
  }, [inView, products, total]);

  useEffect(() => {
    if (!fineHover) setHoverPaused(false);
  }, [fineHover]);

  const jumpWithoutAnimation = useCallback(
    (nextVisual: number) => {
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
    },
    [restartProgress],
  );

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

  const settleAfterTransition = useCallback(() => {
    if (!transitioningRef.current) return;
    transitioningRef.current = false;

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

    setLocked(false);
    setAnnounce(products[logicalIndex]?.name ?? '');
    restartProgress();
  }, [jumpWithoutAnimation, logicalIndex, products, restartProgress, total, visualIndex]);

  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== trackRef.current) return;
    if (event.propertyName !== 'transform') return;
    settleAfterTransition();
  };

  useEffect(() => {
    if (!locked || reducedMotion) return;
    const failsafe = window.setTimeout(() => {
      settleAfterTransition();
    }, 700);
    return () => window.clearTimeout(failsafe);
  }, [locked, reducedMotion, settleAfterTransition, visualIndex]);

  const endSwipeGesture = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    swipeActiveRef.current = false;
    setSwiping(false);
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    touchStartX.current = touch?.clientX ?? null;
    touchStartY.current = touch?.clientY ?? null;
    swipeActiveRef.current = false;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    if (Math.abs(deltaX) < 12) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (swipeActiveRef.current) return;
    swipeActiveRef.current = true;
    setSwiping(true);
  };

  const onTouchCancel = () => {
    endSwipeGesture();
  };

  const onTouchEnd = (event: TouchEvent) => {
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    endSwipeGesture();
    if (startX == null || total < 2) return;
    const endTouch = event.changedTouches[0];
    const endX = endTouch?.clientX ?? startX;
    const endY = endTouch?.clientY ?? startY ?? 0;
    const deltaX = endX - startX;
    const deltaY = endY - (startY ?? endY);
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (Math.abs(deltaX) < Math.abs(deltaY)) return;
    goBy(deltaX > 0 ? -1 : 1);
  };

  const onMouseEnter = () => {
    if (!fineHover) return;
    setHoverPaused(true);
  };

  const onMouseLeave = (event: ReactMouseEvent<HTMLElement>) => {
    if (!fineHover) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setHoverPaused(false);
  };

  const progressPaused = reducedMotion || !inView || docHidden || hoverPaused || locked || swiping;
  progressPausedRef.current = progressPaused;

  // JS timer kept in lockstep with CSS fill (--featured-autoplay-ms / FEATURED_AUTOPLAY_MS)
  useEffect(() => {
    if (total < 2 || reducedMotion || progressPaused) return;
    const generation = ++timerGenerationRef.current;
    tickStartedAtRef.current = Date.now();
    const delay = Math.max(0, remainingMsRef.current);
    const timer = window.setTimeout(() => {
      if (generation !== timerGenerationRef.current) return;
      if (progressPausedRef.current) return;
      remainingMsRef.current = FEATURED_AUTOPLAY_MS;
      goBy(1);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (generation !== timerGenerationRef.current) return;
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
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
                  presentation="featured-product"
                  headingId={slide.headingId}
                  interactive={isActiveReal}
                />
              </div>
            );
          })}
        </div>
      </div>
      <FeaturedProgressNav
        products={products}
        activeIndex={logicalIndex}
        progressPaused={progressPaused}
        progressToken={progressToken}
        reducedMotion={reducedMotion}
        onSelect={goTo}
      />
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
  featuredAddedLabel,
}: FeaturedProductShowcaseProps) {
  if (products.length === 0) return null;
  const featuredCopy = featuredAddedLabel ? { ...copy, addedLabel: featuredAddedLabel } : copy;

  return (
    <StorefrontFeaturedCarousel
      products={products}
      productHref={productHref}
      priceFormat={priceFormat}
      imageFallback={imageFallback}
      shopName={shopName}
      copy={featuredCopy}
    />
  );
}
