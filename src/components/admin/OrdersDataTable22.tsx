import React from 'react';

type OrderListItem = {
  id: string;
    orderNumber?: string | null;
  customerName?: string | null;

  customerEmail: string;
  status: 'PAID' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  _count: { items: number };
};

type OrderDetail = {
  id: string;
    orderNumber?: string | null;
  customerName?: string | null;

  customerEmail: string;
  status: 'PAID' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  collectedAt: string | null;
  items: Array<{
    id: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};

type OrdersDataTable22Props = {
  orders: OrderListItem[];
    isMobileView: boolean;
  expandedOrderId: string | null;
  onToggleExpand: (orderId: string) => void;
  orderDetailsById: Record<string, OrderDetail>;
  orderDetailsLoadingId: string | null;
  onMarkCollected: (orderId: string) => void;
  ordersUnauthorized: boolean;
    emptyMessage?: string;
};

function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB');
}

function getStatusClassName(status: OrderListItem['status']): string {
  return status === 'COLLECTED' ? 'admin-orders-status admin-orders-status--collected' : 'admin-orders-status admin-orders-status--paid';
}

export default function OrdersDataTable22({
  orders,
    isMobileView,
  expandedOrderId,
  onToggleExpand,
  orderDetailsById,
  orderDetailsLoadingId,
  onMarkCollected,
 ordersUnauthorized,
  emptyMessage = 'No orders yet.'
}: OrdersDataTable22Props) {
  return (
    <section className="admin-orders-table22" aria-label="Orders table">
      {!isMobileView ? (
        <div className="admin-orders-table22__table-wrap">
          <table className="admin-table admin-orders-table22__table">
            <thead>

              <tr>
                <th aria-label="Expand row" />
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Items</th>

              </tr>
            </thead>
            <tbody>
              {!ordersUnauthorized && orders.length === 0 ? (
                <tr>
                  <td colSpan={5}>{emptyMessage}</td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const detail = orderDetailsById[order.id];
                  const isDetailLoading = orderDetailsLoadingId === order.id && !detail;

                  return (
                    <React.Fragment key={order.id}>
                      <tr className={isExpanded ? 'admin-orders-table22__row admin-orders-table22__row--expanded' : 'admin-orders-table22__row'}>
                        <td>
                          <button
                            type="button"
                            className="admin-orders-table22__expand"
                            onClick={() => onToggleExpand(order.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Collapse order ${order.id}` : `Expand order ${order.id}`}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                        <td className="admin-orders-table22__customer" title={order.customerEmail}>{order.customerEmail}</td>
                        <td>{formatPrice(order.totalPence)}</td>
                        <td>
                          <span className={getStatusClassName(order.status)}>{order.status}</span>

                        </td>
                                                <td>{order._count.items}</td>
                      </tr>

                      {isExpanded ? (
                        <tr className="admin-orders-table22__details-row">
                          <td colSpan={5}>
                            <OrderDetailsPanel
                              detail={detail}
                              isDetailLoading={isDetailLoading}
                              onMarkCollected={onMarkCollected}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-orders-cards" role="list" aria-label="Orders list">
          {!ordersUnauthorized && orders.length === 0 ? (
            <p className="admin-orders-cards__empty">{emptyMessage}</p>
          ) : (
            orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const detail = orderDetailsById[order.id];
              const isDetailLoading = orderDetailsLoadingId === order.id && !detail;

              return (
                <article key={order.id} className="admin-orders-card" role="listitem">
                  <div className="admin-orders-card__row admin-orders-card__row--top">
                    <p className="admin-orders-card__customer" title={order.customerEmail}>{order.customerEmail}</p>
                    <span className={getStatusClassName(order.status)}>{order.status}</span>
                  </div>
                  <div className="admin-orders-card__row admin-orders-card__row--summary">
                    <p className="admin-orders-card__total">{formatPrice(order.totalPence)}</p>
                    <p className="admin-orders-card__items">Items: {order._count.items}</p>
                  </div>
                  <p className="admin-orders-card__created muted">Created: {formatDate(order.createdAt)}</p>
                  <button
                    type="button"
                    className="admin-orders-card__toggle"
                    onClick={() => onToggleExpand(order.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse order ${order.id}` : `Expand order ${order.id}`}
                  >
                    {isExpanded ? 'Hide details ▲' : 'Show details ▼'}
                  </button>
                  {isExpanded ? (
                    <OrderDetailsPanel
                      detail={detail}
                      isDetailLoading={isDetailLoading}
                      onMarkCollected={onMarkCollected}
                    />
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      )}

    </section>
  );
}

type OrderDetailsPanelProps = {
  detail?: OrderDetail;
  isDetailLoading: boolean;
  onMarkCollected: (orderId: string) => void;
};

function OrderDetailsPanel({ detail, isDetailLoading, onMarkCollected }: OrderDetailsPanelProps) {
  return (
    <div className="admin-orders-table22__details">
      {isDetailLoading ? <p className="muted">Loading order details…</p> : null}

      {!isDetailLoading && detail ? (
        <>
          <div className="admin-orders-table22__meta-grid">
            <p>
              <strong>Email:</strong> {detail.customerEmail}
            </p>
            <p>
              <strong>Created:</strong> {formatDate(detail.createdAt)}
            </p>
            <p>
              <strong>Paid:</strong> {formatDate(detail.paidAt)}
            </p>
            <p>
              <strong>Collected:</strong> {formatDate(detail.collectedAt)}
            </p>
          </div>

          <div className="admin-products-table-wrap">
            <table className="admin-table admin-orders-table22__subtable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nameSnapshot}</td>
                    <td>{formatPrice(item.unitPricePenceSnapshot)}</td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.lineTotalPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.status === 'PAID' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onMarkCollected(detail.id)}
            >
              Mark as collected
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
