/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMarketingNavCurrent, initMarketingNav } from './marketingNavController';

beforeAll(() => {
  window.addEventListener('click', (event) => event.preventDefault());
});

const panel = (id: string, links: string) => `
  <li class="mnav__item">
    <button type="button" aria-expanded="false" aria-controls="mnav-panel-${id}" data-mnav-trigger="${id}">${id}</button>
    <div id="mnav-panel-${id}" data-mnav-panel hidden>${links}</div>
  </li>`;

const accordion = (id: string, links: string) => `
  <li>
    <button type="button" aria-expanded="false" aria-controls="mnav-hub-${id}" data-mnav-accordion="${id}">${id}</button>
    <div id="mnav-hub-${id}" hidden>${links}</div>
  </li>`;

const compareLinks = `
  <a href="/booksy-alternative" data-mnav-match="/booksy-alternative">Booksy</a>
  <a href="/fresha-alternative" data-mnav-match="/fresha-alternative">Fresha</a>`;
const resourceLinks = `<a href="/barber-software-cost-calculator" data-mnav-match="/barber-software-cost-calculator">Calculator</a>`;

function render() {
  document.documentElement.className = '';
  document.body.innerHTML = `
    <a id="skip" href="#main">Skip</a>
    <header data-mnav>
      <nav aria-label="Main">
        <ul>
          ${panel('compare', compareLinks)}
          ${panel('resources', resourceLinks)}
          <li><a href="/#pricing" data-mnav-section="pricing">Pricing</a></li>
        </ul>
      </nav>
      <button type="button" aria-expanded="false" aria-controls="mnav-hub" data-mnav-menu>
        <span data-mnav-menu-label>Menu</span>
      </button>
      <div id="mnav-hub" data-mnav-hub hidden inert>
        <ul>
          ${accordion('compare', compareLinks)}
          ${accordion('resources', resourceLinks)}
        </ul>
      </div>
    </header>
    <main id="main"><button id="outside">Outside</button></main>
    <footer id="footer"></footer>`;
  return document.querySelector<HTMLElement>('[data-mnav]')!;
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const trigger = (id: string) => $<HTMLButtonElement>(`[data-mnav-trigger="${id}"]`);
const menu = () => $<HTMLButtonElement>('[data-mnav-menu]');
const hub = () => $('#mnav-hub');
const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

function stubMatchMedia(matches: (query: string) => boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

let cleanup: (() => void) | undefined;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  // @ts-expect-error reset the stub between tests
  delete window.matchMedia;
});

describe('desktop disclosure panels', () => {
  it('toggles aria-expanded and keeps only one panel open', () => {
    const root = render();
    cleanup = initMarketingNav(root);

    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
    expect($('#mnav-panel-compare').hidden).toBe(false);
    expect(root.dataset.mnavPanel).toBe('compare');

    trigger('resources').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
    expect($('#mnav-panel-compare').hidden).toBe(true);
    expect(trigger('resources').getAttribute('aria-expanded')).toBe('true');

    trigger('resources').click();
    expect(trigger('resources').getAttribute('aria-expanded')).toBe('false');
    expect($('#mnav-panel-resources').hidden).toBe(true);
    expect(root.dataset.mnavPanel).toBeUndefined();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    cleanup = initMarketingNav(render());
    trigger('compare').click();
    $('#mnav-panel-compare a').focus();
    press('Escape');
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger('compare'));
  });

  it('closes on outside pointerdown but not inside the panel', () => {
    cleanup = initMarketingNav(render());
    trigger('compare').click();
    $('#mnav-panel-compare').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
    $('#outside').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when focus leaves the open item', () => {
    cleanup = initMarketingNav(render());
    trigger('compare').click();
    const item = trigger('compare').closest('li')!;
    item.dispatchEvent(new FocusEvent('focusout', { relatedTarget: $('#mnav-panel-compare a') }));
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
    item.dispatchEvent(new FocusEvent('focusout', { relatedTarget: $('#outside') }));
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes after a panel link is chosen', () => {
    cleanup = initMarketingNav(render());
    trigger('compare').click();
    $('#mnav-panel-compare a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on hover intent only for fine pointers and ignores touch', () => {
    vi.useFakeTimers();
    stubMatchMedia((query) => query.includes('hover'));
    cleanup = initMarketingNav(render(), { hoverOpenDelay: 100, hoverCloseDelay: 200 });
    const item = trigger('compare').closest('li')!;

    const touch = new Event('pointerenter');
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    item.dispatchEvent(touch);
    vi.advanceTimersByTime(150);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');

    item.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(50);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
    vi.advanceTimersByTime(60);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');

    item.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(210);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a click-pinned panel open when the pointer leaves', () => {
    vi.useFakeTimers();
    stubMatchMedia((query) => query.includes('hover'));
    cleanup = initMarketingNav(render(), { hoverCloseDelay: 200 });
    trigger('compare').click();
    trigger('compare').closest('li')!.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(500);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
  });

  it('does not open panels on hover without a hover-capable pointer', () => {
    vi.useFakeTimers();
    stubMatchMedia(() => false);
    cleanup = initMarketingNav(render());
    trigger('compare').closest('li')!.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(1000);
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('mobile navigation hub', () => {
  it('opens with scroll lock, inert page content and focus in the hub', () => {
    const root = render();
    cleanup = initMarketingNav(root);
    menu().click();

    expect(menu().getAttribute('aria-expanded')).toBe('true');
    expect($('[data-mnav-menu-label]').textContent).toBe('Close');
    expect(hub().hidden).toBe(false);
    expect(hub().hasAttribute('inert')).toBe(false);
    expect(document.documentElement.classList.contains('mnav-locked')).toBe(true);
    expect(root.hasAttribute('data-mnav-hub-open')).toBe(true);
    expect($('#main').hasAttribute('inert')).toBe(true);
    expect($('#footer').hasAttribute('inert')).toBe(true);
    expect(root.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe($('[data-mnav-accordion="compare"]'));
  });

  it('closes, restores scroll and inert state, and returns focus to the menu button', () => {
    const root = render();
    $('#footer').setAttribute('inert', '');
    cleanup = initMarketingNav(root);
    menu().click();
    press('Escape');

    expect(menu().getAttribute('aria-expanded')).toBe('false');
    expect($('[data-mnav-menu-label]').textContent).toBe('Menu');
    expect(hub().hidden).toBe(true);
    expect(hub().hasAttribute('inert')).toBe(true);
    expect(document.documentElement.classList.contains('mnav-locked')).toBe(false);
    expect($('#main').hasAttribute('inert')).toBe(false);
    expect($('#footer').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(menu());
  });

  it('toggles accordions independently', () => {
    cleanup = initMarketingNav(render());
    menu().click();
    const compare = $<HTMLButtonElement>('[data-mnav-accordion="compare"]');
    const resources = $<HTMLButtonElement>('[data-mnav-accordion="resources"]');

    compare.click();
    resources.click();
    expect(compare.getAttribute('aria-expanded')).toBe('true');
    expect(resources.getAttribute('aria-expanded')).toBe('true');
    expect($('#mnav-hub-compare').hidden).toBe(false);
    expect($('#mnav-hub-resources').hidden).toBe(false);

    compare.click();
    expect(compare.getAttribute('aria-expanded')).toBe('false');
    expect($('#mnav-hub-compare').hidden).toBe(true);
    expect($('#mnav-hub-resources').hidden).toBe(false);
  });

  it('closes when a hub link is chosen', () => {
    cleanup = initMarketingNav(render());
    menu().click();
    $('#mnav-hub-compare a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(menu().getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.classList.contains('mnav-locked')).toBe(false);
  });

  it('closes an open desktop panel when the hub opens', () => {
    cleanup = initMarketingNav(render());
    trigger('compare').click();
    menu().click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('lifecycle and current state', () => {
  it('is idempotent when initialised twice', () => {
    const root = render();
    const first = initMarketingNav(root);
    const second = initMarketingNav(root);
    cleanup = first;
    expect(second).toBe(first);

    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
    menu().click();
    expect(menu().getAttribute('aria-expanded')).toBe('true');
  });

  it('cleans up on astro:before-swap and can be re-initialised', () => {
    const root = render();
    initMarketingNav(root);
    menu().click();
    expect(root.dataset.mnavBound).toBe('true');

    document.dispatchEvent(new Event('astro:before-swap'));
    expect(menu().getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.classList.contains('mnav-locked')).toBe(false);
    expect($('#main').hasAttribute('inert')).toBe(false);
    expect(root.dataset.mnavBound).toBeUndefined();

    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');

    cleanup = initMarketingNav(root);
    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
  });

  it('derives aria-current from the live URL and clears stale state', () => {
    const root = render();
    applyMarketingNavCurrent(root, { pathname: '/booksy-alternative' });
    const booksy = root.querySelectorAll('a[href="/booksy-alternative"]');
    booksy.forEach((link) => expect(link.getAttribute('aria-current')).toBe('page'));
    expect(trigger('compare').hasAttribute('data-current')).toBe(true);
    expect($('[data-mnav-accordion="compare"]').hasAttribute('data-current')).toBe(true);
    expect(trigger('resources').hasAttribute('data-current')).toBe(false);

    applyMarketingNavCurrent(root, { pathname: '/barber-software-cost-calculator/' });
    booksy.forEach((link) => expect(link.hasAttribute('aria-current')).toBe(false));
    expect(trigger('compare').hasAttribute('data-current')).toBe(false);
    expect(trigger('resources').hasAttribute('data-current')).toBe(true);
  });

  it('applies current state for the page being initialised', () => {
    window.history.replaceState(null, '', '/fresha-alternative');
    const root = render();
    cleanup = initMarketingNav(root);
    expect(root.querySelector('#mnav-panel-compare a[href="/fresha-alternative"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(root.querySelector('a[data-mnav-section="pricing"]')?.hasAttribute('aria-current')).toBe(false);
  });
});
