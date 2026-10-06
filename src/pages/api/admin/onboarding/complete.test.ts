import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIContext } from 'astro';

type ShopRow = {
  id: string;
  name: string;
  townCity: string | null;
  logoUrl: string | null;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  freeBookingActivatedAt: Date | null;
  bookingSlug: string | null;
  onboardingCompleted: boolean;
  onboardingCurrentStep: number;
  onboardingCompletedAt: Date | null;
  stripeConnectAccountId?: string | null;
  stripeConnectChargesEnabled?: boolean;
  stripeConnectAccountType?: 'STANDARD' | 'EXPRESS' | null;
};

const db = vi.hoisted(() => ({
  shop: null as unknown as ShopRow,
  subscription: null as null | Record<string, unknown>,
  /** Non-PENDING SaaS rows for the shop (a Full subscription existed at some point). */
  endedFullSubscriptions: 0,
  pendingFullCheckouts: 0,
  activeBookableBarbers: 1,
  activeServicePrices: [2500] as number[],
  legal: [] as Array<Record<string, unknown>>,
  onLock: null as null | (() => void),
  /** Slugs held by other shops (for collision checks). */
  otherSlugs: [] as string[],
  /** Ids of other shops (slugs must never equal a shop id). */
  otherShopIds: [] as string[],
}));

const {
  requireOnboardingAccess,
  shopMeetsOnboardingCompletionRequirements,
  markOnboardingCompleted,
} = vi.hoisted(() => ({
  requireOnboardingAccess: vi.fn(),
  shopMeetsOnboardingCompletionRequirements: vi.fn(),
  markOnboardingCompleted: vi.fn(),
}));

const slugAdvisoryLock = vi.fn();

const tx = {
  $queryRaw: async (sql: { sql: string }) => {
    if (sql.sql.includes('pg_advisory_xact_lock')) {
      slugAdvisoryLock();
      return [{ locked: 1 }];
    }
    db.onLock?.();
    return [{ id: db.shop.id }];
  },
  shopSettings: {
    findUnique: vi.fn(async () => ({ ...db.shop })),
    findUniqueOrThrow: async () => ({ ...db.shop }),
    findMany: async ({
      where,
    }: {
      where: { OR: [{ bookingSlug: { in: string[] } }, { id: { in: string[] } }] };
    }) => {
      const [slugFilter, idFilter] = where.OR;
      const slugs = [...db.otherSlugs, ...(db.shop.bookingSlug ? [db.shop.bookingSlug] : [])];
      return [
        ...slugs.filter((slug) => slugFilter.bookingSlug.in.includes(slug)).map((bookingSlug) => ({
          id: `owner-of-${bookingSlug}`,
          bookingSlug,
        })),
        ...[db.shop.id, ...db.otherShopIds]
          .filter((id) => idFilter.id.in.includes(id))
          .map((id) => ({ id, bookingSlug: null })),
      ];
    },
    update: async ({ data }: { data: Partial<ShopRow> }) => {
      Object.assign(db.shop, data);
      return { ...db.shop };
    },
  },
  saasSubscription: {
    findFirst: vi.fn(async () => db.subscription),
    count: vi.fn(async () => db.endedFullSubscriptions),
    create: vi.fn(),
  },
  barber: {
    count: async () => db.activeBookableBarbers,
  },
  legalAcceptance: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      db.legal.push(data);
      return data;
    },
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    // Rolls back the fake rows when the transaction callback throws.
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
      const shopSnapshot = { ...db.shop };
      const legalSnapshot = [...db.legal];
      try {
        return await fn(tx);
      } catch (error) {
        db.shop = shopSnapshot;
        db.legal = legalSnapshot;
        throw error;
      }
    },
    shopSettings: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === db.shop.id ? { ...db.shop } : null,
      findUniqueOrThrow: async () => ({ ...db.shop }),
    },
    saasSubscription: {
      findFirst: async () => db.subscription,
      count: async ({ where }: { where: { status: unknown } }) =>
        where.status === 'PENDING' ? db.pendingFullCheckouts : db.endedFullSubscriptions,
    },
    barber: { findMany: async () => [] },
    service: {
      findMany: async (args?: { select?: Record<string, unknown> }) =>
        args?.select?.pricePence
          ? db.activeServicePrices.map((pricePence, index) => ({
              id: `svc_${index + 1}`,
              name: `Service ${index + 1}`,
              pricePence,
              isActive: true,
            }))
          : [],
    },
  },
}));

vi.mock('@/lib/admin/shopOpeningHours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/shopOpeningHours')>();
  return { ...actual, serializeShopOpeningHours: async () => [] };
});

vi.mock('@/lib/admin/onboarding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/onboarding')>();
  return {
    ...actual,
    requireOnboardingAccess: (...a: unknown[]) => requireOnboardingAccess(...a),
    shopMeetsOnboardingCompletionRequirements: (...a: unknown[]) =>
      shopMeetsOnboardingCompletionRequirements(...a),
    markOnboardingCompleted: (...a: unknown[]) => markOnboardingCompleted(...a),
  };
});

import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { shopAcceptsPublicBookings } from '@/lib/setup/shopPublicBookingGate';
import { POST } from './complete';

const ownerAccess = {
  shopId: 'shop_1',
  userId: 'user_1',
  userName: 'Owner',
  userEmail: 'Owner@Example.com',
  emailVerified: true,
  userImage: null,
  via: 'session',
  role: 'OWNER',
  memberId: 'member_1',
  barberId: null,
  permissions: ['onboarding.manage'],
};

function freshShop(overrides: Partial<ShopRow> = {}): ShopRow {
  return {
    id: 'shop_1',
    name: 'Fade Lab',
    townCity: 'Leeds',
    logoUrl: null,
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: null,
    bookingSlug: null,
    // Legacy hours save already marks onboarding complete before the final action.
    onboardingCompleted: true,
    onboardingCurrentStep: 6,
    onboardingCompletedAt: new Date('2026-10-01T10:00:00.000Z'),
    stripeConnectAccountId: null,
    stripeConnectChargesEnabled: false,
    ...overrides,
  };
}

async function complete(body?: unknown) {
  const request = new Request('http://localhost/api/admin/onboarding/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'user-agent': 'Vitest Browser',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await POST({ request } as unknown as APIContext);
  return { status: res.status, body: await res.json() };
}

describe('POST /api/admin/onboarding/complete — Free Booking activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shop = freshShop();
    db.subscription = null;
    db.endedFullSubscriptions = 0;
    db.pendingFullCheckouts = 0;
    db.activeBookableBarbers = 1;
    db.activeServicePrices = [2500];
    db.legal = [];
    db.onLock = null;
    db.otherSlugs = [];
    db.otherShopIds = [];
    requireOnboardingAccess.mockResolvedValue(ownerAccess);
    shopMeetsOnboardingCompletionRequirements.mockResolvedValue(true);
    markOnboardingCompleted.mockImplementation(async () => {
      if (!db.shop.onboardingCompleted) {
        db.shop.onboardingCompleted = true;
        db.shop.onboardingCompletedAt = new Date();
      }
    });
  });

  it('A: SETUP + termsAccepted=true + requirements met activates FREE_BOOKING', async () => {
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(200);
    expect(db.shop.freeBookingActivatedAt).toBeInstanceOf(Date);
    expect(res.body).toMatchObject({
      activation: 'activated',
      onboardingCompleted: true,
      productAccess: { state: 'FREE_BOOKING', capabilities: { publicBooking: true, retail: false } },
      bookingUrl: '/book/fade-lab',
      freeActivationRequired: false,
    });
    expect(db.shop.onboardingCompletedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
  });

  it('A: sets onboardingCompleted/At when the legacy flag was not yet set', async () => {
    db.shop = freshShop({ onboardingCompleted: false, onboardingCompletedAt: null });
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(200);
    expect(db.shop.onboardingCompleted).toBe(true);
    expect(db.shop.onboardingCompletedAt).toEqual(db.shop.freeBookingActivatedAt);
  });

  it('B: missing or false termsAccepted is rejected with no Free marker', async () => {
    for (const body of [{ plan: 'STARTER' }, { plan: 'STARTER', termsAccepted: false }]) {
      const res = await complete(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        code: 'TERMS_NOT_ACCEPTED',
        error: 'Please accept the Terms to continue.',
      });
    }
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  it('Q: non-boolean "true" / 1 do not count as Terms acceptance', async () => {
    for (const termsAccepted of ['true', 1, 'yes']) {
      const res = await complete({ termsAccepted, plan: 'STARTER' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TERMS_NOT_ACCEPTED');
    }
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  describe('Phase 5F.1 explicit plan choice', () => {
    it('11: no plan choice → no activation, no marker, no legal record (even with Terms accepted)', async () => {
      for (const body of [undefined, {}, { termsAccepted: true }, { termsAccepted: true, plan: '' }]) {
        const res = await complete(body);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          code: 'PLAN_CHOICE_REQUIRED',
          error: 'Choose KERSIVO Starter or Full KERSIVO before finishing setup.',
        });
      }
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.shop.bookingSlug).toBeNull();
      expect(db.legal).toHaveLength(0);
    });

    it('11: a Full (or unknown) plan never activates Starter through this endpoint', async () => {
      for (const plan of ['FULL', 'starter', 'FREE_BOOKING', 'full_kersivo']) {
        const res = await complete({ termsAccepted: true, plan });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PLAN_CHOICE_REQUIRED');
      }
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.legal).toHaveLength(0);
    });

    it('v1.19: explicit Starter configures the workspace without Stripe, but public intake stays paused', async () => {
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        activation: 'activated',
        productAccess: { state: 'FREE_BOOKING', capabilities: { publicBooking: true } },
        bookingUrl: '/book/fade-lab',
      });
      expect(tx.saasSubscription.create).not.toHaveBeenCalled();
      expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
    });

    it('v1.19: workspace activation itself remains Stripe-independent; public-live readiness is a separate gate', () => {
      for (const file of ['src/lib/shop/freeBookingActivation.ts', 'src/pages/api/admin/onboarding/complete.ts']) {
        const source = readFileSync(resolve(process.cwd(), file), 'utf8');
        expect(source, file).not.toMatch(/stripe/i);
        expect(source, file).not.toMatch(/bookingPaymentMode|saasSubscription\.create|Checkout/);
      }
    });

    it('6: a retry after activation (with or without the plan) is idempotent', async () => {
      await complete({ termsAccepted: true, plan: 'STARTER' });
      const activatedAt = db.shop.freeBookingActivatedAt;
      for (const body of [{ termsAccepted: true, plan: 'STARTER' }, {}]) {
        const replay = await complete(body);
        expect(replay.status).toBe(200);
        expect(replay.body.activation).toBe('already_free');
      }
      expect(db.shop.freeBookingActivatedAt).toBe(activatedAt);
      expect(db.legal).toHaveLength(1);
    });

    it('former Full shop (SETUP after Full ended) is never faked into Starter by the legacy marker', async () => {
      db.endedFullSubscriptions = 1;
      db.subscription = {
        status: 'CANCELED',
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        postFullPlan: 'CHOICE_REQUIRED',
      };
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('POST_FULL_PLAN_CHOICE_REQUIRED');
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.legal).toHaveLength(0);
    });

    it('former Full shop with a stale legacy marker does not get a false already_free', async () => {
      db.endedFullSubscriptions = 1;
      db.subscription = { status: 'CANCELED', currentPeriodEnd: null, postFullPlan: 'CHOICE_REQUIRED' };
      db.shop = freshShop({ freeBookingActivatedAt: new Date('2026-05-01T00:00:00.000Z') });
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('POST_FULL_PLAN_CHOICE_REQUIRED');
    });

    it('a departed Starter shop with a stale activation marker is never reactivated', async () => {
      const marker = new Date('2026-05-01T00:00:00.000Z');
      db.shop = {
        ...freshShop({ freeBookingActivatedAt: marker }),
        departure: { status: 'RETENTION' },
      } as ShopRow;
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SHOP_DEPARTURE_IN_PROGRESS');
      expect(db.shop.freeBookingActivatedAt).toBe(marker);
      expect(db.legal).toHaveLength(0);
    });

    it('former Full shop that explicitly chose Starter (post-Full choice) replays as already_free', async () => {
      db.endedFullSubscriptions = 1;
      db.subscription = { status: 'CANCELED', currentPeriodEnd: null, postFullPlan: 'STARTER', postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119' };
      const res = await complete();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ activation: 'already_free', productAccess: { state: 'FREE_BOOKING' } });
    });
  });

  it('C/O: onboardingCompleted=true without the Free marker stays SETUP and is not publicly bookable', async () => {
    expect(db.shop.onboardingCompleted).toBe(true);
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('v1.19: activated Starter passes the public gate only after Stripe becomes payment-ready', async () => {
    await complete({ termsAccepted: true, plan: 'STARTER' });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);

    db.shop.stripeConnectAccountId = 'acct_ready';
    db.shop.stripeConnectChargesEnabled = true;
    db.shop.stripeConnectAccountType = 'STANDARD';
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('v1.19: activated Starter remains paused if any active service is below £5', async () => {
    await complete({ termsAccepted: true, plan: 'STARTER' });
    db.shop.stripeConnectAccountId = 'acct_ready';
    db.shop.stripeConnectChargesEnabled = true;
    db.shop.stripeConnectAccountType = 'STANDARD';
    db.activeServicePrices = [2500, 499];

    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('D: replay after activation is idempotent with no duplicate side effects', async () => {
    await complete({ termsAccepted: true, plan: 'STARTER' });
    const activatedAt = db.shop.freeBookingActivatedAt;

    const replay = await complete({ termsAccepted: true, plan: 'STARTER' });
    const replayWithoutTerms = await complete();

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ activation: 'already_free', productAccess: { state: 'FREE_BOOKING' } });
    expect(replayWithoutTerms.status).toBe(200);
    expect(replayWithoutTerms.body.activation).toBe('already_free');
    expect(db.shop.freeBookingActivatedAt).toBe(activatedAt);
    expect(db.legal).toHaveLength(1);
  });

  it('D: a concurrent double-submit that loses the lock does not write a second activation', async () => {
    const winnerAt = new Date('2026-10-04T09:00:00.000Z');
    db.onLock = () => {
      db.shop.freeBookingActivatedAt = winnerAt;
    };

    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(200);
    expect(res.body.activation).toBe('already_free');
    expect(db.shop.freeBookingActivatedAt).toBe(winnerAt);
    expect(db.legal).toHaveLength(0);
  });

  describe('stable booking slug', () => {
    it('F: SETUP → Free allocates the slug in the activation transaction and returns /book/{slug}', async () => {
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(200);
      expect(db.shop.bookingSlug).toBe('fade-lab');
      expect(db.shop.freeBookingActivatedAt).toBeInstanceOf(Date);
      expect(res.body.bookingUrl).toBe('/book/fade-lab');
      expect(res.body.bookingUrl).not.toContain('shop_1');
      expect(db.legal).toHaveLength(1);
      expect(db.legal[0]!.meta).toMatchObject({ bookingSlug: 'fade-lab' });
      expect(slugAdvisoryLock).toHaveBeenCalledTimes(1);
    });

    it('F: a taken name slug uses the town suffix', async () => {
      db.otherSlugs = ['fade-lab'];
      await complete({ termsAccepted: true, plan: 'STARTER' });
      expect(db.shop.bookingSlug).toBe('fade-lab-leeds');
    });

    it('F: a name slug equal to an existing shop id is skipped', async () => {
      db.otherShopIds = ['fade-lab'];
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });
      expect(res.status).toBe(200);
      expect(db.shop.bookingSlug).toBe('fade-lab-leeds');
    });

    it('G: a failed legal write leaves no Free marker and no partially committed slug', async () => {
      vi.spyOn(tx.legalAcceptance, 'create').mockRejectedValueOnce(new Error('db down'));
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(500);
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.shop.bookingSlug).toBeNull();
      expect(db.legal).toHaveLength(0);
    });

    it('G: the barber limit rejection allocates no slug', async () => {
      db.activeBookableBarbers = 5;
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });
      expect(res.status).toBe(409);
      expect(db.shop.bookingSlug).toBeNull();
    });

    it('H: already-Free replay keeps the slug unchanged even after a shop rename', async () => {
      await complete({ termsAccepted: true, plan: 'STARTER' });
      const activatedAt = db.shop.freeBookingActivatedAt;
      db.shop.name = 'Totally New Name';
      db.shop.townCity = 'York';

      const replay = await complete();

      expect(replay.body.activation).toBe('already_free');
      expect(db.shop.bookingSlug).toBe('fade-lab');
      expect(replay.body.bookingUrl).toBe('/book/fade-lab');
      expect(db.shop.freeBookingActivatedAt).toBe(activatedAt);
      expect(db.legal).toHaveLength(1);
    });

    it('I: a legacy Free row without a slug is repaired without touching activation or legal records', async () => {
      const activatedAt = new Date('2026-09-01T00:00:00.000Z');
      const existingLegal = { purpose: 'FREE_BOOKING_ACTIVATION', shopId: 'shop_1' };
      db.shop = freshShop({ freeBookingActivatedAt: activatedAt, bookingSlug: null });
      db.legal = [existingLegal];

      const res = await complete();

      expect(res.status).toBe(200);
      expect(res.body.activation).toBe('already_free');
      expect(db.shop.bookingSlug).toBe('fade-lab');
      expect(db.shop.freeBookingActivatedAt).toBe(activatedAt);
      expect(db.legal).toEqual([existingLegal]);
    });

    it('J: Full completion writes no Free marker and allocates no slug', async () => {
      db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z') };
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.body.activation).toBe('full_kersivo');
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.shop.bookingSlug).toBeNull();
      expect(slugAdvisoryLock).not.toHaveBeenCalled();
    });

    it('J: Full discovered under the lock also allocates no slug', async () => {
      db.onLock = () => {
        db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z') };
      };
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.body.activation).toBe('full_kersivo');
      expect(db.shop.bookingSlug).toBeNull();
      expect(db.shop.freeBookingActivatedAt).toBeNull();
    });
  });

  describe('product state re-resolved under the shop lock', () => {
    const activeSubscription = {
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    };

    it('A: pre-check SETUP, locked FULL_KERSIVO → full_kersivo with no Free marker or legal record', async () => {
      db.shop = freshShop({ onboardingCompleted: false, onboardingCompletedAt: null });
      db.onLock = () => {
        db.subscription = activeSubscription;
      };

      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ activation: 'full_kersivo', productAccess: { state: 'FULL_KERSIVO' } });
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.legal).toHaveLength(0);
      expect(db.shop.onboardingCompleted).toBe(true);
      expect(db.shop.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(markOnboardingCompleted).not.toHaveBeenCalled();
    });

    it('A: locked FULL_KERSIVO does not require Terms even though the pre-check saw SETUP', async () => {
      db.onLock = () => {
        db.subscription = activeSubscription;
      };

      const res = await complete();

      expect(res.status).toBe(200);
      expect(res.body.activation).toBe('full_kersivo');
      expect(db.shop.freeBookingActivatedAt).toBeNull();
      expect(db.legal).toHaveLength(0);
    });

    it('B: pre-check SETUP, locked FREE_BOOKING → already_free, timestamp and legal record unchanged', async () => {
      const existingActivation = new Date('2026-10-03T08:00:00.000Z');
      const existingLegal = { purpose: 'FREE_BOOKING_ACTIVATION', shopId: 'shop_1' };
      db.legal = [existingLegal];
      db.onLock = () => {
        db.shop.freeBookingActivatedAt = existingActivation;
      };

      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ activation: 'already_free', productAccess: { state: 'FREE_BOOKING' } });
      expect(db.shop.freeBookingActivatedAt).toBe(existingActivation);
      expect(db.legal).toEqual([existingLegal]);
    });

    it('C: SETUP under the lock still activates, resolving state through the transaction', async () => {
      const res = await complete({ termsAccepted: true, plan: 'STARTER' });

      expect(res.status).toBe(200);
      expect(res.body.activation).toBe('activated');
      expect(db.shop.freeBookingActivatedAt).toBeInstanceOf(Date);
      expect(db.legal).toHaveLength(1);
      expect(tx.shopSettings.findUnique).toHaveBeenCalled();
      expect(tx.saasSubscription.findFirst).toHaveBeenCalled();
    });
  });

  it('E: FULL_KERSIVO completion stays Full and never writes the Free marker', async () => {
    db.shop = freshShop({ onboardingCompleted: false, onboardingCompletedAt: null });
    db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z') };

    const res = await complete();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ activation: 'full_kersivo', productAccess: { state: 'FULL_KERSIVO' } });
    expect(markOnboardingCompleted).toHaveBeenCalledWith('shop_1');
    expect(db.shop.onboardingCompleted).toBe(true);
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  it('E: legacy paid fallback shop is also not silently opted into Free', async () => {
    db.shop = freshShop({ shopPaidAt: new Date('2026-01-01T00:00:00.000Z') });
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.body.activation).toBe('full_kersivo');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('F: more than 4 active bookable barbers rejects Free activation', async () => {
    db.activeBookableBarbers = 5;
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 'FREE_BOOKABLE_BARBER_LIMIT',
      error: 'KERSIVO Starter includes up to 4 barbers taking online bookings.',
      limit: 4,
    });
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  it('G: exactly 4 active bookable barbers is allowed', async () => {
    db.activeBookableBarbers = 4;
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(200);
    expect(res.body.productAccess.state).toBe('FREE_BOOKING');
  });

  it('rejects activation when onboarding requirements are not met', async () => {
    shopMeetsOnboardingCompletionRequirements.mockResolvedValue(false);
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ONBOARDING_INCOMPLETE');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('requires an account email for the legal record', async () => {
    requireOnboardingAccess.mockResolvedValue({ ...ownerAccess, userEmail: null });
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ACCOUNT_EMAIL_REQUIRED');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('P: records a FREE_BOOKING_ACTIVATION legal acceptance with audit fields', async () => {
    await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(db.legal).toHaveLength(1);
    expect(db.legal[0]).toMatchObject({
      purpose: 'FREE_BOOKING_ACTIVATION',
      termsVersion: CURRENT_TERMS_VERSION,
      userId: 'user_1',
      email: 'owner@example.com',
      shopId: 'shop_1',
      ip: '203.0.113.7',
      userAgent: 'Vitest Browser',
      stripeSessionId: null,
    });
    expect(db.legal[0]!.meta).toMatchObject({
      freeBookingActivatedAt: db.shop.freeBookingActivatedAt!.toISOString(),
      activeBookableBarbers: 1,
    });
  });

  it('fails closed inside the activation transaction when the legal record cannot be written', async () => {
    const createSpy = vi.spyOn(tx.legalAcceptance, 'create').mockRejectedValueOnce(new Error('db down'));
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(500);
    expect(createSpy).toHaveBeenCalled();
  });

  it('passes the guest-preview restriction through requireOnboardingAccess', async () => {
    requireOnboardingAccess.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Onboarding is only available for signed-in private workspaces.' }), {
        status: 403,
      }),
    );
    const res = await complete({ termsAccepted: true, plan: 'STARTER' });

    expect(res.status).toBe(403);
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });
});
