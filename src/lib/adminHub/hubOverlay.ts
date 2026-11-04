import { useEffect, useState } from 'react';

/**
 * Phones (portrait up to 768 px wide, or any short landscape viewport) get a full-screen sheet.
 * Landscape phones are wider than 768 px, so the height clause keeps them off the centred window.
 */
export const HUB_FULLSCREEN_QUERY = '(max-width: 768px), (max-height: 500px)';

export type HubOverlayMode = 'window' | 'sheet' | 'fullscreen';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Window on desktop, bottom sheet below `sheetBelow`, full screen on phones. */
export function hubOverlayMode(sheetBelow = 1024): HubOverlayMode {
  if (matches(HUB_FULLSCREEN_QUERY)) return 'fullscreen';
  if (matches(`(max-width: ${sheetBelow - 1}px)`)) return 'sheet';
  return 'window';
}

/** Same as `hubOverlayMode`, kept in sync with resizes and rotation. */
export function useHubOverlayMode(sheetBelow = 1024): HubOverlayMode {
  const [mode, setMode] = useState<HubOverlayMode>(() => hubOverlayMode(sheetBelow));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const queries = [HUB_FULLSCREEN_QUERY, `(max-width: ${sheetBelow - 1}px)`].map((q) => window.matchMedia(q));
    const sync = () => setMode(hubOverlayMode(sheetBelow));
    sync();
    for (const mq of queries) mq.addEventListener('change', sync);
    return () => {
      for (const mq of queries) mq.removeEventListener('change', sync);
    };
  }, [sheetBelow]);
  return mode;
}

let lockCount = 0;
let saved: {
  htmlOverflow: string;
  htmlScrollBehavior: string;
  bodyOverflow: string;
  bodyOverscroll: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  scrollY: number;
} | null = null;

/**
 * Lock page scroll under an overlay without losing the scroll position. Nested-safe.
 *
 * `overflow: hidden` alone does not stop touch scrolling on iOS Safari, and the page moving under a
 * fixed overlay shifts the browser toolbar (and with it the visible height). Pinning the body with
 * `position: fixed; top: -scrollY` stops that; the scroll position is put back on release.
 */
export function lockAdminHubScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const { body, documentElement } = document;
  if (lockCount === 0) {
    const scrollY = window.scrollY || documentElement.scrollTop || 0;
    saved = {
      htmlOverflow: documentElement.style.overflow,
      htmlScrollBehavior: documentElement.style.scrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      scrollY,
    };
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'contain';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !saved) return;
    const restore = saved;
    saved = null;
    documentElement.style.overflow = restore.htmlOverflow;
    body.style.overflow = restore.bodyOverflow;
    body.style.overscrollBehavior = restore.bodyOverscroll;
    body.style.position = restore.bodyPosition;
    body.style.top = restore.bodyTop;
    body.style.left = restore.bodyLeft;
    body.style.right = restore.bodyRight;
    body.style.width = restore.bodyWidth;
    const top = restore.scrollY;
    // No smooth scroll back: the page must be where it was the moment the overlay goes.
    documentElement.style.scrollBehavior = 'auto';
    documentElement.scrollTop = top;
    body.scrollTop = top;
    if (typeof window.scrollTo === 'function' && !/jsdom/i.test(navigator.userAgent)) {
      window.scrollTo({ top, left: 0, behavior: 'auto' });
    }
    documentElement.style.scrollBehavior = restore.htmlScrollBehavior;
  };
}

export function useAdminHubScrollLock(locked = true): void {
  useEffect(() => {
    if (!locked) return undefined;
    return lockAdminHubScroll();
  }, [locked]);
}

/** `document.body` after mount so SSR / first hydrate can render `null` without a mismatch. */
export function useClientPortalTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
  }, []);
  return target;
}
