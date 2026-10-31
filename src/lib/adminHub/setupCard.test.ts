import { describe, expect, it } from 'vitest';
import { ADMIN_HUB_STAGE_PILL, adminHubPillTone } from './copy';
import { SETUP_PHASE1_TITLE, isSetupPhase1Stage, setupPhase1Items, setupPhase1Status } from './setupCard';

const none = { SERVICES: null, TEAM: null, HOURS: null };

describe('setup card phase 1', () => {
  it('uses the approved title and status', () => {
    expect(SETUP_PHASE1_TITLE).toBe('Help us build your site');
    expect(setupPhase1Status(2, 6)).toBe('Your shop · 2 of 6');
  });

  it('lists the six rows in order with About optional', () => {
    const card = setupPhase1Items({ stage: 'review', assetKinds: [], aboutText: null, reviewStates: none });
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

  it('counts uploads, confirmed reviews and the about text', () => {
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
  });

  it('only shows during the preview stages', () => {
    expect(['requested', 'designing', 'review'].every((stage) => isSetupPhase1Stage(stage as never))).toBe(true);
    expect(['launch', 'live', 'declined', 'expired'].some((stage) => isSetupPhase1Stage(stage as never))).toBe(false);
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
