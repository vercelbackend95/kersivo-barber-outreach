import React, { forwardRef } from 'react';
import { ConfirmationStatusIcon } from '@/components/ConfirmationStatusIcon';
import type { BookingDemoConfirmCta } from './bookingPresentation';

export type BookingSummary = {
  service?: string;
  barber?: string;
  date?: string;
  time?: string;
  reference?: string;
};

export type BookingPostConfirmCta = {
  label: string;
  href: string;
};

export type BookingDemoCopy = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  ctas?: readonly BookingDemoConfirmCta[];
};

type Props = {
  variant: 'booked' | 'rescheduled' | 'demo';
  summary?: BookingSummary;
  postConfirmCta?: BookingPostConfirmCta | null;
  demoCopy?: BookingDemoCopy | null;
};

const contentByVariant = {
  booked: {
    eyebrow: 'Confirmed',
    heading: "You're booked",
    body: 'A confirmation email is on the way with appointment details and links to reschedule or cancel.',
  },
  rescheduled: {
    eyebrow: 'Updated',
    heading: 'Booking rescheduled',
    body: 'Your new time is confirmed. A fresh email with the updated details is on the way.',
  },
  demo: {
    eyebrow: 'Demo complete',
    heading: 'That’s the KERSIVO booking experience',
    body: 'No appointment was created and no email was sent. Ready to explore KERSIVO for your barbershop?',
  },
} as const;

const DEMO_CTAS = [
  { label: 'See pricing', href: '/#pricing', primary: true },
  { label: 'Ask about my setup', href: '/#contact', primary: false },
] as const;

function buildSummaryRows(summary?: BookingSummary): Array<{ label: string; value: string }> {
  if (!summary) return [];

  return [
    { label: 'Service', value: summary.service ?? '' },
    { label: 'Barber', value: summary.barber ?? '' },
    { label: 'Date', value: summary.date ?? '' },
    { label: 'Time', value: summary.time ?? '' },
    { label: 'Reference', value: summary.reference ?? '' },
  ].filter((entry) => entry.value.trim().length > 0);
}

const BookingConfirmationPanel = forwardRef<HTMLElement, Props>(function BookingConfirmationPanel(
  { variant, summary, postConfirmCta = null, demoCopy = null },
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
  const rows = buildSummaryRows(summary);
  const isDemo = variant === 'demo';
  const demoCtas = demoCopy?.ctas?.length ? demoCopy.ctas : DEMO_CTAS;

  return (
    <section
      ref={ref}
      className="booking-confirmation booking-confirmation--success"
      role="status"
      aria-live="polite"
      tabIndex={-1}
    >
      <div className="booking-confirmation__header">
        <ConfirmationStatusIcon variant="success" />
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

      {isDemo ? (
        <div className="booking-confirmation__cta booking-confirmation__cta--stack">
          {demoCtas.map((cta) => (
            <a
              key={cta.href}
              className={cta.primary ? 'btn btn--primary btn--lg' : 'btn btn--secondary btn--lg'}
              href={cta.href}
            >
              {cta.label}
            </a>
          ))}
        </div>
      ) : postConfirmCta ? (
        <div className="booking-confirmation__cta">
          <a className="btn btn--primary btn--lg" href={postConfirmCta.href}>
            {postConfirmCta.label}
          </a>
        </div>
      ) : null}
    </section>
  );
});

export default BookingConfirmationPanel;
