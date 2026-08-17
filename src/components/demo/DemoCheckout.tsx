import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import {
  BLACKLINE_CONFIRMATION_STORAGE_KEY,
  BLACKLINE_MAX_QUANTITY,
  BLACKLINE_SHOP_ID,
  DEMO_PRODUCT_IDS,
} from '@/lib/demo/products';
import { formatDemoPriceGbp } from '@/lib/demo/services';
import { DEMO_HOURS, DEMO_LOCATION } from '@/lib/demo/site';
import { navigateDemoPath } from '@/lib/demo/clientNavigate';
import {
  bindCartNamespace,
  clear,
  getServerSnapshot,
  getSnapshot,
  setQuantity,
  subscribe,
} from '@/lib/shop/cartStore';

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function DemoCheckout() {
  const { items, subtotalPence } = useCartSnapshot();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false);
  const errorId = useId();

  useEffect(() => {
    bindCartNamespace({ shopId: BLACKLINE_SHOP_ID, allowedProductIds: DEMO_PRODUCT_IDS });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (lockRef.current || submitting) return;
    setError(null);

    if (items.length === 0) {
      setError('Your bag is empty. Add products before completing the demo.');
      return;
    }

    lockRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch('/api/demo/shop/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; order?: unknown }
        | null;

      if (!response.ok || !payload?.order) {
        throw new Error(payload?.error || 'Unable to complete the demo order.');
      }

      window.sessionStorage.setItem(BLACKLINE_CONFIRMATION_STORAGE_KEY, JSON.stringify(payload.order));
      clear();
      await navigateDemoPath('/demo/shop/confirmation');
    } catch (err) {
      lockRef.current = false;
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Unable to complete the demo order.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="bl-checkout-empty">
        <h2 className="bl-bag-empty-heading">YOUR BAG IS EMPTY.</h2>
        <a className="bl-btn bl-btn--primary" href="/demo/shop">
          RETURN TO THE SHOP →
        </a>
      </div>
    );
  }

  return (
    <form className="bl-checkout-grid" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="bl-checkout-details">
        <p className="bl-checkout-kicker">Collection</p>
        <h2 className="bl-checkout-subhead">In-shop pickup.</h2>
        <p className="bl-checkout-copy">
          This demo order is for collection at {DEMO_LOCATION}. No delivery is offered and no time is
          guaranteed.
        </p>
        <dl className="bl-checkout-facts">
          <div>
            <dt>Method</dt>
            <dd>Collect in shop</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>
              {DEMO_HOURS.map((row) => (
                <span key={row.days}>
                  {row.days} {row.hours}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <p className="bl-checkout-safety">DEMO CHECKOUT · NO PAYMENT WILL BE TAKEN</p>
      </div>

      <aside className="bl-checkout-summary">
        <p className="bl-checkout-kicker">Order summary</p>
        <ul className="bl-checkout-lines">
          {items.map((item) => (
            <li key={item.productId}>
              <span>{item.name}</span>
              <span>
                {item.quantity} × {formatDemoPriceGbp(item.pricePence)}
              </span>
              <div className="bl-qty" role="group" aria-label={`Quantity for ${item.name}`}>
                <button
                  type="button"
                  className="bl-qty-btn"
                  aria-label={`Decrease quantity of ${item.name}`}
                  disabled={submitting}
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                >
                  −
                </button>
                <span className="bl-qty-value">{item.quantity}</span>
                <button
                  type="button"
                  className="bl-qty-btn"
                  aria-label={`Increase quantity of ${item.name}`}
                  disabled={submitting || item.quantity >= BLACKLINE_MAX_QUANTITY}
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="bl-bag-subtotal">
          <span>Subtotal</span>
          <span>{formatDemoPriceGbp(subtotalPence)}</span>
        </p>
        {error ? (
          <p className="bl-checkout-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="bl-btn bl-btn--primary bl-checkout-submit"
          disabled={submitting}
          aria-busy={submitting}
          aria-describedby={error ? errorId : undefined}
        >
          {submitting ? 'Completing demo order…' : 'COMPLETE DEMO ORDER →'}
        </button>
      </aside>
    </form>
  );
}
