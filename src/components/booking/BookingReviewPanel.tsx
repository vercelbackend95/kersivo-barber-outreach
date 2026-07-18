import React from 'react';

type ReviewRow = {
  label: string;
  value: string;
};

type TrustItem = {
  label: string;
  value?: string;
};

type Props = {
  mode: 'create' | 'reschedule';
  appointmentRows: ReviewRow[];
  contactRows?: ReviewRow[];
  contactHelper?: string;
  trustItems: TrustItem[];
  /** Caps trust list length (default 3). Public demo passes 4 sandbox points. */
  maxTrustItems?: number;
  alwaysVisible?: boolean;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  submitLabel?: string;
  onSubmit?: () => void;
};

function ReviewList({ rows, ariaLabel }: { rows: ReviewRow[]; ariaLabel: string }) {
  return (
    <dl className="booking-review-panel__list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <div className="booking-review-panel__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function BookingReviewPanel({
  mode,
  appointmentRows,
  contactRows = [],
  contactHelper,
  trustItems,
  maxTrustItems = 3,
  alwaysVisible = false,
  isSubmitting = false,
  isSubmitDisabled = true,
  submitLabel,
  onSubmit,
}: Props) {
  const ctaLabel = isSubmitting
    ? (mode === 'reschedule' ? 'Rescheduling…' : 'Confirming…')
    : (submitLabel ?? (mode === 'reschedule' ? 'Reschedule booking' : 'Confirm booking'));

  const showContact = mode === 'create' && contactRows.some((row) => row.value !== '—');

  return (
    <aside
      className={`booking-review-panel${alwaysVisible ? ' booking-review-panel--always-visible' : ''}`}
      aria-labelledby="booking-review-panel-title"
    >
      <div className="booking-review-panel__header">
        <p className="booking-review-panel__eyebrow">Summary</p>
        <h2 id="booking-review-panel-title">Your booking</h2>
      </div>

      <div className="booking-review-panel__grid">
        <section className="booking-review-panel__card" aria-labelledby="booking-review-appointment-title">
          <h3 id="booking-review-appointment-title" className="booking-review-panel__card-title">Appointment</h3>
          <ReviewList rows={appointmentRows} ariaLabel="Appointment review" />
        </section>

        {showContact ? (
          <section className="booking-review-panel__card" aria-labelledby="booking-review-contact-title">
            <h3 id="booking-review-contact-title" className="booking-review-panel__card-title">Contact</h3>
            <ReviewList rows={contactRows} ariaLabel="Contact review" />
            {contactHelper ? <p className="booking-review-panel__helper">{contactHelper}</p> : null}
          </section>
        ) : null}

        <section className="booking-review-panel__card booking-review-panel__card--trust" aria-labelledby="booking-review-trust-title">
          <h3 id="booking-review-trust-title" className="booking-review-panel__card-title">Next</h3>
          <ul className="booking-review-panel__trust-list" aria-label="Booking reassurance details">
            {trustItems.slice(0, maxTrustItems).map((item) => (
              <li className="booking-review-panel__trust-item" key={`${item.label}-${item.value ?? ''}`}>
                <span className="booking-review-panel__trust-label">{item.label}</span>
                {item.value ? <span className="booking-review-panel__trust-value">{item.value}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {alwaysVisible && onSubmit ? (
        <div className="booking-review-panel__cta">
          <button
            type="button"
            className="btn btn--primary booking-review-panel__cta-button"
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled}
            aria-busy={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? <span className="booking-action-bar__spinner" aria-hidden="true" /> : null}
            <span>{ctaLabel}</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
