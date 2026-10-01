/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import TodayTimeline from './TodayTimeline';
import { AdminClockContext, HERO_SHOWCASE_ADMIN_CLOCK, type AdminClock } from './adminClock';
import { BLACKLINE_HERO_SHOWCASE_DAY } from '@/lib/admin/heroShowcase';
import { atDayMinute } from '@/lib/admin/blacklineDemoFixtures/time';
import { TIMELINE_NOW_ANCHOR } from '@/lib/admin/timelineNowScroll';

const ROW_OFFSET = 900;
const HEIGHT = 400;

function mockMatchMedia(reduceMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduceMotion && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function bookingsFor(day: string) {
  return [9 * 60, 11 * 60, 14 * 60, 16 * 60, 18 * 60].map((minute, index) => ({
    id: `b-${index}`,
    fullName: `Client ${index}`,
    email: `client${index}@example.com`,
    status: 'BOOKED',
    startAt: atDayMinute(day, minute),
    endAt: atDayMinute(day, minute + 30),
    barberId: 'bl-barber-ellis',
    barber: { name: 'Ellis Ward' },
    service: { id: 'svc', name: 'Haircut' },
  }));
}

type Props = Partial<React.ComponentProps<typeof TodayTimeline>>;

function renderTimeline(clock: AdminClock, day: string, props: Props) {
  const element = (extra: Props) => (
    <AdminClockContext.Provider value={clock}>
      <TodayTimeline
        barbers={[{ id: 'bl-barber-ellis', name: 'Ellis Ward' }]}
        bookings={bookingsFor(day)}
        timeBlocks={[]}
        selectedDate={day}
        onBookingClick={() => undefined}
        {...props}
        {...extra}
      />
    </AdminClockContext.Provider>
  );
  const view = render(element({}));
  const container = document.querySelector<HTMLElement>('.admin-vtl-scroll')!;
  const nowRow = document.querySelector<HTMLElement>('.admin-vtl-now-row')!;
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: HEIGHT });
  Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2400 });
  container.getBoundingClientRect = () => ({ top: 100, height: HEIGHT } as DOMRect);
  nowRow.parentElement!.getBoundingClientRect = () =>
    ({ top: 100 + ROW_OFFSET - container.scrollTop, height: 20 } as DOMRect);
  return { ...view, container, nowRow, rerenderWith: (extra: Props) => view.rerender(element(extra)) };
}

const expectedTarget = Math.round(ROW_OFFSET + 10 - HEIGHT * TIMELINE_NOW_ANCHOR);
const nextFrames = () => act(() => new Promise((resolve) => setTimeout(resolve, 80)));

describe('TodayTimeline showcase now-scroll', () => {
  let intoView: ReturnType<typeof vi.fn>;
  let pageScroll: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
    pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    pageScroll.mockRestore();
  });

  it('does not scroll on mount or render alone', async () => {
    mockMatchMedia(true);
    const onStart = vi.fn();
    const { container } = renderTimeline(HERO_SHOWCASE_ADMIN_CLOCK, BLACKLINE_HERO_SHOWCASE_DAY, {
      allowInitialNowScroll: false,
      containInitialNowScroll: true,
      onInitialNowScroll: onStart,
    });
    await nextFrames();
    expect(onStart).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(0);
    expect(intoView).not.toHaveBeenCalled();
  });

  it('scrolls only the timeline container to the frozen "now" row once allowed, exactly once', async () => {
    mockMatchMedia(true);
    const onStart = vi.fn();
    const props = { containInitialNowScroll: true, onInitialNowScroll: onStart };
    const { container, nowRow, rerenderWith } = renderTimeline(HERO_SHOWCASE_ADMIN_CLOCK, BLACKLINE_HERO_SHOWCASE_DAY, {
      ...props,
      allowInitialNowScroll: false,
    });
    expect(nowRow.textContent).toContain('15:25');

    rerenderWith({ ...props, allowInitialNowScroll: true });
    await waitFor(() => expect(container.scrollTop).toBe(expectedTarget));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(intoView).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0);

    container.scrollTop = 120;
    rerenderWith({ ...props, allowInitialNowScroll: false });
    rerenderWith({ ...props, allowInitialNowScroll: true });
    await nextFrames();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(container.scrollTop).toBe(120);
  });

  it('follows whatever the frozen clock says rather than a hardcoded time', async () => {
    mockMatchMedia(true);
    const day = '2026-03-10';
    const clock: AdminClock = { frozen: true, nowMs: () => Date.parse('2026-03-10T11:40:00.000Z') };
    const { container, nowRow, rerenderWith } = renderTimeline(clock, day, {
      containInitialNowScroll: true,
      allowInitialNowScroll: false,
    });
    expect(nowRow.textContent).toContain('11:40');
    expect(nowRow.textContent).not.toContain('15:25');
    rerenderWith({ containInitialNowScroll: true, allowInitialNowScroll: true });
    await waitFor(() => expect(container.scrollTop).toBe(expectedTarget));
  });

  it('keeps the normal admin behaviour: scrollIntoView on the now row when allowed', async () => {
    mockMatchMedia(false);
    const { nowRow } = renderTimeline(HERO_SHOWCASE_ADMIN_CLOCK, BLACKLINE_HERO_SHOWCASE_DAY, {
      allowInitialNowScroll: true,
    });
    await waitFor(() => expect(intoView).toHaveBeenCalledTimes(1));
    expect(intoView.mock.instances[0]).toBe(nowRow.parentElement);
    expect(intoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});
