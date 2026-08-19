import type { StorefrontCategoryOption, StorefrontSort } from '@/lib/shop/storefrontCatalog';
import { STOREFRONT_ALL_CATEGORY, STOREFRONT_SORT_MIN_COUNT } from '@/lib/shop/storefrontCatalog';

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
}: ShopDiscoveryBarProps) {
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? 'All products';

  return (
    <div className={`sf-discovery${sticky ? ' sf-discovery--sticky' : ''}`} data-sf-discovery>
      {options.length > 1 ? (
        <div className="sf-rail" role="tablist" aria-label="Filter by category">
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
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search"
              data-shop-search
            />
          </label>
          {showSort && total >= STOREFRONT_SORT_MIN_COUNT ? (
            <label className="sf-sort">
              <span className="sf-sr-only">Sort products</span>
              <select
                id="sf-sort"
                data-shop-sort
                value={sort}
                onChange={(event) => onSortChange(event.target.value as StorefrontSort)}
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
              Clear
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
