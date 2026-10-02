import { HERO_SHOWCASE_READY_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { announceHeroShowcaseVisibleWhenSeen } from '@/lib/admin/heroShowcaseVisibility';
import { receiveHeroShowcaseWheel } from '@/lib/admin/heroShowcaseWheel';
import { mountDeferredDemoFrame } from '@/lib/performance/deferredDemoFrame';

/**
 * Binds the hero dashboard showcase on the current page (deferred load, ready-gated reveal,
 * wheel forwarding, visibility announcement) and tears it down before the next soft swap.
 * Safe to call repeatedly: a viewport is only ever bound once.
 */
export function bindHeroDashboardShowcase(win: Window & typeof globalThis = window): void {
  const doc = win.document;
  const viewport = doc.querySelector<HTMLElement>('[data-deferred-demo-frame]');
  if (!viewport || viewport.dataset.heroFrameBound === 'true') return;
  viewport.dataset.heroFrameBound = 'true';
  const productFrame = viewport.querySelector<HTMLIFrameElement>('.hero-showcase__frame');
  const stopFrame = mountDeferredDemoFrame(viewport, win, { readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE });
  const cleanups = [stopFrame];
  if (productFrame) {
    cleanups.push(receiveHeroShowcaseWheel(productFrame, win));
    cleanups.push(announceHeroShowcaseVisibleWhenSeen(viewport, productFrame, win));
  }
  doc.addEventListener('astro:before-swap', () => cleanups.forEach((cleanup) => cleanup()), { once: true });
}
