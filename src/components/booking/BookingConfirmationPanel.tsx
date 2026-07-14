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
    eyebrow: 'Confirmed',
    heading: 'You\'re booked',
    body: 'A confirmation email is on the way with appointment details and links to reschedule or cancel.',
  },
  rescheduled: {
    eyebrow: 'Updated',
    heading: 'Booking rescheduled',
    body: 'Your new time is confirmed. A fresh email with the updated details is on the way.',
  },
} as const;

function buildSummaryRows(summary?: BookingSummary): Array<{ label: string; value: string }> {
  if (!summary) return [];

  return [
    { label: 'Service', value: summary.service ?? '' },
    { label: 'Barber', value: summary.barber ?? '' },
    { label: 'Date', value: summary.date ?? '' },
    { label: 'Time', value: summary.time ?? '' },
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
          <p className="booking-confirmation__eyebrow">{content.eyebrow}</p>
          <h2 className="booking-confirmation__heading">{content.heading}</h2>
          <p className="booking-confirmation__body">{content.body}</p>
        </div>
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
