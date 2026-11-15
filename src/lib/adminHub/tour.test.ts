import { describe, expect, it } from 'vitest';
import { PLAN_SCOPE_HIGHLIGHTS } from '@/lib/pricing/claimsPolicy';
import { setupPhase1Items, setupPhase2Items, type SetupShopCounts } from './setupCard';
import {
  TOUR_COPY,
  TOUR_OFFER_POINTS,
  TOUR_STEP_COPY,
  TOUR_STEP_IDS,
  initialTourMemory,
  parseTourMemory,
  tourCurrentStep,
  tourModel,
  tourStorageKey,
  tourSurface,
  tourUncelebrated,
  type TourMemory,
} from './tour';

const NONE: SetupShopCounts = { activeServices: 0, activeBarbers: 0, products: 0, openingHoursSaved: false };

function card(input: { assets?: string[]; counts?: Partial<SetupShopCounts>; about?: string | null } = {}) {
  return setupPhase1Items({
    stage: 'requested',
    assetKinds: input.assets ?? [],
    aboutText: input.about ?? null,
    shopCounts: { ...NONE, ...input.counts },
  });
}

const ALL_DONE = card({
  assets: ['LOGO', 'SHOP_PHOTO'],
  counts: { activeServices: 2, activeBarbers: 1, openingHoursSaved: true },
});

function memory(patch: Partial<TourMemory> = {}): TourMemory {
  return { v: 1, welcomed: true, open: false, celebrated: [], finaleSeen: false, focus: null, ...patch };
}

describe('tourModel', () => {
  it('follows the setup card: five required steps, logo and photos first', () => {
    const model = tourModel(card())!;
    expect(model.steps.map((step) => step.id)).toEqual([...TOUR_STEP_IDS]);
    expect(model.steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5]);
    expect(model.done).toBe(0);
    expect(model.total).toBe(5);
    expect(model.nextId).toBe('logo');
    expect(model.extras.map((item) => item.id)).toEqual(['about', 'products']);
  });

  it('runs on the phase-1 card only', () => {
    expect(tourModel(null)).toBeNull();
    expect(
      tourModel(setupPhase2Items({ businessDone: false, domainDone: false, paymentsDone: false, approveDone: false })),
    ).toBeNull();
  });

  it('keeps Team locked until a service exists, and skips over it', () => {
    const before = tourModel(card({ assets: ['LOGO', 'SHOP_PHOTO'] }))!;
    expect(before.steps.find((step) => step.id === 'team')?.locked).toBe(true);
    expect(before.nextId).toBe('services');

    const after = tourModel(card({ assets: ['LOGO', 'SHOP_PHOTO'], counts: { activeServices: 1 } }))!;
    expect(after.steps.find((step) => step.id === 'team')?.locked).toBe(false);
    expect(after.nextId).toBe('team');
  });

  it('does not lock a team that already exists', () => {
    const model = tourModel(card({ counts: { activeBarbers: 1 } }))!;
    expect(model.steps.find((step) => step.id === 'team')).toMatchObject({ done: true, locked: false });
  });

  it('is all done once the five required steps are, whatever the optional rows say', () => {
    const model = tourModel(ALL_DONE)!;
    expect(model.allDone).toBe(true);
    expect(model.nextId).toBeNull();
    expect(model.extras.length).toBe(2);
  });
});

describe('tourCurrentStep', () => {
  it('opens the picked step while it can be done, otherwise the next step', () => {
    const model = tourModel(card())!;
    expect(tourCurrentStep(model, null)?.id).toBe('logo');
    expect(tourCurrentStep(model, 'hours')?.id).toBe('hours');
    // Locked or finished picks fall back to the next step.
    expect(tourCurrentStep(model, 'team')?.id).toBe('logo');
    expect(tourCurrentStep(tourModel(card({ assets: ['LOGO'] }))!, 'logo')?.id).toBe('photos');
  });
});

describe('tour memory', () => {
  it('starts from what is already done, so earlier work is never celebrated', () => {
    const model = tourModel(card({ assets: ['LOGO'] }))!;
    const first = initialTourMemory(model);
    expect(first).toMatchObject({ welcomed: false, open: false, celebrated: ['logo'], finaleSeen: false });
    expect(tourUncelebrated(model, first)).toEqual([]);
  });

  it('never welcomes or congratulates an owner who had finished before the tour existed', () => {
    const model = tourModel(ALL_DONE)!;
    const first = initialTourMemory(model);
    expect(first).toMatchObject({ welcomed: true, finaleSeen: true });
    expect(tourSurface(model, first)).toBe('none');
  });

  it('parses only its own shape', () => {
    expect(parseTourMemory(null)).toBeNull();
    expect(parseTourMemory('nope')).toBeNull();
    expect(parseTourMemory(JSON.stringify({ v: 2 }))).toBeNull();
    expect(
      parseTourMemory(
        JSON.stringify({ v: 1, welcomed: true, open: 'yes', celebrated: ['logo', 'logo', 'bogus'], focus: 'nope' }),
      ),
    ).toEqual({ v: 1, welcomed: true, open: false, celebrated: ['logo'], finaleSeen: false, focus: null });
  });

  it('scopes storage per owner', () => {
    expect(tourStorageKey(' Jo@Shop.test ')).toBe('ks_admin_hub_tour:jo@shop.test');
    expect(tourStorageKey(null)).toBe('ks_admin_hub_tour');
  });
});

describe('tourSurface', () => {
  const model = tourModel(card({ assets: ['LOGO'] }))!;

  it('welcomes first, then guides', () => {
    expect(tourSurface(model, memory({ welcomed: false, celebrated: ['logo'] }))).toBe('welcome');
    expect(tourSurface(model, memory({ celebrated: ['logo'] }))).toBe('pill');
    expect(tourSurface(model, memory({ celebrated: ['logo'], open: true }))).toBe('dock');
  });

  it('celebrates a step finished since the last look', () => {
    expect(tourSurface(model, memory())).toBe('celebrate');
    expect(tourUncelebrated(model, memory()).map((step) => step.id)).toEqual(['logo']);
  });

  it('ends with the finale once, then disappears', () => {
    const done = tourModel(ALL_DONE)!;
    expect(tourSurface(done, memory({ celebrated: ['logo', 'photos', 'services', 'team'] }))).toBe('finale');
    expect(tourSurface(done, memory({ finaleSeen: true }))).toBe('none');
  });
});

describe('tour copy', () => {
  it('has complete copy for every step', () => {
    for (const id of TOUR_STEP_IDS) {
      for (const value of Object.values(TOUR_STEP_COPY[id])) expect(value.trim().length).toBeGreaterThan(3);
    }
  });

  it('states the price with its qualifier', () => {
    expect(TOUR_COPY.welcomeFree).toContain('£39/month per location');
    expect(TOUR_OFFER_POINTS.length).toBe(5);
    expect(PLAN_SCOPE_HIGHLIGHTS.length).toBeGreaterThan(0);
  });

  it('explains the service-before-team rule', () => {
    expect(TOUR_COPY.locked).toBe('Add a service first');
    expect(TOUR_COPY.lockedWhy).toMatch(/service before your team/);
  });
});
