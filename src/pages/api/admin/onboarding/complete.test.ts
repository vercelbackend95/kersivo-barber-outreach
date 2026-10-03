import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

type ShopRow = {
  id: string;
  name: string;
  townCity: string | null;
  logoUrl: string | null;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  freeBookingActivatedAt: Date | null;
  onboardingCompleted: boolean;
  onboardingCurrentStep: number;
  onboardingCompletedAt: Date | null;
};

const db = vi.hoisted(() => ({
  shop: null as unknown as ShopRow,
  subscription: null as null | Record<string, unknown>,
  activeBookableBarbers: 1,
  legal: [] as Array<Record<string, unknown>>,
  onLock: null as null | (() => void),
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

const tx = {
  $queryRaw: async () => {
    db.onLock?.();
    return [{ id: db.shop.id }];
  },
  shopSettings: {
    findUniqueOrThrow: async () => ({ ...db.shop }),
    update: async ({ data }: { data: Partial<ShopRow> }) => {
      Object.assign(db.shop, data);
      return { ...db.shop };
    },
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
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    shopSettings: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === db.shop.id ? { ...db.shop } : null,
      findUniqueOrThrow: async () => ({ ...db.shop }),
    },
    saasSubscription: {
      findFirst: async () => db.subscription,
    },
    barber: { findMany: async () => [] },
    service: { findMany: async () => [] },
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
    // Legacy hours save already marks onboarding complete before the final action.
    onboardingCompleted: true,
    onboardingCurrentStep: 6,
    onboardingCompletedAt: new Date('2026-10-01T10:00:00.000Z'),
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
    db.activeBookableBarbers = 1;
    db.legal = [];
    db.onLock = null;
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
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(200);
    expect(db.shop.freeBookingActivatedAt).toBeInstanceOf(Date);
    expect(res.body).toMatchObject({
      activation: 'activated',
      onboardingCompleted: true,
      productAccess: { state: 'FREE_BOOKING', capabilities: { publicBooking: true, retail: false } },
      bookingUrl: '/book/shop_1',
      freeActivationRequired: false,
    });
    expect(db.shop.onboardingCompletedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
  });

  it('A: sets onboardingCompleted/At when the legacy flag was not yet set', async () => {
    db.shop = freshShop({ onboardingCompleted: false, onboardingCompletedAt: null });
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(200);
    expect(db.shop.onboardingCompleted).toBe(true);
    expect(db.shop.onboardingCompletedAt).toEqual(db.shop.freeBookingActivatedAt);
  });

  it('B: missing or false termsAccepted is rejected with no Free marker', async () => {
    for (const body of [undefined, {}, { termsAccepted: false }]) {
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
      const res = await complete({ termsAccepted });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TERMS_NOT_ACCEPTED');
    }
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  it('C/O: onboardingCompleted=true without the Free marker stays SETUP and is not publicly bookable', async () => {
    expect(db.shop.onboardingCompleted).toBe(true);
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(false);
  });

  it('N: activated Free shop passes the public booking gate', async () => {
    await complete({ termsAccepted: true });
    expect(await shopAcceptsPublicBookings('shop_1')).toBe(true);
  });

  it('D: replay after activation is idempotent with no duplicate side effects', async () => {
    await complete({ termsAccepted: true });
    const activatedAt = db.shop.freeBookingActivatedAt;

    const replay = await complete({ termsAccepted: true });
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

    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(200);
    expect(res.body.activation).toBe('already_free');
    expect(db.shop.freeBookingActivatedAt).toBe(winnerAt);
    expect(db.legal).toHaveLength(0);
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
    const res = await complete({ termsAccepted: true });

    expect(res.body.activation).toBe('full_kersivo');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('F: more than 4 active bookable barbers rejects Free activation', async () => {
    db.activeBookableBarbers = 5;
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 'FREE_BOOKABLE_BARBER_LIMIT',
      error: 'KERSIVO Free includes up to 4 barbers taking online bookings.',
      limit: 4,
    });
    expect(db.shop.freeBookingActivatedAt).toBeNull();
    expect(db.legal).toHaveLength(0);
  });

  it('G: exactly 4 active bookable barbers is allowed', async () => {
    db.activeBookableBarbers = 4;
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(200);
    expect(res.body.productAccess.state).toBe('FREE_BOOKING');
  });

  it('rejects activation when onboarding requirements are not met', async () => {
    shopMeetsOnboardingCompletionRequirements.mockResolvedValue(false);
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ONBOARDING_INCOMPLETE');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('requires an account email for the legal record', async () => {
    requireOnboardingAccess.mockResolvedValue({ ...ownerAccess, userEmail: null });
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ACCOUNT_EMAIL_REQUIRED');
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });

  it('P: records a FREE_BOOKING_ACTIVATION legal acceptance with audit fields', async () => {
    await complete({ termsAccepted: true });

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
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(500);
    expect(createSpy).toHaveBeenCalled();
  });

  it('passes the guest-preview restriction through requireOnboardingAccess', async () => {
    requireOnboardingAccess.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Onboarding is only available for signed-in private workspaces.' }), {
        status: 403,
      }),
    );
    const res = await complete({ termsAccepted: true });

    expect(res.status).toBe(403);
    expect(db.shop.freeBookingActivatedAt).toBeNull();
  });
});
