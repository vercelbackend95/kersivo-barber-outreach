import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import { DEMO_SHOP_HREF } from '@/lib/demo/nav';
import { ArrowRight, X } from '@/components/lucide-react';
import '@/styles/components/admin-booking-proof-card.css';

export type BlacklineBookingProofCardProps = {
  bookingId: string;
  onDismiss: () => void;
};

export default function BlacklineBookingProofCard({
  bookingId,
  onDismiss,
}: BlacklineBookingProofCardProps) {
  const viewedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackConsentedEvent(FUNNEL_EVENTS.blackline_booking_proof_card_viewed, { bookingId }, 'analytics');
  }, [bookingId]);

  const dismiss = (eventName: FunnelEventNameForDismiss) => {
    trackConsentedEvent(eventName, { bookingId }, 'analytics');
    onDismiss();
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="bl-booking-proof-layer" data-blackline-booking-proof-layer="">
      <button
        type="button"
        className="bl-booking-proof-layer__catch"
        aria-label="Dismiss booking proof overlay"
        onClick={() => dismiss(FUNNEL_EVENTS.blackline_booking_proof_dismissed)}
      />
      <aside
        className="bl-booking-proof"
        data-blackline-booking-proof=""
        role="dialog"
        aria-modal="true"
        aria-labelledby="bl-booking-proof-title"
        aria-describedby="bl-booking-proof-body"
      >
        <button
          type="button"
          className="bl-booking-proof__close"
          aria-label="Dismiss"
          onClick={() => dismiss(FUNNEL_EVENTS.blackline_booking_proof_dismissed)}
        >
          <X width={18} height={18} aria-hidden="true" />
        </button>

        <p className="bl-booking-proof__eyebrow">YOUR BOOKING IS LIVE</p>
        <h2 id="bl-booking-proof-title" className="bl-booking-proof__title">
          You’ve just seen the booking flow from the client side to your dashboard.
        </h2>
        <p id="bl-booking-proof-body" className="bl-booking-proof__body">
          There’s more to explore — try retail, look around the dashboard, or see what KERSIVO could
          look like for your shop.
        </p>

        <div className="bl-booking-proof__next">
          <p className="bl-booking-proof__next-label">NEXT EXPERIENCE</p>
          <a
            className="bl-booking-proof__next-link"
            href={DEMO_SHOP_HREF}
            onClick={() => {
              trackConsentedEvent(
                FUNNEL_EVENTS.blackline_booking_proof_order_clicked,
                { bookingId },
                'analytics',
              );
              onDismiss();
            }}
          >
            <span className="bl-booking-proof__next-copy">
              <span className="bl-booking-proof__next-title">Place a demo order</span>
              <span className="bl-booking-proof__next-micro">
                See how retail flows into the admin
              </span>
            </span>
            <span className="bl-booking-proof__next-arrow" aria-hidden="true">
              <ArrowRight width={18} height={18} />
            </span>
          </a>
        </div>

        <div className="bl-booking-proof__or-row">
          <span className="bl-booking-proof__or" aria-hidden="true">
            OR
          </span>
          <button
            type="button"
            className="bl-booking-proof__explore"
            onClick={() => dismiss(FUNNEL_EVENTS.blackline_booking_proof_explore_clicked)}
          >
            Explore the dashboard
          </button>
        </div>

        <div className="bl-booking-proof__convert">
          <p className="bl-booking-proof__convert-eyebrow">READY TO MAKE IT YOURS?</p>
          <a
            className="bl-booking-proof__convert-cta"
            href={OWNER_LAUNCH_HREF}
            onClick={() => {
              trackConsentedEvent(
                FUNNEL_EVENTS.blackline_booking_proof_get_kersivo_clicked,
                { bookingId },
                'analytics',
              );
              onDismiss();
            }}
          >
            Get KERSIVO for my shop
          </a>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

type FunnelEventNameForDismiss =
  | typeof FUNNEL_EVENTS.blackline_booking_proof_dismissed
  | typeof FUNNEL_EVENTS.blackline_booking_proof_explore_clicked;
