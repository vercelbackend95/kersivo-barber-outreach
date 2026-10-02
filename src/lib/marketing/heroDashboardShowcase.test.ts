/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stopFrame: vi.fn(),
  stopWheel: vi.fn(),
  stopVisible: vi.fn(),
  mountDeferredDemoFrame: vi.fn(),
  receiveHeroShowcaseWheel: vi.fn(),
  announceHeroShowcaseVisibleWhenSeen: vi.fn(),
}));

vi.mock('@/lib/performance/deferredDemoFrame', () => ({ mountDeferredDemoFrame: mocks.mountDeferredDemoFrame }));
vi.mock('@/lib/admin/heroShowcaseWheel', () => ({ receiveHeroShowcaseWheel: mocks.receiveHeroShowcaseWheel }));
vi.mock('@/lib/admin/heroShowcaseVisibility', () => ({
  announceHeroShowcaseVisibleWhenSeen: mocks.announceHeroShowcaseVisibleWhenSeen,
}));

import { HERO_SHOWCASE_READY_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { bindHeroDashboardShowcase } from './heroDashboardShowcase';

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
  mocks.receiveHeroShowcaseWheel.mockReturnValue(mocks.stopWheel);
  mocks.announceHeroShowcaseVisibleWhenSeen.mockReturnValue(mocks.stopVisible);
});

afterEach(() => {
  swap();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('bindHeroDashboardShowcase', () => {
  it('mounts the deferred, ready-gated frame with wheel forwarding and the visibility announcement', () => {
    const { viewport, frame } = renderShowcase();
    bindHeroDashboardShowcase(window);

    expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledWith(viewport, window, {
      readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE,
    });
    expect(mocks.receiveHeroShowcaseWheel).toHaveBeenCalledWith(frame, window);
    expect(mocks.announceHeroShowcaseVisibleWhenSeen).toHaveBeenCalledWith(viewport, frame, window);
    expect(viewport.dataset.heroFrameBound).toBe('true');
  });

  it('binds a viewport only once, however often page-load fires', () => {
    renderShowcase();
    bindHeroDashboardShowcase(window);
    bindHeroDashboardShowcase(window);
    bindHeroDashboardShowcase(window);

    expect(mocks.mountDeferredDemoFrame).toHaveBeenCalledTimes(1);
    expect(mocks.receiveHeroShowcaseWheel).toHaveBeenCalledTimes(1);
    expect(mocks.announceHeroShowcaseVisibleWhenSeen).toHaveBeenCalledTimes(1);
  });

  it('tears down every listener before a soft swap, exactly once', () => {
    renderShowcase();
    bindHeroDashboardShowcase(window);
    swap();
    swap();

    expect(mocks.stopFrame).toHaveBeenCalledTimes(1);
    expect(mocks.stopWheel).toHaveBeenCalledTimes(1);
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

  it('does nothing on pages without a showcase', () => {
    document.body.innerHTML = '<main><h1>No showcase</h1></main>';
    bindHeroDashboardShowcase(window);
    swap();
    expect(mocks.mountDeferredDemoFrame).not.toHaveBeenCalled();
  });
});
