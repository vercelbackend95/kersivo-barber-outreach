import { HERO_SHOWCASE_READY_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { announceHeroShowcaseVisibleWhenSeen } from '@/lib/admin/heroShowcaseVisibility';
import { mountDeferredDemoFrame } from '@/lib/performance/deferredDemoFrame';

/** Must match the static-image breakpoint in hero-dashboard-showcase.css. */
export const HERO_SHOWCASE_STILL_QUERY = '(max-width: 48rem)';

/**
 * Binds the hero dashboard showcase on the current page (deferred load, ready-gated reveal,
 * visibility announcement) and tears it down before the next soft swap. Wheel scrolling over the
 * frame needs no wiring: the embed has no user-scrollable surface, so it chains to this page.
 * Phone widths show a static image instead, so the live frame is never mounted (or fetched)
 * there; it is bound if the viewport later grows past the breakpoint.
 * Safe to call repeatedly: a viewport is only ever bound once.
 */
export function bindHeroDashboardShowcase(win: Window & typeof globalThis = window): void {
  const doc = win.document;
  const viewport = doc.querySelector<HTMLElement>('[data-deferred-demo-frame]');
  if (!viewport || viewport.dataset.heroFrameBound === 'true') return;
  viewport.dataset.heroFrameBound = 'true';
  const cleanups: Array<() => void> = [];

  const bindLiveFrame = () => {
    const productFrame = viewport.querySelector<HTMLIFrameElement>('.hero-showcase__frame');
    const stopFrame = mountDeferredDemoFrame(viewport, win, { readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE });
    cleanups.push(stopFrame);
    if (productFrame) cleanups.push(announceHeroShowcaseVisibleWhenSeen(viewport, productFrame, win));
  };

  const stillQuery = typeof win.matchMedia === 'function' ? win.matchMedia(HERO_SHOWCASE_STILL_QUERY) : null;
  if (stillQuery?.matches) {
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) return;
      stillQuery.removeEventListener('change', onChange);
      bindLiveFrame();
    };
    stillQuery.addEventListener('change', onChange);
    cleanups.push(() => stillQuery.removeEventListener('change', onChange));
  } else {
    bindLiveFrame();
  }

  doc.addEventListener('astro:before-swap', () => cleanups.forEach((cleanup) => cleanup()), { once: true });
}
