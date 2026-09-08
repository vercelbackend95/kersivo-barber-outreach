import React, { forwardRef } from 'react';
import { ConfirmationStatusIcon } from '@/components/ConfirmationStatusIcon';
import AddToCalendarControl from '@/components/booking/AddToCalendarControl';
import type { BookingCalendarInput } from '@/lib/booking/calendarEvent';

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

export type { BookingCalendarInput };

type Props = {
  variant: 'booked' | 'rescheduled' | 'demo';
  summary?: BookingSummary;
  demoCopy?: BookingDemoCopy | null;
  calendar?: BookingCalendarInput | null;
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
    heading: "You're all set",
    body: 'Demo only — no appointment or email was created.',
  },
} as const;

const BookingConfirmationPanel = forwardRef<HTMLDivElement, Props>(function BookingConfirmationPanel(
  { variant, summary, demoCopy = null, calendar = null },
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

  const service = summary?.service?.trim() || '';
  const barber = summary?.barber?.trim() || '';
  const date = summary?.date?.trim() || '';
  const time = summary?.time?.trim() || '';
  const reference = summary?.reference?.trim() || '';
  const hasPass = Boolean(service || barber || date || time || reference);
  const whenValue = [date, time].filter(Boolean).join(' · ');
  const showCalendar = Boolean(calendar?.shopName?.trim() && calendar?.timezone?.trim());

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

      {hasPass ? (
        <div className="booking-confirmation__pass" aria-label="Booking summary">
          <dl className="booking-confirmation__pass-fields">
            {service ? (
              <div className="booking-confirmation__pass-field booking-confirmation__pass-field--service">
                <dt>Appointment</dt>
                <dd>{service}</dd>
              </div>
            ) : null}

            {date ? (
              <div className="booking-confirmation__pass-field booking-confirmation__pass-field--date">
                <dt>Date</dt>
                <dd>{date}</dd>
              </div>
            ) : null}

            {time ? (
              <div className="booking-confirmation__pass-field booking-confirmation__pass-field--time">
                <dt>Time</dt>
                <dd>{time}</dd>
              </div>
            ) : null}

            {whenValue ? (
              <div className="booking-confirmation__pass-when" aria-hidden="true">
                {whenValue}
              </div>
            ) : null}

            {barber ? (
              <div className="booking-confirmation__pass-field booking-confirmation__pass-field--barber">
                <dt>Barber</dt>
                <dd>
                  <span className="booking-confirmation__pass-with">with </span>
                  {barber}
                </dd>
              </div>
            ) : null}

            {reference ? (
              <div className="booking-confirmation__pass-field booking-confirmation__pass-field--ref">
                <dt>Reference</dt>
                <dd>{reference}</dd>
              </div>
            ) : null}
          </dl>

          {showCalendar && calendar ? (
            <AddToCalendarControl calendar={calendar} className="booking-confirmation__calendar" />
          ) : null}
        </div>
      ) : null}
    </section>
  );
});

export default BookingConfirmationPanel;
