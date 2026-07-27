import { describe, expect, it } from 'vitest';

import {
  buildLaunchProgress,
  demoLaunchProgress,
  emptyLaunchProgress,
  resolveLaunchCtaPresentation,
} from './launchCtaProgress';

describe('buildLaunchProgress', () => {
  it('is complete only when all four setup steps are done', () => {
    const partial = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 2,
      serviceCount: 1,
      retailComplete: false,
    });
    expect(partial.complete).toBe(false);
    expect(partial.steps.map((s) => s.done)).toEqual([true, true, true, false]);
    expect(partial.nextHref).toBe('/admin/retail-onboarding');

    const full = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 2,
      serviceCount: 3,
      retailComplete: true,
    });
    expect(full.complete).toBe(true);
    expect(full.steps.every((s) => s.done)).toBe(true);
    expect(full.nextHref).toBeNull();
  });

  it('requires two team profile cards for the team step', () => {
    const one = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 1,
      serviceCount: 1,
      retailComplete: true,
    });
    expect(one.steps.find((s) => s.id === 'team')?.done).toBe(false);
    expect(one.nextHref).toBe('/admin?section=bookings_blocks');

    const two = buildLaunchProgress({
      onboardingCompleted: true,
      teamProfileCount: 2,
      serviceCount: 1,
      retailComplete: true,
    });
    expect(two.steps.find((s) => s.id === 'team')?.done).toBe(true);
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

  it('demo progress is mid-checklist Continue Setup', () => {
    const progress = demoLaunchProgress();
    const result = resolveLaunchCtaPresentation({ progress, pending: false, paid: false });
    expect(result.status).toBe('IN PROGRESS');
    expect(result.title).toBe('Continue Setup');
    expect(result.doneCount).toBe(3);
    expect(result.totalCount).toBe(4);
    expect(result.href).toBe('/admin/retail-onboarding');
  });
});
