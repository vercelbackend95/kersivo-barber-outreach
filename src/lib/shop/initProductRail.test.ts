/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyProductRails, initProductRails } from '@/lib/shop/initProductRail';

function mountRail(itemCount = 4) {
  document.body.innerHTML = `
    <div data-product-rail-root data-shop6-carousel-root tabindex="0">
      <div class="product-rail__header">
        <p data-product-rail-status>01 / 04</p>
        <div>
          <button type="button" data-product-rail-prev data-shop6-prev>Prev</button>
          <button type="button" data-product-rail-next data-shop6-next>Next</button>
        </div>
      </div>
      <ul data-product-rail-track data-shop6-carousel class="product-rail__track shop6__grid">
        ${Array.from({ length: itemCount }, (_, i) => {
          return `<li class="product-rail__item shop6__item" style="flex:0 0 200px;width:200px;height:40px;">Item ${i + 1}</li>`;
        }).join('')}
      </ul>
    </div>
  `;

  const track = document.querySelector('[data-product-rail-track]') as HTMLElement;
  Object.defineProperty(track, 'clientWidth', { configurable: true, get: () => 300 });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, get: () => 200 * itemCount });

  let scrollLeft = 0;
  Object.defineProperty(track, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });

  track.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
    scrollLeft = typeof options === 'number' ? options : Number(options?.left) || 0;
    void y;
    track.dispatchEvent(new Event('scroll'));
  }) as HTMLElement['scrollTo'];
  track.scrollBy = ((options?: ScrollToOptions | number, y?: number) => {
    scrollLeft += typeof options === 'number' ? options : Number(options?.left) || 0;
    void y;
    track.dispatchEvent(new Event('scroll'));
  }) as HTMLElement['scrollBy'];
  const scrollToSpy = vi.spyOn(track, 'scrollTo');
  const scrollBySpy = vi.spyOn(track, 'scrollBy');
  void scrollBySpy;

  const items = Array.from(track.querySelectorAll('.product-rail__item')) as HTMLElement[];
  items.forEach((item, index) => {
    Object.defineProperty(item, 'offsetLeft', { configurable: true, get: () => index * 200 });
    Object.defineProperty(item, 'offsetParent', { configurable: true, get: () => track });
    item.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 40,
        top: 0,
        left: index * 200,
        bottom: 40,
        right: index * 200 + 200,
        x: index * 200,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
  });

  return {
    root: document.querySelector('[data-product-rail-root]') as HTMLElement,
    track,
    prev: document.querySelector('[data-product-rail-prev]') as HTMLButtonElement,
    next: document.querySelector('[data-product-rail-next]') as HTMLButtonElement,
    status: document.querySelector('[data-product-rail-status]') as HTMLElement,
    getScrollLeft: () => scrollLeft,
    setScrollLeft: (value: number) => {
      scrollLeft = value;
      track.dispatchEvent(new Event('scroll'));
    },
    scrollToSpy,
  };
}

describe('initProductRails', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        disconnect() {}
        unobserve() {}
      },
    );
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 16 } as IdleDeadline);
      return 1;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
      onchange: null,
    }));
  });

  afterEach(() => {
    destroyProductRails();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('disables previous at the start and next at the end after scrolling', async () => {
    const rail = mountRail();
    initProductRails();
    await Promise.resolve();

    expect(rail.prev.disabled).toBe(true);
    expect(rail.next.disabled).toBe(false);

    rail.next.click();
    expect(rail.scrollToSpy).toHaveBeenCalled();

    rail.setScrollLeft(500);
    expect(rail.prev.disabled).toBe(false);
    expect(rail.next.disabled).toBe(true);
    expect(rail.status.getAttribute('aria-label')).toMatch(/Product \d+ of 4/);
  });

  it('supports keyboard navigation on the root', async () => {
    const rail = mountRail();
    initProductRails();
    await Promise.resolve();

    rail.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(rail.scrollToSpy).toHaveBeenCalled();
  });

  it('destroy removes listeners so a second init can rebind cleanly', async () => {
    const rail = mountRail();
    initProductRails();
    await Promise.resolve();
    destroyProductRails();
    initProductRails();
    await Promise.resolve();

    rail.next.click();
    expect(rail.scrollToSpy).toHaveBeenCalled();
  });

  it('initProductRails accepts the root element as scope', async () => {
    const rail = mountRail();
    initProductRails(rail.root);
    await Promise.resolve();

    expect(rail.prev.disabled).toBe(true);
    expect(rail.next.disabled).toBe(false);
    rail.next.click();
    expect(rail.scrollToSpy).toHaveBeenCalled();

    destroyProductRails(rail.root);
    rail.scrollToSpy.mockClear();
    rail.next.click();
    expect(rail.scrollToSpy).not.toHaveBeenCalled();
  });
});
