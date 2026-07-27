import type { Barber } from './barbersTypes';
import {
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  LayoutDashboard,
  Scissors,
  Shield,
} from '../lucide-react';
import type { BarberAvailabilityStatus, DayFillData, NextBookingPreview } from '../../lib/admin/barberRosterPresentation';
import { AVAIL_STATUS_LABELS } from '../../lib/admin/barberRosterPresentation';

const META_ICON = {
  width: 15,
  height: 15,
  className: 'admin-barber-roster-meta-icon',
  'aria-hidden': true as const,
};

function rolePillIcon(role: string) {
  if (role === 'OWNER') return <Crown {...META_ICON} />;
  if (role === 'MANAGER') return <Shield {...META_ICON} />;
  return <Scissors {...META_ICON} />;
}

function resolveRoleFromClassName(className?: string): string {
  if (className?.includes('--owner')) return 'OWNER';
  if (className?.includes('--manager')) return 'MANAGER';
  return 'BARBER';
}

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
  /** Prefer over single roleLabel when Owner/Manager is also bookable. */
  rolePills?: Array<{ label: string; className: string; role?: string }>;
  /** When false, mute schedule chrome (Team: online bookings off / no seat) */
  showSchedule?: boolean;
  /** When false, hide shift/next/CTA/day-fill */
  showRosterChrome?: boolean;
  showProfileCta?: boolean;
  /** Team account access label (Joined / Invitation pending / No dashboard account) */
  accountAccessLabel?: string;
  /** Badge classes for account access pill */
  accountAccessClassName?: string;
  /** Online bookings line */
  onlineBookingsLine?: string;
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
  rolePills,
  showSchedule = true,
  showRosterChrome = true,
  showProfileCta = true,
  accountAccessLabel,
  accountAccessClassName,
  onlineBookingsLine,
}: AdminBarberRosterCardProps) {
  const availLabel = AVAIL_STATUS_LABELS[availStatus];
  const bookedHDisplay = Math.round(dayFill.bookedHoursH * 10) / 10;
  const dayFillAriaLabel = `${dayFill.count} booking${dayFill.count !== 1 ? 's' : ''} today (${bookedHDisplay}h booked of ${dayFill.workingH}h)`;
  const nextBookingTitle = nextBookingPreview
    ? `Next: ${nextBookingPreview.timeLabel} · ${nextBookingPreview.serviceLabel} (${nextBookingPreview.relativeLabel})`
    : 'No upcoming bookings';
  const isTeamCard = Boolean(accountAccessLabel);

  const statusAnnouncement = isTeamCard
    ? [accountAccessLabel, onlineBookingsLine].filter(Boolean).join('. ')
    : availLabel;

  return (
    <li className={`admin-barber-card admin-barber-card--roster${barberIsActive ? '' : ' is-inactive'}`}>
      <span className="admin-barber-roster-rank" aria-label={`Roster position ${orderIndex + 1}`}>
        {orderIndex + 1}
      </span>
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
            <div className="admin-barber-roster-title-stack">
              <p className="admin-barber-name admin-barber-roster-name">{barber.name}</p>
              <div className="admin-barber-roster-meta-row">
                {rolePills && rolePills.length > 0
                  ? rolePills.map((pill) => (
                      <span key={`${pill.label}-${pill.className}`} className="admin-barber-roster-fact-row">
                        {rolePillIcon(pill.role || 'BARBER')}
                        <span className={pill.className || 'admin-team__role-pill'}>{pill.label}</span>
                      </span>
                    ))
                  : roleLabel
                    ? (
                        <span className="admin-barber-roster-fact-row">
                          {rolePillIcon(resolveRoleFromClassName(rolePillClassName))}
                          <span className={rolePillClassName || 'admin-team__role-pill'}>{roleLabel}</span>
                        </span>
                      )
                    : null}
              </div>
              {isTeamCard ? (
                <div className="admin-barber-roster-facts" role="status" aria-label={statusAnnouncement}>
                  {accountAccessLabel ? (
                    <span className="admin-barber-roster-fact-row">
                      <LayoutDashboard {...META_ICON} />
                      <span className={accountAccessClassName || 'badge badge--neutral'}>
                        {accountAccessLabel}
                      </span>
                    </span>
                  ) : null}
                  {onlineBookingsLine ? (
                    <span className="admin-barber-roster-fact-row">
                      <Calendar {...META_ICON} />
                      <p
                        className={`admin-barber-roster-status admin-barber-roster-status--${
                          showSchedule ? availStatus : 'off'
                        }`}
                      >
                        {onlineBookingsLine}
                      </p>
                    </span>
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
