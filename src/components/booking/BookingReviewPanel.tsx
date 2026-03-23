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
  missingItems: string[];
  isReady: boolean;
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
  missingItems,
  isReady
}: Props) {
  return (
    <section className="booking-review-panel" aria-labelledby="booking-review-panel-title">
      <div className="booking-review-panel__header">
        <p className="booking-review-panel__eyebrow">Final review</p>
        <h2 id="booking-review-panel-title">Review before you confirm</h2>
        <p className="booking-review-panel__intro muted">
          Check the appointment details, confirm where updates will be sent, and review the booking policies before the final step.
        </p>
      </div>

      <div className="booking-review-panel__status" role="status" aria-live="polite">
        <div className="booking-review-panel__status-head">
          <span className={`booking-review-panel__status-badge${isReady ? ' is-ready' : ' is-pending'}`}>
            {isReady ? 'Ready to confirm' : 'Almost there'}
          </span>
          <p className="booking-review-panel__status-title">
            {isReady ? 'Everything needed for confirmation is in place.' : 'Complete the remaining items before you confirm.'}
          </p>
        </div>

        {missingItems.length > 0 ? (
          <ul className="booking-review-panel__missing-list" aria-label="Items still required before confirmation">
            {missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="booking-review-panel__status-copy">Your appointment summary is complete and ready for the final confirmation.</p>
        )}
      </div>

      <div className="booking-review-panel__grid">
        <section className="booking-review-panel__card" aria-labelledby="booking-review-appointment-title">
          <div className="booking-review-panel__card-head">
            <p className="booking-review-panel__card-kicker">Appointment review</p>
            <h3 id="booking-review-appointment-title">Appointment details</h3>
          </div>
          <ReviewList rows={appointmentRows} ariaLabel="Appointment review" />
        </section>

        {mode === 'create' ? (
          <section className="booking-review-panel__card" aria-labelledby="booking-review-contact-title">
            <div className="booking-review-panel__card-head">
              <p className="booking-review-panel__card-kicker">Contact review</p>
              <h3 id="booking-review-contact-title">Contact details</h3>
            </div>
            <ReviewList rows={contactRows} ariaLabel="Contact review" />
            {contactHelper ? <p className="booking-review-panel__helper">{contactHelper}</p> : null}
          </section>
        ) : null}

        <section className="booking-review-panel__card" aria-labelledby="booking-review-trust-title">
          <div className="booking-review-panel__card-head">
            <p className="booking-review-panel__card-kicker">Trust &amp; reassurance</p>
            <h3 id="booking-review-trust-title">What happens next</h3>
          </div>
          <ul className="booking-review-panel__trust-list" aria-label="Booking reassurance details">
            {trustItems.map((item) => (
              <li className="booking-review-panel__trust-item" key={`${item.label}-${item.value ?? ''}`}>
                <span className="booking-review-panel__trust-label">{item.label}</span>
                {item.value ? <span className="booking-review-panel__trust-value">{item.value}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
