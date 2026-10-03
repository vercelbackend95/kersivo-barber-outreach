/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OnboardingWizard from './OnboardingWizard';

vi.mock('../PrivateDemoAuthPanel', () => ({
  default: function MockAuthPanel() {
    return null;
  },
}));

const LIMIT_COPY = 'KERSIVO Free includes up to 4 barbers taking online bookings.';

function onboardingState(barberCount: number) {
  return {
    shop: { id: 'shop-1', name: 'Fade Room', townCity: 'Leeds', logoUrl: null },
    barbers: Array.from({ length: barberCount }, (_, index) => ({
      id: `b-${index}`,
      name: `Barber ${index}`,
      avatarUrl: null,
      isActive: true,
      intendedRole: 'BARBER',
    })),
    services: [],
    hours: [],
    shopHours: [],
    onboardingCurrentStep: 3,
    onboardingCompleted: false,
    productAccess: { state: 'SETUP' },
    freeActivationRequired: false,
    freeBookableBarberLimit: 4,
    bookingUrl: '/book/shop-1',
    user: { name: 'Owner', email: 'owner@example.com', image: null },
  };
}

function barberCards(container: HTMLElement) {
  return container.querySelectorAll('[id^="onboarding-barber-name-"]');
}

describe('OnboardingWizard — Free bookable barber limit', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(onboardingState(4)), { status: 200 })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not append a hidden fifth barber card once four are bookable', async () => {
    const { container } = render(<OnboardingWizard />);
    const addButton = await screen.findByRole('button', { name: 'Add another barber' });
    expect(barberCards(container)).toHaveLength(4);

    fireEvent.click(addButton);

    expect(barberCards(container)).toHaveLength(4);
    expect(screen.getByRole('status').textContent).toBe(LIMIT_COPY);
  });

  it('still allows turning an existing barber online bookings off', async () => {
    const { container } = render(<OnboardingWizard />);
    await screen.findByRole('button', { name: 'Add another barber' });
    const toggle = container.querySelector<HTMLInputElement>('#onboarding-barber-bookings-1')!;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.checked).toBe(false));
    expect(barberCards(container)).toHaveLength(4);
  });

  it('appends a bookable card while under the limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(onboardingState(3)), { status: 200 })),
    );
    const { container } = render(<OnboardingWizard />);
    const addButton = await screen.findByRole('button', { name: 'Add another barber' });

    fireEvent.click(addButton);

    expect(barberCards(container)).toHaveLength(4);
    const added = container.querySelector<HTMLInputElement>('#onboarding-barber-bookings-3')!;
    expect(added.checked).toBe(true);
    expect(screen.queryByText(LIMIT_COPY)).toBeNull();
  });
});
