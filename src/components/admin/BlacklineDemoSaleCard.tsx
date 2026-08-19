import { formatDemoPriceGbp } from '@/lib/demo/services';
import { BLACKLINE_SESSION_SALE_TAG, type BlacklineSessionOrder } from '@/lib/demo/blacklineSessionOrders';

export default function BlacklineDemoSaleCard({ order }: { order: BlacklineSessionOrder }) {
  return (
    <article
      className="blackline-demo-sale-card"
      id={`admin-demo-sale-${order.id}`}
      data-demo-sale-id={order.id}
      aria-labelledby="blackline-demo-sale-title"
    >
      <p className="blackline-demo-sale-card__eyebrow">{BLACKLINE_SESSION_SALE_TAG}</p>
      <h3 id="blackline-demo-sale-title" className="blackline-demo-sale-card__title">
        Paid retail transaction
      </h3>
      <p className="blackline-demo-sale-card__meta">
        Order {order.reference} · {formatDemoPriceGbp(order.totalPence)}
      </p>
      <ul className="blackline-demo-sale-card__items">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.name} × {item.quantity}
          </li>
        ))}
      </ul>
    </article>
  );
}
