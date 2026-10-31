import { describe, expect, it } from 'vitest';
import {
  cardStateFromReview,
  formatGbpPence,
  hoursFingerprint,
  hubHoursProposalSchema,
  hubReviewPostSchema,
  hubServicesProposalSchema,
  hubTeamProposalSchema,
  reviewDiff,
  reviewNowNeed,
  servicesFingerprint,
  teamFingerprint,
} from './hubReviews';
import { HUB_NOW_REVIEW_NEED_ALL, HUB_NOW_REVIEW_NEED_DONE, HUB_REVIEW_CARD_FOOTER } from './hubCopy';

const baseline = servicesFingerprint([
  { id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 },
]);

describe('hub review validation', () => {
  it('accepts a valid services proposal and rejects a £1000 price', () => {
    const ok = hubServicesProposalSchema.safeParse({
      baseline,
      services: [{ clientId: 'c1', id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2200 }],
    });
    expect(ok.success).toBe(true);
    const high = hubServicesProposalSchema.safeParse({
      baseline,
      services: [{ clientId: 'c1', name: 'Skin fade', durationMinutes: 45, pricePence: 100000 }],
    });
    expect(high.success).toBe(false);
  });

  it('accepts team and hours proposals and rejects start >= end', () => {
    expect(
      hubTeamProposalSchema.safeParse({
        baseline: 'x',
        barbers: [{ clientId: 'b1', name: 'Alex', bio: 'Cuts.', showOnWebsite: true }],
      }).success,
    ).toBe(true);
    const days = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      open: dayOfWeek !== 7,
      start: '09:00',
      end: '18:00',
    }));
    expect(hubHoursProposalSchema.safeParse({ baseline: 'h', days }).success).toBe(true);
    expect(
      hubHoursProposalSchema.safeParse({
        baseline: 'h',
        days: days.map((day) => (day.dayOfWeek === 1 ? { ...day, start: '18:00', end: '09:00' } : day)),
      }).success,
    ).toBe(false);
  });

  it('parses confirmed and corrections posts', () => {
    expect(hubReviewPostSchema.safeParse({ action: 'confirmed', section: 'SERVICES' }).success).toBe(true);
    expect(
      hubReviewPostSchema.safeParse({
        action: 'corrections',
        section: 'HOURS',
        proposal: {
          baseline: hoursFingerprint([]),
          days: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
            dayOfWeek,
            open: false,
            start: '09:00',
            end: '17:00',
          })),
        },
      }).success,
    ).toBe(true);
  });
});

describe('hub review card states and Now copy', () => {
  it('maps review states and formats pounds', () => {
    expect(cardStateFromReview(null)).toBe('not_checked');
    expect(cardStateFromReview('CONFIRMED')).toBe('confirmed');
    expect(cardStateFromReview('CORRECTIONS_SENT')).toBe('corrections_sent');
    expect(cardStateFromReview('APPLIED')).toBe('updated');
    expect(cardStateFromReview('DISMISSED')).toBe('dismissed');
    expect(formatGbpPence(2200)).toBe('£22.00');
    expect(HUB_REVIEW_CARD_FOOTER).toContain("don't use your round");
  });

  it('tells the owner what is left to check', () => {
    expect(
      reviewNowNeed({ SERVICES: 'not_checked', TEAM: 'not_checked', HOURS: 'not_checked' }),
    ).toBe(HUB_NOW_REVIEW_NEED_ALL);
    expect(reviewNowNeed({ SERVICES: 'confirmed', TEAM: 'updated', HOURS: 'corrections_sent' })).toBe(
      HUB_NOW_REVIEW_NEED_DONE,
    );
    expect(reviewNowNeed({ SERVICES: 'not_checked', TEAM: 'confirmed', HOURS: 'confirmed' })).toContain(
      'services',
    );
  });

  it('fingerprints are stable', () => {
    expect(teamFingerprint([{ id: 'b', name: 'Alex', photoAssetId: null }])).toContain('Alex');
    expect(hoursFingerprint([{ dayOfWeek: 1, open: true, start: '09:00', end: '18:00' }])).toContain('09:00');
  });

  it('reviewDiff formats service prices after the shared-module split', () => {
    const rows = reviewDiff({
      section: 'SERVICES',
      current: {
        shopId: 'shop_1',
        services: [{ id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2200 }],
        barbers: [],
        hours: [],
      },
      proposal: {
        baseline: 'x',
        services: [{ clientId: 'c1', id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 }],
      },
    });
    expect(rows).toEqual([
      { label: 'Skin fade', from: 'Skin fade · 45 min · £22.00', to: 'Skin fade · 45 min · £25.00' },
    ]);
  });
});
