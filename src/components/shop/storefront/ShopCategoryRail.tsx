import type { StorefrontCategoryOption } from '@/lib/shop/storefrontCatalog';
import { STOREFRONT_ALL_CATEGORY } from '@/lib/shop/storefrontCatalog';

type ShopCategoryRailProps = {
  options: StorefrontCategoryOption[];
  selected: string;
  onSelect: (category: string) => void;
};

export default function ShopCategoryRail({ options, selected, onSelect }: ShopCategoryRailProps) {
  if (options.length <= 1) return null;

  return (
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
      <span className="sf-sr-only" aria-live="polite">
        {options.find((option) => option.value === selected)?.count ?? 0} products
        {selected !== STOREFRONT_ALL_CATEGORY ? ` in ${options.find((option) => option.value === selected)?.label ?? selected}` : ''}
      </span>
    </div>
  );
}
