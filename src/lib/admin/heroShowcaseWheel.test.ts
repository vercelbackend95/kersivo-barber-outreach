/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HERO_SHOWCASE_WHEEL_MESSAGE_TYPE } from './heroShowcase';
import { forwardHeroShowcaseWheel, normalizeWheelDeltaY, receiveHeroShowcaseWheel } from './heroShowcaseWheel';

const ORIGIN = window.location.origin;

function createFrameWindow() {
  const postMessage = vi.fn();
  const win = Object.assign(new EventTarget(), { parent: { postMessage }, location: { origin: ORIGIN } });
  return { win: win as unknown as Window, postMessage };
}

function wheel(init: WheelEventInit) {
  return new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('forwardHeroShowcaseWheel (inside the hero iframe)', () => {
  it('hands vertical wheel deltas to the same-origin parent and stops the iframe consuming them', () => {
    const { win, postMessage } = createFrameWindow();
    forwardHeroShowcaseWheel(win);
    const event = wheel({ deltaY: 3.5, deltaX: 0.5 });
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      { type: HERO_SHOWCASE_WHEEL_MESSAGE_TYPE, deltaY: 3.5, deltaMode: 0 },
      ORIGIN,
    );
  });

  it('leaves Ctrl+wheel zoom, horizontal gestures and already-handled events alone', () => {
    const { win, postMessage } = createFrameWindow();
    forwardHeroShowcaseWheel(win);
    const zoom = wheel({ deltaY: 100, ctrlKey: true });
    const horizontal = wheel({ deltaY: 2, deltaX: 40 });
    const handled = wheel({ deltaY: 100 });
    handled.preventDefault();
    for (const event of [zoom, horizontal, handled]) win.dispatchEvent(event);
    expect(zoom.defaultPrevented).toBe(false);
    expect(horizontal.defaultPrevented).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does nothing in a top-level window and stops after cleanup', () => {
    const top = Object.assign(new EventTarget(), { location: { origin: ORIGIN } }) as unknown as Window & { parent: Window };
    top.parent = top;
    const topEvent = wheel({ deltaY: 100 });
    forwardHeroShowcaseWheel(top);
    top.dispatchEvent(topEvent);
    expect(topEvent.defaultPrevented).toBe(false);

    const { win, postMessage } = createFrameWindow();
    const cleanup = forwardHeroShowcaseWheel(win);
    cleanup();
    const event = wheel({ deltaY: 100 });
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('never cancels clicks or pointer events', () => {
    const { win } = createFrameWindow();
    forwardHeroShowcaseWheel(win);
    const click = new MouseEvent('click', { cancelable: true });
    const pointer = new Event('pointerdown', { cancelable: true });
    win.dispatchEvent(click);
    win.dispatchEvent(pointer);
    expect(click.defaultPrevented).toBe(false);
    expect(pointer.defaultPrevented).toBe(false);
  });
});

describe('receiveHeroShowcaseWheel (on the landing page)', () => {
  function setup() {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as typeof window.scrollBy;
    const cleanup = receiveHeroShowcaseWheel(frame, window);
    const post = (data: unknown, init: { origin?: string; source?: MessageEventSource | null } = {}) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          origin: init.origin ?? ORIGIN,
          source: init.source === undefined ? frame.contentWindow : init.source,
        }),
      );
    return { scrollBy, cleanup, post };
  }

  const message = (deltaY: unknown, deltaMode: unknown = 0) => ({ type: HERO_SHOWCASE_WHEEL_MESSAGE_TYPE, deltaY, deltaMode });

  it('scrolls the page by the exact pixel delta, instantly', () => {
    const { scrollBy, post } = setup();
    post(message(4));
    post(message(-2.5));
    expect(scrollBy.mock.calls).toEqual([
      [{ top: 4, left: 0, behavior: 'instant' }],
      [{ top: -2.5, left: 0, behavior: 'instant' }],
    ]);
  });

  it('normalises line and page deltas', () => {
    const { scrollBy, post } = setup();
    post(message(3, 1));
    post(message(1, 2));
    expect(scrollBy.mock.calls.map(([options]) => (options as ScrollToOptions).top)).toEqual([120, window.innerHeight]);
    expect(normalizeWheelDeltaY(7, 0, 900)).toBe(7);
  });

  it('only accepts the exact wheel message from the hero frame on the same origin', () => {
    const { scrollBy, post } = setup();
    post(message(100), { origin: 'https://evil.example' });
    post(message(100), { source: window });
    post({ ...message(100), type: 'kersivo:hero-showcase-ready' });
    post(message('100'));
    post(message(Number.NaN));
    post(message(100, 5));
    post('kersivo:hero-showcase-wheel');
    post(null);
    post(message(0));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('stops listening on cleanup', () => {
    const { scrollBy, cleanup, post } = setup();
    cleanup();
    post(message(100));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
