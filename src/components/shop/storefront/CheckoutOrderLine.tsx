import ProductMediaFallback from '@/components/shop/storefront/ProductMediaFallback';
import {
  formatCheckoutUnitPrice,
  normalizeCheckoutMedia,
  type CheckoutLineItem,
} from '@/lib/shop/checkoutLineItem';
import type { StorefrontImageFallback } from '@/lib/shop/storefrontTheme';

type CheckoutOrderLineProps = {
  item: CheckoutLineItem;
  shopName: string;
  imageFallback?: StorefrontImageFallback;
  formatPrice: (pence: number) => string;
  maxQuantity?: number;
  disabled?: boolean;
  showLineTotal?: boolean;
  onDecrease?: () => void;
  onIncrease?: () => void;
};

export default function CheckoutOrderLine({
  item,
  shopName,
  imageFallback = 'wordmark',
  formatPrice,
  maxQuantity,
  disabled = false,
  showLineTotal = false,
  onDecrease,
  onIncrease,
}: CheckoutOrderLineProps) {
  const media = normalizeCheckoutMedia({
    imageUrl: item.imageUrl,
    name: item.name,
    imageAlt: item.imageAlt,
  });
  const unitLabel = formatCheckoutUnitPrice(item.unitPrice, formatPrice);
  const steppers = typeof onDecrease === 'function' && typeof onIncrease === 'function';

  return (
    <li className="checkout-line">
      <div className="checkout-line-media">
        <ProductMediaFallback
          image={{ src: media.src, alt: media.alt, width: 160, height: 160 }}
          name={item.name}
          shopName={shopName}
          fallback={imageFallback}
          sizes="80px"
          className="checkout-line-media-inner"
          decorative={false}
        />
      </div>
      <div className="checkout-line-copy">
        <p className="checkout-line-name">{item.name}</p>
        {item.variant ? <p className="checkout-line-variant">{item.variant}</p> : null}
        <p className="checkout-line-meta">
          {item.quantity} × {unitLabel}
        </p>
        {showLineTotal ? (
          <p className="checkout-line-total">{formatPrice(item.unitPrice * item.quantity)}</p>
        ) : null}
      </div>
      {steppers ? (
        <div className="checkout-line-qty bl-qty" role="group" aria-label={`Quantity for ${item.name}`}>
          <button
            type="button"
            className="bl-qty-btn checkout-line-qty-btn"
            aria-label={`Decrease quantity of ${item.name}`}
            disabled={disabled}
            onClick={onDecrease}
          >
            −
          </button>
          <span className="bl-qty-value checkout-line-qty-value">{item.quantity}</span>
          <button
            type="button"
            className="bl-qty-btn checkout-line-qty-btn"
            aria-label={`Increase quantity of ${item.name}`}
            disabled={disabled || (typeof maxQuantity === 'number' && item.quantity >= maxQuantity)}
            onClick={onIncrease}
          >
            +
          </button>
        </div>
      ) : null}
    </li>
  );
}
