import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import EmptyState from '../EmptyState';
import { Check, Package, ShoppingBag } from '../lucide-react';
import AdminDataTable, {
  AdminTableFilters,
  AdminTableIdentity,
  AdminTableToolbar,
  AdminTableStatus,
  type AdminDataTableColumn,
  type AdminDataTableSort,
} from './AdminDataTable';

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
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
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

type SortColumn = 'orderNumber' | 'placed' | 'total';
type SortDir = 'asc' | 'desc';

function getOrderStatusLabel(status: OrderListItem['status']): string {
  if (status === 'READY_FOR_PICKUP') return 'Ready for pickup';
  return status === 'PAID' ? 'Paid' : 'Collected';
}

function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'collected'>('all');

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
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
      } else if (sortColumn === 'placed') {
        cmp = new Date(a.paidAt ?? a.createdAt).getTime() - new Date(b.paidAt ?? b.createdAt).getTime();
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

  const openCount = orders.filter((order) => order.status !== 'COLLECTED').length;
  const visibleOrders =
    statusFilter === 'all'
      ? sortedOrders
      : sortedOrders.filter((order) => (statusFilter === 'collected') === (order.status === 'COLLECTED'));

  const tableSort: AdminDataTableSort | null = sortColumn ? { id: sortColumn, dir: sortDir } : null;

  const columns: AdminDataTableColumn<OrderListItem>[] = [
    {
      id: 'avatar',
      header: '',
      srHeader: 'Customer',
      width: '2.25rem',
      mobile: 'lead',
      cell: (order) => {
        const identity = getCustomerIdentity(order);
        return (
          <button
            type="button"
            className="adt-avatar admin-orders-grid-avatar--btn"
            onClick={(event) => handleAvatarClick(event, { email: identity.email, fullName: identity.displayName })}
            aria-label={`View profile for ${identity.displayName}`}
            title="View client profile"
          >
            {getCustomerInitials(order)}
          </button>
        );
      },
    },
    {
      id: 'customer',
      header: 'Customer',
      width: 'minmax(12rem, 2fr)',
      mobile: 'primary',
      cell: (order) => {
        const identity = getCustomerIdentity(order);
        const isSessionOrder = Boolean(sessionOrderIds?.has(order.id));
        return (
          <AdminTableIdentity
            title={identity.displayName}
            subtitle={identity.email}
            badge={
              isSessionOrder ? (
                <span className="adt-badge adt-badge--brand">Your demo order</span>
              ) : order.isTestOrder ? (
                <span className="adt-badge">Test</span>
              ) : null
            }
          />
        );
      },
    },
    {
      id: 'orderNumber',
      header: 'Order',
      width: 'minmax(8.75rem, 1fr)',
      sortable: true,
      mobile: 'hidden',
      cell: (order) => (
        <span className="adt-identity">
          <span className="adt-num">{getOrderNumberLabel(order)}</span>
          <span className="adt-identity-sub">{formatItemCount(order._count.items)}</span>
        </span>
      ),
    },
    {
      id: 'placed',
      header: 'Placed',
      width: 'minmax(7rem, 0.9fr)',
      sortable: true,
      mobile: 'hidden',
      cell: (order) => <span>{formatShortDate(order.paidAt ?? order.createdAt)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(8rem, 0.9fr)',
      mobile: 'hidden',
      cell: (order) => (
        <AdminTableStatus tone={order.status === 'COLLECTED' ? 'ok' : order.status === 'READY_FOR_PICKUP' ? 'warn' : 'info'}>
          {order.status === 'COLLECTED' ? 'Collected' : order.status === 'READY_FOR_PICKUP' ? 'Ready for pickup' : 'To collect'}
        </AdminTableStatus>
      ),
    },
    {
      id: 'summary',
      header: '',
      width: '0px',
      only: 'narrow',
      mobile: 'meta',
      cell: (order) => (
        <span>
          <span className="adt-num">{formatPrice(order.totalPence)}</span>
          {` · ${formatItemCount(order._count.items)} · ${order.status === 'COLLECTED' ? 'Collected' : 'To collect'}`}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Total',
      width: 'minmax(5.5rem, 0.7fr)',
      align: 'end',
      sortable: true,
      mobile: 'hidden',
      cell: (order) => <span className="adt-num">{formatPrice(order.totalPence)}</span>,
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Actions',
      width: '8.5rem',
      align: 'end',
      mobile: 'end',
      className: 'admin-orders-grid-actions',
      cell: (order) => {
        const orderLabel = getOrderNumberLabel(order);
        const done = order.status === 'COLLECTED';
        return (
          <button
            type="button"
            className={[
              'adt-action admin-orders-grid-collect-btn',
              done ? 'adt-action--done admin-orders-grid-collect-btn--done' : 'adt-action--primary admin-orders-grid-collect-btn--pending',
            ].join(' ')}
            onClick={done ? undefined : (event) => handleCollectClick(event, order.id)}
            disabled={done}
            aria-label={done ? `${orderLabel} collected` : `Mark ${orderLabel} as collected`}
          >
            {done ? <Check aria-hidden="true" /> : <Package aria-hidden="true" />}
            <span>{done ? 'Collected' : 'Collect'}</span>
          </button>
        );
      },
    },
  ];

  return (
    <section className="admin-orders-table22" aria-label="Orders table">
      <AdminDataTable<OrderListItem>
        label="Orders"
        className="admin-orders-grid-wrap"
        rows={ordersUnauthorized ? [] : visibleOrders}
        columns={columns}
        getRowId={(order) => order.id}
        toolbar={
          <AdminTableToolbar
            search={searchSlot}
            filters={
              orders.length > 0 ? (
                <AdminTableFilters<'all' | 'open' | 'collected'>
                  label="Order status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All', count: orders.length },
                    { value: 'open', label: 'To collect', count: openCount },
                    { value: 'collected', label: 'Collected', count: orders.length - openCount },
                  ]}
                />
              ) : undefined
            }
          />
        }
        sort={tableSort}
        onSortChange={(id) => handleSort(id as SortColumn)}
        onRowClick={(order) => onToggleExpand(order.id)}
        rowActionLabel={(order) => {
          const identity = getCustomerIdentity(order);
          return [
            `Order ${getOrderNumberLabel(order)}`,
            identity.displayName,
            formatPrice(order.totalPence),
            getOrderStatusLabel(order.status),
            formatItemCount(order._count.items),
          ].join(', ');
        }}
        isRowExpanded={(order) => expandedOrderId === order.id}
        renderExpanded={(order) => (
          <OrderDetailsPanel
            detail={orderDetailsById[order.id]}
            isDetailLoading={orderDetailsLoadingId === order.id && !orderDetailsById[order.id]}
          />
        )}
        rowAttributes={(order) => ({
          id: `admin-order-${order.id}`,
          'data-order-id': order.id,
          'data-session-order': sessionOrderIds?.has(order.id) ? 'true' : undefined,
        })}
        rowClassName={(order) =>
          [
            'admin-orders-grid-item',
            highlightedOrderId === order.id ? 'admin-orders-grid-item--highlight adt-hit' : '',
            walkthroughOrderId === order.id ? 'admin-orders-grid-item--walkthrough' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }
        isRowMuted={(order) => order.status === 'COLLECTED'}
        empty={
          !isEmpty && visibleOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={statusFilter === 'open' ? 'Nothing to collect' : 'No collected orders yet'}
              description={
                statusFilter === 'open'
                  ? 'Every paid order has been handed over.'
                  : 'Orders move here once you mark them as collected.'
              }
              variant="filtered"
            />
          ) : isEmpty ? (
            <EmptyState
              icon={ShoppingBag}
              title={emptyTitle(emptyMessage)}
              description={emptyDesc(emptyMessage)}
              variant={emptyMessage !== 'No orders yet.' ? 'filtered' : undefined}
            />
          ) : null
        }
      />

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
  if (isDetailLoading || !detail) {
    return (
      <div className="admin-orders-table22__details" aria-busy="true">
        <span className="adt-skeleton" style={{ width: '40%' }} />
        <span className="adt-skeleton" style={{ width: '65%', marginTop: '0.75rem' }} />
      </div>
    );
  }

  return (
    <div className="admin-orders-table22__details">
      <dl className="adt-detail-grid">
        <div>
          <dt>Order</dt>
          <dd>{getOrderNumberLabel(detail)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatDate(detail.paidAt)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{getOrderStatusLabel(detail.status)}</dd>
        </div>
        <div>
          <dt>Collected</dt>
          <dd>{formatDate(detail.collectedAt)}</dd>
        </div>
      </dl>

      <table className="adt-lines">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Unit price</th>
            <th className="num">Qty</th>
            <th className="num">Line total</th>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((item) => (
            <tr key={item.id}>
              <td>{item.nameSnapshot}</td>
              <td className="num">{formatPrice(item.unitPricePenceSnapshot)}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatPrice(item.lineTotalPence)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="num adt-num">{formatPrice(detail.totalPence)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
