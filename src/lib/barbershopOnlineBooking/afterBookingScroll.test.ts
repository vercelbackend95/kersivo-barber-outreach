// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAfterBookingScroll, computeStoryProgress } from './afterBookingScroll';

describe('computeStoryProgress', () => {
  it('maps track travel through the viewport to 0→1', () => {
    expect(computeStoryProgress(100, 1000, 500)).toBe(0);
    expect(computeStoryProgress(0, 1000, 500)).toBe(0);
    expect(computeStoryProgress(-250, 1000, 500)).toBe(0.5);
    expect(computeStoryProgress(-500, 1000, 500)).toBe(1);
    expect(computeStoryProgress(-800, 1000, 500)).toBe(1);
  });

  it('returns 0 when the track is not taller than the viewport', () => {
    expect(computeStoryProgress(0, 400, 500)).toBe(0);
  });
});

describe('bindAfterBookingScroll', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('sets scrub progress on scroll and cleans up before soft swap', () => {
    document.body.innerHTML = `
      <section class="bob-ab" data-bob-ab style="--bob-ab-p: 0">
        <div data-bob-ab-track style="height: 1000px"></div>
      </section>
    `;
    const root = document.querySelector<HTMLElement>('[data-bob-ab]')!;
    const track = root.querySelector<HTMLElement>('[data-bob-ab-track]')!;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -250,
      height: 1000,
      bottom: 750,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: -250,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    let rafCb: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb;
      return 1;
    });

    bindAfterBookingScroll(window);
    expect(root.dataset.bobAbBound).toBe('true');
    expect(root.dataset.bobAbScrub).toBe('on');
    expect(root.style.getPropertyValue('--bob-ab-p')).toBe('0.5000');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: -500,
      height: 1000,
      bottom: 500,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: -500,
      toJSON: () => ({}),
    } as DOMRect);
    window.dispatchEvent(new Event('scroll'));
    expect(rafCb).toBeTruthy();
    rafCb?.(0);
    expect(root.style.getPropertyValue('--bob-ab-p')).toBe('1.0000');

    document.dispatchEvent(new Event('astro:before-swap'));
    expect(root.dataset.bobAbBound).toBeUndefined();
    expect(root.dataset.bobAbScrub).toBeUndefined();
    expect(root.style.getPropertyValue('--bob-ab-p')).toBe('');
  });

  it('no-ops scrub mode when prefers-reduced-motion matches', () => {
    document.body.innerHTML = `
      <section class="bob-ab" data-bob-ab>
        <div data-bob-ab-track></div>
      </section>
    `;
    const root = document.querySelector<HTMLElement>('[data-bob-ab]')!;
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    bindAfterBookingScroll(window);
    expect(root.dataset.bobAbScrub).toBe('off');
    expect(root.style.getPropertyValue('--bob-ab-p')).toBe('0');
  });
});
