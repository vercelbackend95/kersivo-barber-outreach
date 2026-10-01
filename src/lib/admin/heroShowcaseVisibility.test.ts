/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE } from './heroShowcase';
import {
  HERO_SHOWCASE_VISIBLE_THRESHOLD,
  announceHeroShowcaseVisibleWhenSeen,
  heroShowcaseVisibleFraction,
  listenForHeroShowcaseVisible,
} from './heroShowcaseVisibility';

const ORIGIN = 'https://kersivo.test';

function fakeIframeWindow() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const parent = {} as Window;
  const win = {
    parent,
    location: { origin: ORIGIN },
    addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') listeners.delete(listener);
    }),
  } as unknown as Window;
  const dispatch = (data: unknown, init: { origin?: string; source?: unknown } = {}) => {
    const event = { data, origin: init.origin ?? ORIGIN, source: 'source' in init ? init.source : parent } as MessageEvent;
    [...listeners].forEach((listener) => listener(event));
  };
  return { win, parent, dispatch, listeners };
}

describe('listenForHeroShowcaseVisible (inside the hero iframe)', () => {
  it('ignores messages from another origin, another window or with another type', () => {
    const { win, dispatch } = fakeIframeWindow();
    const onVisible = vi.fn();
    listenForHeroShowcaseVisible(win, onVisible);

    dispatch({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, { origin: 'https://evil.test' });
    dispatch({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, { source: {} });
    dispatch({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, { source: null });
    dispatch({ type: 'kersivo:hero-showcase-wheel', deltaY: 40, deltaMode: 0 });
    dispatch({ type: 'kersivo:hero-showcase-ready' });
    dispatch(HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE);
    dispatch(null);

    expect(onVisible).not.toHaveBeenCalled();
  });

  it('fires once for the exact same-origin message from the parent, then stops listening', () => {
    const { win, dispatch, listeners } = fakeIframeWindow();
    const onVisible = vi.fn();
    listenForHeroShowcaseVisible(win, onVisible);

    dispatch({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE });
    dispatch({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE });

    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('never listens outside an iframe', () => {
    const win = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window;
    (win as unknown as { parent: Window }).parent = win;
    listenForHeroShowcaseVisible(win, vi.fn());
    expect(win.addEventListener).not.toHaveBeenCalled();
  });
});

describe('heroShowcaseVisibleFraction', () => {
  const entry = (visible: number, element: number, root: number) => ({
    intersectionRect: { height: visible } as DOMRectReadOnly,
    boundingClientRect: { height: element } as DOMRectReadOnly,
    rootBounds: { height: root } as DOMRectReadOnly,
  });

  it('measures the visible share of the dashboard', () => {
    expect(heroShowcaseVisibleFraction(entry(358, 716, 800), 800)).toBeCloseTo(0.5);
  });

  it('measures against the screen when the dashboard is taller than it', () => {
    expect(heroShowcaseVisibleFraction(entry(400, 608, 400), 400)).toBe(1);
  });

  it('uses a threshold that needs most of the dashboard on screen, not a thin strip', () => {
    expect(HERO_SHOWCASE_VISIBLE_THRESHOLD).toBeGreaterThanOrEqual(0.5);
    expect(HERO_SHOWCASE_VISIBLE_THRESHOLD).toBeLessThanOrEqual(0.65);
  });
});

describe('announceHeroShowcaseVisibleWhenSeen (on the landing page)', () => {
  let ioCallback: IntersectionObserverCallback | null = null;
  const ioDisconnect = vi.fn();

  class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      ioCallback = callback;
    }
    observe() {}
    disconnect() {
      ioDisconnect();
    }
  }

  afterEach(() => {
    ioCallback = null;
    ioDisconnect.mockReset();
    document.body.innerHTML = '';
  });

  function setup(transition: { property: string; duration: string } | null) {
    const viewport = document.createElement('div');
    viewport.dataset.frameState = 'loading';
    if (transition) {
      viewport.style.transitionProperty = transition.property;
      viewport.style.transitionDuration = transition.duration;
    }
    const frame = document.createElement('iframe');
    viewport.appendChild(frame);
    document.body.appendChild(viewport);
    const postMessage = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } });
    const win = window as Window & { IntersectionObserver: unknown };
    const original = win.IntersectionObserver;
    win.IntersectionObserver = FakeIntersectionObserver;
    const stop = announceHeroShowcaseVisibleWhenSeen(viewport, frame, window);
    win.IntersectionObserver = original;
    const see = (visible: number) =>
      ioCallback?.([{
        isIntersecting: visible > 0,
        intersectionRect: { height: visible },
        boundingClientRect: { height: 700 },
        rootBounds: { height: 800 },
      } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    const markReady = async () => {
      viewport.dataset.frameState = 'ready';
      await Promise.resolve();
    };
    const finishFade = () => {
      const event = new Event('transitionend') as TransitionEvent;
      Object.defineProperty(event, 'propertyName', { value: 'opacity' });
      viewport.dispatchEvent(event);
    };
    return { viewport, postMessage, see, markReady, finishFade, stop };
  }

  it('waits for ready when the dashboard is seen first, then posts once', async () => {
    const { postMessage, see, markReady } = setup(null);
    see(600);
    expect(postMessage).not.toHaveBeenCalled();
    await markReady();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, window.location.origin);
    see(0);
    see(700);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(ioDisconnect).toHaveBeenCalled();
  });

  it('waits for visibility when ready comes first', async () => {
    const { postMessage, see, markReady } = setup(null);
    await markReady();
    see(100);
    expect(postMessage).not.toHaveBeenCalled();
    see(Math.ceil(700 * HERO_SHOWCASE_VISIBLE_THRESHOLD));
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('waits for the reveal fade to finish before announcing', async () => {
    const { postMessage, see, markReady, finishFade } = setup({ property: 'opacity', duration: '800ms' });
    see(700);
    await markReady();
    expect(postMessage).not.toHaveBeenCalled();
    finishFade();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('never announces while the frame is not ready, however visible', async () => {
    const { viewport, postMessage, see } = setup(null);
    see(700);
    viewport.dataset.frameState = 'poster';
    await Promise.resolve();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('stops observing when cancelled', async () => {
    const { postMessage, see, markReady, stop } = setup(null);
    stop();
    see(700);
    await markReady();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
