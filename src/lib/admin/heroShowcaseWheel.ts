import { HERO_SHOWCASE_WHEEL_MESSAGE_TYPE } from './heroShowcase';

export type HeroShowcaseWheelMessage = {
  type: typeof HERO_SHOWCASE_WHEEL_MESSAGE_TYPE;
  deltaY: number;
  deltaMode: number;
};

/** Pixels per `DOM_DELTA_LINE` step, matching common wheel normalisation. */
const WHEEL_LINE_HEIGHT_PX = 40;

export function normalizeWheelDeltaY(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return deltaY * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === 2) return deltaY * pageHeight;
  return deltaY;
}

/**
 * Inside the hero iframe: hand every vertical wheel gesture to the landing page instead
 * of letting the fixed showcase swallow it. Ctrl+wheel (browser zoom / pinch) and
 * horizontal gestures stay native; clicks are never touched.
 */
export function forwardHeroShowcaseWheel(win: Window): () => void {
  if (win.parent === win) return () => {};

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.defaultPrevented) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const message: HeroShowcaseWheelMessage = {
      type: HERO_SHOWCASE_WHEEL_MESSAGE_TYPE,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
    };
    win.parent.postMessage(message, win.location.origin);
  };

  win.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => win.removeEventListener('wheel', onWheel, { capture: true });
}

/**
 * On the landing page: scroll by the forwarded delta immediately. `behavior: 'instant'`
 * overrides the page's CSS `scroll-behavior: smooth`, which would otherwise restart a
 * smooth animation per wheel event and make scrolling over the dashboard feel heavy.
 */
export function receiveHeroShowcaseWheel(frame: HTMLIFrameElement, win: Window): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== win.location.origin) return;
    if (!frame.contentWindow || event.source !== frame.contentWindow) return;
    const data = event.data as Partial<HeroShowcaseWheelMessage> | null;
    if (!data || typeof data !== 'object' || data.type !== HERO_SHOWCASE_WHEEL_MESSAGE_TYPE) return;
    const { deltaY, deltaMode } = data;
    if (typeof deltaY !== 'number' || !Number.isFinite(deltaY)) return;
    if (deltaMode !== 0 && deltaMode !== 1 && deltaMode !== 2) return;
    const top = normalizeWheelDeltaY(deltaY, deltaMode, win.innerHeight);
    if (top !== 0) win.scrollBy({ top, left: 0, behavior: 'instant' });
  };

  win.addEventListener('message', onMessage);
  return () => win.removeEventListener('message', onMessage);
}
