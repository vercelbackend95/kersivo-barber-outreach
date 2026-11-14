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

const tab = (id: string, selected: boolean) =>
  `<button type="button" role="tab" aria-selected="${selected}" aria-controls="mnav-hub-${id}" ${selected ? '' : 'tabindex="-1"'} data-mnav-tab="${id}">${id}</button>`;
const tabPanel = (id: string, links: string, selected: boolean) =>
  `<div id="mnav-hub-${id}" role="tabpanel" data-mnav-tabpanel="${id}" ${selected ? '' : 'hidden'}>${links}</div>`;

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
        <template data-mnav-hub-content>
          <button type="button" data-mnav-finder-open>Search</button>
          <div role="tablist">
            ${tab('compare', true)}
            ${tab('resources', false)}
            <span data-mnav-tab-thumb></span>
          </div>
          ${tabPanel('compare', compareLinks, true)}
          ${tabPanel('resources', resourceLinks, false)}
        </template>
      </div>
      <dialog data-mnav-finder>
        <template data-mnav-finder-content>
          <input data-mnav-finder-input />
          <button type="button" data-mnav-finder-close>Close</button>
          <ul role="listbox">
            <li role="none" data-terms="compare all booking systems booksy fresha" data-title="compare all booking systems"><a id="f-hub" role="option" href="/compare">Compare all</a></li>
            <li role="none" data-terms="booksy alternative compare" data-title="booksy alternative booksy"><a id="f-booksy" role="option" href="/booksy-alternative">Booksy</a></li>
            <li role="none" data-terms="no-show calculator deposit" data-title="no-show calculator"><a id="f-noshow" role="option" href="/barbershop-no-show-calculator">No-show</a></li>
          </ul>
          <p data-mnav-finder-empty hidden>None</p>
          <p data-mnav-finder-status></p>
        </template>
      </dialog>
      <button type="button" id="desktop-search" data-mnav-finder-open>Search</button>
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

  it('moves between triggers with the arrow keys and through the open links', () => {
    stubMatchMedia((query) => query.includes('min-width'));
    cleanup = initMarketingNav(render());
    trigger('compare').focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(trigger('resources'));
    expect(trigger('resources').getAttribute('aria-expanded')).toBe('true');
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');

    trigger('compare').focus();
    press('ArrowDown');
    const links = [...document.querySelectorAll<HTMLAnchorElement>('#mnav-panel-compare a')];
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(links[0]);
    press('ArrowDown');
    expect(document.activeElement).toBe(links[1]);
    press('ArrowUp');
    expect(document.activeElement).toBe(links[0]);
    press('Escape');
    expect(document.activeElement).toBe(trigger('compare'));
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
  it('keeps hub content out of the live DOM until the menu is first opened', () => {
    window.history.replaceState(null, '', '/booksy-alternative');
    cleanup = initMarketingNav(render());
    expect(hub().querySelector('[data-mnav-tab]')).toBeNull();
    expect(hub().querySelector('template[data-mnav-hub-content]')).not.toBeNull();

    menu().click();
    expect(hub().querySelector('template')).toBeNull();
    expect(hub().querySelectorAll('[data-mnav-tab]')).toHaveLength(2);
    // Current-page state is applied to the freshly mounted links and their tab.
    expect(hub().querySelector('a[href="/booksy-alternative"]')?.getAttribute('aria-current')).toBe('page');
    expect($('[data-mnav-tab="compare"]').hasAttribute('data-current')).toBe(true);

    press('Escape');
    menu().click();
    expect(hub().querySelectorAll('[data-mnav-tab]')).toHaveLength(2);
    window.history.replaceState(null, '', '/');
  });

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
    expect(document.activeElement).toBe(hub().querySelector('[data-mnav-finder-open]'));
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

  it('switches tabs with one tab stop and arrow-key navigation', () => {
    cleanup = initMarketingNav(render());
    menu().click();
    const compare = $<HTMLButtonElement>('[data-mnav-tab="compare"]');
    const resources = $<HTMLButtonElement>('[data-mnav-tab="resources"]');

    resources.click();
    expect(resources.getAttribute('aria-selected')).toBe('true');
    expect(compare.getAttribute('aria-selected')).toBe('false');
    expect(compare.getAttribute('tabindex')).toBe('-1');
    expect(resources.hasAttribute('tabindex')).toBe(false);
    expect($('#mnav-hub-resources').hidden).toBe(false);
    expect($('#mnav-hub-compare').hidden).toBe(true);

    resources.focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(compare);
    expect($('#mnav-hub-compare').hidden).toBe(false);
    press('End');
    expect(document.activeElement).toBe(resources);
    press('Home');
    expect(document.activeElement).toBe(compare);
  });

  it('opens on the tab of the page being shown', () => {
    window.history.replaceState(null, '', '/barber-software-cost-calculator');
    cleanup = initMarketingNav(render());
    menu().click();
    expect($('[data-mnav-tab="resources"]').getAttribute('aria-selected')).toBe('true');
    expect($('#mnav-hub-resources').hidden).toBe(false);
    expect($('#mnav-hub-compare').hidden).toBe(true);
  });

  it('reserves the header’s measured in-flow height while open and releases it on close', () => {
    const root = render();
    root.getBoundingClientRect = () => ({ height: 61.25 }) as DOMRect;
    cleanup = initMarketingNav(root);
    const flow = () => document.body.style.getPropertyValue('--mnav-flow-h');

    menu().click();
    expect(flow()).toBe('61.25px');
    menu().click();
    expect(flow()).toBe('');

    menu().click();
    menu().click();
    menu().click();
    expect(flow()).toBe('61.25px');
    press('Escape');
    expect(flow()).toBe('');
    expect(root.hasAttribute('data-mnav-hub-open')).toBe(false);
  });

  it('measures the header before pinning it, so the reserved space is its in-flow height', () => {
    const root = render();
    let measuredWhileOpen: boolean | null = null;
    root.getBoundingClientRect = () => {
      measuredWhileOpen = root.hasAttribute('data-mnav-hub-open');
      return { height: 61 } as DOMRect;
    };
    cleanup = initMarketingNav(root);
    menu().click();
    expect(measuredWhileOpen).toBe(false);
  });

  it('pins the header and reserves its space before the hub becomes visible', () => {
    const root = render();
    const panel = hub();
    const hidden = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden')!;
    let pinnedWhenShown: boolean | null = null;
    Object.defineProperty(panel, 'hidden', {
      configurable: true,
      get: () => hidden.get!.call(panel),
      set: (value: boolean) => {
        if (!value && pinnedWhenShown === null) {
          pinnedWhenShown =
            root.hasAttribute('data-mnav-hub-open') &&
            document.documentElement.classList.contains('mnav-locked') &&
            document.body.style.getPropertyValue('--mnav-flow-h') !== '';
        }
        hidden.set!.call(panel, value);
      },
    });
    cleanup = initMarketingNav(root);
    menu().click();
    expect(pinnedWhenShown).toBe(true);
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
    expect(root.hasAttribute('data-mnav-hub-open')).toBe(false);
    expect(document.body.style.getPropertyValue('--mnav-flow-h')).toBe('');
    expect($('#main').hasAttribute('inert')).toBe(false);
    expect(root.dataset.mnavBound).toBeUndefined();

    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('false');

    cleanup = initMarketingNav(root);
    trigger('compare').click();
    expect(trigger('compare').getAttribute('aria-expanded')).toBe('true');
  });

  it('marks a group current from a path prefix when no child link matches', () => {
    const root = render();
    trigger('compare').dataset.mnavCurrentPrefix = '/demo';
    applyMarketingNavCurrent(root, { pathname: '/demo/gallery' });
    expect(trigger('compare').hasAttribute('data-current')).toBe(true);
    expect($('#mnav-panel-compare a')?.hasAttribute('aria-current')).toBe(false);
    applyMarketingNavCurrent(root, { pathname: '/pricing' });
    expect(trigger('compare').hasAttribute('data-current')).toBe(false);
  });

  it('derives aria-current from the live URL and clears stale state', () => {
    const root = render();
    applyMarketingNavCurrent(root, { pathname: '/booksy-alternative' });
    const booksy = root.querySelectorAll('a[href="/booksy-alternative"]');
    booksy.forEach((link) => expect(link.getAttribute('aria-current')).toBe('page'));
    expect(trigger('compare').hasAttribute('data-current')).toBe(true);
    // Hub accordions are not live until mounted; they get their state at mount (see the hub tests).
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

describe('navigation finder', () => {
  beforeAll(() => {
    // jsdom has no modal dialog support; a minimal stand-in keeps open state and fires "close".
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
    if (typeof proto.showModal !== 'function') {
      proto.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
      proto.close = function close(this: HTMLDialogElement) {
        if (!this.hasAttribute('open')) return;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  });

  const finder = () => $<HTMLDialogElement>('[data-mnav-finder]');
  const input = () => $<HTMLInputElement>('[data-mnav-finder-input]');
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('mounts lazily and opens from the search button with focus in the field', () => {
    cleanup = initMarketingNav(render());
    expect(finder().querySelector('[data-mnav-finder-input]')).toBeNull();
    $('#desktop-search').click();
    expect(finder().open).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it('filters by every typed word and marks the first match active', () => {
    cleanup = initMarketingNav(render());
    $('#desktop-search').click();
    type('deposit');
    const rows = [...finder().querySelectorAll<HTMLElement>('li')];
    expect(rows.map((row) => row.hidden)).toEqual([true, true, false]);
    expect(input().getAttribute('aria-activedescendant')).toBe('f-noshow');
    expect($('[data-mnav-finder-status]').textContent).toBe('1 result');

    type('nothing here');
    expect($('[data-mnav-finder-empty]').hidden).toBe(false);
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('ranks title matches above description-only matches', () => {
    cleanup = initMarketingNav(render());
    $('#desktop-search').click();
    type('booksy');
    // Both rows match; the hub only through its description, so the Booksy page leads.
    expect(input().getAttribute('aria-activedescendant')).toBe('f-booksy');
    expect($('#f-hub').parentElement!.style.order).toBe('1');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(input().getAttribute('aria-activedescendant')).toBe('f-hub');
  });

  it('opens with "/" and Ctrl+K, but not while typing in a field', () => {
    cleanup = initMarketingNav(render());
    press('/');
    expect(finder().open).toBe(true);
    finder().close();

    const field = document.createElement('input');
    $('#main').append(field);
    field.focus();
    press('/');
    expect(finder().open).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(finder().open).toBe(true);
  });

  it('closes the hub when opened from it and returns focus to the menu button on close', () => {
    cleanup = initMarketingNav(render());
    menu().click();
    hub().querySelector<HTMLButtonElement>('[data-mnav-finder-open]')!.click();
    expect(menu().getAttribute('aria-expanded')).toBe('false');
    expect(finder().open).toBe(true);
    $('[data-mnav-finder-close]').click();
    expect(finder().open).toBe(false);
    expect(document.activeElement).toBe(menu());
  });

  it('closes on astro:before-swap and still filters after the persisted header is re-initialised', () => {
    const root = render();
    initMarketingNav(root);
    $('#desktop-search').click();
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(finder().open).toBe(false);

    cleanup = initMarketingNav(root);
    $('#desktop-search').click();
    type('deposit');
    expect(input().getAttribute('aria-activedescendant')).toBe('f-noshow');
  });
});
