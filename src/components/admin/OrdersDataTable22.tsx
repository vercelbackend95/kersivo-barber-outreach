import { type MouseEvent, type ReactNode, type SVGProps, useMemo, useState } from 'react';
import EmptyState from '../EmptyState';
import { ChevronDown, ChevronUp, ShoppingBag } from '../lucide-react';

type OrderStatus = 'PAID' | 'READY_FOR_PICKUP' | 'COLLECTED';

type OrderListItem = {
  id: string;
  orderNumber?: string | null;
  customerName?: string | null;
  customerEmail: string;
  status: OrderStatus;
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  isTestOrder?: boolean;
  _count: { items: number };
};

type OrderDetail = {
  id: string;
  orderNumber?: string | null;
  customerName?: string | null;
  customerEmail: string;
  status: OrderStatus;
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  collectedAt: string | null;
  isTestOrder?: boolean;
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
  highlightedOrderId?: string | null;
  walkthroughOrderId?: string | null;
  onOpenClientProfile?: (contact: { email: string; fullName: string }) => void;
  ordersUnauthorized: boolean;
  emptyMessage?: string;
  searchSlot?: ReactNode;
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

const DEMO_CUSTOMERS = [
  { displayName: 'Oliver Reed', email: 'oliver.reed@example.com' },
  { displayName: 'Amelia Clarke', email: 'amelia.clarke@example.com' },
  { displayName: 'Noah Bennett', email: 'noah.bennett@example.com' },
  { displayName: 'Isla Morgan', email: 'isla.morgan@example.com' },
  { displayName: 'Leo Carter', email: 'leo.carter@example.com' },
  { displayName: 'Maya Brooks', email: 'maya.brooks@example.com' },
  { displayName: 'Theo Hughes', email: 'theo.hughes@example.com' },
  { displayName: 'Grace Turner', email: 'grace.turner@example.com' },
];

function getStableIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getCustomerIdentity(order: Pick<OrderListItem, 'id' | 'customerName' | 'customerEmail'>): {
  displayName: string;
  email: string;
} {
  const email = order.customerEmail.trim();
  const storedName = order.customerName?.trim();

  if (storedName) {
    return { displayName: storedName, email };
  }

  if (/^demo\+shop-sales-/i.test(email)) {
    return DEMO_CUSTOMERS[getStableIndex(order.id || email, DEMO_CUSTOMERS.length)];
  }

  const localPart = email.split('@')[0]?.split('+')[0] ?? '';
  const inferredName = toTitleCase(localPart);

  return { displayName: inferredName || 'Customer', email };
}

function getCustomerInitials(order: Pick<OrderListItem, 'id' | 'customerName' | 'customerEmail'>): string {
  const source = getCustomerIdentity(order).displayName;
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

type SortColumn = 'orderNumber' | 'total' | 'status';
type SortDir = 'asc' | 'desc';
type SortState = SortDir | 'none';

const STATUS_SORT_ORDER: Record<string, number> = { PAID: 0, READY_FOR_PICKUP: 1, COLLECTED: 2 };

function getOrderStatusLabel(status: OrderListItem['status']): string {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  return status === 'PAID' ? 'Paid' : 'Collected';
}

function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function OrderStatusDot({ status }: { status: OrderListItem['status'] }) {
  const label = getOrderStatusLabel(status);

  return (
    <span
      className={`aog-status-dot aog-status-dot--${status.toLowerCase()}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function SortIcon({ state }: { state: SortState }) {
  if (state === 'asc') {
    return <ChevronUp className="admin-orders-grid-sort-icon" width={13} height={13} aria-hidden="true" />;
  }

  if (state === 'desc') {
    return <ChevronDown className="admin-orders-grid-sort-icon" width={13} height={13} aria-hidden="true" />;
  }

  return (
    <span className="admin-orders-grid-sort-icon admin-orders-grid-sort-icon--neutral" aria-hidden="true">
      <ChevronUp width={12} height={12} />
      <ChevronDown width={12} height={12} />
    </span>
  );
}

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
  highlightedOrderId = null,
  walkthroughOrderId = null,
  onOpenClientProfile,
  ordersUnauthorized,
  emptyMessage = 'No orders yet.',
  searchSlot,
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
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, sortColumn, sortDir]);

  function handleCollectClick(event: MouseEvent<HTMLButtonElement>, orderId: string) {
    event.stopPropagation();
    onMarkCollected(orderId);
  }

  function handleAvatarClick(
    event: MouseEvent<HTMLButtonElement>,
    contact: { email: string; fullName: string },
  ) {
    event.stopPropagation();
    onOpenClientProfile?.(contact);
  }

  return (
    <section className="admin-orders-table22" aria-label="Orders table">
      {/* ── Clients-style grid ── */}
      <div className="admin-orders-grid-wrap" aria-label="Orders">
        {searchSlot}

        {!isEmpty ? (
          <div className="admin-orders-grid-header">
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
                <span className="admin-orders-grid-sort-label">Order / customer</span>
                <SortIcon state={getSortAttr('orderNumber')} />
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
                <span className="admin-orders-grid-sort-label">Total</span>
                <SortIcon state={getSortAttr('total')} />
              </button>
            </span>
            <span
              className="admin-orders-grid-header-cell admin-orders-grid-header-cell--status"
              role="columnheader"
              aria-sort={getAriaSort('status')}
            >
              <button
                type="button"
                className="admin-orders-grid-sort"
                data-sort={getSortAttr('status')}
                onClick={() => handleSort('status')}
                aria-label="Sort by collection"
              >
                <span className="admin-orders-grid-sort-label">Collection</span>
                <SortIcon state={getSortAttr('status')} />
              </button>
            </span>
            <span className="admin-orders-grid-header-cell admin-orders-grid-header-cell--actions">Actions</span>
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
              const customerIdentity = getCustomerIdentity(order);
              const rowLabel = [
                `Order ${orderLabel}`,
                customerIdentity.displayName,
                customerIdentity.email,
                formatPrice(order.totalPence),
                getOrderStatusLabel(order.status),
                formatItemCount(order._count.items),
              ].join(', ');

              return (
                <li
                  key={order.id}
                  id={`admin-order-${order.id}`}
                  data-order-id={order.id}
                  className={[
                    'admin-orders-grid-item',
                    isExpanded ? 'admin-orders-grid-item--expanded' : '',
                    highlightedOrderId === order.id ? 'admin-orders-grid-item--highlight' : '',
                    walkthroughOrderId === order.id ? 'admin-orders-grid-item--walkthrough' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className={
                      isExpanded
                        ? 'admin-orders-grid-row admin-orders-grid-row--expanded'
                        : 'admin-orders-grid-row'
                    }
                    aria-expanded={isExpanded}
                    aria-label={rowLabel}
                    onClick={() => onToggleExpand(order.id)}
                  >
                    <div
                      className="admin-orders-grid-identity"
                      title={`Order ${orderLabel}: ${customerIdentity.displayName} (${customerIdentity.email})`}
                    >
                      <button
                        type="button"
                        className="admin-orders-grid-avatar admin-orders-grid-avatar--btn"
                        onClick={(event) => handleAvatarClick(event, customerIdentity)}
                        aria-label={`View profile for ${customerIdentity.displayName}`}
                        title="View client profile"
                      >
                        <span className="admin-orders-grid-avatar-initials">
                          {getCustomerInitials(order)}
                        </span>
                      </button>
                      <div className="admin-orders-grid-identity__text">
                        <span className="admin-orders-grid-identity__title">
                          <span className="admin-orders-grid-customer">
                            {customerIdentity.displayName}
                          </span>
                          {order.isTestOrder ? (
                            <span className="admin-orders-test-badge">
                              <span className="admin-orders-test-badge__long">TEST ORDER</span>
                              <span className="admin-orders-test-badge__short">TEST</span>
                            </span>
                          ) : null}
                          <span className="admin-orders-grid-identity__meta" aria-hidden="true">
                            <OrderStatusDot status={order.status} />
                          </span>
                        </span>
                        <span className="admin-orders-grid-email">
                          {customerIdentity.email}
                        </span>
                      </div>
                    </div>

                    <span className="admin-orders-grid-total">{formatPrice(order.totalPence)}</span>
                    <span className="admin-orders-grid-status">
                      <OrderStatusDot status={order.status} />
                    </span>
                  </button>

                  <div className="admin-orders-grid-actions">
                    {order.status === 'PAID' ||
                    order.status === 'READY_FOR_PICKUP' ||
                    order.status === 'COLLECTED' ? (
                      <button
                        type="button"
                        className={[
                          'btn btn--ghost btn--sm admin-orders-grid-collect-btn',
                          order.status === 'COLLECTED'
                            ? 'admin-orders-grid-collect-btn--done'
                            : 'admin-orders-grid-collect-btn--pending',
                        ].join(' ')}
                        onClick={
                          order.status === 'COLLECTED'
                            ? undefined
                            : (event) => handleCollectClick(event, order.id)
                        }
                        disabled={order.status === 'COLLECTED'}
                        title={order.status === 'COLLECTED' ? 'Collected' : 'Mark as Collected'}
                        aria-label={
                          order.status === 'COLLECTED'
                            ? `${orderLabel} collected`
                            : `Mark ${orderLabel} as collected`
                        }
                      >
                        <CollectedOrderIcon width={24} height={24} strokeWidth={2.25} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="admin-orders-grid-expand-chevron"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpand(order.id);
                      }}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} order ${orderLabel}`}
                    >
                      <ChevronDown width={15} height={15} aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    className={
                      isExpanded
                        ? 'admin-orders-expand-wrap admin-orders-expand-wrap--open'
                        : 'admin-orders-expand-wrap'
                    }
                    aria-hidden={!isExpanded}
                    inert={!isExpanded ? true : undefined}
                  >
                    <div className="admin-orders-grid-details">
                      <OrderDetailsPanel
                        detail={detail}
                        isDetailLoading={isDetailLoading}
                      />
                    </div>
                  </div>
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
};

function OrderDetailsPanel({
  detail,
  isDetailLoading,
}: OrderDetailsPanelProps) {
  return (
    <div className="admin-orders-table22__details">
      {isDetailLoading ? <p className="muted">Loading order details…</p> : null}

      {!isDetailLoading && detail ? (
        <>
          {detail.isTestOrder ? (
            <p className="admin-orders-test-badge admin-orders-test-badge--panel">
              <span className="admin-orders-test-badge__long">TEST ORDER</span>
              <span className="admin-orders-test-badge__short">TEST</span>
            </p>
          ) : null}
          <div className="admin-orders-table22__meta-grid">
            <p>
              <strong>Created:</strong> {formatDate(detail.createdAt)}
            </p>
            <p>
              <strong>Paid:</strong> {formatDate(detail.paidAt)}
            </p>
            <p>
              <strong>Status:</strong> {getOrderStatusLabel(detail.status)}
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
        </>
      ) : null}
    </div>
  );
}
