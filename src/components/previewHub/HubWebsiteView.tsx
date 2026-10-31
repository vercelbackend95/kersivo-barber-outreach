import { useEffect, useRef, useState } from 'react';
import BookingFlow from '@/components/booking/BookingFlow';
import PreviewTopBar from '@/components/freePreview/PreviewTopBar';
import { previewBookingPresentation } from '@/lib/freePreview/previewBooking';
import {
  HUB_WEBSITE_BOOKING,
  HUB_WEBSITE_DESKTOP,
  HUB_WEBSITE_OPEN_TAB,
  HUB_WEBSITE_PHONE,
  HUB_WEBSITE_REQUEST_CHANGES,
  HUB_WEBSITE_SUGGEST,
  HUB_WEBSITE_TEST_NOTE,
  HUB_WEBSITE_WEBSITE,
} from '@/lib/freePreview/hubCopy';
import { HUB_CHANGE_PAGES } from '@/lib/freePreview/hubChanges';
import { HubChanges } from './HubChanges';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges';

export type HubWebsiteDraft = {
  sitePreviewUrl: string | null;
  timezone: string;
  cancellationWindowHours: number;
  rescheduleWindowHours: number;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    pricePence: number;
    category: string | null;
    description: string | null;
  }>;
  barbers: Array<{ id: string; name: string; serviceIds: string[] }>;
};

export function HubWebsiteView(props: {
  token: string;
  shopName: string;
  townCity: string;
  firstName: string | null;
  checkoutEmail: string;
  hasOwnDomain: string;
  existingWebsiteHost: string;
  isOperator: boolean;
  converted: boolean;
  view: 'website' | 'booking';
  websiteHref: string;
  bookingHref: string;
  changesHref: string;
  draft: HubWebsiteDraft;
  changeItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
  canDraft: boolean;
  canSend: boolean;
  canCheckout: boolean;
}) {
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [sheet, setSheet] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const apply = () => setDevice(wide.matches ? 'desktop' : 'phone');
    apply();
    wide.addEventListener('change', apply);
    return () => wide.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (device !== 'phone' || !frame.current) return;
    const node = frame.current;
    const update = () => setScale(Math.min(1, node.clientWidth / 390));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [device]);

  const showWebsite = props.view === 'website' && Boolean(props.draft.sitePreviewUrl);
  const suggestPage = props.view === 'booking' ? 'BOOKING' : 'HOME';

  return (
    <div className="hub-website">
      <div className="hub-website-toolbar">
        <div className="hub-seg" role="group" aria-label="Preview pages">
          <a
            className="hub-seg__btn"
            href={props.websiteHref}
            aria-current={props.view === 'website' ? 'page' : undefined}
          >
            {HUB_WEBSITE_WEBSITE}
          </a>
          <a
            className="hub-seg__btn"
            href={props.bookingHref}
            aria-current={props.view === 'booking' ? 'page' : undefined}
          >
            {HUB_WEBSITE_BOOKING}
          </a>
        </div>
        <div className="hub-seg" role="group" aria-label="Device">
          <button
            type="button"
            className="hub-seg__btn"
            aria-pressed={device === 'phone'}
            onClick={() => setDevice('phone')}
          >
            {HUB_WEBSITE_PHONE}
          </button>
          <button
            type="button"
            className="hub-seg__btn"
            aria-pressed={device === 'desktop'}
            onClick={() => setDevice('desktop')}
          >
            {HUB_WEBSITE_DESKTOP}
          </button>
        </div>
        <p className="hub-website-toolbar__note">{HUB_WEBSITE_TEST_NOTE}</p>
        <div className="hub-website-toolbar__actions">
          {showWebsite ? (
            <a className="btn btn--ghost btn--sm" href={props.draft.sitePreviewUrl ?? '#'} target="_blank" rel="noopener noreferrer">
              {HUB_WEBSITE_OPEN_TAB}
            </a>
          ) : null}
          <a className="btn btn--secondary btn--sm" href={props.changesHref}>
            {HUB_WEBSITE_REQUEST_CHANGES}
          </a>
          {props.canDraft ? (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSheet(true)}>
              {HUB_WEBSITE_SUGGEST}
            </button>
          ) : null}
          {props.canCheckout ? (
            <PreviewTopBar
              chrome="checkout"
              token={props.token}
              shopName={props.shopName}
              townCity={props.townCity}
              firstName={props.firstName}
              checkoutEmail={props.checkoutEmail}
              hasOwnDomain={props.hasOwnDomain}
              existingWebsiteHost={props.existingWebsiteHost}
              isOperator={props.isOperator}
              converted={props.converted}
              activeView={props.view}
              websiteHref={props.websiteHref}
              bookingHref={props.bookingHref}
            />
          ) : null}
        </div>
      </div>

      <div className={`hub-device hub-device--${device}`} ref={frame}>
        {showWebsite ? (
          <div className="hub-device__stage" style={device === 'phone' ? { transform: `scale(${scale})` } : undefined}>
            <iframe
              className="hub-device__frame"
              src={props.draft.sitePreviewUrl ?? ''}
              title={`Website preview for ${props.shopName}`}
              referrerPolicy="no-referrer"
            />
          </div>
        ) : props.draft.services.length && props.draft.barbers.length ? (
          <div className="hub-device__stage hub-device__stage--booking" style={device === 'phone' ? { transform: `scale(${scale})` } : undefined}>
            <BookingFlow
              mode="create"
              publicDemoMode={true}
              services={props.draft.services}
              barbers={props.draft.barbers}
              shopDetails={{
                timezone: props.draft.timezone,
                name: props.shopName,
                cancellationWindowHours: props.draft.cancellationWindowHours,
                rescheduleWindowHours: props.draft.rescheduleWindowHours,
              }}
              presentation={previewBookingPresentation(props.shopName)}
            />
          </div>
        ) : (
          <p className="hub-card__body">We're still adding services and barbers to this booking page.</p>
        )}
      </div>

      {sheet ? (
        <div className="hub-sheet" role="dialog" aria-modal="true" aria-labelledby="hub-suggest-title">
          <div className="hub-sheet__panel">
            <header className="hub-review-card__head">
              <h2 id="hub-suggest-title">{HUB_WEBSITE_SUGGEST}</h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSheet(false)}>
                Close
              </button>
            </header>
            <HubChanges
              token={props.token}
              initialItems={props.changeItems}
              includedChangeRounds={props.includedChangeRounds}
              changeRoundsUsed={props.changeRoundsUsed}
              canDraft={props.canDraft}
              canSend={props.canSend}
              initialPage={suggestPage as (typeof HUB_CHANGE_PAGES)[number]}
              startComposer
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
