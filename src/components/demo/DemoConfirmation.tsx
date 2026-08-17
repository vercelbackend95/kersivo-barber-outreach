import { useEffect, useState } from 'react';
import { BLACKLINE_CONFIRMATION_STORAGE_KEY } from '@/lib/demo/products';
import { formatDemoPriceGbp } from '@/lib/demo/services';
import type { BlacklineDemoOrderSnapshot } from '@/lib/demo/shopOrder';

export default function DemoConfirmation() {
  const [order, setOrder] = useState<BlacklineDemoOrderSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(BLACKLINE_CONFIRMATION_STORAGE_KEY);
      if (raw) {
        setOrder(JSON.parse(raw) as BlacklineDemoOrderSnapshot);
      }
    } catch {
      setOrder(null);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <p className="bl-checkout-copy">Loading demo confirmation…</p>;
  }

  if (!order) {
    return (
      <div className="bl-checkout-empty">
        <h2 className="bl-bag-empty-heading">YOUR BAG IS EMPTY.</h2>
        <p className="bl-checkout-copy">No demo confirmation is waiting in this browser session.</p>
        <a className="bl-btn bl-btn--primary" href="/demo/shop">
          RETURN TO THE SHOP →
        </a>
      </div>
    );
  }

  return (
    <section className="bl-confirm-panel" aria-label="Demo order summary">
      <ul className="bl-checkout-lines">
        {order.items.map((item) => (
          <li key={`${item.productId}-${item.quantity}`}>
            <span>{item.name}</span>
            <span>
              {item.quantity} × {formatDemoPriceGbp(item.unitPricePence)}
            </span>
            <span>{formatDemoPriceGbp(item.lineTotalPence)}</span>
          </li>
        ))}
      </ul>
      <p className="bl-bag-subtotal">
        <span>Subtotal</span>
        <span>{formatDemoPriceGbp(order.totalPence)}</span>
      </p>
      <p className="bl-confirm-method">Collection: {order.collectionMethod}</p>
      <a className="bl-btn bl-btn--primary" href="/demo/shop">
        RETURN TO THE SHOP →
      </a>
    </section>
  );
}
