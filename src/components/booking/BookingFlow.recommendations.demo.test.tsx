/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import BookingFlow from './BookingFlow';
import { BLACKLINE_BOOKING_PRESENTATION, BLACKLINE_TIMELINE_CTA_LABEL } from '@/lib/demo/booking';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_SERVICE_CATEGORY_ORDER, DEMO_SERVICES } from '@/lib/demo/services';
import { BLACKLINE_SESSION_BOOKINGS_KEY } from '@/lib/demo/blacklineSessionBookings';
import { getDemoRecommendationProducts } from '@/lib/demo/recommendations';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

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

function flowProps(initialServiceId: string) {
  return {
    publicDemoMode: true as const,
    persistDemoSessionBooking: true as const,
    initialServiceId,
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

async function completeFromBarberStep() {
  fireEvent.click(screen.getByRole('radio', { name: /^Ellis Ward$/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
  });
  fireEvent.change(screen.getByLabelText('Select booking date'), { target: { value: WEDNESDAY } });
  await waitFor(() => {
    const slots = screen
      .getAllByRole('radio')
      .filter((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''));
    expect(slots.length).toBeGreaterThan(0);
  });
  fireEvent.click(
    screen.getAllByRole('radio').find((button) => /^\d{2}:\d{2}$/.test(button.textContent ?? ''))!,
  );
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
}

describe('BookingFlow BLACKLINE confirmation recommendations', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
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

  it.each([
    ['bl-svc-skin-fade', 'Skin Fade'],
    ['bl-svc-haircut-finish', 'Classic Cut & Finish'],
    ['bl-svc-haircut-beard', 'Haircut & Beard'],
  ] as const)('renders recommendation rail for %s', async (serviceId, serviceName) => {
    const expected = getDemoRecommendationProducts(serviceId);
    expect(expected.length).toBeGreaterThanOrEqual(2);

    render(<BookingFlow {...flowProps(serviceId)} />);
    await completeFromBarberStep();

    expect(
      screen.getByRole('heading', { name: `Recommended for your ${serviceName}` }),
    ).toBeTruthy();
    expect(
      screen.getByText('Chosen to suit your booking. Add now and collect at your appointment.'),
    ).toBeTruthy();
    expect(screen.getByText(expected[0]!.name)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hides the rail without a broken heading when recommendations are empty', async () => {
    expect(getDemoRecommendationProducts('bl-svc-grey-blending').length).toBeLessThan(2);

    render(<BookingFlow {...flowProps('bl-svc-grey-blending')} />);
    await completeFromBarberStep();

    expect(screen.getByText('That’s the Blackline booking experience')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Recommended for/i })).toBeNull();
    expect(screen.queryByLabelText('Recommended products')).toBeNull();
  });
});
