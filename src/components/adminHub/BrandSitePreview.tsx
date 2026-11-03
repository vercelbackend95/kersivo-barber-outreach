import { ADMIN_HUB_COLOURS_BOOK, ADMIN_HUB_COLOURS_PRICES } from '@/lib/adminHub/copy';
import { sitePreviewColours, type BrandBackgroundTone } from '@/lib/adminHub/colour';
import { HubLogoMark } from './HubLogoMark';

export type BrandSitePreviewSize = 'tile' | 'compact' | 'full';

/** Neutral rows when the shop has no services yet (styled as placeholders, never as real data). */
export const BRAND_SITE_PREVIEW_PLACEHOLDER_SERVICES = ['Haircut', 'Beard trim'] as const;

/** Address-bar text for the tile frame: the shop name as a slug (no domain, no real URL). */
export function brandSiteSlug(shop: string): string {
  const slug = shop
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return slug || 'your-shop';
}

/**
 * The small "how your website looks" preview: hero in Main with an Accent glow, Book in Accent, services and time
 * slots on the chosen background tone. Pure presentation, always aria-hidden (the surrounding UI says what it is).
 * - full: the Brand colours app ("How it looks").
 * - compact: the app's hero-only strip.
 * - tile: the Overview tile, inside a thin browser frame with the shop's logo; fixed 16:11 box.
 */
export function BrandSitePreview(props: {
  size: BrandSitePreviewSize;
  shop: string;
  mainHex?: string | null;
  accentHex?: string | null;
  tone: BrandBackgroundTone;
  services?: ReadonlyArray<{ name: string }>;
  logo?: { src: string; width?: number | null; height?: number | null } | null;
  testId?: string;
}) {
  const { size } = props;
  const colours = sitePreviewColours({ mainHex: props.mainHex, accentHex: props.accentHex, tone: props.tone });
  const shop = props.shop.trim() || 'Your shop';
  const services = (props.services ?? []).filter((row) => row.name.trim()).slice(0, 2);
  const rows = services.length
    ? services.map((row) => ({ name: row.name, placeholder: false }))
    : BRAND_SITE_PREVIEW_PLACEHOLDER_SERVICES.map((name) => ({ name, placeholder: true }));
  const showBody = size !== 'compact';
  const navButton = { background: colours.button.background, color: colours.button.color };

  const site = (
    <>
      <div className="admin-hub-livep__hero" style={colours.hero}>
        {size !== 'compact' ? (
          <div className="admin-hub-livep__nav">
            {size === 'tile' && props.logo?.src ? (
              <HubLogoMark
                src={props.logo.src}
                width={props.logo.width}
                height={props.logo.height}
                maxHeight="20px"
                className="admin-hub-livep__logo"
              />
            ) : (
              <span className="admin-hub-livep__brand">{shop}</span>
            )}
            <span style={navButton}>Book</span>
          </div>
        ) : null}
        <div className="admin-hub-livep__h">{shop}</div>
        <div className="admin-hub-livep__btns">
          <span className="admin-hub-livep__book" style={colours.button}>
            {ADMIN_HUB_COLOURS_BOOK}
          </span>
          {size === 'full' ? (
            <span style={{ border: `1px solid ${colours.heroText}66`, color: 'inherit' }}>{ADMIN_HUB_COLOURS_PRICES}</span>
          ) : null}
        </div>
      </div>
      {showBody ? (
        <div className="admin-hub-livep__body" style={{ background: colours.background, color: colours.text }}>
          {rows.map((row) => (
            <div
              key={row.name}
              className={`admin-hub-livep__svc${row.placeholder ? ' admin-hub-livep__svc--placeholder' : ''}`}
              style={{ borderBottomColor: colours.divider }}
            >
              <span>{row.name}</span>
              <b style={{ color: colours.marker }}>·</b>
            </div>
          ))}
          <div className="admin-hub-livep__slots">
            <span className="admin-hub-livep__slot" style={colours.slot}>
              10:00
            </span>
            <span style={{ borderColor: colours.slotBorder }}>10:30</span>
            <span style={{ borderColor: colours.slotBorder }}>11:15</span>
          </div>
        </div>
      ) : null}
    </>
  );

  if (size === 'tile') {
    return (
      <div className="admin-hub-livep admin-hub-livep--tile" aria-hidden="true" data-testid={props.testId}>
        <div className="admin-hub-livep__chrome">
          <span className="admin-hub-livep__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="admin-hub-livep__url">{brandSiteSlug(shop)}</span>
        </div>
        <div className="admin-hub-livep__site" style={{ background: colours.background }}>
          {site}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`admin-hub-livep${size === 'compact' ? ' admin-hub-livep--compact' : ''}`}
      aria-hidden="true"
      data-testid={props.testId}
    >
      {site}
    </div>
  );
}
