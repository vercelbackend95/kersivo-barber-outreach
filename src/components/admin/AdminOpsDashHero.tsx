import React from 'react';
import AdminDemoPill from './AdminDemoPill';

function liveStatusModifier(label: string): 'live' | 'offline' | 'connecting' {
  if (label === 'LIVE') return 'live';
  if (label === 'OFFLINE') return 'offline';
  return 'connecting';
}

export type AdminOpsDashHeroProps = {
  ariaLabel: string;
  lead: string;
  detail: React.ReactNode;
  secondary?: React.ReactNode;
  /** Shown only when there is no connection pill (`connectionStateLabel` empty). */
  footer?: string;
  /** LIVE / OFFLINE / CONNECTING… pill — mutually exclusive with `trailing`. */
  connectionStateLabel?: string;
  hasLivePulse?: boolean;
  /** Replaces connection pill when set (e.g. Services catalogue badge). */
  trailing?: React.ReactNode;
  /** Shows a subtle DEMO MODE pill next to the connection/badge (public demo only). */
  showDemoPill?: boolean;
};

export default function AdminOpsDashHero({
  ariaLabel,
  lead,
  detail,
  secondary,
  footer,
  connectionStateLabel,
  hasLivePulse = false,
  trailing,
  showDemoPill = false,
}: AdminOpsDashHeroProps) {
  const useLive = connectionStateLabel != null && connectionStateLabel !== '';
  const statusMod = useLive ? liveStatusModifier(connectionStateLabel) : null;

  const trailingEl = useLive ? (
    <div
      className={`admin-live-status admin-live-status--${statusMod}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`admin-live-status-dot ${hasLivePulse ? 'admin-live-status-dot--pulse' : ''}`}
        aria-hidden="true"
      />
      <span className="admin-live-status-label">{connectionStateLabel}</span>
    </div>
  ) : trailing != null ? (
    <div className="admin-ops-dash-hero-trailing">{trailing}</div>
  ) : null;

  const trailingCluster =
    showDemoPill || trailingEl ? (
      <div className="admin-ops-dash-hero-status">
        {showDemoPill ? <AdminDemoPill /> : null}
        {trailingEl}
      </div>
    ) : null;

  return (
    <section className="admin-bookings-ops admin-bookings-ops--dash-hero" aria-label={ariaLabel}>
      <div className="admin-bookings-ops-dash-hero">
        <div className="admin-bookings-ops-status">
          <div className="admin-bookings-ops-status-copy">
            <p className="admin-bookings-ops-status-primary">
              <span className="admin-bookings-ops-status-lead">{lead}</span>
              <span className="admin-bookings-ops-status-detail">{detail}</span>
            </p>
            {secondary ? (
              <p className="admin-bookings-ops-status-secondary muted">{secondary}</p>
            ) : null}
          </div>
          {trailingCluster}
        </div>
        {footer && !useLive ? <p className="muted admin-bookings-ops-updated">{footer}</p> : null}
      </div>
    </section>
  );
}
