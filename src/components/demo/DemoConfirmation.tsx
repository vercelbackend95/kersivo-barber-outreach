import { useEffect, useMemo, useState } from 'react';
import { BLACKLINE_CONFIRMATION_STORAGE_KEY } from '@/lib/demo/products';
import { formatDemoPriceGbp } from '@/lib/demo/services';
import { buildBlacklineRetailHref } from '@/lib/admin/demoConfig';
import {
  getBlacklineSessionOrder,
  type BlacklineConfirmationSnapshot,
} from '@/lib/demo/blacklineSessionOrders';

const DASHBOARD_CTA = 'See your order in the dashboard';

function readConfirmationSnapshot(): BlacklineConfirmationSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(BLACKLINE_CONFIRMATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Partial<BlacklineConfirmationSnapshot>;
    if (typeof row.orderId === 'string' && row.orderId.trim()) {
      const stored = getBlacklineSessionOrder(row.orderId);
      if (stored) {
        return {
          orderId: stored.id,
          reference: stored.reference,
          items: stored.items,
          totalPence: stored.totalPence,
          collectionMethod: stored.collectionMethod,
          createdAt: stored.createdAt,
        };
      }
    }
    if (!Array.isArray(row.items) || typeof row.totalPence !== 'number') return null;
    return {
      orderId: typeof row.orderId === 'string' ? row.orderId : '',
      reference: typeof row.reference === 'string' ? row.reference : '',
      items: row.items,
      totalPence: row.totalPence,
      collectionMethod: 'Collect in shop',
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    };
  } catch {
    return null;
  }
}

export default function DemoConfirmation() {
  const [order, setOrder] = useState<BlacklineConfirmationSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrder(readConfirmationSnapshot());
    setReady(true);
  }, []);

  const dashboardHref = useMemo(() => {
    if (!order?.orderId) return null;
    return buildBlacklineRetailHref({
      section: 'shop_orders',
      orderId: order.orderId,
      demoJourney: true,
    });
  }, [order?.orderId]);

  if (!ready) {
    return <p className="bl-checkout-copy">Loading demo confirmation…</p>;
  }

  if (!order) {
    return (
      <div className="bl-checkout-empty">
        <h2 className="bl-bag-empty-heading">YOUR BAG IS EMPTY.</h2>
        <p className="bl-checkout-copy">No demo confirmation is waiting in this browser session.</p>
        <a className="bl-btn bl-btn--primary" href="/demo/shop">
          Back to shop
        </a>
      </div>
    );
  }

  return (
    <section className="bl-confirm-panel" aria-label="Demo order summary">
      {order.reference ? (
        <p className="bl-confirm-reference">
          Demo reference <span>{order.reference}</span>
        </p>
      ) : null}
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
        <span>Total</span>
        <span>{formatDemoPriceGbp(order.totalPence)}</span>
      </p>
      <p className="bl-confirm-method">Collection: {order.collectionMethod}</p>
      <p className="bl-confirm-safety">
        No real payment, order or email was created. This demo stays in this browser session only.
      </p>
      <div className="bl-confirm-actions">
        {dashboardHref ? (
          <a className="bl-btn bl-btn--primary" href={dashboardHref}>
            {DASHBOARD_CTA}
          </a>
        ) : null}
        <a className="bl-btn bl-btn--secondary" href="/demo/shop">
          Back to shop
        </a>
      </div>
    </section>
  );
}
