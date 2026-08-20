/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CART_OPEN_REQUEST_EVENT,
  NAV_CLOSE_MS,
  NAV_OPEN_MS,
  bindMobileNav,
  createScrollLock,
  overlayTopFromHeader,
  prefersReducedMotion,
} from './mobileNav';
import { formatNavIndex } from './nav';

function mountNav(options?: { current?: boolean; matchDesktop?: boolean; reducedMotion?: boolean }) {
  document.body.innerHTML = `
    <main class="bl-main"><button type="button" id="page-btn">Page</button></main>
    <footer class="bl-footer"></footer>
    <header data-bl-header data-bl-nav-state="closed">
      <a class="bl-wordmark" href="/demo">Blackline</a>
      <a class="bl-header-book" href="/demo/book">Book</a>
      <button type="button" data-bl-nav-toggle aria-controls="bl-mobile-nav" aria-expanded="false">
        <span class="bl-sr-only">Open navigation menu</span>
      </button>
      <div id="bl-mobile-nav" data-bl-nav-panel hidden>
        <nav aria-label="Mobile navigation">
          <a href="/demo" ${options?.current === false ? '' : 'aria-current="page"'}>Home</a>
          <a href="/demo/shop">Shop</a>
        </nav>
        <a data-bl-nav-book href="/demo/book">Book an appointment</a>
        <button type="button" data-bl-nav-bag>Bag (0)</button>
      </div>
    </header>
  `;

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes('prefers-reduced-motion')
        ? Boolean(options?.reducedMotion)
        : query.includes('min-width: 70rem')
          ? Boolean(options?.matchDesktop)
          : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  const header = document.querySelector('header') as HTMLElement;
  const toggle = document.querySelector('[data-bl-nav-toggle]') as HTMLButtonElement;
  const overlay = document.querySelector('[data-bl-nav-panel]') as HTMLElement;
  const unbind = bindMobileNav({
    header,
    toggle,
    overlay,
    reducedMotion: () => Boolean(options?.reducedMotion),
    openMs: options?.reducedMotion ? 0 : NAV_OPEN_MS,
    closeMs: options?.reducedMotion ? 0 : NAV_CLOSE_MS,
  });
  return { header, toggle, overlay, unbind };
}

describe('formatNavIndex', () => {
  it('zero-pads editorial numbers', () => {
    expect(formatNavIndex(0)).toBe('01');
    expect(formatNavIndex(5)).toBe('06');
  });
});

describe('createScrollLock', () => {
  it('locks with position fixed and restores the saved scroll position', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(240);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const lock = createScrollLock(document, window);

    lock.lock();
    expect(lock.isLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('none');

    lock.unlock();
    expect(lock.isLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });
});

describe('bindMobileNav', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts closed with aria-expanded false and a hidden overlay', () => {
    const { header, toggle, overlay } = mountNav();
    expect(header.dataset.blNavState).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.hidden).toBe(true);
    expect(toggle.querySelector('.bl-sr-only')?.textContent).toBe('Open navigation menu');
  });

  it('opens, moves focus to the active route, then completes opening after the motion window', () => {
    const { header, toggle, overlay } = mountNav();
    toggle.click();
    expect(overlay.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(header.dataset.blNavState).toBe('opening');
    expect(document.activeElement?.textContent).toContain('Home');
    expect(document.body.style.position).toBe('fixed');

    vi.advanceTimersByTime(NAV_OPEN_MS);
    expect(header.dataset.blNavState).toBe('open');
  });

  it('closes on Escape and restores focus to the toggle', () => {
    const { header, toggle, overlay } = mountNav({ reducedMotion: true });
    toggle.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(header.dataset.blNavState).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    expect(document.body.style.position).toBe('');
  });

  it('does not close when tabbing through the final control', () => {
    const { overlay, toggle } = mountNav({ reducedMotion: true });
    toggle.click();
    const bag = overlay.querySelector('[data-bl-nav-bag]') as HTMLButtonElement;
    bag.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(overlay.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes immediately on route click and desktop resize, restoring scroll', () => {
    const { header, overlay, toggle } = mountNav({ reducedMotion: true });
    toggle.click();
    overlay.querySelector('a[href="/demo/shop"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(header.dataset.blNavState).toBe('closed');

    toggle.click();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('min-width: 70rem'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.dispatchEvent(new Event('resize'));
    expect(overlay.hidden).toBe(true);
    expect(document.body.style.position).toBe('');
  });

  it('closes immediately when a BLACKLINE route transition begins', () => {
    const { header, overlay, toggle } = mountNav({ reducedMotion: true });
    toggle.click();
    expect(overlay.hidden).toBe(false);
    document.dispatchEvent(new Event('astro:before-preparation'));
    expect(overlay.hidden).toBe(true);
    expect(header.dataset.blNavState).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.position).toBe('');
  });

  it('opens the bag after an immediate close and skips timers when reduced motion is set', () => {
    const { header, overlay, toggle } = mountNav({ reducedMotion: true });
    const opened = vi.fn();
    window.addEventListener(CART_OPEN_REQUEST_EVENT, opened);
    toggle.click();
    expect(header.dataset.blNavState).toBe('open');
    overlay.querySelector('[data-bl-nav-bag]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.hidden).toBe(true);
    expect(opened).toHaveBeenCalledOnce();
    expect(prefersReducedMotion(window)).toBe(true);
  });
});

describe('overlayTopFromHeader', () => {
  it('uses the visible header bottom and never goes negative', () => {
    const header = document.createElement('header');
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      bottom: 88,
      top: 40,
      left: 0,
      right: 320,
      width: 320,
      height: 48,
      x: 0,
      y: 40,
      toJSON() {
        return {};
      },
    });
    expect(overlayTopFromHeader(header)).toBe(88);
  });
});
