/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TIMELINE_NOW_ANCHOR,
  TIMELINE_NOW_SCROLL_DURATION_MS,
  easeInOutCubic,
  scrollContainerToRow,
  timelineNowScrollTarget,
} from './timelineNowScroll';

function geometry({ rowOffset = 900, height = 400, scrollHeight = 2000 } = {}) {
  const container = document.createElement('div');
  container.style.scrollBehavior = 'smooth';
  const row = document.createElement('div');
  container.appendChild(row);
  document.body.appendChild(container);
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(container, 'scrollHeight', { configurable: true, value: scrollHeight });
  container.getBoundingClientRect = () => ({ top: 100, height } as DOMRect);
  row.getBoundingClientRect = () => ({ top: 100 + rowOffset - container.scrollTop, height: 20 } as DOMRect);
  return { container, row };
}

function fakeFrames() {
  let now = 0;
  let nextId = 0;
  const queue = new Map<number, FrameRequestCallback>();
  const win = {
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      nextId += 1;
      queue.set(nextId, cb);
      return nextId;
    },
    cancelAnimationFrame: (id: number) => queue.delete(id),
  } as unknown as Window;
  const advance = (ms: number) => {
    now += ms;
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((cb) => cb(now));
  };
  return { win, advance };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('timelineNowScrollTarget', () => {
  it('puts the now row slightly above the centre of the visible timeline', () => {
    const { container, row } = geometry();
    expect(TIMELINE_NOW_ANCHOR).toBeGreaterThan(0.3);
    expect(TIMELINE_NOW_ANCHOR).toBeLessThanOrEqual(0.5);
    expect(timelineNowScrollTarget(container, row)).toBe(Math.round(900 + 10 - 400 * TIMELINE_NOW_ANCHOR));
  });

  it('clamps to the scrollable range', () => {
    const early = geometry({ rowOffset: 40 });
    expect(timelineNowScrollTarget(early.container, early.row)).toBe(0);
    const late = geometry({ rowOffset: 1990 });
    expect(timelineNowScrollTarget(late.container, late.row)).toBe(1600);
  });
});

describe('scrollContainerToRow', () => {
  it('jumps straight to the target for reduced motion', () => {
    const { container, row } = geometry();
    const target = timelineNowScrollTarget(container, row);
    scrollContainerToRow(container, row, true, fakeFrames().win);
    expect(container.scrollTop).toBe(target);
    expect(container.style.scrollBehavior).toBe('smooth');
  });

  it('eases only the timeline container to the target over the set duration', () => {
    const { container, row } = geometry();
    const target = timelineNowScrollTarget(container, row);
    const { win, advance } = fakeFrames();
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;

    scrollContainerToRow(container, row, false, win);
    expect(container.style.scrollBehavior).toBe('auto');
    advance(0);
    const positions: number[] = [];
    for (let t = 0; t < TIMELINE_NOW_SCROLL_DURATION_MS; t += 50) {
      advance(50);
      positions.push(container.scrollTop);
    }
    advance(50);

    expect(container.scrollTop).toBe(target);
    expect(positions.every((value, index) => index === 0 || value >= positions[index - 1])).toBe(true);
    expect(positions[1]).toBeLessThan(target * 0.1);
    expect(container.style.scrollBehavior).toBe('smooth');
    expect(pageScroll).not.toHaveBeenCalled();
    expect(intoView).not.toHaveBeenCalled();
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0);
    pageScroll.mockRestore();
  });

  it('stops where it is as soon as the visitor touches the timeline', () => {
    const { container, row } = geometry();
    const { win, advance } = fakeFrames();
    scrollContainerToRow(container, row, false, win);
    advance(0);
    advance(200);
    const midway = container.scrollTop;
    container.dispatchEvent(new Event('pointerdown'));
    advance(200);
    advance(400);
    expect(container.scrollTop).toBe(midway);
  });

  it('uses a symmetric ease that starts and ends gently', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.1)).toBeLessThan(0.05);
  });
});
