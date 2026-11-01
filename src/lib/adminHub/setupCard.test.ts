import { describe, expect, it } from 'vitest';
import { ADMIN_HUB_STAGE_PILL, adminHubPillTone } from './copy';
import {
  SETUP_CARD_TITLE,
  SETUP_COMPLETE_LABEL,
  SETUP_COMPLETE_VISIBLE_MS,
  SETUP_PHASE1_TITLE,
  SETUP_PHASE2_TITLE,
  SETUP_PHASE3_TITLE,
  isSetupPhase1Stage,
  isSetupPhase2Stage,
  resolveSetupCardChrome,
  setupCardAllDone,
  setupCardForStage,
  setupDoneStatus,
  setupPhase1Items,
  setupPhase1Status,
  setupPhase2Items,
  setupPhase2Status,
  setupPhase3Items,
  setupStorageKey,
  reviewStepDone,
} from './setupCard';

const none = { SERVICES: null, TEAM: null, HOURS: null };

describe('compact setup card chrome', () => {
  it('uses the compact title and X of Y done', () => {
    expect(SETUP_CARD_TITLE).toBe('Set up your website');
    expect(SETUP_COMPLETE_LABEL).toBe('Setup complete');
    expect(setupDoneStatus(2, 6)).toBe('2 of 6 done');
    expect(setupCardAllDone({ done: 6, total: 6 })).toBe(true);
    expect(setupCardAllDone({ done: 5, total: 6 })).toBe(false);
    expect(setupStorageKey('ks_admin_hub_setup_expanded', 'Jo@Shop.test')).toBe(
      'ks_admin_hub_setup_expanded:jo@shop.test',
    );
  });

  it('hides the complete line when no date is stored or after 7 days', () => {
    const now = Date.parse('2026-11-01T12:00:00.000Z');
    expect(resolveSetupCardChrome(false, now, null)).toBe('checklist');
    expect(resolveSetupCardChrome(true, now, null)).toBe('hidden');
    expect(resolveSetupCardChrome(true, now, now - SETUP_COMPLETE_VISIBLE_MS + 1)).toBe('complete');
    expect(resolveSetupCardChrome(true, now, now - SETUP_COMPLETE_VISIBLE_MS)).toBe('hidden');
  });
});

describe('setup card phase 1', () => {
  it('uses the approved title and status', () => {
    expect(SETUP_PHASE1_TITLE).toBe('Help us build your site');
    expect(setupPhase1Status(2, 6)).toBe('Your shop · 2 of 6');
  });

  it('lists the seven rows in order with About and Products optional', () => {
    const card = setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none });
    expect(card.phase).toBe(1);
    expect(card.items.map((item) => item.label)).toEqual([
      'Logo',
      'Shop photos',
      'Services & prices',
      'Team',
      'Opening hours',
      'About your shop',
      'Products',
    ]);
    expect(card.items.map((item) => item.href)).toEqual([
      '/admin?app=materials&item=logo',
      '/admin?app=materials&item=photos',
      '/admin/services',
      '/admin/team',
      '/admin?app=hours',
      '/admin?app=materials&item=text',
      '/admin/products',
    ]);
    expect(card.items.find((item) => item.id === 'about')?.optional).toBe(true);
    expect(card.items.find((item) => item.id === 'products')?.optional).toBe(true);
    expect(card.total).toBe(7);
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

  it('counts hours when the review is confirmed, sent or applied', () => {
    expect(reviewStepDone('CONFIRMED')).toBe(true);
    expect(reviewStepDone('CORRECTIONS_SENT')).toBe(true);
    expect(reviewStepDone('APPLIED')).toBe(true);
    expect(reviewStepDone('DISMISSED')).toBe(false);
    expect(reviewStepDone(null)).toBe(false);
  });

  it('counts services, team and products from the draft shop, not from review rows', () => {
    const empty = setupPhase1Items({
      stage: 'review',
      assetKinds: [],
      aboutText: null,
      reviewStates: { SERVICES: 'CONFIRMED', TEAM: 'CONFIRMED', HOURS: null },
      shopCounts: null,
    });
    expect(empty.items.find((item) => item.id === 'services')?.done).toBe(false);
    expect(empty.items.find((item) => item.id === 'team')?.done).toBe(false);
    expect(empty.items.find((item) => item.id === 'products')?.done).toBe(false);

    const filled = setupPhase1Items({
      stage: 'review',
      assetKinds: [],
      aboutText: null,
      reviewStates: none,
      shopCounts: { activeServices: 1, activeBarbers: 1, products: 1 },
    });
    expect(filled.items.find((item) => item.id === 'services')?.done).toBe(true);
    expect(filled.items.find((item) => item.id === 'team')?.done).toBe(true);
    expect(filled.items.find((item) => item.id === 'products')?.done).toBe(true);
  });

  it('does not treat inactive services or offline barbers as done', () => {
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: [],
      aboutText: null,
      reviewStates: none,
      shopCounts: { activeServices: 0, activeBarbers: 0, products: 0 },
    });
    expect(card.items.find((item) => item.id === 'services')?.done).toBe(false);
    expect(card.items.find((item) => item.id === 'team')?.done).toBe(false);
    expect(card.items.find((item) => item.id === 'products')?.done).toBe(false);
  });

  it('does not pick optional products as next while required rows remain', () => {
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: [],
      aboutText: 'Since 2014',
      reviewStates: none,
      shopCounts: { activeServices: 0, activeBarbers: 0, products: 0 },
    });
    expect(card.nextId).toBe('logo');
    expect(card.items.find((item) => item.id === 'products')?.optional).toBe(true);
  });

  it('counts the about text when it is present', () => {
    expect(setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: '  Since 2014  ', reviewStates: none }).items[5]?.done).toBe(
      true,
    );
    expect(setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: '   ', reviewStates: none }).items[5]?.done).toBe(false);
  });

  it('counts uploads, draft-shop rows and the about text together', () => {
    const card = setupPhase1Items({
      stage: 'review',
      assetKinds: ['LOGO', 'SHOP_PHOTO', 'SHOP_PHOTO'],
      aboutText: 'Since 2014',
      reviewStates: { SERVICES: 'CONFIRMED', TEAM: 'CORRECTIONS_SENT', HOURS: 'DISMISSED' },
      shopCounts: { activeServices: 2, activeBarbers: 1, products: 0 },
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

  it('only tags Hours "From your links" before Review and still points at services and team', () => {
    const card = setupPhase1Items({ stage: 'designing', assetKinds: ['LOGO'], aboutText: null, reviewStates: none });
    expect(card.items.filter((item) => item.fromLinks).map((item) => item.id)).toEqual(['hours']);
    expect(card.items.find((item) => item.id === 'services')?.fromLinks).toBe(false);
    expect(card.items.find((item) => item.id === 'team')?.fromLinks).toBe(false);
    expect(card.nextId).toBe('photos');
    expect(card.total).toBe(7);
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
