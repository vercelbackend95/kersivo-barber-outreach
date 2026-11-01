import { describe, expect, it } from 'vitest';
import { ADMIN_HUB_STAGE_PILL, adminHubPillTone } from './copy';
import {
  SETUP_PHASE1_TITLE,
  SETUP_PHASE2_TITLE,
  SETUP_PHASE3_TITLE,
  isSetupPhase1Stage,
  isSetupPhase2Stage,
  setupCardForStage,
  setupPhase1Items,
  setupPhase1Status,
  setupPhase2Items,
  setupPhase2Status,
  setupPhase3Items,
  reviewStepDone,
} from './setupCard';

const none = { SERVICES: null, TEAM: null, HOURS: null };

describe('setup card phase 1', () => {
  it('uses the approved title and status', () => {
    expect(SETUP_PHASE1_TITLE).toBe('Help us build your site');
    expect(setupPhase1Status(2, 6)).toBe('Your shop · 2 of 6');
  });

  it('lists the six rows in order with About optional', () => {
    const card = setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none });
    expect(card.phase).toBe(1);
    expect(card.items.map((item) => item.label)).toEqual([
      'Logo',
      'Shop photos',
      'Services & prices',
      'Team',
      'Opening hours',
      'About your shop',
    ]);
    expect(card.items.map((item) => item.href)).toEqual([
      '/admin?app=logo',
      '/admin?app=photos',
      '/admin?app=services',
      '/admin?app=team',
      '/admin?app=hours',
      '/admin?app=about',
    ]);
    expect(card.items.find((item) => item.id === 'about')?.optional).toBe(true);
    expect(card.total).toBe(6);
  });

  it('counts a logo when at least one LOGO asset exists', () => {
    expect(setupPhase1Items({ stage: 'review', assetKinds: ['LOGO'], aboutText: null, reviewStates: none }).items[0]?.done).toBe(true);
    expect(setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none }).items[0]?.done).toBe(false);
  });

  it('counts shop photos when at least one SHOP_PHOTO exists', () => {
    expect(
      setupPhase1Items({ stage: 'review', assetKinds: ['SHOP_PHOTO', 'SHOP_PHOTO'], aboutText: null, reviewStates: none }).items[1]
        ?.done,
    ).toBe(true);
  });

  it('counts services, team and hours when the review is confirmed, sent or applied', () => {
    expect(reviewStepDone('CONFIRMED')).toBe(true);
    expect(reviewStepDone('CORRECTIONS_SENT')).toBe(true);
    expect(reviewStepDone('APPLIED')).toBe(true);
    expect(reviewStepDone('DISMISSED')).toBe(false);
    expect(reviewStepDone(null)).toBe(false);
  });

  it('counts the about text when it is present', () => {
    expect(setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: '  Since 2014  ', reviewStates: none }).items[5]?.done).toBe(
      true,
    );
    expect(setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: '   ', reviewStates: none }).items[5]?.done).toBe(false);
  });

  it('counts uploads, confirmed reviews and the about text together', () => {
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: ['LOGO', 'SHOP_PHOTO', 'SHOP_PHOTO'],
      aboutText: 'Since 2014',
      reviewStates: { SERVICES: 'CONFIRMED', TEAM: 'CORRECTIONS_SENT', HOURS: 'DISMISSED' },
    });
    expect(card.items.filter((item) => item.done).map((item) => item.id)).toEqual([
      'logo',
      'photos',
      'services',
      'team',
      'about',
    ]);
    expect(card.done).toBe(5);
    expect(card.nextId).toBe('hours');
  });

  it('tags Services, Team and Hours "From your links" before Review and does not point at them', () => {
    const card = setupPhase1Items({ stage: 'designing', assetKinds: ['LOGO'], aboutText: null, reviewStates: none });
    expect(card.items.filter((item) => item.fromLinks).map((item) => item.id)).toEqual(['services', 'team', 'hours']);
    expect(card.nextId).toBe('photos');
    expect(card.total).toBe(6);
  });
});

describe('setup card phase 2', () => {
  it('uses the approved title, status and four rows', () => {
    expect(SETUP_PHASE2_TITLE).toBe("Let's put you live");
    expect(setupPhase2Status(1, 4)).toBe('Launch · 1 of 4');
    const card = setupPhase2Items({
      businessDone: true,
      domainDone: false,
      paymentsDone: false,
      approveDone: false,
    });
    expect(card.phase).toBe(2);
    expect(card.items.map((item) => item.label)).toEqual([
      'Business details',
      'Domain',
      'Payments',
      'Approve your website',
    ]);
    expect(card.items.map((item) => item.href)).toEqual([
      '/admin?app=business',
      '/admin?app=domain',
      '/admin?app=payments',
      '/admin?app=approve',
    ]);
    expect(card.items.find((item) => item.id === 'payments')?.optional).toBe(true);
    expect(card.done).toBe(1);
    expect(card.total).toBe(4);
    expect(card.nextId).toBe('domain');
  });

  it('skips optional payments when choosing the next row', () => {
    const card = setupPhase2Items({
      businessDone: true,
      domainDone: true,
      paymentsDone: false,
      approveDone: false,
    });
    expect(card.nextId).toBe('approve');
  });

  it('counts payments when Stripe is connected or skipped', () => {
    const card = setupPhase2Items({
      businessDone: true,
      domainDone: true,
      paymentsDone: true,
      approveDone: true,
    });
    expect(card.done).toBe(4);
    expect(card.nextId).toBeNull();
  });
});

describe('setup card phase 3', () => {
  it('uses the live site, test-book and retail-onboarding hrefs', () => {
    expect(SETUP_PHASE3_TITLE).toBe('Get the most from KERSIVO');
    const card = setupPhase3Items({
      viewedSite: true,
      testBookingDone: false,
      retailDone: false,
      liveUrl: 'https://live.example',
    });
    expect(card.phase).toBe(3);
    expect(card.items.map((item) => item.id)).toEqual(['view-site', 'test-booking', 'retail']);
    expect(card.items.map((item) => item.href)).toEqual([
      'https://live.example',
      '/admin/test-book',
      '/admin/retail-onboarding',
    ]);
    expect(card.items[2]?.optional).toBe(true);
    expect(card.nextId).toBe('test-booking');
  });
});

describe('setup card phase by stage', () => {
  it('only shows phase 1 during the preview stages', () => {
    expect(['requested', 'designing', 'review'].every((stage) => isSetupPhase1Stage(stage as never))).toBe(true);
    expect(['launch', 'live', 'declined', 'expired'].some((stage) => isSetupPhase1Stage(stage as never))).toBe(false);
  });

  it('shows phase 2 on launch and hides the card otherwise', () => {
    expect(isSetupPhase2Stage('launch')).toBe(true);
    expect(isSetupPhase2Stage('live')).toBe(false);
    expect(
      setupCardForStage({
        stage: 'launch',
        assetKinds: [],
        aboutText: null,
        reviewStates: none,
        launch: { businessDone: false, domainDone: false, paymentsDone: false, approveDone: false },
      })?.phase,
    ).toBe(2);
    expect(
      setupCardForStage({
        stage: 'live',
        assetKinds: [],
        aboutText: null,
        reviewStates: none,
        launch: { businessDone: true, domainDone: true, paymentsDone: true, approveDone: true },
      }),
    ).toBeNull();
    expect(
      setupCardForStage({ stage: 'expired', assetKinds: [], aboutText: null, reviewStates: none, launch: null }),
    ).toBeNull();
  });
});

describe('stage pill', () => {
  it('matches the mockup for a ready preview and keeps the other hub labels', () => {
    expect(ADMIN_HUB_STAGE_PILL).toEqual({
      requested: 'Requested',
      designing: 'Designing',
      review: 'Preview ready',
      launch: 'Launch',
      live: 'Live',
      declined: 'Closed',
      expired: 'Expired',
    });
  });

  it('is red while in progress, green when live and neutral when closed', () => {
    expect(adminHubPillTone('review')).toBe('accent');
    expect(adminHubPillTone('live')).toBe('live');
    expect(adminHubPillTone('expired')).toBe('neutral');
    expect(adminHubPillTone('declined')).toBe('neutral');
  });
});
