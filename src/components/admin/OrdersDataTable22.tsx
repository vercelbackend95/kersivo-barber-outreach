import React, { useMemo, useState } from 'react';
import EmptyState from '../EmptyState';
import { Package, ShoppingBag } from '../lucide-react';
import StatusBadge from './StatusBadge';
import { getStatusLabel } from './bookingStatus';

type OrderListItem = {
  id: string;
  orderNumber?: string | null;
  customerName?: string | null;
  customerEmail: string;
  status: 'PENDING' | 'PAID' | 'COLLECTED';
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
  status: 'PENDING' | 'PAID' | 'COLLECTED';
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

function getOrderNumberLabel(order: Pick<OrderListItem, 'orderNumber' | 'id'>): string {
  return order.orderNumber ?? `${order.id.slice(0, 8)}…`;
}


const emptyTitle = (msg: string) =>
  msg === 'No orders yet.' ? 'No orders yet' : 'No orders match your search';

const emptyDesc = (msg: string) =>
  msg === 'No orders yet.'
    ? 'Orders will appear here when customers checkout.'
    : "Try a different search term to find what you're looking for.";

type SortColumn = 'orderNumber' | 'total' | 'status' | 'items';
type SortDir = 'asc' | 'desc';

const STATUS_SORT_ORDER: Record<string, number> = { PENDING: 0, PAID: 1, COLLECTED: 2 };

export default function OrdersDataTable22({
  orders,
  isMobileView,
  expandedOrderId,
  onToggleExpand,
  orderDetailsById,
  orderDetailsLoadingId,
  onMarkCollected,
  ordersUnauthorized,
  emptyMessage = 'No orders yet.',
}: OrdersDataTable22Props) {
  const isEmpty = !ordersUnauthorized && orders.length === 0;

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }

  function getSortAttr(col: SortColumn): 'asc' | 'desc' | 'none' {
    if (sortColumn !== col) return 'none';
    return sortDir;
  }

  function getAriaSort(col: SortColumn): 'ascending' | 'descending' | 'none' {
    if (sortColumn !== col) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  const sortedOrders = useMemo(() => {
    if (!sortColumn) return orders;
    return [...orders].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'orderNumber') {
        cmp = getOrderNumberLabel(a).localeCompare(getOrderNumberLabel(b));
      } else if (sortColumn === 'total') {
        cmp = a.totalPence - b.totalPence;
      } else if (sortColumn === 'status') {
        cmp = (STATUS_SORT_ORDER[a.status] ?? 0) - (STATUS_SORT_ORDER[b.status] ?? 0);
      } else if (sortColumn === 'items') {
        cmp = a._count.items - b._count.items;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, sortColumn, sortDir]);

  const pendingCount   = orders.filter((o) => o.status === 'PENDING').length;
  const paidCount      = orders.filter((o) => o.status === 'PAID').length;
  const collectedCount = orders.filter((o) => o.status === 'COLLECTED').length;

  return (
    <section className="admin-orders-table22" aria-label="Orders table">

      {/* ── Status pipeline summary ── */}
      {!isEmpty && (
        <div className="admin-orders-table22__pipeline" aria-label="Order status summary">
          <span className="admin-orders-table22__pipeline-step">
            <StatusBadge status="PENDING" variant="dot" size="sm" />
            <span className="admin-orders-table22__pipeline-count">{pendingCount}</span>
          </span>

          <span className="admin-orders-table22__pipeline-arrow" aria-hidden="true">→</span>

          <span className="admin-orders-table22__pipeline-step">
            <StatusBadge status="PAID" variant="dot" size="sm" />
            <span className="admin-orders-table22__pipeline-count">{paidCount}</span>
          </span>

          <span className="admin-orders-table22__pipeline-arrow" aria-hidden="true">→</span>

          <span className="admin-orders-table22__pipeline-step">
            <StatusBadge status="COLLECTED" variant="dot" size="sm" />
            <span className="admin-orders-table22__pipeline-count">{collectedCount}</span>
          </span>
        </div>
      )}

      {/* ── Desktop table ── */}
      <div className="admin-table-wrap admin-orders-table22__table-wrap">
        <table className="admin-table admin-orders-table22__table">
          <thead>
            <tr>
              <th aria-label="Expand row" style={{ width: '3rem' }} />
              <th
                data-sort={getSortAttr('orderNumber')}
                aria-sort={getAriaSort('orderNumber')}
                onClick={() => handleSort('orderNumber')}
              >
                Order #
              </th>
              <th>{/* TODO: add sort by customer name if needed */}Customer</th>
              <th
                className="col-num"
                data-sort={getSortAttr('total')}
                aria-sort={getAriaSort('total')}
                onClick={() => handleSort('total')}
              >
                Total
              </th>
              <th
                data-sort={getSortAttr('status')}
                aria-sort={getAriaSort('status')}
                onClick={() => handleSort('status')}
              >
                Status
              </th>
              <th
                className="col-num"
                data-sort={getSortAttr('items')}
                aria-sort={getAriaSort('items')}
                onClick={() => handleSort('items')}
              >
                Items
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={ShoppingBag}
                    title={emptyTitle(emptyMessage)}
                    description={emptyDesc(emptyMessage)}
                    variant={emptyMessage !== 'No orders yet.' ? 'filtered' : undefined}
                  />
                </td>
              </tr>
            ) : (
              sortedOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const detail = orderDetailsById[order.id];
                const isDetailLoading = orderDetailsLoadingId === order.id && !detail;

                return (
                  <React.Fragment key={order.id}>
                    <tr
                      className={
                        isExpanded
                          ? 'admin-orders-table22__row admin-orders-table22__row--expanded'
                          : 'admin-orders-table22__row'
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="admin-orders-table22__expand"
                          onClick={() => onToggleExpand(order.id)}
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded ? `Collapse order ${order.id}` : `Expand order ${order.id}`
                          }
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                      </td>
                      <td className="admin-order-number-cell" title={order.orderNumber ?? order.id}>
                        {getOrderNumberLabel(order)}
                      </td>
                      <td
                        className="admin-orders-table22__customer admin-customer-cell"
                        title={order.customerEmail}
                      >
                        <span className="admin-customer-cell__name">
                          {order.customerName || order.customerEmail}
                        </span>
                        {order.customerName ? (
                          <span className="admin-customer-cell__email muted">
                            {order.customerEmail}
                          </span>
                        ) : null}
                      </td>
                      <td className="col-num">{formatPrice(order.totalPence)}</td>
                      <td>
                        <StatusBadge status={order.status} variant="dot" size="sm" />
                      </td>
                      <td className="col-num">{order._count.items}</td>
                      <td>
                        {order.status === 'PAID' ? (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => onMarkCollected(order.id)}
                            title="Mark as Collected"
                          >
                            <Package width={14} height={14} aria-hidden="true" />
                            Mark as Collected
                          </button>
                        ) : null}
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="admin-orders-table22__details-row">
                        <td colSpan={7}>
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

      {/* ── Mobile card list ── */}
      <div className="admin-card-list" role="list" aria-label="Orders list">
        {isEmpty ? (
          <EmptyState
            icon={ShoppingBag}
            title={emptyTitle(emptyMessage)}
            description={emptyDesc(emptyMessage)}
            variant={emptyMessage !== 'No orders yet.' ? 'filtered' : undefined}
          />
        ) : (
          sortedOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const detail = orderDetailsById[order.id];
            const isDetailLoading = orderDetailsLoadingId === order.id && !detail;

            return (
              <article key={order.id} className="admin-card" role="listitem">
                <div className="admin-card__header">
                  <div className="admin-card__title-wrap" title={order.customerEmail}>
                    <p className="admin-card__title">
                      {order.customerName || order.customerEmail}
                    </p>
                    {order.customerName ? (
                      <p className="admin-card__subtitle muted">{order.customerEmail}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={order.status} variant="pill" size="sm" />
                </div>

                <dl className="admin-card__dl">
                  <dt className="admin-card__dt">Order #</dt>
                  <dd className="admin-card__dd admin-order-number-cell">
                    {getOrderNumberLabel(order)}
                  </dd>
                  <dt className="admin-card__dt">Total</dt>
                  <dd className="admin-card__dd">{formatPrice(order.totalPence)}</dd>
                  <dt className="admin-card__dt">Status</dt>
                  <dd className="admin-card__dd">{getStatusLabel(order.status)}</dd>
                  <dt className="admin-card__dt">Items</dt>
                  <dd className="admin-card__dd">{order._count.items}</dd>
                  <dt className="admin-card__dt">Created</dt>
                  <dd className="admin-card__dd">{formatDate(order.createdAt)}</dd>
                </dl>

                <div className="admin-card__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onToggleExpand(order.id)}
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded ? `Collapse order ${order.id}` : `Expand order ${order.id}`
                    }
                  >
                    {isExpanded ? 'Hide details ▲' : 'Show details ▼'}
                  </button>

                  {order.status === 'PAID' ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onMarkCollected(order.id)}
                      title="Mark as Collected"
                    >
                      <Package width={14} height={14} aria-hidden="true" />
                      Mark as Collected
                    </button>
                  ) : null}
                </div>

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
              <strong>Created:</strong> {formatDate(detail.createdAt)}
            </p>
            <p>
              <strong>Paid:</strong> {formatDate(detail.paidAt)}
            </p>
            <p>
              <strong>Collected:</strong> {formatDate(detail.collectedAt)}
            </p>
          </div>

          <div className="admin-table-wrap admin-products-table-wrap">
            <table className="admin-table admin-orders-table22__subtable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="col-num">Unit price</th>
                  <th className="col-num">Qty</th>
                  <th className="col-num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nameSnapshot}</td>
                    <td className="col-num">{formatPrice(item.unitPricePenceSnapshot)}</td>
                    <td className="col-num">{item.quantity}</td>
                    <td className="col-num">{formatPrice(item.lineTotalPence)}</td>
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
