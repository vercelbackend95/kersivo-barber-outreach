import React, { useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import EmptyState from '../EmptyState';
import { Calendar } from '../lucide-react';
import ClientListAvatar from './ClientListAvatar';
import AdminDataTable, {
  AdminTableIdentity,
  AdminTableStatus,
  type AdminDataTableColumn,
  type AdminTableStatusTone,
} from './AdminDataTable';

/** Mirrors dashboard `Booking` rows from the admin API (structural match for handlers). */
export type ScheduleListBooking = {
  id: string;
  barberId: string;
  clientId?: string | null;
  clientAvatarUrl?: string | null;
  fullName: string;
  /** Null when the viewer is not allowed to see the client's email. */
  email: string | null;
  status: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  rescheduledAt?: string | null;
  paymentRequired?: boolean;
  paymentStatus?: string | null;
  depositRefund?: {
    status: 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED';
    amountPence: number;
    stripeRefundId?: string | null;
    attempts: number;
    lastError?: string | null;
  } | null;
  barber: { name: string };
  service: { name: string };
};

function depositRefundBadgeLabel(
  refund: NonNullable<ScheduleListBooking['depositRefund']>,
): string {
  if (refund.status === 'REFUNDED') return 'Refunded';
  if (refund.status === 'REFUND_FAILED') return 'Refund failed';
  return 'Refund pending';
}

type TemporalGroup = 'past' | 'now' | 'upcoming';

function getTemporalGroup(booking: ScheduleListBooking, nowMs: number): TemporalGroup {
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  const windowMs = 30 * 60 * 1000;
  if (nowMs >= startMs - windowMs && nowMs < endMs + windowMs) return 'now';
  if (endMs <= nowMs) return 'past';
  return 'upcoming';
}

function bookingDurationMinutes(booking: ScheduleListBooking): number {
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function formatDurationLine(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe <= 0) return '—';
  return `${safe} min`;
}

/** Reference-style: "Marcus T." */
function formatClientShort(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initial = last[0]?.toUpperCase() ?? '';
  return `${parts[0]} ${initial}.`;
}

function barberFirstName(name: string | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '—';
  return n.split(/\s+/)[0] ?? n;
}

function pastStatusShort(booking: ScheduleListBooking): string {
  if (booking.status === 'CANCELLED_BY_CLIENT') return 'Cancelled';
  if (booking.status === 'CANCELLED_BY_SHOP') return 'Shop cancel';
  if (booking.status === 'CANCELLED_BY_ADMIN') return 'Cancelled';
  if (booking.status === 'EXPIRED') return 'Expired';
  if (booking.status === 'RESCHEDULED') return 'Rescheduled';
  if (booking.status === 'BOOKED') return 'Booked';
  return 'Closed';
}

function historyChipVariant(status: string): 'done' | 'cancelled' | 'expired' | 'rescheduled' | 'default' {
  if (status === 'BOOKED' || status === 'COMPLETED') return 'done';
  if (status.startsWith('CANCELLED')) return 'cancelled';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'RESCHEDULED') return 'rescheduled';
  return 'default';
}

type CommonScheduleListProps = {
  bookings: ScheduleListBooking[];
  nowMs: number;
  bookingsInitialLoading: boolean;
  updatedBookingIds: string[];
  highlightMatch: (value: string) => React.ReactNode;
  formatStartTime: (startAt: string) => string;
  onOpenClient: (booking: ScheduleListBooking) => void | Promise<void>;
};

type RefundRetryProps = {
  onRetryDepositRefund?: (booking: ScheduleListBooking) => void | Promise<void>;
  refundRetryLoadingBookingId?: string | null;
  canRetryDepositRefund?: (booking: ScheduleListBooking) => boolean;
};

export type AdminBookingsScheduleDayProps = CommonScheduleListProps &
  RefundRetryProps & {
    variant?: 'day' | undefined;
    selectedDate: string;
    todayLondonDate: string;
    selectedDateLabel: string;
    onCancelBooking: (booking: ScheduleListBooking) => void | Promise<void>;
    cancelLoadingBookingId: string | null;
    canCancelBooking: (booking: ScheduleListBooking) => boolean;
  };

export type AdminBookingsScheduleHistoryProps = CommonScheduleListProps &
  RefundRetryProps & {
    variant: 'history';
    heading: string;
    historyFilters?: React.ReactNode;
    historyToolbar?: React.ReactNode;
    /** Rendered under the last row (e.g. Load more). */
    historyFooter?: React.ReactNode;
    formatDateTime: (startAt: string) => string;
    /** Human-readable status line for the row (e.g. Done, Cancelled by client). */
    getHistoryStatusLine: (booking: ScheduleListBooking) => string;
    historyDateFiltered: boolean;
    onClearHistoryDateRange?: () => void;
    onClientAvatarChange?: (clientId: string, nextUrl: string) => void;
    onEditHistoryStatus: (booking: ScheduleListBooking) => void;
    statusEditorBookingId: string | null;
  };

export type AdminBookingsScheduleListProps = AdminBookingsScheduleDayProps | AdminBookingsScheduleHistoryProps;

function isHistoryProps(p: AdminBookingsScheduleListProps): p is AdminBookingsScheduleHistoryProps {
  return p.variant === 'history';
}

export default function AdminBookingsScheduleList(props: AdminBookingsScheduleListProps) {
  const history = isHistoryProps(props);
  const {
    bookings,
    nowMs,
    bookingsInitialLoading,
    updatedBookingIds,
    highlightMatch,
    formatStartTime,
    onOpenClient,
  } = props;

  const heading = history
    ? props.heading
    : props.selectedDate === props.todayLondonDate
      ? "Today's schedule"
      : `Schedule · ${props.selectedDateLabel}`;

  const displayBookings = useMemo(() => {
    if (history) return [...bookings];
    return [...bookings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [bookings, history]);

  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const rootClass = history ? 'admin-bookings-schedule admin-bookings-schedule--history' : 'admin-bookings-schedule';

  const pastLine = (booking: ScheduleListBooking) =>
    history ? props.getHistoryStatusLine(booking) : pastStatusShort(booking);

  const toggleHistoryExpand = (bookingId: string) => {
    setExpandedBookingId((current) => (current === bookingId ? null : bookingId));
  };

  const historyFiltersNode =
    history && props.historyFilters ? (
      <div className="admin-bookings-schedule__history-filters">
        {props.historyFilters}
      </div>
    ) : null;

  if (history) {
    const statusTone = (status: string): AdminTableStatusTone => {
      const variant = historyChipVariant(status);
      if (status === 'NO_SHOW') return 'warn';
      if (variant === 'done') return 'ok';
      if (variant === 'cancelled') return 'danger';
      if (variant === 'rescheduled') return 'violet';
      return 'neutral';
    };

    const columns: AdminDataTableColumn<ScheduleListBooking>[] = [
      {
        id: 'avatar',
        header: '',
        srHeader: 'Photo',
        width: '2.25rem',
        mobile: 'lead',
        cell: (booking) => (
          <ClientListAvatar
            clientId={booking.clientId}
            fullName={booking.fullName}
            avatarUrl={booking.clientAvatarUrl}
            className="adt-avatar admin-bookings-schedule__history-avatar"
            onAvatarChange={props.onClientAvatarChange}
            onClick={(event) => {
              event.stopPropagation();
              void onOpenClient(booking);
            }}
          />
        ),
      },
      {
        id: 'client',
        header: 'Client',
        width: 'minmax(11rem, 1.6fr)',
        mobile: 'primary',
        cell: (booking) => (
          <AdminTableIdentity
            title={highlightMatch(booking.fullName)}
            subtitle={(booking.email ?? '').trim() ? highlightMatch((booking.email ?? '').trim()) : undefined}
          />
        ),
      },
      {
        id: 'service',
        header: 'Service',
        width: 'minmax(9rem, 1.4fr)',
        mobile: 'hidden',
        cell: (booking) => (
          <span className="adt-identity">
            <span className="adt-truncate" style={{ color: 'var(--kui-text)' }}>
              {highlightMatch(booking.service?.name ?? '—')}
            </span>
            <span className="adt-identity-sub">{formatDurationLine(bookingDurationMinutes(booking))}</span>
          </span>
        ),
      },
      {
        id: 'when',
        header: 'Date & time',
        width: 'minmax(8.5rem, 1fr)',
        mobile: 'hidden',
        cell: (booking) => (
          <span className="adt-identity">
            <span className="adt-truncate" style={{ color: 'var(--kui-text)' }}>
              {formatInTimeZone(new Date(booking.startAt), 'Europe/London', 'EEE d MMM yyyy')}
            </span>
            <span className="adt-identity-sub">{formatStartTime(booking.startAt)}</span>
          </span>
        ),
      },
      {
        id: 'barber',
        header: 'Barber',
        width: 'minmax(5.5rem, 0.7fr)',
        mobile: 'hidden',
        cell: (booking) => <span className="adt-truncate">{barberFirstName(booking.barber?.name)}</span>,
      },
      {
        id: 'summary',
        header: '',
        width: '0px',
        only: 'narrow',
        mobile: 'meta',
        cell: (booking) => (
          <span className="adt-truncate">
            {formatStartTime(booking.startAt)} · {highlightMatch(booking.service?.name ?? '—')} · {barberFirstName(booking.barber?.name)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: 'minmax(8.5rem, auto)',
        align: 'end',
        mobile: 'end',
        cell: (booking) => {
          const chipLabel = props.getHistoryStatusLine(booking);
          return (
            <span className="adt-stack-end">
              <AdminTableStatus
                as="button"
                tone={statusTone(booking.status)}
                className="admin-bookings-schedule__history-chip--button"
                aria-haspopup="dialog"
                aria-expanded={props.statusEditorBookingId === booking.id}
                aria-label={`Update status for ${booking.fullName}. Current status: ${chipLabel}`}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  props.onEditHistoryStatus(booking);
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {chipLabel}
              </AdminTableStatus>
              {booking.depositRefund ? (
                <span
                  className={`admin-bookings-schedule__refund-badge admin-bookings-schedule__refund-badge--${booking.depositRefund.status.toLowerCase()}`}
                >
                  {depositRefundBadgeLabel(booking.depositRefund)}
                </span>
              ) : null}
            </span>
          );
        },
      },
    ];

    return (
      <section className={rootClass} aria-label={heading}>
        {historyFiltersNode}
        <AdminDataTable<ScheduleListBooking>
          label={heading}
          className="admin-bookings-schedule__history-table-wrap"
          rows={displayBookings}
          columns={columns}
          getRowId={(booking) => booking.id}
          loading={bookingsInitialLoading}
          toolbar={props.historyToolbar ?? undefined}
          footer={props.historyFooter}
          onRowClick={(booking) => toggleHistoryExpand(booking.id)}
          rowActionLabel={(booking) =>
            `${expandedBookingId === booking.id ? 'Hide' : 'Show'} booking details for ${booking.fullName}`
          }
          isRowExpanded={(booking) => expandedBookingId === booking.id}
          rowAttributes={(booking) => ({ 'data-booking-id': booking.id })}
          rowClassName={(booking) => (updatedBookingIds.includes(booking.id) ? 'adt-hit' : undefined)}
          isRowMuted={(booking) => booking.status.startsWith('CANCELLED') || booking.status === 'EXPIRED'}
          renderExpanded={(booking) => {
            const serviceName = booking.service?.name ?? '—';
            const durationLabel = formatDurationLine(bookingDurationMinutes(booking));
            const canRetry = Boolean(props.canRetryDepositRefund?.(booking) && props.onRetryDepositRefund);
            return (
              <div className="admin-bookings-schedule__history-details">
                <dl className="adt-detail-grid">
                  <div>
                    <dt>Service</dt>
                    <dd>
                      {serviceName}
                      {durationLabel !== '—' ? ` · ${durationLabel}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Date &amp; time</dt>
                    <dd>{props.formatDateTime(booking.startAt)}</dd>
                  </div>
                  <div>
                    <dt>Barber</dt>
                    <dd>{booking.barber?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{props.getHistoryStatusLine(booking)}</dd>
                  </div>
                  {booking.depositRefund ? (
                    <div>
                      <dt>Deposit</dt>
                      <dd>{depositRefundBadgeLabel(booking.depositRefund)}</dd>
                    </div>
                  ) : null}
                  {booking.notes ? (
                    <div>
                      <dt>Notes</dt>
                      <dd>{booking.notes}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="adt-detail-actions">
                  <button type="button" className="adt-action" onClick={() => void onOpenClient(booking)}>
                    Client profile
                  </button>
                  <button type="button" className="adt-action" onClick={() => props.onEditHistoryStatus(booking)}>
                    Update status
                  </button>
                  {canRetry ? (
                    <button
                      type="button"
                      className="adt-action"
                      onClick={() => void props.onRetryDepositRefund?.(booking)}
                      disabled={props.refundRetryLoadingBookingId === booking.id}
                    >
                      {props.refundRetryLoadingBookingId === booking.id ? 'Retrying refund…' : 'Retry refund'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          }}
          empty={
            <EmptyState
              icon={Calendar}
              title={props.historyDateFiltered ? 'No bookings in this period' : 'No booking history'}
              description={
                props.historyDateFiltered
                  ? 'No appointments were found for the selected date range.'
                  : 'Past appointments will appear here once bookings are completed or cancelled.'
              }
              variant={props.historyDateFiltered ? 'filtered' : undefined}
              action={
                props.historyDateFiltered && props.onClearHistoryDateRange ? (
                  <button type="button" className="adt-action" onClick={props.onClearHistoryDateRange}>
                    Clear date range
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>
    );
  }

  return (
    <section className={rootClass} aria-label={heading}>
      <header className="admin-bookings-schedule__head">
        <h2 className="admin-bookings-schedule__title">{heading}</h2>
        <div className="admin-bookings-schedule__rule" aria-hidden="true" />
      </header>

      {bookingsInitialLoading ? (
        <div className="admin-bookings-schedule__list" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="admin-bookings-schedule__skeleton-row"
              aria-hidden="true"
            >
              <span className="admin-bookings-schedule__skeleton-block admin-bookings-schedule__skeleton-block--time" />
              <span className="admin-bookings-schedule__skeleton-block admin-bookings-schedule__skeleton-block--main" />
              <span className="admin-bookings-schedule__skeleton-block admin-bookings-schedule__skeleton-block--right" />
            </div>
          ))}
        </div>
      ) : displayBookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No bookings"
          description="When clients book appointments, they will appear here."
        />
      ) : (
        <div className="admin-bookings-schedule__list" role="list" aria-live="polite">
          {displayBookings.map((booking) => {
            const temporal = getTemporalGroup(booking, nowMs);
            const timeStr = formatStartTime(booking.startAt);
            const serviceName = booking.service?.name ?? '—';
            const subline = `${serviceName} · ${formatDurationLine(bookingDurationMinutes(booking))}`;
            const barberShort = barberFirstName(booking.barber?.name);
            const isUpdated = updatedBookingIds.includes(booking.id);
            const canCancel = 'canCancelBooking' in props && props.canCancelBooking(booking);

            const isDonePast = temporal === 'past' && booking.status === 'BOOKED';
            const isPastOther = temporal === 'past' && !isDonePast;

            const rowClass = [
              'admin-bookings-schedule__row',
              temporal === 'now' ? 'admin-bookings-schedule__row--now' : '',
              isDonePast ? 'admin-bookings-schedule__row--done' : '',
              isPastOther ? 'admin-bookings-schedule__row--past-muted' : '',
              temporal === 'upcoming' ? 'admin-bookings-schedule__row--upcoming' : '',
              isUpdated ? 'admin-bookings-schedule__row--updated' : '',
            ]
              .filter(Boolean)
              .join(' ');

            let right: React.ReactNode;
            if (temporal === 'now') {
              right = (
                <div className="admin-bookings-schedule__right-stack">
                  <span className="admin-bookings-schedule__barber">{barberShort}</span>
                  <span className="admin-bookings-schedule__status-now">NOW</span>
                </div>
              );
            } else if (temporal === 'upcoming') {
              if (booking.status.startsWith('CANCELLED') || booking.status === 'EXPIRED') {
                right = <span className="admin-bookings-schedule__status-muted">{pastLine(booking)}</span>;
              } else {
                right = (
                  <div className="admin-bookings-schedule__right-stack">
                    <span className="admin-bookings-schedule__barber">{barberShort}</span>
                    <span className="admin-bookings-schedule__upcoming-time">{formatStartTime(booking.startAt)}</span>
                  </div>
                );
              }
            } else if (isDonePast) {
              right = (
                <div className="admin-bookings-schedule__right-stack">
                  <span className="admin-bookings-schedule__barber admin-bookings-schedule__barber--faint">{barberShort}</span>
                  <span className="admin-bookings-schedule__status-done">Done</span>
                </div>
              );
            } else {
              right = (
                <div className="admin-bookings-schedule__right-stack">
                  <span className="admin-bookings-schedule__barber admin-bookings-schedule__barber--faint">{barberShort}</span>
                  <span className="admin-bookings-schedule__status-muted">{pastLine(booking)}</span>
                </div>
              );
            }

            return (
              <div key={booking.id} className={rowClass} role="listitem" data-booking-id={booking.id}>
                <div className="admin-bookings-schedule__accent" aria-hidden="true" />
                <div className={`admin-bookings-schedule__time${temporal === 'now' ? ' admin-bookings-schedule__time--now' : ''}`}>
                  {timeStr}
                </div>
                <div className="admin-bookings-schedule__main">
                  <button
                    type="button"
                    className="admin-bookings-schedule__client"
                    onClick={() => void onOpenClient(booking)}
                  >
                    {highlightMatch(formatClientShort(booking.fullName))}
                  </button>
                  <p className="admin-bookings-schedule__subline">{subline}</p>
                </div>
                <div className="admin-bookings-schedule__right">
                  {right}
                  {booking.depositRefund ? (
                    <span
                      className={`admin-bookings-schedule__refund-badge admin-bookings-schedule__refund-badge--${booking.depositRefund.status.toLowerCase()}`}
                    >
                      {depositRefundBadgeLabel(booking.depositRefund)}
                    </span>
                  ) : null}
                </div>
                {(canCancel && 'onCancelBooking' in props) ||
                (props.canRetryDepositRefund?.(booking) && props.onRetryDepositRefund) ? (
                  <div className="admin-bookings-schedule__actions">
                    {canCancel && 'onCancelBooking' in props ? (
                      <button
                        type="button"
                        className="admin-bookings-schedule__cancel"
                        onClick={() => void props.onCancelBooking(booking)}
                        disabled={props.cancelLoadingBookingId === booking.id}
                      >
                        {props.cancelLoadingBookingId === booking.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    ) : null}
                    {props.canRetryDepositRefund?.(booking) && props.onRetryDepositRefund ? (
                      <button
                        type="button"
                        className="admin-bookings-schedule__cancel"
                        onClick={() => void props.onRetryDepositRefund?.(booking)}
                        disabled={props.refundRetryLoadingBookingId === booking.id}
                      >
                        {props.refundRetryLoadingBookingId === booking.id
                          ? 'Retrying refund…'
                          : 'Retry refund'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
