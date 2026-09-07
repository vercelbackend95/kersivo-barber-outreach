import React, { forwardRef } from 'react';
import { ConfirmationStatusIcon } from '@/components/ConfirmationStatusIcon';

export type BookingSummary = {
  service?: string;
  barber?: string;
  date?: string;
  time?: string;
  reference?: string;
};

export type BookingDemoCopy = {
  eyebrow?: string;
  heading?: string;
  body?: string;
};

type Props = {
  variant: 'booked' | 'rescheduled' | 'demo';
  summary?: BookingSummary;
  demoCopy?: BookingDemoCopy | null;
};

const contentByVariant = {
  booked: {
    eyebrow: 'Booking confirmed',
    heading: "You're booked",
    body: 'Your appointment details are on their way by email.',
  },
  rescheduled: {
    eyebrow: 'Booking updated',
    heading: 'Your new time is confirmed',
    body: 'Updated appointment details are on their way by email.',
  },
  demo: {
    eyebrow: 'Demo complete',
    heading: 'Demo booking complete',
    body: 'Saved in this browser only — no real appointment or email.',
  },
} as const;

type PassField = { label: string; value: string; subordinate?: boolean };

function buildPassFields(summary?: BookingSummary): PassField[] {
  if (!summary) return [];

  return [
    { label: 'Service', value: summary.service ?? '' },
    { label: 'Barber', value: summary.barber ?? '' },
    { label: 'Date', value: summary.date ?? '' },
    { label: 'Time', value: summary.time ?? '' },
    { label: 'Reference', value: summary.reference ?? '', subordinate: true },
  ].filter((entry) => entry.value.trim().length > 0);
}

const BookingConfirmationPanel = forwardRef<HTMLDivElement, Props>(function BookingConfirmationPanel(
  { variant, summary, demoCopy = null },
  ref,
) {
  const defaults = contentByVariant[variant];
  const content =
    variant === 'demo' && demoCopy
      ? {
          eyebrow: demoCopy.eyebrow ?? defaults.eyebrow,
          heading: demoCopy.heading ?? defaults.heading,
          body: demoCopy.body ?? defaults.body,
        }
      : defaults;
  const fields = buildPassFields(summary);

  return (
    <section className="booking-confirmation booking-confirmation--success booking-confirmation--pass">
      <div
        ref={ref}
        className="booking-confirmation__announce"
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        <ConfirmationStatusIcon variant="success" />
        <div className="booking-confirmation__copy">
          <p className="booking-confirmation__eyebrow">{content.eyebrow}</p>
          <h2 className="booking-confirmation__heading">{content.heading}</h2>
          <p className="booking-confirmation__body">{content.body}</p>
        </div>
      </div>

      {fields.length > 0 ? (
        <dl className="booking-confirmation__pass" aria-label="Booking summary">
          {fields.map((field) => (
            <div
              className={[
                'booking-confirmation__pass-field',
                field.subordinate ? 'booking-confirmation__pass-field--ref' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              key={field.label}
            >
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
});

export default BookingConfirmationPanel;
