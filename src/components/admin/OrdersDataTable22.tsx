import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import EmptyState from '../EmptyState';
import { ChevronDown, ChevronUp, Package, ShoppingBag } from '../lucide-react';

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
  onLoadOrderDetails?: (orderId: string) => void;
  highlightedOrderId?: string | null;
  walkthroughOrderId?: string | null;
  sessionOrderIds?: ReadonlySet<string>;
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

function getCustomerFirstName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  return first || displayName;
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

type SortColumn = 'orderNumber' | 'total';
type SortDir = 'asc' | 'desc';
type SortState = SortDir | 'none';

function getOrderStatusLabel(status: OrderListItem['status']): string {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  return status === 'PAID' ? 'Paid' : 'Collected';
}

function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
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

export default function OrdersDataTable22({
  orders,
  expandedOrderId,
  onToggleExpand,
  orderDetailsById,
  orderDetailsLoadingId,
  onMarkCollected,
  onLoadOrderDetails,
  highlightedOrderId = null,
  walkthroughOrderId = null,
  sessionOrderIds,
  onOpenClientProfile,
  ordersUnauthorized,
  emptyMessage = 'No orders yet.',
  searchSlot,
}: OrdersDataTable22Props) {
  const isEmpty = !ordersUnauthorized && orders.length === 0;

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);

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
    const statusRank = (status: OrderListItem['status']) => (status === 'COLLECTED' ? 1 : 0);

    return [...orders].sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;

      if (!sortColumn) return 0;

      let cmp = 0;
      if (sortColumn === 'orderNumber') {
        cmp = getOrderNumberLabel(a).localeCompare(getOrderNumberLabel(b));
      } else if (sortColumn === 'total') {
        cmp = a.totalPence - b.totalPence;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, sortColumn, sortDir]);

  function handleCollectClick(event: MouseEvent<HTMLButtonElement>, orderId: string) {
    event.stopPropagation();
    setConfirmOrderId(orderId);
    if (!orderDetailsById[orderId]) {
      onLoadOrderDetails?.(orderId);
    }
  }

  function closeCollectConfirm() {
    setConfirmOrderId(null);
  }

  function confirmCollect() {
    if (!confirmOrderId) return;
    onMarkCollected(confirmOrderId);
    setConfirmOrderId(null);
  }

  useEffect(() => {
    if (!confirmOrderId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmOrderId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOrderId]);

  const confirmOrder = useMemo(
    () => (confirmOrderId ? orders.find((order) => order.id === confirmOrderId) ?? null : null),
    [confirmOrderId, orders],
  );
  const confirmIdentity = confirmOrder ? getCustomerIdentity(confirmOrder) : null;
  const confirmDetail = confirmOrderId ? orderDetailsById[confirmOrderId] : undefined;
  const confirmDetailLoading = Boolean(
    confirmOrderId && orderDetailsLoadingId === confirmOrderId && !confirmDetail,
  );

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
              const isSessionOrder = Boolean(sessionOrderIds?.has(order.id));
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
                  data-session-order={isSessionOrder ? 'true' : undefined}
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
                        onClick={(event) =>
                          handleAvatarClick(event, {
                            email: customerIdentity.email,
                            fullName: customerIdentity.displayName,
                          })
                        }
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
                            {getCustomerFirstName(customerIdentity.displayName)}
                          </span>
                          {isSessionOrder ? (
                            <span className="admin-orders-test-badge">
                              <span className="admin-orders-test-badge__long">YOUR DEMO ORDER</span>
                              <span className="admin-orders-test-badge__short">YOURS</span>
                            </span>
                          ) : order.isTestOrder ? (
                            <span className="admin-orders-test-badge">
                              <span className="admin-orders-test-badge__long">TEST ORDER</span>
                              <span className="admin-orders-test-badge__short">TEST</span>
                            </span>
                          ) : null}
                        </span>
                        <span className="admin-orders-grid-email">
                          {customerIdentity.email}
                        </span>
                      </div>
                    </div>

                    <span className="admin-orders-grid-total">{formatPrice(order.totalPence)}</span>
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
                        <Package width={24} height={24} strokeWidth={2.25} aria-hidden="true" />
                      </button>
                    ) : null}
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

      {confirmOrder && confirmIdentity && typeof document !== 'undefined'
        ? createPortal(
            <div className="admin-product-delete-confirm-layer" role="presentation">
              <button
                type="button"
                className="admin-product-delete-confirm-backdrop"
                onClick={closeCollectConfirm}
                aria-label="Close confirmation dialog"
              />
              <div
                className="admin-product-delete-confirm-dialog admin-collect-receipt-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="collect-order-confirm-title"
                aria-describedby="collect-order-confirm-body"
              >
                <h4 id="collect-order-confirm-title" className="admin-product-delete-confirm-title">
                  Mark as collected?
                </h4>
                <div id="collect-order-confirm-body" className="admin-product-delete-confirm-body">
                  <div className="admin-collect-receipt__customer">
                    <p className="admin-collect-receipt__customer-name">{confirmIdentity.displayName}</p>
                    <p className="admin-collect-receipt__customer-email">{confirmIdentity.email}</p>
                  </div>

                  <div className="admin-collect-receipt">
                    <p className="admin-collect-receipt__eyebrow">
                      Order {getOrderNumberLabel(confirmOrder)}
                    </p>

                    {confirmDetailLoading ? (
                      <p className="admin-collect-receipt__loading">Loading receipt…</p>
                    ) : null}

                    {!confirmDetailLoading && confirmDetail ? (
                      <>
                        <ul className="admin-collect-receipt__items">
                          {confirmDetail.items.map((item) => (
                            <li key={item.id} className="admin-collect-receipt__item">
                              <span className="admin-collect-receipt__item-name">
                                {item.nameSnapshot}
                                <span className="admin-collect-receipt__item-qty"> × {item.quantity}</span>
                              </span>
                              <span className="admin-collect-receipt__item-price">
                                {formatPrice(item.lineTotalPence)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="admin-collect-receipt__total">
                          <span>Total</span>
                          <span>{formatPrice(confirmDetail.totalPence)}</span>
                        </div>
                      </>
                    ) : null}

                    {!confirmDetailLoading && !confirmDetail ? (
                      <div className="admin-collect-receipt__total">
                        <span>Total</span>
                        <span>{formatPrice(confirmOrder.totalPence)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-product-delete-confirm-actions">
                  <button type="button" className="btn btn--secondary" onClick={closeCollectConfirm}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn--primary" onClick={confirmCollect}>
                    Confirm
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
