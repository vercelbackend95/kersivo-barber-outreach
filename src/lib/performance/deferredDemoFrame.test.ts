/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDeferredDemoFrame } from './deferredDemoFrame';

const SRC = '/demo/admin?embed=hero&section=bookings_dashboard';

type IoCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let ioCallback: IoCallback | undefined;
let idleCallback: (() => void) | undefined;

function setup() {
  document.body.innerHTML = `
    <div data-deferred-demo-frame>
      <iframe data-deferred-src="${SRC}" title="Interactive KERSIVO owner dashboard demo"></iframe>
    </div>`;
  const viewport = document.querySelector<HTMLElement>('[data-deferred-demo-frame]')!;
  const frame = viewport.querySelector('iframe')!;
  return { viewport, frame };
}

beforeEach(() => {
  vi.useFakeTimers();
  ioCallback = undefined;
  idleCallback = undefined;
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

  it('reveals the frame on its load event and ignores the initial about:blank load', () => {
    const { viewport, frame } = setup();
    mountDeferredDemoFrame(viewport);

    frame.dispatchEvent(new Event('load'));
    expect(viewport.dataset.frameState).toBe('poster');

    viewport.dispatchEvent(new Event('pointerdown'));
    frame.dispatchEvent(new Event('load'));
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('falls back to revealing the frame if its load event never fires', () => {
    const { viewport } = setup();
    mountDeferredDemoFrame(viewport, window, { revealFallbackMs: 5000 });
    viewport.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(5000);
    expect(viewport.dataset.frameState).toBe('ready');
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
