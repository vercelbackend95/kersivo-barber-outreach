import type { CSSProperties, KeyboardEvent } from 'react';
import { ArrowUpRight, Lock, Palette } from '@/components/lucide-react';
import {
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_BOOK,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_OPEN,
  ADMIN_HUB_TILE_COLOURS,
} from '@/lib/adminHub/copy';
import { betterButtonText, siteBackgroundHex } from '@/lib/adminHub/colour';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import { useHubSnapshot } from '@/lib/adminHub/hubStore';
import {
  OVERVIEW_PALETTE_CAP,
  overviewColours,
  overviewTileHrefs,
  shopInitials,
  type OverviewColoursLook,
  type OverviewRoleColour,
} from '@/lib/adminHub/overviewTiles';

export function overviewColoursFromLive(live: AdminHubLiveState) {
  return overviewColours({
    hasLogo: Boolean(live.currentLogo),
    brandPrimaryColour: live.details.brandPrimaryColour,
    brandSecondaryColour: live.details.brandSecondaryColour,
    brandColoursSentAt: live.details.brandColoursSentAt,
    brandColoursSource: live.details.brandColoursSource,
    brandBackgroundTone: live.details.brandBackgroundTone,
    brandPaletteExtracted: live.details.brandPaletteExtracted,
  });
}

const PILL_CLASS = {
  no_logo: 'admin-hub-pill--amber',
  not_started: 'admin-hub-pill--amber',
  draft: 'admin-hub-pill--draft',
  sent: 'admin-hub-pill--live',
  kersivo: 'admin-hub-pill--live',
} as const;

/**
 * Overview "Brand colours" tile: the whole tile is one link (into Brand colours, or Materials → Logo when there
 * is no logo yet). Layout switches on the tile's own width (container queries), so SSR and every width agree.
 */
export function AdminHubColoursTile(props: { initialState: AdminHubLiveState | null; shopName: string }) {
  const snapshot = useHubSnapshot();
  const live = snapshot.state ?? props.initialState;
  // Skeleton chips only while the first state is still on its way — never placeholder colours.
  const loading = !live && snapshot.pending;
  const colours = live ? overviewColoursFromLive(live) : null;
  const logoSrc = live?.currentLogo?.src ?? null;
  const initials = shopInitials(props.shopName);
  const state = colours?.state ?? 'no_logo';

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  const chips = colours?.palette ?? [];
  const darkPlate = siteBackgroundHex('DARK', colours?.main?.hex ?? null);
  const lightPlate = siteBackgroundHex('LIGHT');

  return (
    <a
      className="admin-hub-tile admin-hub-bento__colours"
      data-tile="colours"
      data-state={state}
      href={colours?.href ?? overviewTileHrefs().colours}
      data-locked={colours?.locked ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
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
        <div className={`admin-hub-colours-layout${colours?.look ? ' admin-hub-colours-layout--look' : ''}`}>
          <div className="admin-hub-colours-main">
            <div className="admin-hub-colours-id">
              <div className="admin-hub-colours-logos" data-testid="admin-hub-colours-logos">
                <span className="admin-hub-colours-plate" style={{ background: darkPlate }}>
                  {logoSrc ? (
                    <img src={logoSrc} alt="" width="160" height="90" decoding="async" />
                  ) : (
                    <span className="admin-hub-colours-plate__initials" aria-hidden="true">
                      {initials}
                    </span>
                  )}
                </span>
                {logoSrc ? (
                  <span className="admin-hub-colours-plate admin-hub-colours-plate--light" style={{ background: lightPlate }}>
                    <img src={logoSrc} alt="" width="160" height="90" decoding="async" />
                  </span>
                ) : null}
              </div>
              <p className="admin-hub-colours-headline" data-testid="admin-hub-colours-headline">
                {colours ? <strong>{colours.headline}</strong> : null}
              </p>
            </div>
            <ul
              className={`admin-hub-palette${chips.length ? '' : ' admin-hub-palette--empty'}${loading ? ' admin-hub-palette--loading' : ''}`}
              data-testid="admin-hub-colours-palette"
              data-count={chips.length}
              aria-hidden={chips.length ? undefined : 'true'}
            >
              {chips.length
                ? chips.map((chip) => (
                    <li key={chip.hex} className="admin-hub-palette__chip">
                      <span
                        className={`admin-hub-palette__swatch${chip.light ? ' admin-hub-palette__swatch--light' : ''}`}
                        style={{ background: chip.css }}
                        aria-hidden="true"
                      />
                      {chip.share !== null ? (
                        <span className="admin-hub-palette__share" aria-hidden="true">
                          <span style={{ width: `${Math.max(4, Math.round(chip.share * 100))}%` }} />
                        </span>
                      ) : null}
                      <small>{chip.hex}</small>
                    </li>
                  ))
                : Array.from({ length: OVERVIEW_PALETTE_CAP }, (_, index) => (
                    <li key={index} className="admin-hub-palette__chip admin-hub-palette__chip--slot">
                      <span className="admin-hub-palette__swatch" />
                    </li>
                  ))}
            </ul>
          </div>
          {colours?.look ? (
            <div className="admin-hub-colours-side">
              <MiniSite look={colours.look} shopName={props.shopName} />
              <dl className="admin-hub-colours-roles" data-testid="admin-hub-colours-roles">
                {colours.main ? <RoleRow label={ADMIN_HUB_COLOURS_MAIN} colour={colours.main} /> : null}
                {colours.accent ? <RoleRow label={ADMIN_HUB_COLOURS_ACCENT} colour={colours.accent} /> : null}
              </dl>
            </div>
          ) : null}
        </div>
        <div className="admin-hub-tile__foot admin-hub-colours-foot">
          {colours ? (
            <>
              <span className={`admin-hub-pill ${PILL_CLASS[state]}`} data-testid="admin-hub-colours-status">
                {colours.locked ? (
                  <Lock width={11} height={11} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <span className="admin-hub-pill__dot" aria-hidden="true"></span>
                )}
                {colours.statusLabel}
              </span>
              <span className="admin-hub-colours-foot__guide" data-testid="admin-hub-colours-guidance">
                {colours.guidance}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function RoleRow(props: { label: string; colour: OverviewRoleColour }) {
  return (
    <div className="admin-hub-colours-role">
      <dt>
        <span className="admin-hub-colours-role__chip" style={{ background: props.colour.css }} aria-hidden="true" />
        {props.label}
      </dt>
      <dd>
        <span className="admin-hub-colours-role__name">{props.colour.name}</span>
        <small>{props.colour.hex}</small>
      </dd>
    </div>
  );
}

/** Decorative "how it looks" card (the tile link already says where it goes). */
function MiniSite(props: { look: OverviewColoursLook; shopName: string }) {
  const ink = betterButtonText(props.look.background);
  const shop = props.shopName.trim() || ' ';
  return (
    <div className="admin-hub-site-mini" style={{ background: props.look.background, color: ink } as CSSProperties} aria-hidden="true">
      <div
        className="admin-hub-site-mini__bar"
        style={props.look.header ? { background: props.look.header.css, color: props.look.header.text } : undefined}
      >
        <span className="admin-hub-site-mini__shop">{shop}</span>
        <span className="admin-hub-site-mini__nav">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="admin-hub-site-mini__body">
        <span className="admin-hub-site-mini__line" />
        <span className="admin-hub-site-mini__line admin-hub-site-mini__line--short" />
        <span
          className={`admin-hub-site-mini__book${props.look.button ? '' : ' admin-hub-site-mini__book--outline'}`}
          style={props.look.button ? { background: props.look.button.css, color: props.look.button.text } : undefined}
        >
          {ADMIN_HUB_COLOURS_BOOK}
        </span>
      </div>
    </div>
  );
}
