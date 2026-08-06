/**
 * LandingBookingWidget — live client-booking preview for the landing page.
 *
 * Embeds the real `BookingFlow` in preview mode (no Details step, no action bar,
 * no review/confirm panel, never submits) and feeds it the shop's real services,
 * barbers and settings so availability is genuine. Once the visitor picks a
 * service, barber, date and time, a short “booking sent” confirmation shows,
 * then crossfades into the live-preview lock CTA.
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

type OverlayPhase = 'idle' | 'success' | 'lock';

const BOOK_HREF = '/book';
const SUCCESS_HOLD_MS = 1400;
const SUCCESS_HOLD_REDUCED_MS = 200;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LandingBookingWidget({
  services,
  barbers,
  shopDetails,
}: {
  services: WidgetService[];
  barbers: WidgetBarber[];
  shopDetails?: WidgetShopDetails;
}) {
  const [phase, setPhase] = useState<OverlayPhase>('idle');
  const isDimmed = phase !== 'idle';

  useEffect(() => {
    if (!isDimmed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('idle');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDimmed]);

  useEffect(() => {
    if (phase !== 'success') return;
    const delay = prefersReducedMotion() ? SUCCESS_HOLD_REDUCED_MS : SUCCESS_HOLD_MS;
    const timer = window.setTimeout(() => setPhase('lock'), delay);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const dismiss = () => setPhase('idle');

  return (
    <div className={`lbw${isDimmed ? ' is-dimmed' : ''}`}>
      <div className="lbw__stage">
        <div className="lbw__scroll" aria-hidden={isDimmed ? 'true' : undefined}>
          <BookingFlow
            previewMode
            services={services}
            barbers={barbers}
            shopDetails={shopDetails}
            onComplete={() => setPhase('success')}
          />
        </div>

        {phase !== 'idle' && (
          <div
            className="lbw-lock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lbw-lock-title"
            onClick={dismiss}
          >
            <div
              key={phase}
              className={`lbw-lock__card lbw-lock__card--${phase}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="lbw-lock__close"
                aria-label="Close preview message"
                onClick={dismiss}
              >
                ×
              </button>

              {phase === 'success' ? (
                <>
                  <p className="lbw-lock__eyebrow">Preview</p>
                  <p id="lbw-lock-title" className="lbw-lock__title">
                    Booking sent
                  </p>
                  <p className="lbw-lock__body">
                    In a live shop this would confirm the appointment. Here it&rsquo;s just a demo
                    of the booking flow.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingBookingWidget;
