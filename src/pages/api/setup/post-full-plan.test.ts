import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const requireVerifiedEmail = vi.fn();
const transaction = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const findDeparture = vi.fn();
const queryRaw = vi.fn(async (..._args: unknown[]) => []);
const countActiveBookableBarbers = vi.fn();
const recordTermsAcceptance = vi.fn();
const recordAccountLifecycleEvent = vi.fn();
const loadStarterPublicLaunchReadiness = vi.fn();

vi.mock('@/lib/setup/starterPublicLaunchReadiness', () => ({
  loadStarterPublicLaunchReadiness: (...args: unknown[]) => loadStarterPublicLaunchReadiness(...args),
}));

function readiness(overrides: Record<string, unknown> = {}) {
  return {
    ready: true,
    reasons: [],
    stripe: { ready: true, accountLinked: true, disconnected: false, blocker: null },
    activeServiceCount: 3,
    minimumServicePricePence: 500,
    servicesBelowMinimum: [],
    ...overrides,
  };
}

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (...args: unknown[]) => requireVerifiedEmail(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/shop/freeBookableBarbers', () => ({
  FREE_BOOKABLE_BARBER_LIMIT: 4,
  FREE_BOOKABLE_BARBER_LIMIT_CODE: 'FREE_BOOKABLE_BARBER_LIMIT',
  countActiveBookableBarbers: (...args: unknown[]) => countActiveBookableBarbers(...args),
}));

vi.mock('@/lib/legal/termsVersion', () => ({
  TERMS_ACCEPTANCE_PURPOSES: {
    FULL_TO_STARTER: 'FULL_TO_STARTER',
  },
}));

vi.mock('@/lib/legal/requireTermsAcceptance', () => ({
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE: 'Please accept the Terms to continue.',
  parseTermsAccepted: (body: unknown) =>
    Boolean(
      body &&
        typeof body === 'object' &&
        (body as { termsAccepted?: unknown }).termsAccepted === true,
    ),
  recordTermsAcceptance: (...args: unknown[]) => recordTermsAcceptance(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    POST_FULL_PLAN_CHOSEN: 'POST_FULL_PLAN_CHOSEN',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

import { POST } from './post-full-plan';

const access = {
  via: 'session',
  shopId: 'shop-1',
  userId: 'user-1',
  userEmail: 'owner@example.com',
  emailVerified: true,
};

function ctx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/setup/post-full-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'saas-1',
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
    retentionEndsAt: null,
    postFullPlan: 'UNDECIDED',
    postFullPlanChosenAt: null,
    ...overrides,
  };
}

describe('POST /api/setup/post-full-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(access);
    requirePermission.mockReturnValue(null);
    requireVerifiedEmail.mockReturnValue(null);
    countActiveBookableBarbers.mockResolvedValue(2);
    recordTermsAcceptance.mockResolvedValue(undefined);
    recordAccountLifecycleEvent.mockResolvedValue(undefined);
    loadStarterPublicLaunchReadiness.mockResolvedValue(readiness());
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'saas-1',
      postFullPlan: data.postFullPlan,
      postFullPlanChosenAt: data.postFullPlanChosenAt,
      currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
    }));
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: (...args: unknown[]) => queryRaw(...args),
        saasSubscription: {
          findFirst: (...args: unknown[]) => findFirst(...args),
          update: (...args: unknown[]) => update(...args),
        },
        shopDeparture: {
          findUnique: (...args: unknown[]) => findDeparture(...args),
        },
      }),
    );
    findDeparture.mockResolvedValue(null);
  });

  it('refuses any post-Full choice once the shop is leaving KERSIVO (no silent Starter)', async () => {
    findFirst.mockResolvedValue(subscription({ status: 'CANCELED', cancelAtPeriodEnd: false }));
    findDeparture.mockResolvedValue({ id: 'dep-1' });
    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('SHOP_DEPARTURE_IN_PROGRESS');
    expect(update).not.toHaveBeenCalled();
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
  });

  it('returns 401 without a signed-in session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    expect(res.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid choice', async () => {
    const res = await POST(ctx({ choice: 'MAYBE' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_POST_FULL_PLAN');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires cancellation to be scheduled before recording a choice', async () => {
    findFirst.mockResolvedValue(subscription({ cancelAtPeriodEnd: false }));

    const res = await POST(ctx({ choice: 'LEAVE' }) as never);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('CANCELLATION_NOT_SCHEDULED');
    expect(update).not.toHaveBeenCalled();
  });

  it('requires Terms acceptance for Starter', async () => {
    findFirst.mockResolvedValue(subscription());

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: false }) as never);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('TERMS_NOT_ACCEPTED');
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks Starter when more than 4 active bookable barbers exist', async () => {
    findFirst.mockResolvedValue(subscription());
    countActiveBookableBarbers.mockResolvedValue(5);

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('FREE_BOOKABLE_BARBER_LIMIT');
    expect(body.limit).toBe(4);
    expect(body.activeBookableBarbers).toBe(5);
    expect(update).not.toHaveBeenCalled();
  });

  it('records explicit Starter choice and fail-closed Terms proof in the transaction', async () => {
    findFirst.mockResolvedValue(subscription());

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, choice: 'STARTER', alreadyChosen: false });
    expect(recordTermsAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'FULL_TO_STARTER',
        email: 'owner@example.com',
        userId: 'user-1',
        shopId: 'shop-1',
        db: expect.anything(),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'saas-1' },
        data: expect.objectContaining({
          postFullPlan: 'STARTER',
          postFullPlanChosenAt: expect.any(Date),
        }),
      }),
    );
    expect(recordAccountLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'POST_FULL_PLAN_CHOSEN',
        shopId: 'shop-1',
        meta: expect.objectContaining({ postFullPlan: 'STARTER' }),
      }),
    );
  });

  it('Full → Starter with Stripe ready and all services >= £5 reports Starter public launch ready', async () => {
    findFirst.mockResolvedValue(subscription());
    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.starterPublicLaunch).toMatchObject({ ready: true, reasons: [] });
    expect(body.currentPeriodEnd).toBe('2026-11-01T00:00:00.000Z');
  });

  it('Full → Starter with a service below £5 stays a valid choice and surfaces the blocker', async () => {
    findFirst.mockResolvedValue(subscription());
    loadStarterPublicLaunchReadiness.mockResolvedValue(
      readiness({
        ready: false,
        reasons: ['service_below_minimum'],
        servicesBelowMinimum: [{ id: 'svc_low', name: 'Line-up', pricePence: 300 }],
      }),
    );

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, choice: 'STARTER' });
    expect(body.starterPublicLaunch.servicesBelowMinimum).toEqual([
      { id: 'svc_low', name: 'Line-up', pricePence: 300 },
    ]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ postFullPlan: 'STARTER' }) }),
    );
    expect(recordAccountLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          starterPublicLaunchReady: false,
          starterServicesBelowMinimum: ['svc_low'],
        }),
      }),
    );
  });

  it.each([
    ['missing', 'connect_missing'],
    ['disconnected', 'connect_disconnected'],
    ['not payment-ready', 'connect_not_ready'],
  ])('Full → Starter with Stripe %s stays a valid choice and reports paused public intake', async (_l, blocker) => {
    findFirst.mockResolvedValue(subscription());
    loadStarterPublicLaunchReadiness.mockResolvedValue(
      readiness({
        ready: false,
        reasons: ['stripe_not_ready'],
        stripe: { ready: false, accountLinked: false, disconnected: blocker === 'connect_disconnected', blocker },
      }),
    );

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.choice).toBe('STARTER');
    expect(body.starterPublicLaunch).toMatchObject({
      ready: false,
      reasons: ['stripe_not_ready'],
      stripe: { blocker },
    });
  });

  it('readiness never bypasses the 4-barber Starter limit', async () => {
    findFirst.mockResolvedValue(subscription());
    countActiveBookableBarbers.mockResolvedValue(6);

    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('FREE_BOOKABLE_BARBER_LIMIT');
    expect(update).not.toHaveBeenCalled();
    expect(loadStarterPublicLaunchReadiness).not.toHaveBeenCalled();
  });

  it('records Leave without requiring Starter Terms acceptance', async () => {
    findFirst.mockResolvedValue(subscription());

    const res = await POST(ctx({ choice: 'LEAVE' }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.choice).toBe('LEAVE');
    expect(body.starterPublicLaunch).toBeNull();
    expect(loadStarterPublicLaunchReadiness).not.toHaveBeenCalled();
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ postFullPlan: 'LEAVE' }),
      }),
    );
  });

  it('is idempotent for an already-recorded choice', async () => {
    findFirst.mockResolvedValue(
      subscription({
        postFullPlan: 'STARTER',
        postFullPlanChosenAt: new Date('2026-10-05T12:00:00.000Z'),
      }),
    );

    const res = await POST(ctx({ choice: 'STARTER' }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, choice: 'STARTER', alreadyChosen: true });
    expect(countActiveBookableBarbers).not.toHaveBeenCalled();
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('a Starter choice after Full has ended (departure not yet recorded) never resurrects Starter', async () => {
    findFirst.mockResolvedValue(
      subscription({ status: 'CANCELED', cancelAtPeriodEnd: false, postFullPlan: 'CHOICE_REQUIRED' }),
    );
    const res = await POST(ctx({ choice: 'STARTER', termsAccepted: true }) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('SHOP_DEPARTURE_IN_PROGRESS');
    expect(queryRaw).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
  });

  it('a Starter choice recorded before Full ended still replays after the end', async () => {
    findFirst.mockResolvedValue(
      subscription({
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
        postFullPlan: 'STARTER',
        postFullPlanChosenAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    );
    const res = await POST(ctx({ choice: 'STARTER' }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyChosen).toBe(true);
  });

  it('refuses a late choice after the canceled retention window ended', async () => {
    findFirst.mockResolvedValue(
      subscription({
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
        retentionEndsAt: new Date('2000-01-01T00:00:00.000Z'),
      }),
    );

    const res = await POST(ctx({ choice: 'LEAVE' }) as never);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('RETENTION_ENDED');
    expect(update).not.toHaveBeenCalled();
  });
});
