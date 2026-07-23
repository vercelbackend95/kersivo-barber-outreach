import type { Barber } from './barbersTypes';
import { ArrowRight, Calendar, Clock } from '../lucide-react';
import type { BarberAvailabilityStatus, DayFillData, NextBookingPreview } from '../../lib/admin/barberRosterPresentation';
import { AVAIL_STATUS_LABELS } from '../../lib/admin/barberRosterPresentation';

export type AdminBarberRosterCardProps = {
  barber: Barber;
  orderIndex: number;
  barberIsActive: boolean;
  nextBookingPreview: NextBookingPreview | null;
  availStatus: BarberAvailabilityStatus;
  dayFill: DayFillData;
  todayLine: { text: string; title: string; isOff: boolean };
  getInitials: (name: string) => string;
  onOpenBarber: (barberId: string) => void;
  bookingsLength: number;
  variant: 'ops' | 'manage';
  /** Unified Team card extras */
  roleLabel?: string;
  rolePillClassName?: string;
  cardStatus?: 'pending' | 'active';
  /** When false, mute schedule chrome (Team: online bookings off / no seat) */
  showSchedule?: boolean;
  /** When false, hide shift/next/CTA/day-fill */
  showRosterChrome?: boolean;
  showProfileCta?: boolean;
  /** Team account access label (Joined / Invitation pending / No dashboard account) */
  accountAccessLabel?: string;
  /** Online bookings line */
  onlineBookingsLine?: string;
  /** Optional secondary line (e.g. Dashboard access only) */
  secondaryLine?: string | null;
};

export default function AdminBarberRosterCard({
  barber,
  orderIndex,
  barberIsActive,
  nextBookingPreview,
  availStatus,
  dayFill,
  todayLine,
  getInitials,
  onOpenBarber,
  bookingsLength,
  variant: _variant,
  roleLabel,
  rolePillClassName,
  cardStatus,
  showSchedule = true,
  showRosterChrome = true,
  showProfileCta = true,
  accountAccessLabel,
  onlineBookingsLine,
  secondaryLine = null,
}: AdminBarberRosterCardProps) {
  const availLabel = AVAIL_STATUS_LABELS[availStatus];
  const bookedHDisplay = Math.round(dayFill.bookedHoursH * 10) / 10;
  const dayFillAriaLabel = `${dayFill.count} booking${dayFill.count !== 1 ? 's' : ''} today (${bookedHDisplay}h booked of ${dayFill.workingH}h)`;
  const nextBookingTitle = nextBookingPreview
    ? `Next: ${nextBookingPreview.timeLabel} · ${nextBookingPreview.serviceLabel} (${nextBookingPreview.relativeLabel})`
    : 'No upcoming bookings';
  const isTeamCard = Boolean(accountAccessLabel);

  const statusAnnouncement = isTeamCard
    ? [accountAccessLabel, onlineBookingsLine, secondaryLine].filter(Boolean).join('. ')
    : availLabel;

  return (
    <li className={`admin-barber-card admin-barber-card--roster${barberIsActive ? '' : ' is-inactive'}`}>
      <article className="admin-barber-identity admin-barber-identity--roster" aria-label={`${barber.name} roster card`}>
        <div className="admin-barber-roster-hero">
          <div className="admin-barber-roster-avatar-shell">
            <div className={`admin-barber-avatar admin-barber-avatar--roster admin-barber-avatar--status-${availStatus}`}>
              {barber.avatarUrl ? (
                <img src={barber.avatarUrl} alt="" loading="lazy" />
              ) : (
                <span>{getInitials(barber.name)}</span>
              )}
            </div>
            <span className={`admin-barber-avail-dot admin-barber-avail-dot--${availStatus}`} aria-hidden="true" />
          </div>
        </div>

        <div className="admin-barber-roster-body">
          <div className="admin-barber-name-row admin-barber-roster-name-row">
            <span className="admin-barber-roster-rank" aria-label={`Roster position ${orderIndex + 1}`}>
              {orderIndex + 1}
            </span>
            <div className="admin-barber-roster-title-stack">
              <p className="admin-barber-name admin-barber-roster-name">{barber.name}</p>
              <div className="admin-barber-roster-meta-row">
                {roleLabel ? (
                  <span className={rolePillClassName || 'admin-team__role-pill'}>{roleLabel}</span>
                ) : null}
              </div>
              {isTeamCard ? (
                <div className="admin-barber-roster-facts" role="status" aria-label={statusAnnouncement}>
                  {accountAccessLabel ? (
                    <p className="admin-barber-roster-account">{accountAccessLabel}</p>
                  ) : null}
                  {onlineBookingsLine ? (
                    <p
                      className={`admin-barber-roster-status admin-barber-roster-status--${
                        showSchedule ? availStatus : 'off'
                      }`}
                    >
                      {onlineBookingsLine}
                    </p>
                  ) : null}
                  {secondaryLine ? (
                    <p className="admin-barber-roster-secondary">{secondaryLine}</p>
                  ) : null}
                </div>
              ) : (
                <p className={`admin-barber-roster-status admin-barber-roster-status--${availStatus}`} role="status">
                  {availLabel}
                </p>
              )}
            </div>
          </div>

          {showRosterChrome ? (
            <div className="admin-barber-roster-meta">
              <span className={`admin-barber-roster-shift${todayLine.isOff ? ' is-off' : ''}`} title={todayLine.title}>
                <Clock className="admin-barber-roster-meta-icon" width={15} height={15} aria-hidden />
                <span className="admin-barber-roster-shift-text">{todayLine.text}</span>
              </span>

              <div className={`admin-barber-roster-next${nextBookingPreview ? '' : ' is-muted'}`} title={nextBookingTitle}>
                <Calendar className="admin-barber-roster-meta-icon" width={15} height={15} aria-hidden />
                {nextBookingPreview ? (
                  <div className="admin-barber-roster-next-copy">
                    <span className="admin-barber-roster-next-primary">
                      {nextBookingPreview.timeLabel} · {nextBookingPreview.serviceLabel}
                    </span>
                    <span className="admin-barber-roster-next-secondary">{nextBookingPreview.relativeLabel}</span>
                  </div>
                ) : (
                  <span className="admin-barber-roster-next-empty">
                    {bookingsLength > 0 ? 'No upcoming bookings' : 'No schedule data'}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {cardStatus === 'pending' ? (
            <button type="button" className="btn btn--primary admin-barber-roster-cta" disabled>
              Pending invitation
            </button>
          ) : null}

          {showProfileCta && barber.id ? (
            <button
              type="button"
              className="admin-barber-roster-cta"
              onClick={() => onOpenBarber(barber.id)}
              aria-label={`Open ${barber.name} profile and settings`}
            >
              <span className="admin-barber-roster-cta-label">Profile & settings</span>
              <ArrowRight className="admin-barber-roster-cta-icon" width={16} height={16} aria-hidden />
            </button>
          ) : null}

          {showRosterChrome ? (
            <div className="admin-barber-day-fill-row admin-barber-day-fill-row--roster" aria-label={dayFillAriaLabel}>
              <div className="admin-barber-day-fill" aria-hidden="true" style={{ width: `${dayFill.pct}%` }} />
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
