import type { Barber } from './barbersTypes';
import { SettingsGearIcon } from './SettingsGearIcon';
import { ArrowRight, Calendar, Clock } from '../lucide-react';
import type { BarberAvailabilityStatus, DayFillData, NextBookingPreview } from '../../lib/admin/barberRosterPresentation';
import { AVAIL_STATUS_LABELS, ESTIMATED_BOOKING_DURATION_H } from '../../lib/admin/barberRosterPresentation';

export type AdminBarberRosterCardProps = {
  barber: Barber;
  barberIsActive: boolean;
  nextBookingPreview: NextBookingPreview | null;
  availStatus: BarberAvailabilityStatus;
  dayFill: DayFillData;
  todayLine: { text: string; title: string; isOff: boolean };
  getInitials: (name: string) => string;
  onOpenBarber: (barberId: string) => void;
  bookingsLength: number;
  variant: 'ops' | 'manage';
  manageControls?: {
    index: number;
    isFirstItem: boolean;
    isLastItem: boolean;
    barberReordering: boolean;
    onMoveBarber: (index: number, direction: 'up' | 'down') => void;
  };
};

export default function AdminBarberRosterCard({
  barber,
  barberIsActive,
  nextBookingPreview,
  availStatus,
  dayFill,
  todayLine,
  getInitials,
  onOpenBarber,
  bookingsLength,
  variant,
  manageControls,
}: AdminBarberRosterCardProps) {
  const availLabel = AVAIL_STATUS_LABELS[availStatus];
  const dayFillAriaLabel = `${dayFill.count} booking${dayFill.count !== 1 ? 's' : ''} today (est. ${Math.round(dayFill.count * ESTIMATED_BOOKING_DURATION_H * 10) / 10} of ${dayFill.workingH} hours)`;
  const nextBookingTitle = nextBookingPreview
    ? `Next: ${nextBookingPreview.timeLabel} · ${nextBookingPreview.serviceLabel} (${nextBookingPreview.relativeLabel})`
    : 'No upcoming bookings';

  return (
    <li className={`admin-barber-card admin-barber-card--roster${barberIsActive ? '' : ' is-inactive'}`}>
      <button
        type="button"
        className="admin-barber-identity admin-barber-identity--roster"
        onClick={() => onOpenBarber(barber.id)}
        aria-label={`Open ${barber.name} profile and settings`}
      >
        <div className="admin-barber-roster-hero">
          <div className="admin-barber-roster-hero-shine" aria-hidden="true" />
          <div className="admin-barber-roster-avatar-shell">
            <div className={`admin-barber-avatar admin-barber-avatar--roster admin-barber-avatar--status-${availStatus}`}>
              {barber.avatarUrl ? <img src={barber.avatarUrl} alt="" loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
            </div>
            <span className={`admin-barber-avail-dot admin-barber-avail-dot--${availStatus}`} />
          </div>
          <span className={`admin-barber-avail-pill admin-barber-avail-pill--${availStatus}`} role="status">
            {availLabel}
          </span>
        </div>

        <div className="admin-barber-roster-body">
          <div className="admin-barber-name-row admin-barber-roster-name-row">
            <p className="admin-barber-name admin-barber-roster-name">{barber.name}</p>
            {barberIsActive ? null : <span className="admin-barber-roster-inactive-badge">Hidden</span>}
          </div>

          <div className="admin-barber-roster-meta">
            <span className={`admin-barber-roster-shift${todayLine.isOff ? ' is-off' : ''}`} title={todayLine.title}>
              <Clock className="admin-barber-roster-meta-icon" width={16} height={16} aria-hidden />
              <span className="admin-barber-roster-shift-text">{todayLine.text}</span>
            </span>

            <div className={`admin-barber-roster-next${nextBookingPreview ? '' : ' is-muted'}`} title={nextBookingTitle}>
              <Calendar className="admin-barber-roster-meta-icon" width={16} height={16} aria-hidden />
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

          <span className="admin-barber-roster-cta">
            <span className="admin-barber-roster-cta-label">Profile & settings</span>
            <ArrowRight className="admin-barber-roster-cta-icon" width={18} height={18} aria-hidden />
          </span>
        </div>
      </button>

      <div className="admin-barber-roster-toolbar">
        <div className="admin-barber-day-fill-row admin-barber-day-fill-row--roster" aria-label={dayFillAriaLabel}>
          <div className="admin-barber-day-fill" aria-hidden="true" style={{ width: `${dayFill.pct}%` }} />
        </div>
        {variant === 'manage' && manageControls ? (
          <div className="admin-barber-actions admin-barber-actions--roster">
            <div className="admin-reorder-controls admin-reorder-controls--barber" role="group" aria-label={`Reorder ${barber.name}`}>
              <div className="admin-reorder-arrow-stack admin-reorder-arrow-stack--barber">
                <button
                  type="button"
                  className="admin-reorder-btn admin-reorder-btn--barber"
                  onClick={() => manageControls.onMoveBarber(manageControls.index, 'up')}
                  disabled={manageControls.isFirstItem || manageControls.barberReordering}
                  aria-label={`Move ${barber.name} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="admin-reorder-btn admin-reorder-btn--barber"
                  onClick={() => manageControls.onMoveBarber(manageControls.index, 'down')}
                  disabled={manageControls.isLastItem || manageControls.barberReordering}
                  aria-label={`Move ${barber.name} down`}
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                className="admin-reorder-btn admin-reorder-btn--settings admin-reorder-btn--barber admin-reorder-btn--barber-settings"
                onClick={() => onOpenBarber(barber.id)}
                aria-label={`Open ${barber.name} settings`}
              >
                <SettingsGearIcon className="admin-control-icon" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}
