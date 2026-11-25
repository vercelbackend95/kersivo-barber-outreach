/**
 * Geometry for the phone films on /barbershop-website-design, in page px of the 390-wide Heritage
 * Grooming phone page (src/lib/websiteDesign/inspectorCapture.json, measured from the real page).
 */
import capture from './inspectorCapture.json';

export type Rect = { x: number; y: number; w: number; h: number };

/** A framed part of the page. `fixed` rects sit in the phone viewport (the Book bar), not on the page. */
export type FilmShot = { id: string; scroll: number; rect: Rect; fixed?: boolean };

export const PAGE_WIDTH = capture.width;
export const PAGE_HEIGHT = capture.height;
/** Status bar drawn above the page inside the glass (WdDevice), in page px. */
export const STATUS_BAR = 52;
/** Visible page height inside the gold frame's glass (486 × 1056 frame px) under the status bar. */
export const GOLD_VIEWPORT = Math.round((PAGE_WIDTH * 1056) / 486) - STATUS_BAR;
/** The floating "Book a chair" bar of the real site: 16px in from the sides and the bottom, 54px tall. */
export const BOOK_BAR: Rect = { x: 16, y: GOLD_VIEWPORT - 16 - 54, w: PAGE_WIDTH - 32, h: 54 };
/** The real site shows its Book bar once the page has scrolled past this point. */
export const BOOK_BAR_AFTER = 600;

const { regions } = capture;
const maxScroll = PAGE_HEIGHT - GOLD_VIEWPORT;
const pricesScroll = Math.min(maxScroll, regions.prices.y - 120);

/** The hero inspector's shots, in the order of WD_INSPECTOR_POINTS. */
export const INSPECTOR_SHOTS: readonly FilmShot[] = [
  { id: 'identity', scroll: 0, rect: regions.identity },
  { id: 'photo', scroll: 0, rect: { x: 0, y: regions.photo.y, w: regions.photo.w, h: Math.min(regions.photo.h, GOLD_VIEWPORT - regions.photo.y) } },
  { id: 'prices', scroll: pricesScroll, rect: regions.prices },
  { id: 'book', scroll: pricesScroll, rect: BOOK_BAR, fixed: true },
];

/** Tap targets the Mobile UX section measures on the real page (all at least 44px tall). */
export const TAP_TARGETS: readonly { id: string; rect: Rect }[] = [
  { id: 'menu', rect: regions.menu },
  { id: 'cta', rect: regions.cta },
];

/** The order the eye should take on the first screen: name, photo, prices, Book. */
export const HIERARCHY_MARKS: readonly { id: string; x: number; y: number }[] = [
  { id: 'name', x: regions.identity.x + regions.identity.w + 14, y: regions.identity.y + regions.identity.h / 2 },
  { id: 'photo', x: 300, y: 190 },
  { id: 'prices', x: regions.facts.x + 150, y: regions.facts.y + 90 },
  { id: 'book', x: regions.cta.x + regions.cta.w - 30, y: regions.cta.y + regions.cta.h / 2 },
];

export { regions as CAPTURED_REGIONS };
