import {
  HERO_SHOWCASE_READY_ATTRIBUTE,
  HERO_SHOWCASE_READY_MESSAGE_TYPE,
} from '@/lib/admin/heroShowcase';
import {
  getHeroShowcaseRequestActivity,
  subscribeHeroShowcaseRequestActivity,
} from './heroShowcaseFetch';

const SKELETON_SELECTOR = '[class*="skeleton"], [aria-busy="true"]';
/** Safety valve only: the parent keeps its poster and applies its own fallback if we never settle. */
const MAX_SETTLE_ATTEMPTS = 240;

function hasVisibleSkeleton(win: Window): boolean {
  const { innerWidth, innerHeight } = win;
  for (const element of win.document.querySelectorAll<HTMLElement>(SKELETON_SELECTOR)) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) continue;
    if (win.getComputedStyle(element).visibility === 'hidden') continue;
    return true;
  }
  return false;
}

/**
 * Posts `{ type: 'kersivo:hero-showcase-ready' }` to the same-origin parent once the
 * showcase's first frame is final: web fonts loaded, no local data request in flight
 * or started across two consecutive frames, and no skeleton visible in the viewport.
 */
export function signalHeroShowcaseReadyWhenSettled(win: Window = window): () => void {
  let cancelled = false;
  let frameId: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let attempts = 0;

  const nextFrame = () =>
    new Promise<void>((resolve) => {
      frameId = win.requestAnimationFrame(() => {
        frameId = null;
        resolve();
      });
    });

  const whenIdle = () =>
    new Promise<void>((resolve) => {
      if (getHeroShowcaseRequestActivity().pending === 0) {
        resolve();
        return;
      }
      unsubscribe = subscribeHeroShowcaseRequestActivity(() => {
        if (getHeroShowcaseRequestActivity().pending !== 0) return;
        unsubscribe?.();
        unsubscribe = null;
        resolve();
      });
    });

  const announce = () => {
    win.document.documentElement.setAttribute(HERO_SHOWCASE_READY_ATTRIBUTE, 'true');
    if (win.parent && win.parent !== win) {
      win.parent.postMessage({ type: HERO_SHOWCASE_READY_MESSAGE_TYPE }, win.location.origin);
    }
  };

  void (async () => {
    await win.document.fonts?.ready;
    while (!cancelled && attempts < MAX_SETTLE_ATTEMPTS) {
      attempts += 1;
      await whenIdle();
      if (cancelled) return;
      const { serial } = getHeroShowcaseRequestActivity();
      await nextFrame();
      await nextFrame();
      if (cancelled) return;
      const activity = getHeroShowcaseRequestActivity();
      if (activity.pending !== 0 || activity.serial !== serial) continue;
      if (hasVisibleSkeleton(win)) continue;
      announce();
      return;
    }
  })();

  return () => {
    cancelled = true;
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    unsubscribe?.();
  };
}
