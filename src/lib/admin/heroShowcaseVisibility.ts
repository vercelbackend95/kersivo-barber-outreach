import { HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE } from './heroShowcase';

/**
 * Share of the dashboard that must be on screen before the timeline moves. Measured against
 * the smaller of the dashboard and the browser viewport, so a dashboard taller than a short
 * screen still qualifies. The timeline sits in the lower half of the dashboard, so lower
 * values start the scroll while almost none of the timeline is on screen.
 */
export const HERO_SHOWCASE_VISIBLE_THRESHOLD = 0.65;

const OBSERVER_THRESHOLDS = Array.from({ length: 21 }, (_, index) => index / 20);

type VisibilityEntry = Pick<IntersectionObserverEntry, 'intersectionRect' | 'boundingClientRect' | 'rootBounds'>;

export function heroShowcaseVisibleFraction(entry: VisibilityEntry, viewportHeight: number): number {
  const elementHeight = entry.boundingClientRect.height;
  const rootHeight = entry.rootBounds?.height ?? viewportHeight;
  const basis = Math.min(elementHeight, rootHeight);
  if (basis <= 0) return 0;
  return Math.min(1, entry.intersectionRect.height / basis);
}

function hasOpacityTransition(element: HTMLElement, win: Window): boolean {
  const style = win.getComputedStyle(element);
  const properties = style.transitionProperty.split(',').map((value) => value.trim());
  const durations = style.transitionDuration.split(',').map((value) => Number.parseFloat(value) || 0);
  return properties.some((property, index) => {
    const duration = durations[index % durations.length] ?? 0;
    return duration > 0 && (property === 'opacity' || property === 'all');
  });
}

/**
 * On the landing page: post `kersivo:hero-showcase-visible` to the hero iframe exactly once,
 * at the first moment the frame is verified ready (`data-frame-state="ready"`, set by the
 * deferred-frame loader only after its validated ready message) and its reveal fade has
 * finished, while the dashboard is meaningfully on screen. Either may become true first.
 */
export function announceHeroShowcaseVisibleWhenSeen(
  viewport: HTMLElement,
  frame: HTMLIFrameElement,
  win: Window,
  threshold: number = HERO_SHOWCASE_VISIBLE_THRESHOLD,
): () => void {
  const { IntersectionObserver: IntersectionObserverCtor, MutationObserver: MutationObserverCtor } =
    win as Window & typeof globalThis;
  if (typeof IntersectionObserverCtor !== 'function' || typeof MutationObserverCtor !== 'function') {
    return () => {};
  }

  let isSeen = false;
  let isRevealed = false;
  let done = false;

  const onRevealEnd = (event: TransitionEvent) => {
    if (event.target !== viewport || event.propertyName !== 'opacity') return;
    isRevealed = true;
    maybeAnnounce();
  };

  const syncReady = () => {
    if (isRevealed || viewport.dataset.frameState !== 'ready') return;
    if (hasOpacityTransition(viewport, win)) {
      viewport.addEventListener('transitionend', onRevealEnd);
      viewport.addEventListener('transitioncancel', onRevealEnd);
    } else {
      isRevealed = true;
    }
  };

  const intersectionObserver = new IntersectionObserverCtor((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    isSeen = entry.isIntersecting && heroShowcaseVisibleFraction(entry, win.innerHeight) >= threshold;
    maybeAnnounce();
  }, { threshold: OBSERVER_THRESHOLDS });

  const stateObserver = new MutationObserverCtor(() => {
    syncReady();
    maybeAnnounce();
  });

  const stop = () => {
    intersectionObserver.disconnect();
    stateObserver.disconnect();
    viewport.removeEventListener('transitionend', onRevealEnd);
    viewport.removeEventListener('transitioncancel', onRevealEnd);
  };

  function maybeAnnounce() {
    if (done || !isSeen || !isRevealed || !frame.contentWindow) return;
    done = true;
    stop();
    frame.contentWindow.postMessage({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, win.location.origin);
  }

  intersectionObserver.observe(viewport);
  stateObserver.observe(viewport, { attributes: true, attributeFilter: ['data-frame-state'] });
  syncReady();

  return () => {
    done = true;
    stop();
  };
}

/**
 * Inside the hero iframe: call `onVisible` once when the same-origin landing page announces
 * the dashboard is on screen. Anything from another origin, another window or with another
 * type is ignored; outside an iframe this never listens.
 */
export function listenForHeroShowcaseVisible(win: Window, onVisible: () => void): () => void {
  if (win.parent === win) return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== win.location.origin) return;
    if (event.source !== win.parent) return;
    const data = event.data as { type?: unknown } | null;
    if (!data || typeof data !== 'object' || data.type !== HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE) return;
    win.removeEventListener('message', onMessage);
    onVisible();
  };

  win.addEventListener('message', onMessage);
  return () => win.removeEventListener('message', onMessage);
}
