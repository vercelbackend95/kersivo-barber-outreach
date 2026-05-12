import { type SVGProps, useMemo, useState } from 'react';
import EmptyState from '../EmptyState';
import { ShoppingBag } from '../lucide-react';
import StatusBadge from './StatusBadge';

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

function getOrderNumberLabel(order: Pick<OrderListItem, 'orderNumber' | 'id'>): string {
  return order.orderNumber ?? `${order.id.slice(0, 8)}…`;
}

function getCustomerInitials(order: Pick<OrderListItem, 'customerName' | 'customerEmail'>): string {
  const source = order.customerName || order.customerEmail;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}


const emptyTitle = (msg: string) =>
  msg === 'No orders yet.' ? 'No orders yet' : 'No orders match your search';

const emptyDesc = (msg: string) =>
  msg === 'No orders yet.'
    ? 'Orders will appear here when customers checkout.'
    : "Try a different search term to find what you're looking for.";

type SortColumn = 'orderNumber' | 'total' | 'status' | 'items';
type SortDir = 'asc' | 'desc';

const STATUS_SORT_ORDER: Record<string, number> = { PAID: 0, COLLECTED: 1 };

function CollectedOrderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 1.28.25" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="m15 18 2 2 4-5" />
    </svg>
  );
}

export default function OrdersDataTable22({
  orders,
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

  const paidCount      = orders.filter((o) => o.status === 'PAID').length;
  const collectedCount = orders.filter((o) => o.status === 'COLLECTED').length;

  return (
    <section className="admin-orders-table22" aria-label="Orders table">

      {/* ── Status pipeline summary ── */}
      {!isEmpty && (
        <div className="admin-orders-table22__pipeline" aria-label="Order status summary">
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

      {/* ── Clients-style grid ── */}
      <div className="admin-orders-grid-wrap" aria-label="Orders">
        {!isEmpty ? (
          <div className="admin-orders-grid-header">
            <span aria-label="Expand row" />
            <span
              className="admin-orders-grid-header-cell admin-orders-grid-header-cell--identity"
              role="columnheader"
              aria-sort={getAriaSort('orderNumber')}
            >
              <button
                type="button"
                className="admin-orders-grid-sort"
                data-sort={getSortAttr('orderNumber')}
                onClick={() => handleSort('orderNumber')}
              >
                Order / customer
              </button>
            </span>
            <span
              className="admin-orders-grid-header-cell admin-orders-grid-header-cell--total"
              role="columnheader"
              aria-sort={getAriaSort('total')}
            >
              <button
                type="button"
                className="admin-orders-grid-sort"
                data-sort={getSortAttr('total')}
                onClick={() => handleSort('total')}
              >
                Total
              </button>
            </span>
            <span
              className="admin-orders-grid-header-cell"
              role="columnheader"
              aria-sort={getAriaSort('status')}
            >
              <button
                type="button"
                className="admin-orders-grid-sort"
                data-sort={getSortAttr('status')}
                onClick={() => handleSort('status')}
              >
                Status
              </button>
            </span>
            <span
              className="admin-orders-grid-header-cell admin-orders-grid-header-cell--items"
              role="columnheader"
              aria-sort={getAriaSort('items')}
            >
              <button
                type="button"
                className="admin-orders-grid-sort"
                data-sort={getSortAttr('items')}
                onClick={() => handleSort('items')}
              >
                Items
              </button>
            </span>
            <span className="admin-orders-grid-header-cell">Actions</span>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="admin-orders-grid-empty">
            <EmptyState
              icon={ShoppingBag}
              title={emptyTitle(emptyMessage)}
              description={emptyDesc(emptyMessage)}
              variant={emptyMessage !== 'No orders yet.' ? 'filtered' : undefined}
            />
          </div>
        ) : (
          <ul className="admin-orders-grid-list" role="list">
            {sortedOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const detail = orderDetailsById[order.id];
              const isDetailLoading = orderDetailsLoadingId === order.id && !detail;
              const orderLabel = getOrderNumberLabel(order);

              return (
                <li
                  key={order.id}
                  className={
                    isExpanded
                      ? 'admin-orders-grid-item admin-orders-grid-item--expanded'
                      : 'admin-orders-grid-item'
                  }
                >
                  <div className="admin-orders-grid-row">
                    <div className="admin-orders-grid-leading">
                      <button
                        type="button"
                        className="admin-orders-table22__expand"
                        onClick={() => onToggleExpand(order.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Collapse order ${orderLabel}` : `Expand order ${orderLabel}`}
                      >
                        {isExpanded ? '−' : '+'}
                      </button>
                      <span className="admin-orders-grid-avatar" aria-hidden="true">
                        <span className="admin-orders-grid-avatar-initials">
                          {getCustomerInitials(order)}
                        </span>
                      </span>
                    </div>

                    <div className="admin-orders-grid-identity" title={order.customerEmail}>
                      <span className="admin-orders-grid-order admin-order-number-cell" title={order.orderNumber ?? order.id}>
                        {orderLabel}
                      </span>
                      <span className="admin-orders-grid-customer">
                        {order.customerName || order.customerEmail}
                      </span>
                      {order.customerName ? (
                        <span className="admin-orders-grid-email">
                          {order.customerEmail}
                        </span>
                      ) : null}
                    </div>

                    <span className="admin-orders-grid-total">{formatPrice(order.totalPence)}</span>
                    <span className="admin-orders-grid-status">
                      <StatusBadge status={order.status} variant="dot" size="sm" />
                    </span>
                    <span className="admin-orders-grid-items">{order._count.items}</span>
                    <div className="admin-orders-grid-actions">
                      {order.status === 'PAID' ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm admin-orders-grid-collect-btn"
                          onClick={() => onMarkCollected(order.id)}
                          title="Mark as Collected"
                          aria-label={`Mark ${orderLabel} as collected`}
                        >
                          <CollectedOrderIcon width={32} height={32} strokeWidth={2.6} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="admin-orders-grid-action-empty" aria-hidden="true">—</span>
                      )}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="admin-orders-grid-details">
                      <OrderDetailsPanel
                        detail={detail}
                        isDetailLoading={isDetailLoading}
                        onMarkCollected={onMarkCollected}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
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

          <div className="admin-orders-details-table-wrap">
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
