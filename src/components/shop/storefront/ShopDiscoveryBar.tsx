import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { StorefrontCategoryOption, StorefrontSort } from '@/lib/shop/storefrontCatalog';
import { STOREFRONT_ALL_CATEGORY, STOREFRONT_SORT_MIN_COUNT } from '@/lib/shop/storefrontCatalog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Search, X } from '../../lucide-react';

const SORT_LABELS: Record<StorefrontSort, string> = {
  recommended: 'Recommended',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  name: 'Name',
};

type ShopDiscoveryBarProps = {
  options: StorefrontCategoryOption[];
  selected: string;
  onSelect: (category: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sort: StorefrontSort;
  onSortChange: (sort: StorefrontSort) => void;
  showSort: boolean;
  count: number;
  total: number;
  heading?: string;
  onClear: () => void;
  showClear: boolean;
  sticky?: boolean;
  searchPlaceholder?: string;
  clearLabel?: string;
  showSearch?: boolean;
  variant?: 'default' | 'compact';
  showSummary?: boolean;
};

function CategoryPills({
  options,
  selected,
  onSelect,
  railRef,
}: {
  options: StorefrontCategoryOption[];
  selected: string;
  onSelect: (category: string) => void;
  railRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="sf-rail" role="tablist" aria-label="Filter by category" ref={railRef}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            className={`sf-rail-tab${isSelected ? ' is-selected' : ''}`}
            aria-selected={isSelected}
            data-category-filter={option.value}
            onClick={() => onSelect(option.value)}
          >
            <span>{option.label}</span>
            <span className="sf-rail-count" aria-hidden="true">
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SortControl({
  sort,
  onSortChange,
}: {
  sort: StorefrontSort;
  onSortChange: (sort: StorefrontSort) => void;
}) {
  return (
    <label className="sf-sort">
      <span className="sf-sort-label">Sort:</span>
      <span className="sf-sr-only">Sort products</span>
      <select
        id="sf-sort"
        data-shop-sort
        value={sort}
        onChange={(event) => onSortChange(event.target.value as StorefrontSort)}
        aria-label={`Sort: ${SORT_LABELS[sort]}`}
      >
        <option value="recommended">Recommended</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name">Name</option>
      </select>
    </label>
  );
}

export default function ShopDiscoveryBar({
  options,
  selected,
  onSelect,
  query,
  onQueryChange,
  sort,
  onSortChange,
  showSort,
  count,
  total,
  heading,
  onClear,
  showClear,
  sticky = true,
  searchPlaceholder = 'Search',
  clearLabel = 'Clear',
  showSearch = true,
  variant = 'default',
  showSummary = true,
}: ShopDiscoveryBarProps) {
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? 'All products';
  const railRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const compact = variant === 'compact';
  const showSortControl = showSort && total >= STOREFRONT_SORT_MIN_COUNT;

  const updateRailOverflow = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      setOverflowing(false);
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const overflows = maxScroll > 2;
    setOverflowing(overflows);
    setCanPrev(rail.scrollLeft > 2);
    setCanNext(rail.scrollLeft < maxScroll - 2);
    rail.dataset.canPrev = rail.scrollLeft > 2 ? 'true' : 'false';
    rail.dataset.canNext = rail.scrollLeft < maxScroll - 2 ? 'true' : 'false';
  }, []);

  useEffect(() => {
    const selectedTab = railRef.current?.querySelector<HTMLElement>('.sf-rail-tab.is-selected');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    selectedTab?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [selected]);

  useEffect(() => {
    if (!compact) return;
    const rail = railRef.current;
    if (!rail) return;

    updateRailOverflow();
    const onScroll = () => updateRailOverflow();
    rail.addEventListener('scroll', onScroll, { passive: true });

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateRailOverflow()) : null;
    observer?.observe(rail);
    window.addEventListener('resize', updateRailOverflow);

    return () => {
      rail.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      window.removeEventListener('resize', updateRailOverflow);
    };
  }, [compact, options, updateRailOverflow]);

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const amount = Math.max(rail.clientWidth * 0.8, 160);
    rail.scrollBy({ left: direction * amount, behavior: reduced ? 'auto' : 'smooth' });
  };

  const liveAnnouncement = `${count} products${
    selected !== STOREFRONT_ALL_CATEGORY ? ` in ${selectedLabel}` : ''
  }${showSearch && query ? ` matching ${query}` : ''}`;

  const rootClass = [
    'sf-discovery',
    compact ? 'sf-discovery--compact' : '',
    sticky ? 'sf-discovery--sticky' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (compact) {
    return (
      <div className={rootClass} data-sf-discovery data-sf-discovery-variant="compact">
        <div className="sf-discovery-row">
          {options.length > 1 ? (
            <div className={`sf-category-carousel${overflowing ? ' is-overflowing' : ''}`}>
              {overflowing ? (
                <button
                  type="button"
                  className="sf-rail-btn sf-category-carousel__prev"
                  aria-label="Previous product categories"
                  disabled={!canPrev}
                  onClick={() => scrollRail(-1)}
                >
                  <ChevronLeft width={18} height={18} aria-hidden="true" />
                </button>
              ) : null}
              <CategoryPills options={options} selected={selected} onSelect={onSelect} railRef={railRef} />
              {overflowing ? (
                <button
                  type="button"
                  className="sf-rail-btn sf-category-carousel__next"
                  aria-label="Next product categories"
                  disabled={!canNext}
                  onClick={() => scrollRail(1)}
                >
                  <ChevronRight width={18} height={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="sf-category-carousel" />
          )}
          {showSortControl ? (
            <div className="sf-discovery-sort">
              <SortControl sort={sort} onSortChange={onSortChange} />
            </div>
          ) : null}
        </div>
        <span className="sf-sr-only" aria-live="polite">
          {liveAnnouncement}
        </span>
      </div>
    );
  }

  return (
    <div className={rootClass} data-sf-discovery>
      {options.length > 1 ? (
        <CategoryPills options={options} selected={selected} onSelect={onSelect} railRef={railRef} />
      ) : null}

      <div className="sf-toolbar">
        {showSummary ? (
          <div className="sf-toolbar-copy">
            {heading ? <h2 className="sf-toolbar-heading">{heading}</h2> : null}
            <p className="sf-toolbar-count" aria-live="polite">
              {selectedLabel} · {count} of {total}
            </p>
          </div>
        ) : null}
        <div className="sf-discovery-controls">
          {showSearch ? (
            <label className="sf-search">
              <span className="sf-sr-only">Search products</span>
              <Search width={16} height={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={searchPlaceholder}
                data-shop-search
              />
              {query ? (
                <button
                  type="button"
                  className="sf-search-clear"
                  aria-label="Clear search"
                  onClick={() => onQueryChange('')}
                >
                  <X width={14} height={14} aria-hidden="true" />
                </button>
              ) : null}
            </label>
          ) : null}
          {showSortControl ? <SortControl sort={sort} onSortChange={onSortChange} /> : null}
          {showClear ? (
            <button type="button" className="sf-clear" onClick={onClear}>
              {clearLabel}
            </button>
          ) : null}
        </div>
      </div>
      <span className="sf-sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>
    </div>
  );
}
