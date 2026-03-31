import React from 'react';
import { getStatusTone, getStatusLabel } from './bookingStatus';

type Props = {
  /** Raw status string from the API (booking, order, or barber status). */
  status: string;
  /** Pass when the booking has a rescheduledAt timestamp to show correct tone/label. */
  rescheduledAt?: string | null;
  /** Visual size of the badge. Defaults to 'md'. */
  size?: 'sm' | 'md';
  /**
   * Shape variant:
   * - 'dot'  — colored dot + text, for table cells and pipeline summaries.
   * - 'pill' — fully-rounded badge, for mobile cards and inline highlights.
   * Defaults to 'dot'.
   */
  variant?: 'dot' | 'pill';
};

export default function StatusBadge({
  status,
  rescheduledAt,
  size = 'md',
  variant = 'dot',
}: Props) {
  const tone = getStatusTone(status, rescheduledAt);
  const label = getStatusLabel(status, rescheduledAt);

  const className = [
    'badge',
    `badge--${tone}`,
    `badge--${size}`,
    variant === 'pill' ? 'badge--pill' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} aria-label={label}>
      {variant === 'dot' && <span className="badge__dot" aria-hidden="true" />}
      {label}
    </span>
  );
}
