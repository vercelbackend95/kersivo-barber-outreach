/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LANDING_PREVIEW_PASSIVE_MQ } from '@/lib/landing/useMaxWidthPassive';

const timelinePropsSpy = vi.fn();

vi.mock('@/components/admin/TodayTimeline', () => ({
  default: (props: {
    onBookingClick?: () => void;
    onClientProfileIntercept?: () => void;
    previewSwipe?: boolean;
  }) => {
    timelinePropsSpy(props);
    return (
      <div data-testid="mock-timeline">
        <button type="button" onClick={() => props.onBookingClick?.()}>
          Open booking
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/admin/adminAuth', () => ({
  ADMIN_DEMO_BLOCKED_EVENT: 'admin-demo-blocked',
  installAdminFetchInterceptor: vi.fn(),
  setPublicAdminDemoMode: vi.fn(),
}));

vi.mock('@/lib/landing/liveTimelineData', () => ({
  getLandingTimelineData: () => ({
    barbers: [],
    bookings: [],
    timeBlocks: [],
    selectedDate: '2026-09-17',
  }),
}));

import InsideSystemLiveWidget from './InsideSystemLiveWidget';

function mockMatchMedia(matchesPassive: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === LANDING_PREVIEW_PASSIVE_MQ ? matchesPassive : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('InsideSystemLiveWidget mobile passive mode', () => {
  beforeEach(() => {
    timelinePropsSpy.mockClear();
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
    vi.restoreAllMocks();
  });

  it('does not open the preview lock when passive and a booking is clicked', async () => {
    mockMatchMedia(true);
    render(<InsideSystemLiveWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.isw--passive')).toBeTruthy();
    expect(document.querySelector('[data-landing-preview-passive="true"]')).toBeTruthy();
    expect(timelinePropsSpy.mock.calls.at(-1)?.[0]?.previewSwipe).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Open booking', hidden: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the preview lock on desktop when a booking is clicked', async () => {
    mockMatchMedia(false);
    render(<InsideSystemLiveWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.isw--passive')).toBeNull();
    expect(timelinePropsSpy.mock.calls.at(-1)?.[0]?.previewSwipe).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Open booking' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('This is just a preview.')).toBeTruthy();
  });
});
