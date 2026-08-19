/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { BLACKLINE_BOOKING_PRESENTATION, BLACKLINE_TIMELINE_CTA_LABEL } from '@/lib/demo/booking';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_SERVICE_CATEGORY_ORDER, DEMO_SERVICES } from '@/lib/demo/services';
import {
  BLACKLINE_SESSION_BOOKINGS_KEY,
  listBlacklineSessionBookings,
} from '@/lib/demo/blacklineSessionBookings';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const WEDNESDAY = '2026-08-12';

const services = DEMO_SERVICES.map((service) => ({
  id: service.id,
  name: service.name,
  durationMinutes: service.durationMinutes,
  pricePence: service.pricePence,
  category: service.category,
  displayOrder: service.displayOrder,
  featured: service.featured,
  description: service.description,
}));

const barbers = DEMO_BARBERS.map((barber) => ({
  id: barber.id,
  name: barber.name,
  serviceIds: [...barber.serviceIds],
}));

function blacklineFlowProps() {
  return {
    publicDemoMode: true as const,
    persistDemoSessionBooking: true as const,
    services,
    barbers,
    categoryOrder: DEMO_SERVICE_CATEGORY_ORDER,
    presentation: BLACKLINE_BOOKING_PRESENTATION,
    postConfirmCta: {
      label: BLACKLINE_TIMELINE_CTA_LABEL,
      destination: 'admin-timeline' as const,
      adminBasePath: '/demo/admin',
      availableForDemo: true,
    },
  };
}

function skinFadeButtonName(name: string) {
  return /skin fade/i.test(name) && !/beard/i.test(name);
}

async function chooseDate(dayKey: string) {
  fireEvent.change(screen.getByLabelText('Select booking date'), { target: { value: dayKey } });
}

async function completeNoahHaircut() {
  fireEvent.click(screen.getByRole('radio', { name: /^Noah Reid$/i }));
  await chooseDate(WEDNESDAY);
  await waitFor(() => {
    const slotButtons = screen
      .getAllByRole('radio')
      .filter((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''));
    expect(slotButtons.length).toBeGreaterThan(0);
  });
  const slotButton = screen
    .getAllByRole('radio')
    .find((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''))!;
  const slot = slotButton.textContent!.trim();
  fireEvent.click(slotButton);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => {
    expect(screen.getByLabelText(/^Name$/i)).toBeTruthy();
  });
  fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Alex Demo' } });
  fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'alex@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete demo booking' }));
  await waitFor(() => {
    expect(screen.getByText('That’s the Blackline booking experience')).toBeTruthy();
  });
  return slot;
}

describe('BookingFlow BLACKLINE host', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    trackSpy.mockClear();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    window.sessionStorage.removeItem(BLACKLINE_SESSION_BOOKINGS_KEY);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.removeItem(BLACKLINE_SESSION_BOOKINGS_KEY);
  });

  it('preselects a valid service and starts on the barber step', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="bl-svc-skin-fade"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Book a chair' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    expect(screen.getAllByText(/Skin Fade/).length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: /^Ellis Ward$/i })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Hot Towel Shave/i })).toBeNull();
  });

  it('ignores an invalid initialServiceId and stays on service selection', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="svc-from-another-shop"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('radio', { name: skinFadeButtonName })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Hot Towel Wet Shave/i })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^Ellis Ward$/i })).toBeNull();
  });

  it('creates one session booking and a /demo/admin timeline CTA', async () => {
    render(<BookingFlow {...blacklineFlowProps()} initialServiceId="bl-svc-haircut-finish" />);

    const slot = await completeNoahHaircut();
    const stored = listBlacklineSessionBookings();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.fullName).toBe('Alex Demo');
    expect(stored[0]?.barberName).toBe('Noah Reid');
    expect(stored[0]?.serviceName).toBe('Classic Cut & Finish');
    expect(stored[0]?.date).toBe(WEDNESDAY);
    expect(stored[0]?.startTime).toBe(slot);

    const reference = screen.getByText(/^BL-\d{4}$/).textContent;
    expect(reference).toBe(stored[0]?.reference);

    const timeline = screen.getByRole('link', { name: BLACKLINE_TIMELINE_CTA_LABEL });
    const href = timeline.getAttribute('href') ?? '';
    expect(href.startsWith('/demo/admin?')).toBe(true);
    expect(href.startsWith('/admin?')).toBe(false);
    expect(href).toContain(`bookingId=${encodeURIComponent(stored[0]!.id)}`);
    expect(href).toContain(`bookingDate=${WEDNESDAY}`);
    expect(href).toContain('demoJourney=booking');
    expect(href).toContain('section=bookings_dashboard');

    expect(screen.getByRole('link', { name: 'Back to Blackline' }).getAttribute('href')).toBe('/demo');
    expect(screen.queryByRole('link', { name: 'View services' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'See pricing' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('resolves Any barber to a concrete BLACKLINE barber on confirm', async () => {
    render(<BookingFlow {...blacklineFlowProps()} initialServiceId="bl-svc-haircut-finish" />);

    fireEvent.click(screen.getByRole('radio', { name: /Any barber/i }));
    await chooseDate(WEDNESDAY);
    await waitFor(() => {
      const slotButtons = screen
        .getAllByRole('radio')
        .filter((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''));
      expect(slotButtons.length).toBeGreaterThan(0);
    });
    const slotButton = screen
      .getAllByRole('radio')
      .find((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''))!;
    fireEvent.click(slotButton);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Alex Demo' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'alex@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete demo booking' }));
    await waitFor(() => {
      expect(screen.getByText('That’s the Blackline booking experience')).toBeTruthy();
    });

    const stored = listBlacklineSessionBookings();
    expect(stored).toHaveLength(1);
    expect(DEMO_BARBERS.some((barber) => barber.id === stored[0]?.barberId)).toBe(true);
    expect(stored[0]?.barberName).not.toBe('Any barber');
    expect(screen.getByText(stored[0]!.barberName)).toBeTruthy();
  });

  it('keeps a valid initialBarberId and skips the barber step after a service is chosen', async () => {
    render(
      <BookingFlow
        publicDemoMode
        initialBarberId="bl-barber-ellis"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Choose a service' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^Ellis Ward$/i })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: skinFadeButtonName }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: '09:00' })).toBeTruthy();
    });

    expect(screen.getAllByText('Ellis Ward').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Choose a barber' })).toBeNull();
  });

  it('ignores an invalid initialBarberId and stays on BLACKLINE barber selection', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialBarberId="barber-from-another-shop"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: skinFadeButtonName }));

    expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Ellis Ward$/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pick a time' })).toBeNull();
  });

  it('starts on the schedule step when both service and barber are valid', async () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="bl-svc-skin-fade"
        initialBarberId="bl-barber-noah"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
    expect(screen.getAllByText('Noah Reid').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Skin Fade/).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '09:00' })).toBeTruthy();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
