import type { CSSProperties, KeyboardEvent } from 'react';
import { ArrowUpRight, Lock, Palette } from '@/components/lucide-react';
import {
  ADMIN_HUB_COLOURS_MINUTE,
  ADMIN_HUB_COLOURS_NONE,
  ADMIN_HUB_COLOURS_TUNE,
  ADMIN_HUB_OPEN,
  ADMIN_HUB_TILE_COLOURS,
} from '@/lib/adminHub/copy';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import { useHubState } from '@/lib/adminHub/hubStore';
import { overviewColours, overviewTileHrefs, shopInitials } from '@/lib/adminHub/overviewTiles';

export function overviewColoursFromLive(live: AdminHubLiveState) {
  return overviewColours({
    hasLogo: Boolean(live.currentLogo?.src),
    brandPrimaryColour: live.details.brandPrimaryColour,
    brandSecondaryColour: live.details.brandSecondaryColour,
    brandColoursSentAt: live.details.brandColoursSentAt,
    brandColoursSource: live.details.brandColoursSource,
    brandPaletteExtracted: live.details.brandPaletteExtracted,
  });
}

/** Overview "Brand colours" tile: the whole tile is one link into the Brand colours app. */
export function AdminHubColoursTile(props: { initialState: AdminHubLiveState; shopName: string }) {
  const live = useHubState(props.initialState) ?? props.initialState;
  const colours = overviewColoursFromLive(live);
  const logoSrc = live.currentLogo?.src ?? null;
  const previewColour = colours.swatches[0]?.css || 'var(--color-brand)';
  const initials = shopInitials(props.shopName);

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <a
      className="admin-hub-tile admin-hub-bento__colours"
      data-tile="colours"
      href={overviewTileHrefs().colours}
      data-locked={colours.locked ? 'true' : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="admin-hub-tile__head">
        <span className="admin-hub-tile__icon" aria-hidden="true">
          <Palette width={15} height={15} strokeWidth={1.8} />
        </span>
        <span className="admin-hub-tile__title">{ADMIN_HUB_TILE_COLOURS}</span>
        <span className="admin-hub-tile__open" aria-label={ADMIN_HUB_OPEN}>
          <ArrowUpRight width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="admin-hub-colours-body">
        <div className="admin-hub-logo-mini">
          <span
            className={`admin-hub-logo-mini__mark${logoSrc ? '' : ' admin-hub-skel'}`}
            style={logoSrc ? undefined : { background: previewColour }}
          >
            {logoSrc ? <img src={logoSrc} alt="" width="40" height="40" /> : <span aria-hidden="true">{initials}</span>}
          </span>
          {colours.swatches.length ? (
            <p>
              <strong>{colours.headline}</strong>
              {colours.locked ? null : <span>{ADMIN_HUB_COLOURS_TUNE}</span>}
            </p>
          ) : null}
        </div>
        {colours.swatches.length ? (
          <div className="admin-hub-swatches">
            {colours.swatches.map((swatch) => (
              <div
                key={swatch.hex}
                className={`admin-hub-sw${swatch.light ? ' admin-hub-sw--light' : ''}`}
                style={{ '--admin-hub-swatch': swatch.css } as CSSProperties}
              >
                <span className="admin-hub-sw__chip" aria-hidden="true" />
                {swatch.role ? <span className="admin-hub-sw__role">{swatch.role}</span> : null}
                <small>{swatch.hex}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-hub-colours-empty">{ADMIN_HUB_COLOURS_NONE}</p>
        )}
        <div className="admin-hub-tile__foot">
          <span
            className={`admin-hub-pill ${colours.status === 'not_sent' ? 'admin-hub-pill--amber' : 'admin-hub-pill--live'}`}
            data-testid="admin-hub-colours-status"
          >
            {colours.locked ? (
              <Lock width={11} height={11} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <span className="admin-hub-pill__dot" aria-hidden="true"></span>
            )}
            {colours.statusLabel}
          </span>
          {colours.status === 'not_sent' && colours.swatches.length ? <span>{ADMIN_HUB_COLOURS_MINUTE}</span> : null}
        </div>
      </div>
    </a>
  );
}
