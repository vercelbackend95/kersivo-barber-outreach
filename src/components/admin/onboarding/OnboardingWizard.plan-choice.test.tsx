/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { startFullKersivoUpgradeCheckout, redirectToStripe } = vi.hoisted(() => ({
  startFullKersivoUpgradeCheckout: vi.fn(),
  redirectToStripe: vi.fn(),
}));

vi.mock('@/lib/setup/fullKersivoUpgrade.client', () => ({
  startFullKersivoUpgradeCheckout: (...a: unknown[]) => startFullKersivoUpgradeCheckout(...a),
  redirectToStripe: (...a: unknown[]) => redirectToStripe(...a),
}));

vi.mock('../PrivateDemoAuthPanel', () => ({
  default: function MockAuthPanel() {
    return null;
  },
}));

import OnboardingWizard from './OnboardingWizard';
import { ONBOARDING_PLAN_STORAGE_KEY } from './onboardingTypes';

type Overrides = Record<string, unknown>;

function reviewState(overrides: Overrides = {}) {
  return {
    shop: { id: 'shop-1', name: 'Fade Room', townCity: 'Leeds', logoUrl: null },
    barbers: [{ id: 'b-0', name: 'Owner', avatarUrl: null, isActive: true, intendedRole: 'BARBER' }],
    services: [],
    hours: [],
    shopHours: [],
    onboardingCurrentStep: 6,
    onboardingCompleted: true,
    onboardingCompletedAt: null,
    productAccess: { state: 'SETUP', capabilities: {} },
    freeActivationRequired: true,
    fullCheckoutPending: false,
    postFullPlanChoiceRequired: false,
    freeBookableBarberLimit: 4,
    bookingUrl: null,
    user: { id: 'u-1', name: 'Owner', email: 'owner@example.com', image: null },
    ...overrides,
  };
}

const starterLiveState = reviewState({
  productAccess: { state: 'FREE_BOOKING', capabilities: { publicBooking: true } },
  freeActivationRequired: false,
  bookingUrl: '/book/fade-room',
  activation: 'activated',
});

let getState: Overrides;
const fetchMock = vi.fn();
const assign = vi.fn();
const originalLocation = window.location;

function setLocation(search = '') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign, search },
  });
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url) === path);
}

function primaryButton(): HTMLButtonElement {
  return document.querySelector('.admin-onboarding__footer .btn--primary') as HTMLButtonElement;
}

function acceptTerms() {
  fireEvent.click(document.querySelector('#onboarding-terms-accepted') as HTMLInputElement);
}

async function renderReview() {
  render(<OnboardingWizard />);
  await screen.findByRole('heading', { name: 'Choose your plan' });
}

describe('OnboardingWizard — Phase 5F.1 explicit plan choice', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setLocation('');
    assign.mockReset();
    startFullKersivoUpgradeCheckout.mockReset();
    redirectToStripe.mockReset();
    getState = reviewState();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/onboarding' && (!init || !init.method || init.method === 'GET')) {
        return new Response(JSON.stringify(getState), { status: 200 });
      }
      if (url === '/api/admin/onboarding/complete') {
        return new Response(JSON.stringify(starterLiveState), { status: 200 });
      }
      if (url === '/api/setup/post-full-plan') {
        getState = { ...starterLiveState, onboardingCompleted: true };
        return new Response(JSON.stringify({ ok: true, choice: 'STARTER' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: `unexpected ${url}` }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('12: shows both plans with v1.18 pricing and no Free Booking / KERSIVO Free / 1% copy', async () => {
    await renderReview();

    const starter = document.querySelector('[data-plan-card="STARTER"]')!;
    const full = document.querySelector('[data-plan-card="FULL"]')!;
    expect(starter.textContent).toContain('KERSIVO Starter');
    expect(starter.textContent).toContain('£0/month');
    expect(starter.textContent).toContain('Start taking bookings with the core tools you need to run your diary.');
    expect(starter.textContent).toContain('0% KERSIVO commission');
    expect(full.textContent).toContain('Full KERSIVO');
    expect(full.textContent).toContain('£39/month');
    expect(full.textContent).toContain(
      'Own the full customer experience with your website, brand and complete business toolkit.',
    );
    expect(document.body.textContent).toContain('Stripe processing fees apply to online card payments.');
    expect(document.body.textContent).not.toMatch(/Free Booking|KERSIVO Free|\b1%|trial/i);
  });

  it('11: with no plan selected nothing can be activated, even with Terms accepted', async () => {
    await renderReview();
    acceptTerms();

    expect(primaryButton().textContent).toBe('Choose a plan');
    expect(primaryButton().disabled).toBe(true);
    fireEvent.click(primaryButton());

    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
    expect(startFullKersivoUpgradeCheckout).not.toHaveBeenCalled();
  });

  it('a selected plan still needs Terms before its action is enabled', async () => {
    await renderReview();
    fireEvent.click(document.querySelector('[data-plan-card="STARTER"]')!);

    expect(primaryButton().textContent).toBe('Start with KERSIVO Starter');
    expect(primaryButton().disabled).toBe(true);
  });

  it('1/3: explicit Starter + Terms activates Starter with plan=STARTER and never starts Stripe', async () => {
    await renderReview();
    fireEvent.click(document.querySelector('[data-plan-card="STARTER"]')!);
    expect(document.body.textContent).toContain('no Stripe account needed');
    acceptTerms();
    fireEvent.click(primaryButton());

    await screen.findByRole('heading', { name: 'Your booking page is live.' });
    const [, init] = callsTo('/api/admin/onboarding/complete')[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ termsAccepted: true, plan: 'STARTER' });
    expect(startFullKersivoUpgradeCheckout).not.toHaveBeenCalled();
    expect(redirectToStripe).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY)).toBeNull();
  });

  it('7/8: explicit Full + Terms opens the authenticated Full checkout and does not activate anything', async () => {
    startFullKersivoUpgradeCheckout.mockResolvedValue({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' });
    await renderReview();
    fireEvent.click(document.querySelector('[data-plan-card="FULL"]')!);
    acceptTerms();
    expect(primaryButton().textContent).toBe('Choose Full KERSIVO');
    fireEvent.click(primaryButton());

    await waitFor(() => expect(redirectToStripe).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1'));
    expect(startFullKersivoUpgradeCheckout).toHaveBeenCalledWith({ returnTo: 'onboarding' });
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
    expect(callsTo('/api/setup/post-full-plan')).toHaveLength(0);
  });

  it('9: a failed Full checkout stays on the plan step with the error and never falls back to Starter', async () => {
    startFullKersivoUpgradeCheckout.mockResolvedValue({
      kind: 'error',
      message: 'Unable to start checkout. Please try again.',
      code: null,
      billingPortal: false,
      redirectTo: null,
    });
    await renderReview();
    fireEvent.click(document.querySelector('[data-plan-card="FULL"]')!);
    acceptTerms();
    fireEvent.click(primaryButton());

    await screen.findByText('Unable to start checkout. Please try again.');
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
    expect(redirectToStripe).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Choose your plan' })).toBeTruthy();
    expect(primaryButton().textContent).toBe('Choose Full KERSIVO');
  });

  it('9/13: returning from a cancelled Full checkout shows a notice, preselects Full and activates nothing', async () => {
    setLocation('?full_checkout=cancelled');
    await renderReview();

    expect(document.querySelector('[data-full-checkout-cancelled]')!.textContent).toContain(
      'you have not been charged',
    );
    expect(document.querySelector('[data-plan-card="FULL"]')!.getAttribute('aria-checked')).toBe('true');
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
    expect(startFullKersivoUpgradeCheckout).not.toHaveBeenCalled();
  });

  it('13: refresh restores the highlighted choice without acting on it', async () => {
    sessionStorage.setItem(ONBOARDING_PLAN_STORAGE_KEY, 'STARTER');
    await renderReview();

    expect(document.querySelector('[data-plan-card="STARTER"]')!.getAttribute('aria-checked')).toBe('true');
    expect(primaryButton().disabled).toBe(true);
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
  });

  it('13: an open Full checkout is surfaced so the owner can resume it', async () => {
    getState = reviewState({ fullCheckoutPending: true });
    await renderReview();
    expect(document.querySelector('[data-full-checkout-pending]')).toBeTruthy();
  });

  it('13: an owner returning after Starter is live goes to the dashboard without re-activating', async () => {
    getState = { ...starterLiveState, onboardingCompleted: true };
    render(<OnboardingWizard />);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin'));
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
  });

  it('13: an active Full shop is not offered Starter as if unconfigured', async () => {
    getState = reviewState({
      productAccess: { state: 'FULL_KERSIVO', capabilities: {} },
      freeActivationRequired: false,
      onboardingCompleted: false,
    });
    render(<OnboardingWizard />);

    await screen.findByRole('heading', { name: 'Your KERSIVO workspace is ready' });
    expect(document.querySelector('[data-onboarding-plan-choice]')).toBeNull();
  });

  it('former Full shop: Starter goes through the existing post-Full plan choice, not the legacy marker', async () => {
    getState = reviewState({ postFullPlanChoiceRequired: true });
    await renderReview();
    fireEvent.click(document.querySelector('[data-plan-card="STARTER"]')!);
    acceptTerms();
    fireEvent.click(primaryButton());

    await screen.findByRole('heading', { name: 'Your booking page is live.' });
    const [, init] = callsTo('/api/setup/post-full-plan')[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ choice: 'STARTER', termsAccepted: true });
    expect(callsTo('/api/admin/onboarding/complete')).toHaveLength(0);
  });
});
