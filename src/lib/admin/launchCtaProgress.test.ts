import { describe, expect, it } from 'vitest';

import {
  buildLaunchProgress,
  buildStarterLaunchProgress,
  demoLaunchProgress,
  emptyLaunchProgress,
  resolveLaunchBillingFlags,
  resolveLaunchCtaPresentation,
  resolveStarterLaunchCtaPresentation,
} from './launchCtaProgress';

describe('buildLaunchProgress', () => {
  it('is complete only when all four setup steps are done', () => {
    const partial = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 1,
      serviceCount: 1,
      retailComplete: false,
    });
    expect(partial.complete).toBe(false);
    expect(partial.steps.map((s) => s.done)).toEqual([true, true, true, false]);
    expect(partial.nextHref).toBe('/admin/retail-onboarding');

    const full = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 1,
      serviceCount: 3,
      retailComplete: true,
    });
    expect(full.complete).toBe(true);
    expect(full.steps.every((s) => s.done)).toBe(true);
    expect(full.nextHref).toBeNull();
    // Ready status is checklist-only — no selected SaaS plan required.
    expect(JSON.stringify(full)).not.toMatch(/plan/i);
  });

  it('marks first barber when at least one team profile exists', () => {
    const none = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 0,
      serviceCount: 1,
      retailComplete: true,
    });
    expect(none.steps.find((s) => s.id === 'team')?.done).toBe(false);
    expect(none.nextHref).toBe('/admin?section=bookings_blocks');

    const one = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 1,
      serviceCount: 1,
      retailComplete: true,
    });
    expect(one.steps.find((s) => s.id === 'team')?.done).toBe(true);
  });
});
describe('resolveLaunchBillingFlags', () => {
  const pendingDeposit = { plan: 'launch' as const, shopSize: '1-2', currentStack: 'none' };

  it('marks paid and clears pending when shop is a paying tenant', () => {
    const result = resolveLaunchBillingFlags({
      shopPaid: true,
      pendingDeposit,
      hasPaidDeposit: false,
    });
    expect(result.paid).toBe(true);
    expect(result.pending).toBeNull();
  });

  it('keeps pending deposit when shop is unpaid', () => {
    const result = resolveLaunchBillingFlags({
      shopPaid: false,
      pendingDeposit,
      hasPaidDeposit: false,
    });
    expect(result.paid).toBe(false);
    expect(result.pending).toEqual(pendingDeposit);
  });

  it('treats legacy SetupDeposit PAID as paid', () => {
    const result = resolveLaunchBillingFlags({
      shopPaid: false,
      pendingDeposit: null,
      hasPaidDeposit: true,
    });
    expect(result.paid).toBe(true);
    expect(result.pending).toBeNull();
  });

  it('shop paid wins over stale pending even if legacy paid deposit also exists', () => {
    const result = resolveLaunchBillingFlags({
      shopPaid: true,
      pendingDeposit,
      hasPaidDeposit: true,
    });
    expect(result.paid).toBe(true);
    expect(result.pending).toBeNull();
  });
});

describe('resolveLaunchCtaPresentation', () => {
  const complete = buildLaunchProgress({
    onboardingCompleted: true,
    teamProfileCount: 2,
    serviceCount: 1,
    retailComplete: true,
  });

  it('uses Continue Setup while checklist incomplete even if pending', () => {
    const progress = emptyLaunchProgress();
    const result = resolveLaunchCtaPresentation({ progress, pending: true, paid: false });
    expect(result.status).toBe('IN PROGRESS');
    expect(result.title).toBe('Continue Setup');
    expect(result.href).toBe('/admin/onboarding');
  });

  it('uses Continue Purchase when complete and pending', () => {
    const result = resolveLaunchCtaPresentation({ progress: complete, pending: true, paid: false });
    expect(result.status).toBe('READY TO LAUNCH');
    expect(result.title).toBe('Continue Purchase');
    expect(result.href).toBe('/admin/launch?step=2');
  });

  it('uses View Setup Progress when complete and paid', () => {
    const result = resolveLaunchCtaPresentation({
      progress: complete,
      pending: false,
      paid: true,
      paidHref: 'https://forms.example/setup',
    });
    expect(result.title).toBe('View Setup Progress');
    expect(result.href).toBe('https://forms.example/setup');
  });

  it('falls back to /admin when paid without form URL', () => {
    const result = resolveLaunchCtaPresentation({
      progress: complete,
      pending: false,
      paid: true,
      paidHref: null,
    });
    expect(result.href).toBe('/admin');
  });

  it('uses Launch My Barbershop when complete with no deposit', () => {
    const result = resolveLaunchCtaPresentation({ progress: complete, pending: false, paid: false });
    expect(result.title).toBe('Launch My Barbershop');
    expect(result.href).toBe('/admin/launch');
  });

  it('demo progress is complete READY TO LAUNCH', () => {
    const progress = demoLaunchProgress();
    const result = resolveLaunchCtaPresentation({ progress, pending: false, paid: false });
    expect(result.status).toBe('READY TO LAUNCH');
    expect(result.title).toBe('Launch My Barbershop');
    expect(result.doneCount).toBe(4);
    expect(result.totalCount).toBe(4);
    expect(result.href).toBe('/admin/launch');
  });
});


describe('v1.19 Starter launch progress', () => {
  it('replaces Retail with Stripe and requires a valid Starter team/services state', () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 2,
      activeServiceCount: 3,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    expect(progress.steps.map((step) => step.id)).toEqual([
      'barbershop',
      'team',
      'services',
      'stripe',
    ]);
    expect(progress.steps.map((step) => step.label)).not.toContain('Set up your retail shop');
    expect(progress.complete).toBe(false);
    expect(progress.nextHref).toBe('/admin?section=barbershop_settings');
  });

  it('blocks launch when active services are below the £5 Starter floor', () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 2,
      servicesMeetPriceFloor: false,
      stripeReady: true,
    });
    expect(progress.steps.find((step) => step.id === 'services')?.done).toBe(false);
    expect(progress.nextHref).toBe('/admin?section=services');
  });

  it('marks Starter complete only when Stripe is ready too', () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 4,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: true,
    });
    expect(progress.complete).toBe(true);
  });

  it('resolves Launch / Finish / Reconnect Stripe copy', () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    const base = {
      stripeAccountLinked: false,
      stripeReady: false,
      stripeDisconnected: false,
      servicesMeetPriceFloor: true,
      activeServiceCount: 1,
      activeBookableBarbers: 1,
      publicBookingReady: false,
    };

    expect(resolveStarterLaunchCtaPresentation(progress, base).title).toBe('Launch your bookings');
    expect(
      resolveStarterLaunchCtaPresentation(progress, { ...base, stripeAccountLinked: true }).title,
    ).toBe('Finish Stripe setup');
    expect(
      resolveStarterLaunchCtaPresentation(progress, {
        ...base,
        stripeAccountLinked: false,
        stripeDisconnected: true,
      }).title,
    ).toBe('Reconnect Stripe');
  });

  it('returns no-action success once Starter bookings are live', () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: true,
    });
    expect(
      resolveStarterLaunchCtaPresentation(progress, {
        stripeAccountLinked: true,
        stripeReady: true,
        stripeDisconnected: false,
        servicesMeetPriceFloor: true,
        activeServiceCount: 1,
        activeBookableBarbers: 1,
        publicBookingReady: true,
      }),
    ).toMatchObject({ action: 'none', title: 'Bookings live ✓' });
  });
});
