import type { CSSProperties } from 'react';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import { useHubState } from '@/lib/adminHub/hubStore';
import { shopInitials } from '@/lib/adminHub/overviewTiles';
import { overviewColoursFromLive } from './AdminHubColoursTile';

/** Preview tile phone: logo / initials on the Main brand colour (neutral surface until Main is set), from the hub store. */
export function AdminHubPreviewPhone(props: {
  initialState: AdminHubLiveState;
  shopName: string;
  screenshotSrc?: string | null;
}) {
  const live = useHubState(props.initialState) ?? props.initialState;
  const main = overviewColoursFromLive(live).main;
  const previewColour = main?.css ?? 'var(--surface-3)';
  const logoSrc = live.currentLogo?.src ?? null;
  return (
    <div className="admin-hub-phonewrap" style={{ '--admin-hub-brand': previewColour } as CSSProperties}>
      <div className="admin-hub-phone" aria-hidden="true">
        <div className="admin-hub-phone__screen" style={{ background: previewColour }}>
          <span className="admin-hub-phone__notch"></span>
          {props.screenshotSrc ? (
            <img
              src={props.screenshotSrc}
              alt=""
              width="182"
              height="386"
              className="admin-hub-phone__logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : logoSrc ? (
            <img className="admin-hub-phone__logo" src={logoSrc} alt="" width="72" height="72" />
          ) : (
            <span className="admin-hub-phone__initials">{shopInitials(props.shopName)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
