import React, { forwardRef } from 'react';

export type BookingSummary = {
  service?: string;
  barber?: string;
  date?: string;
  time?: string;
};

type Props = {
  variant: 'booked' | 'rescheduled';
  summary?: BookingSummary;
};

const contentByVariant = {
  booked: {
    eyebrow: 'Booking confirmed',
    heading: 'Your appointment is confirmed',
    body: 'Your booking has been received successfully. A confirmation email is on the way with the appointment details and your reschedule or cancel links.',
    accent: 'Appointment secured'
  },
  rescheduled: {
    eyebrow: 'Booking rescheduled',
    heading: 'Your booking has been updated',
    body: 'Your new appointment time is confirmed. A fresh confirmation email is on the way with your updated booking details.',
    accent: 'Schedule updated'
  }
} as const;

function buildSummaryRows(summary?: BookingSummary): Array<{ label: string; value: string }> {
  if (!summary) return [];

  return [
    { label: 'Service', value: summary.service ?? '' },
    { label: 'Barber', value: summary.barber ?? '' },
    { label: 'Date', value: summary.date ?? '' },
    { label: 'Time', value: summary.time ?? '' }
  ].filter((entry) => entry.value.trim().length > 0);
}

const BookingConfirmationPanel = forwardRef<HTMLElement, Props>(function BookingConfirmationPanel({ variant, summary }, ref) {
  const content = contentByVariant[variant];
  const rows = buildSummaryRows(summary);

  return (
    <section ref={ref} className="booking-confirmation" role="status" aria-live="polite" tabIndex={-1}>
      <div className="booking-confirmation__header">
        <div className="booking-confirmation__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M20.707 5.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L10 14.586l9.293-9.293a1 1 0 0 1 1.414 0Z" />
          </svg>
        </div>
        <div className="booking-confirmation__copy">
          <p className="booking-confirmation__eyebrow">{content.eyebrow.toUpperCase()}</p>
          <h2 className="booking-confirmation__heading">{content.heading}</h2>
          <p className="booking-confirmation__body">{content.body}</p>
        </div>
      </div>

      <div className="booking-confirmation__status-strip" aria-label="Booking success state">
        <span className="booking-confirmation__status-label">Status</span>
        <strong>{content.accent}</strong>
      </div>

      {rows.length > 0 && (
        <dl className="booking-confirmation__summary" aria-label="Booking summary">
          {rows.map((row) => (
            <div className="booking-confirmation__summary-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
});

export default BookingConfirmationPanel;
