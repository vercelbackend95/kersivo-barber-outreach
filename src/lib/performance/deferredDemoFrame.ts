export type DeferredDemoFrameState = 'poster' | 'loading' | 'ready';

export type DeferredDemoFrameOptions = {
  /** Upper bound for waiting on an idle period after the page `load` event. */
  idleTimeoutMs?: number;
  /**
   * Reveal a parsed frame even if its `load` event never arrives. Not used with
   * `readyMessageType`: without the explicit ready message the frame stays hidden.
   */
  revealFallbackMs?: number;
  rootMargin?: string;
  /**
   * When set, the frame is revealed only after its document posts `{ type: readyMessageType }`
   * from the same origin — not on `load`, a document ready state or a timeout, all of which
   * can happen before the embedded app has settled.
   */
  readyMessageType?: string;
};

const INTENT_EVENTS = ['pointerenter', 'pointerdown', 'touchstart', 'focusin'] as const;

/**
 * Keeps a heavy same-origin demo iframe off the critical path: the viewport paints
 * with the page in its initial (`poster`) state, the iframe starts after `load` + idle
 * once it is near the viewport, and any direct interaction with the frame starts it
 * immediately.
 */
export function mountDeferredDemoFrame(
  viewport: HTMLElement,
  win: Window & typeof globalThis = window,
  options: DeferredDemoFrameOptions = {},
): () => void {
  const frame = viewport.querySelector<HTMLIFrameElement>('iframe[data-deferred-src]');
  const src = frame?.dataset.deferredSrc;
  if (!frame || !src) return () => {};

  const {
    idleTimeoutMs = 1500,
    revealFallbackMs = 10000,
    rootMargin = '300px 0px',
    readyMessageType,
  } = options;
  const doc = viewport.ownerDocument;
  let started = false;
  let pageReady = false;
  let nearViewport = typeof win.IntersectionObserver !== 'function';
  let observer: IntersectionObserver | undefined;
  let revealTimer: number | undefined;
  let idleHandle: number | undefined;
  let settleFrame: number | undefined;

  const setState = (state: DeferredDemoFrameState) => {
    viewport.dataset.frameState = state;
  };

  const cancelSettle = () => {
    if (settleFrame !== undefined) win.cancelAnimationFrame(settleFrame);
    settleFrame = undefined;
  };

  const reveal = () => {
    if (revealTimer !== undefined) win.clearTimeout(revealTimer);
    revealTimer = undefined;
    cancelSettle();
    win.removeEventListener('message', onFrameMessage);
    if (viewport.dataset.frameState === 'ready') return;
    setState('ready');
  };

  /** Two frames give the loaded document a paint boundary before the atomic reveal. */
  const revealAfterSettle = () => {
    if (viewport.dataset.frameState === 'ready' || settleFrame !== undefined) return;
    settleFrame = win.requestAnimationFrame(() => {
      settleFrame = win.requestAnimationFrame(() => {
        settleFrame = undefined;
        reveal();
      });
    });
  };

  const onFrameLoad = () => {
    if (started && !readyMessageType) revealAfterSettle();
  };

  /** The frame already waited for its own final paint, so the swap is immediate. */
  const onFrameMessage = (event: MessageEvent) => {
    if (!started || viewport.dataset.frameState === 'ready') return;
    if (event.origin !== win.location.origin) return;
    if (event.source !== frame!.contentWindow) return;
    const data = event.data as { type?: unknown } | null;
    if (!data || typeof data !== 'object' || data.type !== readyMessageType) return;
    reveal();
  };

  /** Only give up on the `load` event if the frame document has actually been parsed. */
  const onRevealFallback = () => {
    revealTimer = undefined;
    let readyState: DocumentReadyState | undefined;
    try {
      readyState = frame!.contentDocument?.readyState;
    } catch {
      readyState = undefined;
    }
    if (readyState === 'interactive' || readyState === 'complete') revealAfterSettle();
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
    if (readyMessageType) win.addEventListener('message', onFrameMessage);
    else revealTimer = win.setTimeout(onRevealFallback, revealFallbackMs);
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
    cancelSettle();
    frame.removeEventListener('load', onFrameLoad);
    win.removeEventListener('message', onFrameMessage);
  };
}
