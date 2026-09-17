/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LANDING_PREVIEW_PASSIVE_MQ } from '@/lib/landing/useMaxWidthPassive';

const onCompleteSpy = vi.fn();

vi.mock('@/components/booking/BookingFlow', () => ({
  default: (props: { onComplete?: () => void }) => {
    onCompleteSpy.mockImplementation(() => props.onComplete?.());
    return (
      <div data-testid="mock-booking-flow">
        <button type="button" onClick={() => props.onComplete?.()}>
          Complete preview
        </button>
        <button type="button">Classic Cut & Finish</button>
      </div>
    );
  },
}));

import LandingBookingWidget from './LandingBookingWidget';

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

const services = [
  {
    id: 'svc-classic',
    name: 'Classic Cut & Finish',
    durationMinutes: 35,
    pricePence: 2400,
    category: 'Cuts & Fades',
    description: 'A tailored cut.',
  },
];

const barbers = [
  {
    id: 'barber-jamie',
    name: 'Jamie Reed',
    serviceIds: ['svc-classic'],
  },
];

describe('LandingBookingWidget mobile passive mode', () => {
  beforeEach(() => {
    onCompleteSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not advance to the lock overlay when passive and complete fires', async () => {
    mockMatchMedia(true);
    render(
      <LandingBookingWidget
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London' }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.lbw--passive')).toBeTruthy();
    expect(document.querySelector('[data-landing-preview-passive="true"]')).toBeTruthy();
    expect(document.querySelector('.lbw__scroll[inert], .lbw__scroll[aria-hidden="true"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Complete preview', hidden: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Booking sent')).toBeNull();
  });

  it('opens the success overlay on desktop when complete fires', async () => {
    mockMatchMedia(false);
    render(
      <LandingBookingWidget
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London' }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.lbw--passive')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Complete preview' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Booking sent')).toBeTruthy();
  });
});
