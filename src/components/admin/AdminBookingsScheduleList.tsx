import React, { useMemo } from 'react';
import EmptyState from '../EmptyState';
import { Calendar } from '../lucide-react';

/** Mirrors dashboard `Booking` rows from the admin API (structural match for handlers). */
export type ScheduleListBooking = {
  id: string;
  barberId: string;
  clientId?: string | null;
  fullName: string;
  email: string;
  status: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { name: string };
};

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

type CommonScheduleListProps = {
  bookings: ScheduleListBooking[];
  nowMs: number;
  bookingsInitialLoading: boolean;
  updatedBookingIds: string[];
  highlightMatch: (value: string) => React.ReactNode;
  formatStartTime: (startAt: string) => string;
  onOpenClient: (clientId?: string | null) => void | Promise<void>;
};

export type AdminBookingsScheduleDayProps = CommonScheduleListProps & {
  variant?: 'day' | undefined;
  selectedDate: string;
  todayLondonDate: string;
  selectedDateLabel: string;
  onCancelBooking: (booking: ScheduleListBooking) => void | Promise<void>;
  cancelLoadingBookingId: string | null;
  canCancelBooking: (booking: ScheduleListBooking) => boolean;
};

export type AdminBookingsScheduleHistoryProps = CommonScheduleListProps & {
  variant: 'history';
  heading: string;
  formatDateTime: (startAt: string) => string;
  /** Human-readable status line for the row (e.g. Done, Cancelled by client). */
  getHistoryStatusLine: (booking: ScheduleListBooking) => string;
  historyDateFiltered: boolean;
  onClearHistoryDateRange?: () => void;
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

  const rootClass = history ? 'admin-bookings-schedule admin-bookings-schedule--history' : 'admin-bookings-schedule';

  const pastLine = (booking: ScheduleListBooking) =>
    history ? props.getHistoryStatusLine(booking) : pastStatusShort(booking);

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
              className={`admin-bookings-schedule__skeleton-row${history ? ' admin-bookings-schedule__skeleton-row--history' : ''}`}
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
          title={
            history
              ? props.historyDateFiltered
                ? 'No bookings in this period'
                : 'No booking history'
              : 'No bookings'
          }
          description={
            history
              ? props.historyDateFiltered
                ? 'No appointments were found for the selected date range.'
                : 'Past appointments will appear here once bookings are completed or cancelled.'
              : 'When clients book appointments, they will appear here.'
          }
          variant={history && props.historyDateFiltered ? 'filtered' : undefined}
          action={
            history && props.historyDateFiltered && props.onClearHistoryDateRange ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={props.onClearHistoryDateRange}>
                Clear date range
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="admin-bookings-schedule__list" role="list" aria-live="polite">
          {displayBookings.map((booking) => {
            const temporal = getTemporalGroup(booking, nowMs);
            const timeStr = history ? props.formatDateTime(booking.startAt) : formatStartTime(booking.startAt);
            const serviceName = booking.service?.name ?? '—';
            const subline = `${serviceName} · ${formatDurationLine(bookingDurationMinutes(booking))}`;
            const emailTrimmed = (booking.email ?? '').trim();
            const barberShort = barberFirstName(booking.barber?.name);
            const isUpdated = updatedBookingIds.includes(booking.id);
            const canCancel =
              !history && 'canCancelBooking' in props && props.canCancelBooking(booking);

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
                <div
                  className={`admin-bookings-schedule__time${temporal === 'now' ? ' admin-bookings-schedule__time--now' : ''}${history ? ' admin-bookings-schedule__time--history' : ''}`}
                >
                  {timeStr}
                </div>
                <div className={`admin-bookings-schedule__main${history ? ' admin-bookings-schedule__main--history' : ''}`}>
                  <button
                    type="button"
                    className="admin-bookings-schedule__client"
                    onClick={() => void onOpenClient(booking.clientId)}
                  >
                    {highlightMatch(formatClientShort(booking.fullName))}
                  </button>
                  <p className="admin-bookings-schedule__subline">{subline}</p>
                  {history ? (
                    <p className="admin-bookings-schedule__history-email">
                      {emailTrimmed ? highlightMatch(emailTrimmed) : '—'}
                    </p>
                  ) : null}
                </div>
                <div className="admin-bookings-schedule__right">{right}</div>
                {canCancel && 'onCancelBooking' in props ? (
                  <div className="admin-bookings-schedule__actions">
                    <button
                      type="button"
                      className="admin-bookings-schedule__cancel"
                      onClick={() => void props.onCancelBooking(booking)}
                      disabled={props.cancelLoadingBookingId === booking.id}
                    >
                      {props.cancelLoadingBookingId === booking.id ? 'Cancelling…' : 'Cancel'}
                    </button>
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
