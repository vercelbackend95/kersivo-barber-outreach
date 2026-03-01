import React from 'react';

type OrderListItem = {
  id: string;
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
  expandedOrderId: string | null;
  onToggleExpand: (orderId: string) => void;
  orderDetailsById: Record<string, OrderDetail>;
  orderDetailsLoadingId: string | null;
  onMarkCollected: (orderId: string) => void;
  ordersUnauthorized: boolean;
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
  expandedOrderId,
  onToggleExpand,
  orderDetailsById,
  orderDetailsLoadingId,
  onMarkCollected,
  ordersUnauthorized
}: OrdersDataTable22Props) {
  return (
    <section className="admin-orders-table22" aria-label="Orders table">
      <header className="admin-orders-table22__header">
        <h3>Shop orders</h3>
        <p>Track live payment and collection status for each order.</p>
      </header>

      <div className="admin-orders-table22__table-wrap">
        <table className="admin-table admin-orders-table22__table">
          <thead>
            <tr>
              <th aria-label="Expand row" />
              <th>Customer</th>
              <th>Created</th>
              <th>Paid</th>
              <th>Total</th>
              <th>Status</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {!ordersUnauthorized && orders.length === 0 ? (
              <tr>
                <td colSpan={7}>No orders yet.</td>
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
                      <td className="admin-orders-table22__customer">{order.customerEmail}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{formatDate(order.paidAt)}</td>
                      <td>{formatPrice(order.totalPence)}</td>
                      <td>
                        <span className={getStatusClassName(order.status)}>{order.status}</span>
                      </td>
                      <td>{order._count.items}</td>
                    </tr>

                    {isExpanded ? (
                      <tr className="admin-orders-table22__details-row">
                        <td colSpan={7}>
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
    </section>
  );
}
