import { useEffect, useRef } from 'react';
import type { StorefrontCategoryOption, StorefrontSort } from '@/lib/shop/storefrontCatalog';
import { STOREFRONT_ALL_CATEGORY, STOREFRONT_SORT_MIN_COUNT } from '@/lib/shop/storefrontCatalog';
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
};

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
}: ShopDiscoveryBarProps) {
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? 'All products';
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedTab = railRef.current?.querySelector<HTMLElement>('.sf-rail-tab.is-selected');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    selectedTab?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [selected]);

  return (
    <div className={`sf-discovery${sticky ? ' sf-discovery--sticky' : ''}`} data-sf-discovery>
      {options.length > 1 ? (
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
      ) : null}

      <div className="sf-toolbar">
        <div className="sf-toolbar-copy">
          {heading ? <h2 className="sf-toolbar-heading">{heading}</h2> : null}
          <p className="sf-toolbar-count" aria-live="polite">
            {selectedLabel} · {count} of {total}
          </p>
        </div>
        <div className="sf-discovery-controls">
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
          {showSort && total >= STOREFRONT_SORT_MIN_COUNT ? (
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
          ) : null}
          {showClear ? (
            <button type="button" className="sf-clear" onClick={onClear}>
              {clearLabel}
            </button>
          ) : null}
        </div>
      </div>
      <span className="sf-sr-only" aria-live="polite">
        {count} products
        {selected !== STOREFRONT_ALL_CATEGORY ? ` in ${selectedLabel}` : ''}
        {query ? ` matching ${query}` : ''}
      </span>
    </div>
  );
}
