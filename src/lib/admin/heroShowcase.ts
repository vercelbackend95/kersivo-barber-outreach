import { isBlacklineAdminDemoPathname } from './demoConfig';

/**
 * Canonical clock for the `/demo/admin?embed=hero` landing showcase.
 *
 * Tuesday 6 October 2026, 15:25 Europe/London (BST, UTC+1). At this instant the
 * BLACKLINE fixtures produce exactly 21 bookings with Noah Reid's real 15:15
 * Skin Fade in progress, so `ensureInProgress` never synthesises a live row.
 * Changing either value changes every hero poster — recapture them afterwards.
 */
export const BLACKLINE_HERO_SHOWCASE_DAY = '2026-10-06';
export const BLACKLINE_HERO_SHOWCASE_NOW_ISO = '2026-10-06T14:25:00.000Z';
export const BLACKLINE_HERO_SHOWCASE_NOW_MS = Date.parse(BLACKLINE_HERO_SHOWCASE_NOW_ISO);

export function blacklineHeroShowcaseNow(): Date {
  return new Date(BLACKLINE_HERO_SHOWCASE_NOW_MS);
}

/** Posted by the hero iframe to its parent once the first frame is final. */
export const HERO_SHOWCASE_READY_MESSAGE_TYPE = 'kersivo:hero-showcase-ready';

/** Set on `<html>` inside the iframe at the same moment the ready message is posted. */
export const HERO_SHOWCASE_READY_ATTRIBUTE = 'data-hero-showcase-ready';

export function isHeroShowcaseUrl(url: URL): boolean {
  return isBlacklineAdminDemoPathname(url.pathname) && url.searchParams.get('embed') === 'hero';
}
