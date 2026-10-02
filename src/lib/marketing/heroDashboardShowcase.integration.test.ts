/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SHOWCASE_READY_MESSAGE_TYPE, HERO_SHOWCASE_WHEEL_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { bindHeroDashboardShowcase } from './heroDashboardShowcase';

const SRC = '/demo/admin?embed=hero&section=bookings_dashboard';
const componentSource = readFileSync(join(process.cwd(), 'src/components/marketing/HeroDashboardShowcase.astro'), 'utf8');
/** The component's own markup, minus frontmatter, script and the noscript fallback. */
const componentMarkup = componentSource
  .slice(componentSource.indexOf('<div class="hero-showcase">'), componentSource.indexOf('<script>'))
  .replace(/<noscript>[\s\S]*?<\/noscript>/, '');

type IoCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let ioCallbacks: IoCallback[];
let idleCallback: (() => void) | undefined;

function render() {
  document.body.innerHTML = componentMarkup;
  const viewport = document.querySelector<HTMLElement>('[data-deferred-demo-frame]')!;
  return { viewport, frame: viewport.querySelector('iframe')! };
}

function postFromFrame(frame: HTMLIFrameElement, data: unknown, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: frame.contentWindow }));
}

beforeEach(() => {
  ioCallbacks = [];
  idleCallback = undefined;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IoCallback) {
        ioCallbacks.push(cb);
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
  document.dispatchEvent(new Event('astro:before-swap'));
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('shared hero dashboard showcase, end to end', () => {
  it('reserves the viewport in its initial state and keeps the iframe off the critical path', () => {
    const { viewport, frame } = render();
    bindHeroDashboardShowcase(window);
    expect(viewport.dataset.frameState).toBe('poster');
    expect(frame.getAttribute('src')).toBeNull();
    expect(frame.dataset.deferredSrc).toBe(SRC);
  });

  it('starts loading after load + idle once near the viewport, and reveals only on the validated ready message', () => {
    const { viewport, frame } = render();
    bindHeroDashboardShowcase(window);
    idleCallback?.();
    expect(frame.getAttribute('src')).toBeNull();
    ioCallbacks[0]([{ isIntersecting: true }]);
    expect(viewport.dataset.frameState).toBe('loading');
    expect(frame.getAttribute('src')).toBe(SRC);

    postFromFrame(frame, { type: 'something-else' });
    postFromFrame(frame, { type: HERO_SHOWCASE_READY_MESSAGE_TYPE }, 'https://evil.example');
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: HERO_SHOWCASE_READY_MESSAGE_TYPE }, origin: window.location.origin, source: window }),
    );
    expect(viewport.dataset.frameState).toBe('loading');

    postFromFrame(frame, { type: HERO_SHOWCASE_READY_MESSAGE_TYPE });
    expect(viewport.dataset.frameState).toBe('ready');
  });

  it('starts immediately on intent, before the idle period', () => {
    const { viewport, frame } = render();
    bindHeroDashboardShowcase(window);
    viewport.dispatchEvent(new Event('pointerenter'));
    expect(viewport.dataset.frameState).toBe('loading');
    expect(frame.getAttribute('src')).toBe(SRC);
  });

  it('forwards wheel gestures from the hero frame to the page', () => {
    const { frame } = render();
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);
    window.scrollBy = scrollBy as typeof window.scrollBy;
    bindHeroDashboardShowcase(window);
    postFromFrame(frame, { type: HERO_SHOWCASE_WHEEL_MESSAGE_TYPE, deltaY: 120, deltaMode: 0 });
    expect(scrollBy).toHaveBeenCalledWith({ top: 120, left: 0, behavior: 'instant' });
  });

  it('stops listening after a soft swap and starts a fresh deferred frame on return', () => {
    const first = render();
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as typeof window.scrollBy;
    bindHeroDashboardShowcase(window);
    document.dispatchEvent(new Event('astro:before-swap'));
    postFromFrame(first.frame, { type: HERO_SHOWCASE_WHEEL_MESSAGE_TYPE, deltaY: 120, deltaMode: 0 });
    expect(scrollBy).not.toHaveBeenCalled();

    const second = render();
    bindHeroDashboardShowcase(window);
    expect(second.viewport.dataset.frameState).toBe('poster');
    expect(second.frame.getAttribute('src')).toBeNull();
    second.viewport.dispatchEvent(new Event('pointerdown'));
    expect(second.frame.getAttribute('src')).toBe(SRC);
  });
});
