/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LANDING_PREVIEW_PASSIVE_MQ } from '@/lib/landing/useMaxWidthPassive';
import { EXAMPLE_DAY_KEY } from '@/lib/barbershopOnlineBooking/availabilityExample';

const timelinePropsSpy = vi.fn();
const auth = vi.hoisted(() => ({
  installAdminFetchInterceptor: vi.fn(),
  setPublicAdminDemoMode: vi.fn(),
}));

vi.mock('@/components/admin/TodayTimeline', () => ({
  default: (props: { onBookingClick?: () => void; onClientProfileIntercept?: () => void }) => {
    timelinePropsSpy(props);
    return (
      <div data-testid="mock-timeline">
        <button type="button" onClick={() => props.onBookingClick?.()}>
          Open booking
        </button>
        <button type="button" onClick={() => props.onClientProfileIntercept?.()}>
          Client profile
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/admin/adminAuth', () => ({
  ADMIN_DEMO_BLOCKED_EVENT: 'admin-demo-blocked',
  ...auth,
}));

import OnlineBookingTimelinePreview from './OnlineBookingTimelinePreview';

function mockMatchMedia(passive: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === LANDING_PREVIEW_PASSIVE_MQ ? passive : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function mount(passive: boolean) {
  mockMatchMedia(passive);
  render(<OnlineBookingTimelinePreview focus={{ minute: 735, label: '12:15', caption: 'Marcus free until 13:00' }} />);
  await act(async () => {
    await Promise.resolve();
  });
  return timelinePropsSpy.mock.calls.at(-1)?.[0];
}

describe('OnlineBookingTimelinePreview', () => {
  beforeEach(() => {
    timelinePropsSpy.mockClear();
    auth.installAdminFetchInterceptor.mockClear();
    auth.setPublicAdminDemoMode.mockClear();
    Element.prototype.scrollTo = vi.fn();
    class IntersectionObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the real timeline with the CUTSTATE example day and blocks admin writes', async () => {
    const props = await mount(false);
    expect(auth.setPublicAdminDemoMode).toHaveBeenCalledWith(true);
    expect(auth.installAdminFetchInterceptor).toHaveBeenCalled();
    expect(props.selectedDate).toBe(EXAMPLE_DAY_KEY);
    expect(props.allowInitialNowScroll).toBe(false);
    expect(props.previewSwipe).toBe(true);
    expect(props.timeBlocks).toEqual([]);
    expect(props.bookings.length).toBeGreaterThan(0);
    expect(props.barbers.map((barber: { name: string }) => barber.name)).toEqual(['Ellis Ward', 'Noah Reid', 'Marcus Bell']);
    expect(typeof props.onClientProfileIntercept).toBe('function');
    expect(props.scrollContainerRef).toBeTruthy();
    expect(document.querySelector('.isw.bot')).toBeTruthy();
  });

  it('labels the selected client time on an annotation layer outside the timeline', async () => {
    await mount(false);
    const marker = document.querySelector('.bot-marker')!;
    expect(marker.getAttribute('data-bot-marker')).toBe('12:15');
    expect(marker.getAttribute('aria-hidden')).toBe('true');
    expect(marker.textContent).toBe('12:15 Marcus free until 13:00');
    expect(screen.getByTestId('mock-timeline').contains(marker)).toBe(false);
  });

  it('answers booking, client-profile and blocked actions with the read-only message on desktop', async () => {
    await mount(false);
    expect(document.querySelector('.bot--passive')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('This preview is read-only.');
    expect(screen.getByRole('link', { name: 'Open the admin demo' }).getAttribute('href')).toBe(
      '/demo/admin?section=bookings_dashboard',
    );
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close read-only message');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Client profile' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close read-only message' }));

    act(() => {
      window.dispatchEvent(new Event('admin-demo-blocked'));
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('is a passive, inert window below 900px', async () => {
    const props = await mount(true);
    expect(props.previewSwipe).toBe(false);
    expect(document.querySelector('[data-bot-passive="true"]')).toBeTruthy();
    const timeline = document.querySelector('.bot__timeline')!;
    expect(timeline.hasAttribute('inert')).toBe(true);
    expect(timeline.getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Open booking', hidden: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
