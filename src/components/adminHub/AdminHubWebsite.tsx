import { useEffect, useRef, useState } from 'react';
import BookingFlow from '@/components/booking/BookingFlow';
import PreviewTopBar from '@/components/freePreview/PreviewTopBar';
import { Calendar, ExternalLink, Globe, Lock, MessageCircle, Monitor, Smartphone } from '@/components/lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HubChangeComposer } from '@/components/previewHub/HubChangeComposer';
import { useHubChanges } from '@/components/previewHub/useHubChanges';
import type { HubWebsiteDraft } from '@/components/previewHub/HubWebsiteView';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import { previewBookingPresentation } from '@/lib/freePreview/previewBooking';
import {
  ADMIN_HUB_BOOKING_EMPTY,
  ADMIN_HUB_WEBSITE_DEVICE,
  ADMIN_HUB_WEBSITE_FULL_SCREEN,
  ADMIN_HUB_WEBSITE_PAGES,
  ADMIN_HUB_WEBSITE_SUB,
  ADMIN_HUB_WEBSITE_SUGGEST_SHORT,
  ADMIN_HUB_WEBSITE_TITLE,
} from '@/lib/adminHub/copy';
import {
  defaultPreviewDevice,
  previewFrameSize,
  previewScale,
  previewScaleBadge,
  previewWrapperSize,
  readStoredDevice,
  writeStoredDevice,
  type PreviewDevice,
} from '@/lib/adminHub/previewStage';
import {
  HUB_NAV,
  HUB_WEBSITE_BOOKING,
  HUB_WEBSITE_DESKTOP,
  HUB_WEBSITE_OPEN_TAB,
  HUB_WEBSITE_PHONE,
  HUB_WEBSITE_SUGGEST,
  HUB_WEBSITE_TEST_NOTE,
  HUB_WEBSITE_WEBSITE,
} from '@/lib/freePreview/hubCopy';
import { AdminHubSheet } from './AdminHubSheet';

const ICON = { width: 16, height: 16, strokeWidth: 1.8, 'aria-hidden': true } as const;

export function AdminHubWebsite(props: {
  token: string;
  apiBase?: string;
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
  draft: HubWebsiteDraft;
  changeItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
  canDraft: boolean;
  canSend: boolean;
  canCheckout: boolean;
}) {
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [ready, setReady] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const hub = useHubChanges({
    token: props.token,
    apiBase: props.apiBase,
    initialItems: props.changeItems,
    includedChangeRounds: props.includedChangeRounds,
    changeRoundsUsed: props.changeRoundsUsed,
    canDraft: props.canDraft,
    canSend: props.canSend,
    initialPage: props.view === 'booking' ? 'BOOKING' : 'HOME',
  });

  useEffect(() => {
    const stored = readStoredDevice();
    setDevice(stored ?? defaultPreviewDevice(window.innerWidth));
    setReady(true);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => setStageWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function chooseDevice(next: PreviewDevice) {
    setDevice(next);
    writeStoredDevice(next);
  }

  const showWebsite = props.view === 'website' && Boolean(props.draft.sitePreviewUrl);
  const frame = previewFrameSize(device, stageWidth);
  const scale = previewScale(device, stageWidth);
  const wrap = previewWrapperSize(device, stageWidth);
  const badge = previewScaleBadge(device, stageWidth);
  const openUrl = props.draft.sitePreviewUrl;
  const previewTitle =
    props.view === 'booking' ? `Booking preview for ${props.shopName}` : `Website preview for ${props.shopName}`;

  return (
    <article
      className="admin-hub-website"
      data-testid="admin-hub-website"
      data-device={device}
      data-view={props.view}
      data-ready={ready ? 'true' : 'false'}
    >
      <header className="admin-hub-head">
        <div>
          <span className="admin-hub-head__eyebrow">{HUB_NAV.website}</span>
          <h1>{ADMIN_HUB_WEBSITE_TITLE}</h1>
          <p className="admin-hub-head__sub">{ADMIN_HUB_WEBSITE_SUB}</p>
        </div>
        {props.canCheckout ? (
          <div className="admin-hub-head__actions">
            <PreviewTopBar
              chrome="checkout-outline"
              token={props.token}
              apiBase={props.apiBase}
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
          </div>
        ) : null}
      </header>

      <div className="admin-hub-wtoolbar">
        <SegmentedControl
          ariaLabel={ADMIN_HUB_WEBSITE_PAGES}
          value={props.view}
          options={[
            {
              value: 'website',
              label: HUB_WEBSITE_WEBSITE,
              href: props.websiteHref,
              icon: <Globe {...ICON} />,
            },
            {
              value: 'booking',
              label: HUB_WEBSITE_BOOKING,
              href: props.bookingHref,
              icon: <Calendar {...ICON} />,
            },
          ]}
        />
        <SegmentedControl
          ariaLabel={ADMIN_HUB_WEBSITE_DEVICE}
          name="hub-website-device"
          value={device}
          onChange={chooseDevice}
          options={[
            { value: 'phone', label: HUB_WEBSITE_PHONE, icon: <Smartphone {...ICON} /> },
            { value: 'desktop', label: HUB_WEBSITE_DESKTOP, icon: <Monitor {...ICON} /> },
          ]}
        />
        <p className="admin-hub-wtoolbar__note admin-hub-wtoolbar__note--bar">
          <Lock width={13} height={13} strokeWidth={1.8} aria-hidden="true" />
          {HUB_WEBSITE_TEST_NOTE}
        </p>
        <span className="admin-hub-wtoolbar__spacer" />
        {openUrl ? (
          <a
            className="btn btn--ghost btn--sm admin-hub-wtoolbar__desktop-btn"
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-astro-reload=""
            data-astro-prefetch="false"
          >
            <ExternalLink {...ICON} />
            {HUB_WEBSITE_OPEN_TAB}
          </a>
        ) : null}
        {props.canDraft ? (
          <button
            type="button"
            className="btn btn--outline btn--sm admin-hub-wtoolbar__desktop-btn"
            onClick={() => hub.openComposer(props.view === 'booking' ? 'BOOKING' : 'HOME')}
          >
            <MessageCircle {...ICON} />
            {HUB_WEBSITE_SUGGEST}
          </button>
        ) : null}
      </div>

      <div className={`admin-hub-stage admin-hub-stage--${device}`} ref={stageRef} data-testid="admin-hub-stage">
        <div className="admin-hub-stage__fit" style={{ width: wrap.width || undefined, height: wrap.height || undefined }}>
          <div
            className="admin-hub-stage__frame"
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
            }}
          >
            {showWebsite ? (
              <iframe
                className="admin-hub-stage__iframe"
                src={openUrl ?? ''}
                title={previewTitle}
                referrerPolicy="no-referrer"
              />
            ) : props.draft.services.length && props.draft.barbers.length ? (
              <div className="admin-hub-stage__booking">
                <BookingFlow
                  mode="create"
                  publicDemoMode={true}
                  services={props.draft.services}
                  barbers={props.draft.barbers}
                  openingHours={props.draft.hours}
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
              <p className="admin-hub-stage__empty">{ADMIN_HUB_BOOKING_EMPTY}</p>
            )}
          </div>
        </div>
        {badge ? (
          <span className="admin-hub-stage__badge" data-testid="admin-hub-scale-badge">
            <Monitor width={12} height={12} strokeWidth={1.8} aria-hidden="true" />
            {badge}
          </span>
        ) : null}
      </div>

      <div className="admin-hub-wtoolbar__mobile">
        {openUrl ? (
          <a
            className="btn btn--outline btn--sm"
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-astro-reload=""
            data-astro-prefetch="false"
          >
            <ExternalLink {...ICON} />
            {ADMIN_HUB_WEBSITE_FULL_SCREEN}
          </a>
        ) : (
          <span />
        )}
        {props.canDraft ? (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => hub.openComposer(props.view === 'booking' ? 'BOOKING' : 'HOME')}
          >
            <MessageCircle {...ICON} />
            {ADMIN_HUB_WEBSITE_SUGGEST_SHORT}
          </button>
        ) : null}
      </div>
      <p className="admin-hub-wtoolbar__note admin-hub-wtoolbar__note--mobile">
        <Lock width={13} height={13} strokeWidth={1.8} aria-hidden="true" />
        {HUB_WEBSITE_TEST_NOTE}
      </p>

      {hub.composer ? (
        <AdminHubSheet title={HUB_WEBSITE_SUGGEST} crumb={`${HUB_NAV.website} › ${HUB_WEBSITE_SUGGEST}`} onClose={hub.closeComposer}>
          <HubChangeComposer
            token={props.token}
            apiBase={props.apiBase}
            composer={hub.composer}
            setComposer={hub.setComposer}
            busy={hub.busy}
            onCancel={hub.closeComposer}
            onSave={() => void hub.saveDraft()}
          />
        </AdminHubSheet>
      ) : null}
    </article>
  );
}
