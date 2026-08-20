import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STOREFRONT_ALL_CATEGORY,
  STOREFRONT_PAGE_SIZE,
  collectStorefrontProducts,
  featuredProducts,
  paginateStorefrontProducts,
  parseStorefrontCategoryParam,
  parseStorefrontQuery,
  storefrontCategoryOptions,
  storefrontLoadedStorageKey,
  storefrontProductHref,
  storefrontQuerySearch,
  visibleProducts,
  type StorefrontPriceFormat,
  type StorefrontProduct,
  type StorefrontQuery,
  type StorefrontSort,
} from '@/lib/shop/storefrontCatalog';
import type { StorefrontImageFallback, StorefrontThemeId } from '@/lib/shop/storefrontTheme';
import FeaturedProductShowcase from './FeaturedProductShowcase';
import ProductGrid from './ProductGrid';
import ShopDiscoveryBar from './ShopDiscoveryBar';
import ShopEmptyState from './ShopEmptyState';
import ShopIntro from './ShopIntro';
import { DEFAULT_STOREFRONT_COPY, type StorefrontCopy } from './types';

export type StorefrontShopPageProps = {
  products: StorefrontProduct[];
  themeId: StorefrontThemeId;
  shopName: string;
  productHrefPrefix: string;
  priceFormat?: StorefrontPriceFormat;
  imageFallback?: StorefrontImageFallback;
  selectedCategory?: string;
  shopKey?: string;
  intro: {
    eyebrow?: string;
    heading: string;
    headingId?: string;
    description?: string;
    fulfilmentLabel?: string;
    safetyNote?: string;
    meta?: string[];
  };
  collectionHeading?: string;
  collectionLede?: string;
  copy?: Partial<StorefrontCopy>;
  featuredAddedLabel?: string;
  highlightProductId?: string | null;
  itemIdPrefix?: string;
  showPoweredBy?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
};

function readLoadedCount(key: string): number {
  if (typeof window === 'undefined') return STOREFRONT_PAGE_SIZE;
  const raw = window.sessionStorage.getItem(key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : STOREFRONT_PAGE_SIZE;
}

export default function StorefrontShopPage({
  products,
  themeId,
  shopName,
  productHrefPrefix,
  priceFormat = 'gbp',
  imageFallback = 'initial',
  selectedCategory: selectedCategoryProp,
  shopKey,
  intro,
  collectionHeading,
  copy: copyOverrides,
  featuredAddedLabel,
  highlightProductId = null,
  itemIdPrefix,
  showPoweredBy = false,
  emptyTitle = 'No products listed yet',
  emptyDescription = 'Check back soon or ask the barbershop in person.',
  emptyActionHref,
  emptyActionLabel,
}: StorefrontShopPageProps) {
  const copy: StorefrontCopy = { ...DEFAULT_STOREFRONT_COPY, ...copyOverrides };
  const categoryOptions = useMemo(() => storefrontCategoryOptions(products), [products]);
  const validCategories = useMemo(
    () => categoryOptions.map((option) => option.value),
    [categoryOptions],
  );
  const isBlackline = themeId === 'blackline';
  const namespace = shopKey || productHrefPrefix;

  const normalizeQuery = useCallback(
    (raw: StorefrontQuery): StorefrontQuery => {
      if (!isBlackline) return raw;
      return { ...raw, q: '' };
    },
    [isBlackline],
  );

  const [query, setQuery] = useState<StorefrontQuery>(() =>
    normalizeQuery(
      parseStorefrontQuery(
        {
          get: (name) => (name === 'category' ? selectedCategoryProp ?? null : null),
        },
        validCategories,
      ),
    ),
  );
  const [loadedCount, setLoadedCount] = useState(STOREFRONT_PAGE_SIZE);
  const collectionRef = useRef<HTMLDivElement>(null);

  const applyQuery = useCallback(
    (patch: Partial<StorefrontQuery>, syncUrl: boolean, scrollCollection: boolean) => {
      setQuery((current) => {
        const next = normalizeQuery({
          ...current,
          ...patch,
          ...(patch.category !== undefined
            ? { category: parseStorefrontCategoryParam(patch.category, validCategories) }
            : {}),
          ...(isBlackline ? { q: '' } : {}),
        });
        if (!syncUrl || typeof window === 'undefined') return next;
        const href = `${window.location.pathname}${storefrontQuerySearch(next)}${window.location.hash}`;
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentHref !== href) {
          window.history.pushState(next, '', href);
        }
        return next;
      });
      setLoadedCount(STOREFRONT_PAGE_SIZE);
      if (scrollCollection && !isBlackline && collectionRef.current) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        collectionRef.current.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      }
    },
    [isBlackline, normalizeQuery, validCategories],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initial = normalizeQuery(parseStorefrontQuery(params, validCategories));
    setQuery(initial);
    setLoadedCount(readLoadedCount(storefrontLoadedStorageKey(namespace, initial)));

    if (isBlackline && params.has('q')) {
      const cleaned = `${window.location.pathname}${storefrontQuerySearch(initial)}${window.location.hash}`;
      window.history.replaceState(initial, '', cleaned);
    }
  }, [isBlackline, namespace, normalizeQuery, validCategories]);

  useEffect(() => {
    const root = document.querySelector('.shop-page');
    root?.setAttribute('data-shop-filter-ready', '1');
    root?.setAttribute('data-active-category', query.category);

    const onSetCategory = (event: Event) => {
      const detail = (event as CustomEvent<{ category?: string }>).detail;
      applyQuery({ category: detail?.category ?? STOREFRONT_ALL_CATEGORY }, true, true);
    };
    const onPop = () => {
      const next = normalizeQuery(
        parseStorefrontQuery(new URLSearchParams(window.location.search), validCategories),
      );
      setQuery(next);
      setLoadedCount(readLoadedCount(storefrontLoadedStorageKey(namespace, next)));
      if (isBlackline && new URLSearchParams(window.location.search).has('q')) {
        const cleaned = `${window.location.pathname}${storefrontQuerySearch(next)}${window.location.hash}`;
        window.history.replaceState(next, '', cleaned);
      }
    };

    window.addEventListener('kersivo:shop-set-category', onSetCategory);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('kersivo:shop-set-category', onSetCategory);
      window.removeEventListener('popstate', onPop);
    };
  }, [applyQuery, isBlackline, namespace, normalizeQuery, query.category, validCategories]);

  const featured = featuredProducts(products);
  const matched = collectStorefrontProducts(products, query);
  const highlight = highlightProductId
    ? matched.find((product) => product.id === highlightProductId)
    : null;
  const page = paginateStorefrontProducts(matched, loadedCount);
  const visible = highlight && !page.visible.some((product) => product.id === highlight.id)
    ? [highlight, ...page.visible]
    : page.visible;
  const catalog = visibleProducts(products);
  const hasVisibleProducts = catalog.length > 0;
  const filtersActive =
    query.category !== STOREFRONT_ALL_CATEGORY || Boolean(query.q) || query.sort !== 'recommended';

  useEffect(() => {
    if (!isBlackline || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('q')) return;
    const cleaned = `${window.location.pathname}${storefrontQuerySearch({ ...query, q: '' })}${window.location.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== cleaned) {
      window.history.replaceState(query, '', cleaned);
    }
  }, [isBlackline, query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      storefrontLoadedStorageKey(namespace, query),
      String(page.loadedCount),
    );
  }, [namespace, page.loadedCount, query]);

  return (
    <div
      className={`sf-shop sf-shop--${themeId}`}
      data-sf-theme={themeId}
      data-active-category={query.category}
    >
      <ShopIntro {...intro} compact />

      {featured.length > 0 ? (
        <FeaturedProductShowcase
          products={featured}
          productHref={(id) => storefrontProductHref(productHrefPrefix, id)}
          priceFormat={priceFormat}
          imageFallback={imageFallback}
          shopName={shopName}
          copy={copy}
          themeId={themeId}
          featuredAddedLabel={featuredAddedLabel}
        />
      ) : null}

      {hasVisibleProducts ? (
        <div className="sf-collection" ref={collectionRef} id="storefront-collection">
          <ShopDiscoveryBar
            options={categoryOptions}
            selected={query.category}
            onSelect={(next) => applyQuery({ category: next }, true, true)}
            query={isBlackline ? '' : query.q}
            onQueryChange={(value) => {
              if (isBlackline) return;
              applyQuery({ q: value }, true, false);
            }}
            sort={query.sort}
            onSortChange={(sort: StorefrontSort) => applyQuery({ sort }, true, true)}
            showSort
            count={page.visible.length}
            total={matched.length}
            heading={isBlackline ? undefined : collectionHeading}
            searchPlaceholder={isBlackline ? 'Search products' : 'Search'}
            clearLabel={isBlackline ? 'Clear filters' : 'Clear'}
            onClear={() =>
              applyQuery(
                { category: STOREFRONT_ALL_CATEGORY, q: '', sort: 'recommended', availability: 'all' },
                true,
                true,
              )
            }
            showClear={!isBlackline && filtersActive}
            showSearch={!isBlackline}
            showSummary={!isBlackline}
            variant={isBlackline ? 'compact' : 'default'}
          />
          {matched.length === 0 ? (
            <ShopEmptyState
              title="No products found"
              description={
                isBlackline
                  ? 'Try another category or browse all products.'
                  : 'Try a different search or browse all products.'
              }
              actionLabel="Clear filters"
              onAction={() =>
                applyQuery(
                  { category: STOREFRONT_ALL_CATEGORY, q: '', sort: 'recommended', availability: 'all' },
                  true,
                  false,
                )
              }
            />
          ) : (
            <>
              <ProductGrid
                products={visible}
                productHrefPrefix={productHrefPrefix}
                priceFormat={priceFormat}
                imageFallback={imageFallback}
                shopName={shopName}
                copy={copy}
                highlightProductId={highlightProductId}
                itemIdPrefix={itemIdPrefix}
                filterKey={`${query.category}:${query.q}:${query.sort}`}
                showAtcIcon={isBlackline}
              />
              <p className="sf-showing">
                {isBlackline
                  ? `${page.loadedCount} of ${page.total} products`
                  : `Showing ${page.loadedCount} of ${page.total}`}
              </p>
              {page.hasMore ? (
                <button
                  type="button"
                  className="sf-load-more"
                  onClick={() => setLoadedCount((count) => count + STOREFRONT_PAGE_SIZE)}
                >
                  {isBlackline ? 'Show more products' : 'Load more'}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <ShopEmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionHref={emptyActionHref}
          actionLabel={emptyActionLabel}
        />
      )}

      {showPoweredBy ? (
        <p className="sf-powered">
          Powered by <a href="/">KERSIVO</a>
        </p>
      ) : null}
    </div>
  );
}
