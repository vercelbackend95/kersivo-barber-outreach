/**
 * LandingBookingWidget — live client-booking preview for the landing page.
 *
 * Embeds the real `BookingFlow` in preview mode (no Details step, no action bar,
 * no review/confirm panel, never submits) and feeds it the shop's real services,
 * barbers and settings so availability is genuine. Once the visitor picks a
 * service, barber, date and time, the form visually mutes and a "this is a live
 * preview" overlay invites them into the full `/book` flow.
 *
 * Rendered as a client-only island (time/availability dependent), mirroring
 * `InsideSystemLiveWidget`.
 */
import { useEffect, useState } from 'react';
import BookingFlow from '@/components/booking/BookingFlow';

type WidgetService = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
};

type WidgetBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  serviceIds?: string[];
};

type WidgetShopDetails = {
  timezone: string;
  cancellationWindowHours?: number | null;
  rescheduleWindowHours?: number | null;
};

const BOOK_HREF = '/book';

export function LandingBookingWidget({
  services,
  barbers,
  shopDetails,
}: {
  services: WidgetService[];
  barbers: WidgetBarber[];
  shopDetails?: WidgetShopDetails;
}) {
  const [dimmed, setDimmed] = useState(false);

  useEffect(() => {
    if (!dimmed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDimmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dimmed]);

  return (
    <div className={`lbw${dimmed ? ' is-dimmed' : ''}`}>
      <div className="lbw__stage">
        <div className="lbw__scroll" aria-hidden={dimmed ? 'true' : undefined}>
          <BookingFlow
            previewMode
            services={services}
            barbers={barbers}
            shopDetails={shopDetails}
            onComplete={() => setDimmed(true)}
          />
        </div>

        {dimmed && (
          <div
            className="lbw-lock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lbw-lock-title"
            onClick={() => setDimmed(false)}
          >
            <div className="lbw-lock__card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="lbw-lock__close"
                aria-label="Close preview message"
                onClick={() => setDimmed(false)}
              >
                ×
              </button>
              <p className="lbw-lock__eyebrow">Live preview</p>
              <p id="lbw-lock-title" className="lbw-lock__title">
                This is just a preview.
              </p>
              <p className="lbw-lock__body">
                This is a compact widget of your real booking form. Open the full
                booking flow to complete the details and confirm an appointment.
              </p>
              <a
                href={BOOK_HREF}
                className="btn btn--primary lbw-lock__cta"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Booking Flow
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingBookingWidget;
