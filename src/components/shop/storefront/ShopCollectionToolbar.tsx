import { STOREFRONT_SORT_MIN_COUNT, type StorefrontSort } from '@/lib/shop/storefrontCatalog';

type ShopCollectionToolbarProps = {
  heading?: string;
  lede?: string;
  label: string;
  count: number;
  sort: StorefrontSort;
  onSortChange: (sort: StorefrontSort) => void;
  showSort: boolean;
};

export default function ShopCollectionToolbar({
  heading,
  lede,
  label,
  count,
  sort,
  onSortChange,
  showSort,
}: ShopCollectionToolbarProps) {
  return (
    <div className="sf-toolbar">
      <div className="sf-toolbar-copy">
        {heading ? <h2 className="sf-toolbar-heading">{heading}</h2> : null}
        {lede ? <p className="sf-toolbar-lede">{lede}</p> : null}
        <p className="sf-toolbar-count">
          {label}
          <span aria-hidden="true"> · </span>
          <span>
            {count} {count === 1 ? 'product' : 'products'}
          </span>
        </p>
      </div>
      {showSort && count >= STOREFRONT_SORT_MIN_COUNT ? (
        <div className="sf-sort">
          <label className="sf-sr-only" htmlFor="sf-sort">
            Sort products
          </label>
          <select
            id="sf-sort"
            className="sf-sort-select"
            value={sort}
            data-shop-sort
            onChange={(event) => onSortChange(event.target.value as StorefrontSort)}
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name">Name</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
