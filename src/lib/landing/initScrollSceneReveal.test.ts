/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE_REVEAL_OPTIONS, initScrollSceneReveal } from './initScrollSceneReveal';

type ObserverCallback = (entries: Array<Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>>) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;

  constructor(
    readonly callback: ObserverCallback,
    readonly options: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }

  trigger(target: Element, isIntersecting = true) {
    this.callback([{ target, isIntersecting }]);
  }
}

function mountSection(): { section: HTMLElement; scenes: HTMLElement[] } {
  document.body.innerHTML = `
    <section data-dist>
      <header data-dist-scene></header>
      <div data-dist-scene></div>
      <div data-dist-scene></div>
    </section>`;
  const section = document.querySelector<HTMLElement>('[data-dist]')!;
  return { section, scenes: Array.from(section.querySelectorAll<HTMLElement>('[data-dist-scene]')) };
}

function fakeWindow(reducedMotion: boolean, withObserver = true) {
  return Object.assign(Object.create(window), {
    matchMedia: vi.fn().mockReturnValue({ matches: reducedMotion }),
    IntersectionObserver: withObserver ? FakeIntersectionObserver : undefined,
  }) as Window & typeof globalThis;
}

describe('initScrollSceneReveal', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks the section enhanced and hides scenes until they intersect', () => {
    const { section, scenes } = mountSection();
    initScrollSceneReveal(section, fakeWindow(false));

    expect(section.dataset.distEnhanced).toBe('true');
    expect(scenes.map((scene) => scene.dataset.distVisible)).toEqual(['false', 'false', 'false']);
    const [observer] = FakeIntersectionObserver.instances;
    expect(observer.options).toBe(SCENE_REVEAL_OPTIONS);
    expect(observer.observed.size).toBe(3);
  });

  it('reveals each scene once, the first time it intersects', () => {
    const { section, scenes } = mountSection();
    initScrollSceneReveal(section, fakeWindow(false));
    const [observer] = FakeIntersectionObserver.instances;

    observer.trigger(scenes[1], false);
    expect(scenes[1].dataset.distVisible).toBe('false');

    observer.trigger(scenes[1]);
    expect(scenes[1].dataset.distVisible).toBe('true');
    expect(observer.observed.has(scenes[1])).toBe(false);
    expect(scenes[0].dataset.distVisible).toBe('false');
    expect(scenes[2].dataset.distVisible).toBe('false');
  });

  it('reveals everything immediately when reduced motion is preferred', () => {
    const { section, scenes } = mountSection();
    initScrollSceneReveal(section, fakeWindow(true));

    expect(scenes.every((scene) => scene.dataset.distVisible === 'true')).toBe(true);
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it('reveals everything immediately without IntersectionObserver support', () => {
    const { section, scenes } = mountSection();
    initScrollSceneReveal(section, fakeWindow(false, false));

    expect(scenes.every((scene) => scene.dataset.distVisible === 'true')).toBe(true);
  });

  it('disconnects the observer on cleanup and ignores a missing section', () => {
    const { section } = mountSection();
    const cleanup = initScrollSceneReveal(section, fakeWindow(false));
    cleanup();
    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);

    expect(() => initScrollSceneReveal(null, fakeWindow(false))()).not.toThrow();
  });
});
