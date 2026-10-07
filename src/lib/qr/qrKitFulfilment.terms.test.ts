import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({ prisma: {} }));
vi.mock('../shop/kersivoAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shop/kersivoAccess')>();
  return {
    ...actual,
    loadKersivoAccess: vi.fn(async () => actual.accessForState('FREE_BOOKING')),
  };
});

import { CURRENT_TERMS_VERSION } from '../legal/termsVersion';
import { evaluateQrKitShopEligibility, loadQrKitShopFacts } from './qrKitFulfilment';

type Acceptance = { shopId: string; purpose: string; termsVersion: string };

function dbWith(acceptances: Acceptance[]) {
  const legalAcceptance = {
    count: vi.fn(async ({ where }: { where: { shopId: string; termsVersion?: string; purpose: { in: string[] } } }) =>
      acceptances.filter(
        (a) =>
          a.shopId === where.shopId &&
          where.purpose.in.includes(a.purpose) &&
          (where.termsVersion === undefined || a.termsVersion === where.termsVersion),
      ).length,
    ),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
  return {
    legalAcceptance,
    shopSettings: { findUnique: vi.fn(async () => ({ name: 'Fade Room', bookingSlug: 'fade-room' })) },
    barber: { count: vi.fn(async () => 1) },
    service: { count: vi.fn(async () => 1) },
    shopOpeningHours: { count: vi.fn(async () => 1) },
    availabilityRule: { findMany: vi.fn(async () => [{ startMinutes: 540, endMinutes: 1020 }]) },
  };
}

describe('QR Kit Terms requirement across Terms version bumps', () => {
  it('an existing v1.18 Starter acceptance (older Terms version) still satisfies the QR Kit', async () => {
    expect(CURRENT_TERMS_VERSION).not.toBe('2026-10-05');
    const db = dbWith([{ shopId: 'shop-1', purpose: 'FREE_BOOKING_ACTIVATION', termsVersion: '2026-10-05' }]);

    const facts = await loadQrKitShopFacts('shop-1', { emailVerified: true, db: db as never });

    expect(facts.termsAccepted).toBe(true);
    expect(evaluateQrKitShopEligibility(facts)).not.toContain('TERMS_NOT_ACCEPTED');
  });

  it('a historical Full -> Starter acceptance also qualifies', async () => {
    const db = dbWith([{ shopId: 'shop-1', purpose: 'FULL_TO_STARTER', termsVersion: '2026-09-01' }]);
    const facts = await loadQrKitShopFacts('shop-1', { emailVerified: true, db: db as never });
    expect(facts.termsAccepted).toBe(true);
  });

  it('a shop that never accepted Starter Terms stays blocked', async () => {
    const db = dbWith([
      { shopId: 'shop-1', purpose: 'SAAS_CHECKOUT', termsVersion: CURRENT_TERMS_VERSION },
      { shopId: 'other-shop', purpose: 'FREE_BOOKING_ACTIVATION', termsVersion: CURRENT_TERMS_VERSION },
    ]);

    const facts = await loadQrKitShopFacts('shop-1', { emailVerified: true, db: db as never });

    expect(facts.termsAccepted).toBe(false);
    expect(evaluateQrKitShopEligibility(facts)).toContain('TERMS_NOT_ACCEPTED');
  });

  it('eligibility checks never create or modify legal acceptance records', async () => {
    const db = dbWith([{ shopId: 'shop-1', purpose: 'FREE_BOOKING_ACTIVATION', termsVersion: '2026-10-05' }]);
    await loadQrKitShopFacts('shop-1', { emailVerified: true, db: db as never });
    expect(db.legalAcceptance.create).not.toHaveBeenCalled();
    expect(db.legalAcceptance.update).not.toHaveBeenCalled();
    expect(db.legalAcceptance.upsert).not.toHaveBeenCalled();
  });
});
