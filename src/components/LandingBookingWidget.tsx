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
import '@/styles/components/booking.css';
import '@/styles/components/booking-flow.css';
import '@/styles/components/booking-mobile.css';
import '@/styles/components/booking-review.css';
import '@/styles/components/empty-state.css';
import '@/styles/components/landingBookingWidget.css';
import '@/styles/components/skeleton.css';

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
                This compact booking form is a teaser of the real flow. Build My Booking
                Preview to start your own shop, or continue with the example booking flow
                without signing up.
              </p>
              <div className="lbw-lock__actions">
                <a
                  href="/admin/onboarding"
                  className="btn btn--primary lbw-lock__cta"
                  data-track="plan_my_setup_click"
                >
                  Build My Booking Preview
                </a>
                <a
                  href={BOOK_HREF}
                  className="btn btn--ghost lbw-lock__cta lbw-lock__cta--ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue With Example Booking Flow
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingBookingWidget;
