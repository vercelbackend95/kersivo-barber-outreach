/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDeferredDemoFrame } from './deferredDemoFrame';

const SRC = '/demo/admin?embed=hero&section=bookings_dashboard';

type IoCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let ioCallback: IoCallback | undefined;
let idleCallback: (() => void) | undefined;
let rafQueue: Map<number, FrameRequestCallback>;
let rafId: number;

function flushFrame() {
  const pending = [...rafQueue.entries()];
  rafQueue.clear();
  for (const [, cb] of pending) cb(performance.now());
}

function setup() {
  document.body.innerHTML = `
    <div data-deferred-demo-frame>
      <iframe data-deferred-src="${SRC}" title="Interactive KERSIVO owner dashboard demo"></iframe>
    </div>`;
  const viewport = document.querySelector<HTMLElement>('[data-deferred-demo-frame]')!;
  const frame = viewport.querySelector('iframe')!;
  return { viewport, frame };
}

function setFrameReadyState(frame: HTMLIFrameElement, readyState: DocumentReadyState) {
  Object.defineProperty(frame, 'contentDocument', {
    configurable: true,
    get: () => ({ readyState }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  ioCallback = undefined;
  idleCallback = undefined;
  rafQueue = new Map();
  rafId = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IoCallback) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
    idleCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelIdleCallback', () => {});
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafId += 1;
    rafQueue.set(rafId, cb);
    return rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafQueue.delete(id);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mountDeferredDemoFrame', () => {
  it('shows the poster state and does not load the iframe during initial render', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);
    expect(viewport.dataset.frameState).toBe('poster');
    expect(frame.getAttribute('src')).toBeNull();
  });

  it('starts after page load + idle once the frame is near the viewport', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);

    ioCallback?.([{ isIntersecting: true }]);
    expect(frame.getAttribute('src')).toBeNull();

    idleCallback?.();
    expect(frame.getAttribute('src')).toBe(SRC);
    expect(viewport.dataset.frameState).toBe('loading');
  });

  it('waits for the frame to approach the viewport when the page opens scrolled away', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);

    ioCallback?.([{ isIntersecting: false }]);
    idleCallback?.();
    expect(frame.getAttribute('src')).toBeNull();

    ioCallback?.([{ isIntersecting: true }]);
    expect(frame.getAttribute('src')).toBe(SRC);
  });

  it.each(['pointerenter', 'pointerdown', 'touchstart', 'focusin'])(
    'loads immediately on %s intent without waiting for idle',
    (type) => {
      const { viewport, frame } = setup();
      mountDeferredDemoFrame(viewport);
      viewport.dispatchEvent(new Event(type));
      expect(frame.getAttribute('src')).toBe(SRC);
    },
  );

  it('ignores the initial about:blank load before the frame has started', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);
    frame.dispatchEvent(new Event('load'));
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('poster');
  });

  it('stays in the loading state on the load task and swaps only after two animation frames', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);
    viewport.dispatchEvent(new Event('pointerdown'));

    frame.dispatchEvent(new Event('load'));
    expect(viewport.dataset.frameState).toBe('loading');

    flushFrame();
    expect(viewport.dataset.frameState).toBe('loading');

    flushFrame();
    expect(viewport.dataset.frameState).toBe('ready');

    flushFrame();
    flushFrame();
    expect(rafQueue.size).toBe(0);
  });

  it('falls back to the same settled swap when the frame document is parsed but load never fires', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport, window, { revealFallbackMs: 5000 });
    viewport.dispatchEvent(new Event('pointerdown'));
    setFrameReadyState(frame, 'interactive');

    vi.advanceTimersByTime(5000);
    expect(viewport.dataset.frameState).toBe('loading');
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('keeps the poster when the fallback fires before the frame document has been parsed', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport, window, { revealFallbackMs: 5000 });
    viewport.dispatchEvent(new Event('pointerdown'));
    setFrameReadyState(frame, 'loading');

    vi.advanceTimersByTime(5000);
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('loading');

    frame.dispatchEvent(new Event('load'));
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('cancels pending settle frames on cleanup', () => {
    const { viewport, frame } = setup();
    const cleanup = mountDeferredDemoFrame(viewport);
    viewport.dispatchEvent(new Event('pointerdown'));
    frame.dispatchEvent(new Event('load'));
    expect(rafQueue.size).toBe(1);

    cleanup();
    expect(rafQueue.size).toBe(0);
    expect(viewport.dataset.frameState).toBe('loading');
  });

  it('sets the iframe source only once', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);
    const setter = vi.spyOn(frame, 'src', 'set');
    viewport.dispatchEvent(new Event('pointerdown'));
    viewport.dispatchEvent(new Event('focusin'));
    ioCallback?.([{ isIntersecting: true }]);
    idleCallback?.();
    expect(setter).toHaveBeenCalledTimes(1);
  });
});

describe('mountDeferredDemoFrame with a ready message', () => {
  const READY = 'kersivo:hero-showcase-ready';

  function postFromFrame(
    frame: HTMLIFrameElement,
    init: { data?: unknown; origin?: string; source?: MessageEventSource | null } = {},
  ) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'data' in init ? init.data : { type: READY },
        origin: init.origin ?? window.location.origin,
        source: init.source === undefined ? frame.contentWindow : init.source,
      }),
    );
  }

  function startWithReadyMessage(options: { revealFallbackMs?: number; onReady?: () => void } = {}) {
    const { viewport, frame } = setup();
    const cleanup = mountDeferredDemoFrame(viewport, window, { readyMessageType: READY, ...options });
    viewport.dispatchEvent(new Event('pointerdown'));
    return { viewport, frame, cleanup };
  }

  it('keeps the poster after the frame load event until the ready message arrives', () => {
    const { viewport, frame } = startWithReadyMessage();
    frame.dispatchEvent(new Event('load'));
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('loading');

    postFromFrame(frame);
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('ignores messages from another origin, another window or with another type', () => {
    const { viewport, frame } = startWithReadyMessage();
    postFromFrame(frame, { origin: 'https://evil.example' });
    postFromFrame(frame, { source: window });
    postFromFrame(frame, { data: { type: 'something-else' } });
    postFromFrame(frame, { data: READY });
    postFromFrame(frame, { data: null });
    expect(viewport.dataset.frameState).toBe('loading');
  });

  it('ignores a ready message before the frame has started', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport, window, { readyMessageType: READY });
    postFromFrame(frame);
    expect(viewport.dataset.frameState).toBe('poster');
  });

  it('still falls back to a settled swap when the message never arrives but the document is parsed', () => {
    const { viewport, frame } = startWithReadyMessage({ revealFallbackMs: 5000 });
    setFrameReadyState(frame, 'complete');
    vi.advanceTimersByTime(5000);
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('stops listening for the ready message on cleanup', () => {
    const { viewport, frame, cleanup } = startWithReadyMessage();
    cleanup();
    postFromFrame(frame);
    expect(viewport.dataset.frameState).toBe('loading');
  });

  it('swaps on the verified message but calls onReady only two frames later, exactly once', () => {
    const states: Array<string | undefined> = [];
    const onReady = vi.fn(() => states.push(viewport.dataset.frameState));
    const { viewport, frame } = startWithReadyMessage({ onReady });
    postFromFrame(frame);
    expect(viewport.dataset.frameState).toBe('ready');
    expect(onReady).not.toHaveBeenCalled();
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);

    postFromFrame(frame);
    vi.advanceTimersByTime(20000);
    flushFrame();
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['ready']);
  });

  it('never calls onReady if cleaned up between the swap and the reveal frames', () => {
    const onReady = vi.fn();
    const { frame, cleanup } = startWithReadyMessage({ onReady });
    postFromFrame(frame);
    flushFrame();
    cleanup();
    flushFrame();
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('never calls onReady on frame load or an unverified message', () => {
    const onReady = vi.fn();
    const { frame } = startWithReadyMessage({ onReady });
    frame.dispatchEvent(new Event('load'));
    flushFrame();
    flushFrame();
    postFromFrame(frame, { origin: 'https://evil.example' });
    postFromFrame(frame, { source: window });
    postFromFrame(frame, { data: { type: 'something-else' } });
    expect(onReady).not.toHaveBeenCalled();
  });

  it('runs the same swap-then-onReady lifecycle when the parsed-document fallback reveals', () => {
    const onReady = vi.fn();
    const { viewport, frame } = startWithReadyMessage({ revealFallbackMs: 5000, onReady });
    setFrameReadyState(frame, 'complete');
    vi.advanceTimersByTime(5000);
    flushFrame();
    flushFrame();
    expect(viewport.dataset.frameState).toBe('ready');
    expect(onReady).not.toHaveBeenCalled();
    flushFrame();
    flushFrame();
    postFromFrame(frame);
    flushFrame();
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
