/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ROUTE_COVER_MS,
  ROUTE_REVEAL_MS,
  ROUTE_SAFETY_MS,
  bindRouteTransition,
  clearPageMotionAttributes,
  isBlacklineCustomerPath,
  isCurrentPathNavigation,
  isModifiedNavigationClick,
  isSameDocumentHashNavigation,
  shouldCoverTransition,
  shouldIgnoreAnchorNavigation,
  syncDemoNavActive,
} from './routeTransition';

function url(path: string) {
  return new URL(path, 'http://localhost');
}

function createPrepEvent(options: {
  from: string;
  to: string;
  navigationType?: string;
  loader?: () => Promise<void>;
  signal?: AbortSignal;
}) {
  const event = new Event('astro:before-preparation', { cancelable: true }) as Event & {
    from: URL;
    to: URL;
    navigationType: string;
    loader: () => Promise<void>;
    signal: AbortSignal;
  };
  Object.defineProperty(event, 'from', { value: url(options.from), enumerable: true });
  Object.defineProperty(event, 'to', { value: url(options.to), enumerable: true });
  Object.defineProperty(event, 'navigationType', {
    value: options.navigationType ?? 'push',
    enumerable: true,
  });
  Object.defineProperty(event, 'loader', {
    value: options.loader ?? (async () => undefined),
    writable: true,
    enumerable: true,
  });
  Object.defineProperty(event, 'signal', {
    value: options.signal ?? new AbortController().signal,
    enumerable: true,
  });
  return event;
}

function mountStage() {
  document.body.innerHTML = `
    <header data-bl-header>
      <a class="bl-wordmark" href="/demo">Blackline</a>
      <a class="bl-nav-link" href="/demo">Home</a>
      <a class="bl-nav-link" href="/demo/services" aria-current="page">Services</a>
      <a class="bl-nav-link" href="/demo/shop">Shop</a>
      <a class="bl-header-cta" href="/demo/book">Book now</a>
      <a class="bl-nav-index-link" href="/demo/services" aria-current="page">
        <span class="bl-nav-index-copy">
          <span class="bl-nav-index-label">Services</span>
          <span class="bl-nav-index-current">Current</span>
        </span>
      </a>
      <a class="bl-nav-index-link" href="/demo/shop">
        <span class="bl-nav-index-copy">
          <span class="bl-nav-index-label">Shop</span>
        </span>
      </a>
    </header>
    <div class="bl-route-stage">
      <main class="bl-main" tabindex="-1"><h1>Services</h1></main>
      <div class="bl-route-veil" data-bl-route-veil data-bl-route-phase="idle" aria-hidden="true"></div>
    </div>
  `;
  const veil = document.querySelector('[data-bl-route-veil]') as HTMLElement;
  return { veil };
}

describe('BLACKLINE route transition rules', () => {
  it('covers internal BLACKLINE path changes only', () => {
    expect(isBlacklineCustomerPath('/demo')).toBe(true);
    expect(isBlacklineCustomerPath('/demo/shop')).toBe(true);
    expect(isBlacklineCustomerPath('/demo-shop')).toBe(false);
    expect(isBlacklineCustomerPath('/admin')).toBe(false);

    expect(
      shouldCoverTransition({
        from: url('/demo'),
        to: url('/demo/services'),
        navigationType: 'push',
        reducedMotion: false,
      }),
    ).toBe(true);
  });

  it('skips the current route, hash-only moves, back/forward and reduced motion', () => {
    expect(isCurrentPathNavigation(url('/demo/shop'), url('/demo/shop'))).toBe(true);
    expect(isSameDocumentHashNavigation(url('/demo'), url('/demo#visit'))).toBe(true);
    expect(
      shouldCoverTransition({
        from: url('/demo'),
        to: url('/demo'),
        navigationType: 'push',
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldCoverTransition({
        from: url('/demo/services'),
        to: url('/demo/barbers'),
        navigationType: 'traverse',
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldCoverTransition({
        from: url('/demo'),
        to: url('/demo/shop'),
        navigationType: 'push',
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  it('does not intercept modified clicks, tel, external, hash or download links', () => {
    const here = { href: 'http://localhost/demo', origin: 'http://localhost', pathname: '/demo' };
    expect(isModifiedNavigationClick({ metaKey: true })).toBe(true);
    expect(isModifiedNavigationClick({ ctrlKey: true })).toBe(true);
    expect(isModifiedNavigationClick({ shiftKey: true })).toBe(true);
    expect(isModifiedNavigationClick({ altKey: true })).toBe(true);
    expect(isModifiedNavigationClick({ button: 1 })).toBe(true);
    expect(isModifiedNavigationClick({ button: 0 })).toBe(false);
    expect(shouldIgnoreAnchorNavigation('tel:+441614960127', here)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('mailto:hello@kersivo.co.uk', here)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('https://kersivo.co.uk', here)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/demo#popular-services-heading', here)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/demo', here)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/demo/shop', here, { download: true })).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/demo/shop', here, { target: '_blank' })).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/', here, { reload: true })).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/demo/shop', here)).toBe(false);
  });
});

describe('syncDemoNavActive', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves aria-current and the Current label without touching the wordmark', () => {
    mountStage();
    const header = document.querySelector('[data-bl-header]') as HTMLElement;
    syncDemoNavActive(header, '/demo/shop');
    expect(header.querySelector('.bl-nav-link[href="/demo/shop"]')?.getAttribute('aria-current')).toBe('page');
    expect(header.querySelector('.bl-nav-link[href="/demo/services"]')?.getAttribute('aria-current')).toBeNull();
    expect(header.querySelector('.bl-nav-index-link[href="/demo/shop"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(header.querySelector('.bl-nav-index-link[href="/demo/services"]')?.getAttribute('aria-current')).toBeNull();
    expect(header.querySelector('.bl-nav-index-link[href="/demo/shop"] .bl-nav-index-current')?.textContent).toBe(
      'Current',
    );
    expect(header.querySelector('.bl-wordmark')?.getAttribute('aria-current')).toBeNull();
  });
});

describe('clearPageMotionAttributes', () => {
  it('removes leftover page motion flags', () => {
    document.documentElement.setAttribute('data-bl-shop-motion', '');
    document.documentElement.setAttribute('data-bl-gallery-instant', '');
    document.documentElement.setAttribute('data-theme', 'blackline');
    clearPageMotionAttributes(document.documentElement);
    expect(document.documentElement.hasAttribute('data-bl-shop-motion')).toBe(false);
    expect(document.documentElement.hasAttribute('data-bl-gallery-instant')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('blackline');
  });
});

describe('bindRouteTransition', () => {
  let unbind: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    unbind?.();
    unbind = undefined;
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-bl-shop-motion');
    vi.useRealTimers();
  });

  it('does not cover on bind / initial load', () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({ veil, reducedMotion: () => false });
    expect(veil.dataset.blRoutePhase).toBe('idle');
    document.dispatchEvent(new Event('astro:page-load'));
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });

  it('covers an internal push, then reveals and returns to idle', async () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({
      veil,
      reducedMotion: () => false,
      coverMs: ROUTE_COVER_MS,
      revealMs: ROUTE_REVEAL_MS,
    });
    const event = createPrepEvent({ from: '/demo', to: '/demo/services' });
    document.dispatchEvent(event);
    const loading = event.loader();
    await vi.advanceTimersByTimeAsync(ROUTE_COVER_MS);
    await loading;
    expect(veil.dataset.blRoutePhase).toBe('navigating');
    expect(veil.style.willChange).toBe('opacity');

    document.dispatchEvent(new Event('astro:after-swap'));
    expect(veil.dataset.blRoutePhase).toBe('revealing');
    await vi.advanceTimersByTimeAsync(ROUTE_REVEAL_MS);
    expect(veil.dataset.blRoutePhase).toBe('idle');
    expect(veil.style.willChange).toBe('');
  });

  it('navigates immediately under reduced motion', async () => {
    const { veil } = mountStage();
    const loader = vi.fn(async () => undefined);
    unbind = bindRouteTransition({ veil, reducedMotion: () => true });
    const event = createPrepEvent({ from: '/demo', to: '/demo/shop', loader });
    document.dispatchEvent(event);
    await event.loader();
    expect(loader).toHaveBeenCalledOnce();
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });

  it('skips cover for browser Back/Forward', async () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({ veil, reducedMotion: () => false });
    const event = createPrepEvent({
      from: '/demo/shop',
      to: '/demo',
      navigationType: 'traverse',
    });
    document.dispatchEvent(event);
    await event.loader();
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });

  it('uses the latest navigation and does not queue stacked veils', async () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({ veil, reducedMotion: () => false, coverMs: 40, revealMs: 40 });
    const first = new AbortController();
    const eventA = createPrepEvent({
      from: '/demo',
      to: '/demo/services',
      signal: first.signal,
      loader: () => new Promise(() => undefined),
    });
    document.dispatchEvent(eventA);
    void eventA.loader();
    await vi.advanceTimersByTimeAsync(10);
    expect(veil.dataset.blRoutePhase).toBe('covering');

    const eventB = createPrepEvent({ from: '/demo', to: '/demo/barbers' });
    document.dispatchEvent(eventB);
    first.abort();
    const loadingB = eventB.loader();
    await vi.advanceTimersByTimeAsync(40);
    await loadingB;
    expect(veil.dataset.blRoutePhase).toBe('navigating');
    document.dispatchEvent(new Event('astro:after-swap'));
    await vi.advanceTimersByTimeAsync(40);
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });

  it('cleans up after a navigation error and a safety timeout', async () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({
      veil,
      reducedMotion: () => false,
      coverMs: 20,
      revealMs: 20,
      safetyMs: 80,
    });

    const failing = createPrepEvent({
      from: '/demo',
      to: '/demo/contact',
      loader: async () => {
        throw new Error('route failed');
      },
    });
    document.dispatchEvent(failing);
    await expect(failing.loader()).rejects.toThrow('route failed');
    expect(veil.dataset.blRoutePhase).toBe('idle');

    const hanging = createPrepEvent({
      from: '/demo',
      to: '/demo/gallery',
      loader: () => new Promise(() => undefined),
    });
    document.dispatchEvent(hanging);
    void hanging.loader();
    await vi.advanceTimersByTimeAsync(ROUTE_SAFETY_MS);
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });

  it('resets on unmount so the overlay cannot stay active', async () => {
    const { veil } = mountStage();
    unbind = bindRouteTransition({ veil, reducedMotion: () => false, coverMs: 80 });
    const event = createPrepEvent({ from: '/demo', to: '/demo/book' });
    document.dispatchEvent(event);
    void event.loader();
    await vi.advanceTimersByTimeAsync(10);
    expect(veil.dataset.blRoutePhase).toBe('covering');
    unbind();
    expect(veil.dataset.blRoutePhase).toBe('idle');
  });
});
