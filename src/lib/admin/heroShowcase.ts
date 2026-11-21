import { isHeritageAdminDemoPathname } from './demoConfig';

/**
 * Canonical clock for the landing hero showcase (`/demo/heritage-grooming/admin?embed=hero`).
 *
 * Thursday 8 October 2026, 15:25 Europe/London (BST, UTC+1): a full Heritage Grooming day
 * with all four barbers in, so the timeline shows a busy afternoon either side of "now".
 */
export const HERO_SHOWCASE_DAY = '2026-10-08';
export const HERO_SHOWCASE_NOW_ISO = '2026-10-08T14:25:00.000Z';
export const HERO_SHOWCASE_NOW_MS = Date.parse(HERO_SHOWCASE_NOW_ISO);

export function heroShowcaseNow(): Date {
  return new Date(HERO_SHOWCASE_NOW_MS);
}

/** Posted by the hero iframe to its parent once the first frame is final. */
export const HERO_SHOWCASE_READY_MESSAGE_TYPE = 'kersivo:hero-showcase-ready';

/**
 * Posted by the landing page to the hero iframe, once, after the iframe is ready and the
 * visitor can clearly see the dashboard. Starts the one-time timeline scroll to "now".
 */
export const HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE = 'kersivo:hero-showcase-visible';

/** Set on `<html>` inside the iframe at the same moment the ready message is posted. */
export const HERO_SHOWCASE_READY_ATTRIBUTE = 'data-hero-showcase-ready';

export function isHeroShowcaseUrl(url: URL): boolean {
  return isHeritageAdminDemoPathname(url.pathname) && url.searchParams.get('embed') === 'hero';
}
