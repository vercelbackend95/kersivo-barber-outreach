export type DeferredDemoFrameState = 'poster' | 'loading' | 'ready';

export type DeferredDemoFrameOptions = {
  /** Upper bound for waiting on an idle period after the page `load` event. */
  idleTimeoutMs?: number;
  /** Reveal the frame even if its `load` event never arrives. */
  revealFallbackMs?: number;
  rootMargin?: string;
};

const INTENT_EVENTS = ['pointerenter', 'pointerdown', 'touchstart', 'focusin'] as const;

/**
 * Keeps a heavy same-origin demo iframe off the critical path: the poster paints
 * with the page, the iframe starts after `load` + idle once it is near the
 * viewport, and any direct interaction with the frame starts it immediately.
 */
export function mountDeferredDemoFrame(
  viewport: HTMLElement,
  win: Window & typeof globalThis = window,
  options: DeferredDemoFrameOptions = {},
): () => void {
  const frame = viewport.querySelector<HTMLIFrameElement>('iframe[data-deferred-src]');
  const src = frame?.dataset.deferredSrc;
  if (!frame || !src) return () => {};

  const { idleTimeoutMs = 1500, revealFallbackMs = 10000, rootMargin = '300px 0px' } = options;
  const doc = viewport.ownerDocument;
  let started = false;
  let pageReady = false;
  let nearViewport = typeof win.IntersectionObserver !== 'function';
  let observer: IntersectionObserver | undefined;
  let revealTimer: number | undefined;
  let idleHandle: number | undefined;

  const setState = (state: DeferredDemoFrameState) => {
    viewport.dataset.frameState = state;
  };

  const reveal = () => {
    if (revealTimer !== undefined) win.clearTimeout(revealTimer);
    setState('ready');
  };

  const onFrameLoad = () => {
    if (started) reveal();
  };

  const onIntent = () => start();

  const cleanup = () => {
    observer?.disconnect();
    for (const type of INTENT_EVENTS) viewport.removeEventListener(type, onIntent);
    win.removeEventListener('load', onPageLoad);
    if (idleHandle !== undefined && typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleHandle);
    }
  };

  function start() {
    if (started) return;
    started = true;
    cleanup();
    setState('loading');
    frame!.addEventListener('load', onFrameLoad);
    frame!.src = src!;
    revealTimer = win.setTimeout(reveal, revealFallbackMs);
  }

  const maybeStart = () => {
    if (pageReady && nearViewport) start();
  };

  const onIdle = () => {
    idleHandle = undefined;
    pageReady = true;
    maybeStart();
  };

  function onPageLoad() {
    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(onIdle, { timeout: idleTimeoutMs });
    } else {
      win.setTimeout(onIdle, 200);
    }
  }

  setState('poster');
  for (const type of INTENT_EVENTS) {
    viewport.addEventListener(type, onIntent, { passive: true });
  }

  if (!nearViewport) {
    observer = new win.IntersectionObserver(
      (entries) => {
        nearViewport = entries.some((entry) => entry.isIntersecting);
        maybeStart();
      },
      { rootMargin },
    );
    observer.observe(viewport);
  }

  if (doc.readyState === 'complete') onPageLoad();
  else win.addEventListener('load', onPageLoad, { once: true });

  return () => {
    cleanup();
    if (revealTimer !== undefined) win.clearTimeout(revealTimer);
    frame.removeEventListener('load', onFrameLoad);
  };
}
