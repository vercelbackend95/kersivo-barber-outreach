import { useEffect, useRef, useState } from 'react';
import type { StorefrontProduct } from '@/lib/shop/storefrontCatalog';
import { ShoppingBag } from '../../lucide-react';

type StorefrontAddToBagButtonProps = {
  product: Pick<StorefrontProduct, 'id' | 'name' | 'pricePence' | 'image' | 'available' | 'requiresOptions'>;
  href: string;
  addToBagLabel: string;
  addedLabel: string;
  chooseOptionsLabel: string;
  soldOutLabel: string;
  className?: string;
  quantity?: number;
  showIcon?: boolean;
};

const ADDED_HOLD_MS = 1100;
const MORPH_MS = 180;

export default function StorefrontAddToBagButton({
  product,
  href,
  addToBagLabel,
  addedLabel,
  chooseOptionsLabel,
  soldOutLabel,
  className = '',
  quantity = 1,
  showIcon = false,
}: StorefrontAddToBagButtonProps) {
  const [added, setAdded] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (product.requiresOptions) {
    return (
      <a className={`sf-atc sf-atc--options ${className}`.trim()} href={href}>
        {chooseOptionsLabel}
      </a>
    );
  }

  if (!product.available) {
    return (
      <button type="button" className={`sf-atc sf-atc--sold ${className}`.trim()} disabled>
        {soldOutLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`sf-atc ${showIcon ? 'sf-atc--icon' : ''} ${added ? 'is-added' : ''} ${className}`.trim()}
      data-add-to-cart=""
      data-product-id={product.id}
      data-product-name={product.name}
      data-product-price-pence={String(product.pricePence)}
      data-product-image-url={product.image.src}
      data-product-quantity={String(quantity)}
      data-atc-label={addToBagLabel}
      aria-label={`${addToBagLabel}: ${product.name}`}
      onClick={() => {
        if (added) return;
        setAdded(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setAdded(false), ADDED_HOLD_MS);
      }}
      style={{ transitionDuration: `${MORPH_MS}ms` }}
    >
      {showIcon ? <ShoppingBag width={16} height={16} aria-hidden="true" /> : null}
      {added ? addedLabel : addToBagLabel}
    </button>
  );
}
