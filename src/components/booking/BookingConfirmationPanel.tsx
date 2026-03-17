import React from 'react';

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
    heading: 'Booking confirmed',
    body: 'Your appointment has been booked successfully. A confirmation email has been sent with reschedule and cancel links.'
  },
  rescheduled: {
    eyebrow: 'Booking rescheduled',
    heading: 'Booking rescheduled',
    body: 'Your appointment has been updated successfully. A confirmation email has been sent with your new booking details.'
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

export default function BookingConfirmationPanel({ variant, summary }: Props) {
  const content = contentByVariant[variant];
  const rows = buildSummaryRows(summary);

  return (
    <section className="booking-confirmation" role="status">
      <p className="booking-confirmation__eyebrow">{content.eyebrow.toUpperCase()}</p>
      <h2 className="booking-confirmation__heading">{content.heading}</h2>
      <p className="booking-confirmation__body">{content.body}</p>

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
}
