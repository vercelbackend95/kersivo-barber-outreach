import {
  OPS_CLIENT_FILTERS,
  filterLabel,
  type OpsClientFilter,
} from '@/lib/recommendations/ops/overviewClient';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: OpsClientFilter;
  onFilterChange: (filter: OpsClientFilter) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function OpsFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onClear,
  disabled,
}: Props) {
  const canClear = search.trim().length > 0 || filter !== 'all';
  return (
    <div className="ops-filters">
      <div className="ops-filters__search-row">
        <label className="sr-only" htmlFor="ops-shop-search">
          Search shops by name
        </label>
        <input
          id="ops-shop-search"
          className="ops-filters__search input"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search shop name"
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn--secondary ops-filters__clear"
          onClick={onClear}
          disabled={disabled || !canClear}
          aria-label="Clear filters"
        >
          Clear filters
        </button>
      </div>
      <div className="ops-filters__rail" role="toolbar" aria-label="Page filters">
        {OPS_CLIENT_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={
              filter === f ? 'ops-filters__chip ops-filters__chip--active' : 'ops-filters__chip'
            }
            aria-pressed={filter === f}
            disabled={disabled}
            onClick={() => onFilterChange(f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>
      <p className="ops-filters__note">
        Filters apply to shops loaded on this page only. Search queries the full catalogue.
      </p>
    </div>
  );
}
