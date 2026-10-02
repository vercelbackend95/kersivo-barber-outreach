/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stopFrame: vi.fn(),
  stopVisible: vi.fn(),
  mountDeferredDemoFrame: vi.fn(),
  announceHeroShowcaseVisibleWhenSeen: vi.fn(),
}));

vi.mock('@/lib/performance/deferredDemoFrame', () => ({ mountDeferredDemoFrame: mocks.mountDeferredDemoFrame }));
vi.mock('@/lib/admin/heroShowcaseVisibility', () => ({
  announceHeroShowcaseVisibleWhenSeen: mocks.announceHeroShowcaseVisibleWhenSeen,
}));

import { HERO_SHOWCASE_READY_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { bindHeroDashboardShowcase, HERO_SHOWCASE_STILL_QUERY } from './heroDashboardShowcase';

function renderShowcase() {
  document.body.innerHTML = `
    <div class="hero-showcase">
      <div class="hero-showcase__viewport" data-deferred-demo-frame>
        <iframe class="hero-showcase__frame" data-deferred-src="/demo/admin?embed=hero&section=bookings_dashboard"></iframe>
      </div>
    </div>`;
  const viewport = document.querySelector<HTMLElement>('[data-deferred-demo-frame]')!;
  return { viewport, frame: viewport.querySelector('iframe')! };
}

const swap = () => document.dispatchEvent(new Event('astro:before-swap'));

beforeEach(() => {
  mocks.mountDeferredDemoFrame.mockReturnValue(mocks.stopFrame);
  mocks.announceHeroShowcaseVisibleWhenSeen.mockReturnValue(mocks.stopVisible);
});

afterEach(() => {
  swap();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('bindHeroDashboardShowcase', () => {
  it('mounts the deferred, ready-gated frame with the visibility announcement', () => {
    const { viewport, frame } = renderShowcase();
    bindHeroDashboardShowcase(window);

    expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledWith(viewport, window, {
      readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE,
    });
    expect(mocks.announceHeroShowcaseVisibleWhenSeen).toHaveBeenCalledWith(viewport, frame, window);
    expect(viewport.dataset.heroFrameBound).toBe('true');
  });

  it('leaves wheel scrolling to the browser: no wheel or message relay on the page', () => {
    const add = vi.spyOn(window, 'addEventListener');
    renderShowcase();
    bindHeroDashboardShowcase(window);

    const types = add.mock.calls.map(([type]) => type);
    expect(types).not.toContain('wheel');
    expect(types).not.toContain('message');
    add.mockRestore();
  });

  it('binds a viewport only once, however often page-load fires', () => {
    renderShowcase();
    bindHeroDashboardShowcase(window);
    bindHeroDashboardShowcase(window);
    bindHeroDashboardShowcase(window);

    expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledTimes(1);
    expect(mocks.announceHeroShowcaseVisibleWhenSeen).toHaveBeenCalledTimes(1);
  });

  it('tears down every listener before a soft swap, exactly once', () => {
    renderShowcase();
    bindHeroDashboardShowcase(window);
    swap();
    swap();

    expect(mocks.stopFrame).toHaveBeenCalledTimes(1);
    expect(mocks.stopVisible).toHaveBeenCalledTimes(1);
  });

  it('rebinds the fresh showcase after returning to the page, without reviving stale state', () => {
    renderShowcase();
    bindHeroDashboardShowcase(window);
    swap();

    const { viewport } = renderShowcase();
    expect(viewport.dataset.heroFrameBound).toBeUndefined();
    bindHeroDashboardShowcase(window);

    expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledTimes(2);
    expect(mocks.mountDeferredDemoFrame).toHaveBeenLastCalledWith(viewport, window, {
      readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE,
    });
    expect(mocks.stopFrame).toHaveBeenCalledTimes(1);
  });

  describe('at phone widths (static image)', () => {
    let listeners: Array<(event: MediaQueryListEvent) => void>;
    let query: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      listeners = [];
      query = {
        matches: true,
        addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener)),
        removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners = listeners.filter((l) => l !== listener);
        }),
      };
      vi.stubGlobal('matchMedia', vi.fn(() => query));
    });

    afterEach(() => vi.unstubAllGlobals());

    const resize = (matches: boolean) => {
      query.matches = matches;
      for (const listener of [...listeners]) listener({ matches } as MediaQueryListEvent);
    };

    it('never mounts the live frame or visibility announcement', () => {
      renderShowcase();
      bindHeroDashboardShowcase(window);

      expect(window.matchMedia).toHaveBeenCalledWith(HERO_SHOWCASE_STILL_QUERY);
      expect(HERO_SHOWCASE_STILL_QUERY).toBe('(max-width: 48rem)');
      expect(mocks.mountDeferredDemoFrame).not.toHaveBeenCalled();
      expect(mocks.announceHeroShowcaseVisibleWhenSeen).not.toHaveBeenCalled();
      expect(document.querySelector('iframe')!.hasAttribute('src')).toBe(false);
    });

    it('binds the live frame once if the viewport grows past the breakpoint', () => {
      const { viewport, frame } = renderShowcase();
      bindHeroDashboardShowcase(window);
      resize(true);
      expect(mocks.mountDeferredDemoFrame).not.toHaveBeenCalled();

      resize(false);
      resize(true);
      resize(false);
      expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledTimes(1);
      expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledWith(viewport, window, {
        readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE,
      });
      expect(mocks.announceHeroShowcaseVisibleWhenSeen).toHaveBeenCalledWith(viewport, frame, window);
      expect(listeners).toHaveLength(0);

      swap();
      expect(mocks.stopFrame).toHaveBeenCalledTimes(1);
      expect(mocks.stopVisible).toHaveBeenCalledTimes(1);
    });

    it('stops listening for resizes on a soft swap', () => {
      renderShowcase();
      bindHeroDashboardShowcase(window);
      expect(listeners).toHaveLength(1);
      swap();
      expect(listeners).toHaveLength(0);
      resize(false);
      expect(mocks.mountDeferredDemoFrame).not.toHaveBeenCalled();
    });
  });

  it('does nothing on pages without a showcase', () => {
    document.body.innerHTML = '<main><h1>No showcase</h1></main>';
    bindHeroDashboardShowcase(window);
    swap();
    expect(mocks.mountDeferredDemoFrame).not.toHaveBeenCalled();
  });
});
