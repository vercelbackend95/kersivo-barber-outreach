import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { ClientOnboardingDomainMode, ClientOnboardingStatus } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const isPaidShop = vi.fn();

const clientOnboardingFindUnique = vi.fn();
const clientOnboardingUpsert = vi.fn();
const clientOnboardingUpdate = vi.fn();
const clientOnboardingUpdateMany = vi.fn();
const clientOnboardingFindUniqueOrThrow = vi.fn();
const shopSettingsFindUnique = vi.fn();
const saasFindFirst = vi.fn();
const barberCount = vi.fn();
const serviceCount = vi.fn();
const hoursCount = vi.fn();
const availabilityFindMany = vi.fn();
const productCount = vi.fn();
const barberFindMany = vi.fn();
const serviceFindMany = vi.fn();
const hoursFindMany = vi.fn();
const assetFindMany = vi.fn();
const profileFindMany = vi.fn();
const userFindUnique = vi.fn();
const txSaasUpdateMany = vi.fn();
const emailOutboundCreate = vi.fn();
const transaction = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/rbac/can')>(
    '@/lib/admin/rbac/can',
  );
  return {
    ...actual,
    requirePermission: (...args: unknown[]) => requirePermission(...args),
  };
});

vi.mock('@/lib/shop/paidShop', () => ({
  isPaidShop: (...args: unknown[]) => isPaidShop(...args),
}));

vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: async (
    tx: { emailOutbound: { create: (...args: unknown[]) => unknown } },
    input: { dedupeKey?: string | null; purpose: string },
  ) =>
    tx.emailOutbound.create({
      data: { id: `out_${input.purpose}`, dedupeKey: input.dedupeKey },
    }),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
  deliverOutboxEmail: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    clientOnboarding: {
      findUnique: (...args: unknown[]) => clientOnboardingFindUnique(...args),
      upsert: (...args: unknown[]) => clientOnboardingUpsert(...args),
      update: (...args: unknown[]) => clientOnboardingUpdate(...args),
      updateMany: (...args: unknown[]) => clientOnboardingUpdateMany(...args),
      findUniqueOrThrow: (...args: unknown[]) => clientOnboardingFindUniqueOrThrow(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
    },
    saasSubscription: {
      findFirst: (...args: unknown[]) => saasFindFirst(...args),
      updateMany: vi.fn(),
    },
    barber: {
      count: (...args: unknown[]) => barberCount(...args),
      findMany: (...args: unknown[]) => barberFindMany(...args),
    },
    service: {
      count: (...args: unknown[]) => serviceCount(...args),
      findMany: (...args: unknown[]) => serviceFindMany(...args),
    },
    shopOpeningHours: {
      count: (...args: unknown[]) => hoursCount(...args),
      findMany: (...args: unknown[]) => hoursFindMany(...args),
    },
    availabilityRule: {
      findMany: (...args: unknown[]) => availabilityFindMany(...args),
    },
    product: {
      count: (...args: unknown[]) => productCount(...args),
    },
    clientOnboardingAsset: {
      findMany: (...args: unknown[]) => assetFindMany(...args),
    },
    clientOnboardingBarberProfile: {
      findMany: (...args: unknown[]) => profileFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    emailOutbound: {
      create: (...args: unknown[]) => emailOutboundCreate(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { GET, PUT } from './index';
import { POST as SUBMIT } from './submit';
import { looksLikePublicBlobUrl } from '@/lib/storage/privateOnboardingBlob';
import { CLIENT_ONBOARDING_REQUIRES_PAID_CODE } from '@/lib/admin/clientOnboarding/schema';

const OWNER = {
  shopId: 'shop_1',
  userId: 'user_1',
  userName: 'Alex',
  userEmail: 'alex@example.com',
  emailVerified: true,
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'mem_1',
  barberId: null,
  permissions: ['billing.manage'] as const,
};

function accessFor(role: 'OWNER' | 'MANAGER' | 'BARBER') {
  return {
    ...OWNER,
    role,
    permissions:
      role === 'OWNER'
        ? (['billing.manage'] as const)
        : role === 'MANAGER'
          ? (['onboarding.manage'] as const)
          : ([] as const),
  };
}

function makeContext(method: string, body?: unknown): APIContext {
  return {
    request: new Request('https://kersivo.test/api/admin/client-onboarding', {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  } as unknown as APIContext;
}

function draftRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-07T12:00:00.000Z');
  return {
    id: 'onb_1',
    shopId: 'shop_1',
    status: ClientOnboardingStatus.DRAFT,
    currentStep: 0,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    legalBusinessName: null,
    businessType: null,
    companyNumber: null,
    addressLine1: '1 High Street',
    addressLine2: null,
    townCity: 'London',
    postcode: 'E1 1AA',
    publicEmail: 'shop@example.com',
    publicPhone: null,
    primaryContactName: 'Alex Owner',
    primaryContactEmail: 'alex@example.com',
    tagline: null,
    shopDescription: null,
    websiteNotes: null,
    currentWebsiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
    otherSocialUrl: null,
    brandNotes: null,
    preferredPrimaryColour: null,
    preferredSecondaryColour: null,
    domainMode: ClientOnboardingDomainMode.EXISTING,
    existingDomain: 'example.com',
    domainRegistrar: null,
    preferredDomain1: null,
    preferredDomain2: null,
    preferredDomain3: null,
    domainRegistrationAuthorised: false,
    domainRegistrationAuthorisedAt: null,
    migrationRequested: false,
    migrationSource: null,
    migrationSourceOther: null,
    migrationNotes: null,
    migrationDataConfirmedLawful: false,
    migrationDataConfirmedAt: null,
    launchRetail: false,
    launchDeposits: false,
    retailProductsDeferred: false,
    notificationReplyToEmail: null,
    additionalNotes: null,
    portfolioConsent: false,
    socialMediaConsent: false,
    advertisingConsent: false,
    caseStudyConsent: false,
    marketingConsentUpdatedAt: null,
    contentRightsConfirmed: true,
    informationAccuracyConfirmed: true,
    declarationsConfirmedAt: null,
    ...overrides,
  };
}

function mockWorkspaceReady() {
  shopSettingsFindUnique.mockResolvedValue({
    id: 'shop_1',
    name: 'Test Cuts',
    townCity: 'London',
    logoUrl: null,
    onboardingCompleted: true,
    shopPaidAt: new Date(),
    smsRemindersEnabled: true,
    retailEnabled: false,
    depositsEnabled: false,
  });
  barberCount.mockResolvedValue(1);
  serviceCount.mockResolvedValue(1);
  hoursCount.mockResolvedValue(1);
  availabilityFindMany.mockResolvedValue([{ barberId: 'b1', dayOfWeek: 1 }]);
  productCount.mockResolvedValue(0);
  barberFindMany.mockResolvedValue([
    { id: 'b1', name: 'Alex', active: true, avatarUrl: null, sortOrder: 0 },
  ]);
  serviceFindMany.mockResolvedValue([
    {
      id: 's1',
      name: 'Cut',
      isActive: true,
      pricePence: 2000,
      durationMinutes: 30,
    },
  ]);
  hoursFindMany.mockResolvedValue([
    { dayOfWeek: 1, startMinutes: 540, endMinutes: 1020, active: true },
  ]);
  assetFindMany.mockResolvedValue([
    {
      id: 'asset_1',
      kind: 'MIGRATION_CSV',
      storagePath: 'client-onboarding/shop_1/migration_csv/file.csv',
      originalFileName: 'clients.csv',
      contentType: 'text/csv',
      sizeBytes: 120,
      createdAt: new Date(),
    },
  ]);
  profileFindMany.mockResolvedValue([]);
  userFindUnique.mockResolvedValue({
    id: 'user_1',
    name: 'Alex',
    email: 'alex@example.com',
  });
}

describe('/api/admin/client-onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPaidShop.mockReturnValue(true);
    saasFindFirst.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      pastDueSince: null,
      activatedAt: new Date(),
    });
    requirePermission.mockImplementation((access: { role: string }, permission: string) => {
      if (access.role === 'OWNER' && permission === 'billing.manage') return null;
      return new Response(
        JSON.stringify({ error: 'Forbidden', permission }),
        { status: 403 },
      );
    });
    clientOnboardingFindUnique.mockResolvedValue(draftRow());
    clientOnboardingUpsert.mockResolvedValue(draftRow());
    clientOnboardingUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      draftRow(data),
    );
    emailOutboundCreate.mockImplementation(async ({ data }: { data: { id?: string; purpose?: string } }) => ({
      id: data.id ?? `out_${data.purpose ?? 'x'}`,
      ...data,
    }));
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: vi.fn(async () => undefined),
        clientOnboarding: {
          upsert: (...args: unknown[]) => clientOnboardingUpsert(...args),
          findUnique: (...args: unknown[]) => clientOnboardingFindUnique(...args),
          update: (...args: unknown[]) => clientOnboardingUpdate(...args),
          updateMany: (...args: unknown[]) => clientOnboardingUpdateMany(...args),
          findUniqueOrThrow: (...args: unknown[]) => clientOnboardingFindUniqueOrThrow(...args),
        },
        saasSubscription: {
          updateMany: (...args: unknown[]) => txSaasUpdateMany(...args),
        },
        clientOnboardingAsset: {
          findMany: (...args: unknown[]) => assetFindMany(...args),
        },
        emailOutbound: {
          create: (...args: unknown[]) => emailOutboundCreate(...args),
          findUnique: vi.fn(),
        },
      };
      return fn(tx);
    });
  });

  it('GET allows owner when paid', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const res = await GET(makeContext('GET') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboarding.portfolioConsent).toBe(false);
    expect(looksLikePublicBlobUrl(body.assets[0].storagePath)).toBe(false);
  });

  it('GET returns 403 for unpaid Owner', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    isPaidShop.mockReturnValue(false);
    shopSettingsFindUnique.mockResolvedValue({
      id: 'shop_1',
      shopPaidAt: null,
      smsRemindersEnabled: false,
    });
    const res = await GET(makeContext('GET') as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe(CLIENT_ONBOARDING_REQUIRES_PAID_CODE);
  });

  it('GET returns 403 for Manager', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('MANAGER'));
    const res = await GET(makeContext('GET') as never);
    expect(res.status).toBe(403);
  });

  it('GET returns 403 for Barber', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('BARBER'));
    const res = await GET(makeContext('GET') as never);
    expect(res.status).toBe(403);
  });

  it('PUT saves draft without submitting', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const res = await PUT(
      makeContext('PUT', {
        tagline: 'Sharp cuts',
        portfolioConsent: true,
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(clientOnboardingUpdate).toHaveBeenCalled();
  });

  it('PUT returns 409 when SUBMITTED (write lock)', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    clientOnboardingUpsert.mockResolvedValue(
      draftRow({ status: ClientOnboardingStatus.SUBMITTED, submittedAt: new Date() }),
    );
    const res = await PUT(makeContext('PUT', { tagline: 'Nope' }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CLIENT_ONBOARDING_LOCKED');
  });

  it('POST submit succeeds and stamps onboardingSubmittedAt', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const submitted = draftRow({
      status: ClientOnboardingStatus.SUBMITTED,
      submittedAt: new Date('2026-08-07T12:00:00.000Z'),
    });
    clientOnboardingUpdateMany.mockResolvedValue({ count: 1 });
    clientOnboardingFindUniqueOrThrow.mockResolvedValue(submitted);
    txSaasUpdateMany.mockResolvedValue({ count: 1 });

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(false);
    expect(txSaasUpdateMany).toHaveBeenCalled();
    expect(emailOutboundCreate).toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).toHaveBeenCalled();
    const dedupeKeys = emailOutboundCreate.mock.calls.map((c) => {
      const arg = c[0] as { data?: { dedupeKey?: string } };
      return arg?.data?.dedupeKey;
    });
    expect(
      dedupeKeys.some((k) => k?.startsWith('client-onboarding:internal:onb_1:')),
    ).toBe(true);
    expect(
      dedupeKeys.some((k) => k?.startsWith('client-onboarding:customer:onb_1:')),
    ).toBe(true);
  });

  it('POST submit loser path is idempotent without emails', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    // First ensure inside lock returns already submitted
    clientOnboardingUpsert.mockResolvedValue(
      draftRow({
        status: ClientOnboardingStatus.SUBMITTED,
        submittedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(emailOutboundCreate).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });

  it('NEEDS_CHANGES resubmit enqueues distinct per-submission dedupeKeys', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();

    const firstSubmittedAt = new Date('2026-08-07T12:00:00.000Z');
    const secondSubmittedAt = new Date('2026-08-08T15:30:00.000Z');

    vi.useFakeTimers();
    vi.setSystemTime(firstSubmittedAt);

    // First submit
    clientOnboardingUpsert.mockResolvedValue(draftRow());
    clientOnboardingUpdateMany.mockResolvedValue({ count: 1 });
    clientOnboardingFindUniqueOrThrow.mockResolvedValue(
      draftRow({
        status: ClientOnboardingStatus.SUBMITTED,
        submittedAt: firstSubmittedAt,
      }),
    );
    txSaasUpdateMany.mockResolvedValue({ count: 1 });

    const res1 = await SUBMIT(makeContext('POST') as never);
    expect(res1.status).toBe(200);

    const keysAfterFirst = emailOutboundCreate.mock.calls.map((c) => {
      const arg = c[0] as { data?: { dedupeKey?: string } };
      return arg?.data?.dedupeKey;
    });

    // Reset to NEEDS_CHANGES and submit again with a later clock
    emailOutboundCreate.mockClear();
    tryDeliverOutboxEmail.mockClear();
    clientOnboardingUpsert.mockResolvedValue(
      draftRow({ status: ClientOnboardingStatus.NEEDS_CHANGES, submittedAt: firstSubmittedAt }),
    );
    clientOnboardingUpdateMany.mockResolvedValue({ count: 1 });
    clientOnboardingFindUniqueOrThrow.mockResolvedValue(
      draftRow({
        status: ClientOnboardingStatus.SUBMITTED,
        submittedAt: secondSubmittedAt,
      }),
    );

    vi.setSystemTime(secondSubmittedAt);
    const res2 = await SUBMIT(makeContext('POST') as never);
    expect(res2.status).toBe(200);

    const keysAfterSecond = emailOutboundCreate.mock.calls.map((c) => {
      const arg = c[0] as { data?: { dedupeKey?: string } };
      return arg?.data?.dedupeKey;
    });

    vi.useRealTimers();

    const allKeys = [...keysAfterFirst, ...keysAfterSecond].filter(Boolean) as string[];
    const internalKeys = allKeys.filter((k) => k.startsWith('client-onboarding:internal:'));
    const customerKeys = allKeys.filter((k) => k.startsWith('client-onboarding:customer:'));
    expect(new Set(internalKeys).size).toBe(2);
    expect(new Set(customerKeys).size).toBe(2);
    expect(internalKeys[0]).not.toBe(internalKeys[1]);
    expect(customerKeys[0]).not.toBe(customerKeys[1]);
  });

  it('POST submit enqueues durable emails and remains SUBMITTED after deliver attempt', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const submitted = draftRow({
      status: ClientOnboardingStatus.SUBMITTED,
      submittedAt: new Date('2026-08-07T12:00:00.000Z'),
    });
    clientOnboardingUpdateMany.mockResolvedValue({ count: 1 });
    clientOnboardingFindUniqueOrThrow.mockResolvedValue(submitted);
    txSaasUpdateMany.mockResolvedValue({ count: 1 });
    // Real tryDeliverOutboxEmail swallows delivery failures; submit must not roll back.
    tryDeliverOutboxEmail.mockResolvedValue(undefined);

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.onboarding.status).toBe(ClientOnboardingStatus.SUBMITTED);
    expect(emailOutboundCreate).toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).toHaveBeenCalled();
  });

  it('POST submit fails when migrationRequested is null', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingUpsert.mockResolvedValue(draftRow({ migrationRequested: null }));
    mockWorkspaceReady();
    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing.some((m: string) => m.toLowerCase().includes('migration'))).toBe(
      true,
    );
  });

  it('POST submit fails for KERSIVO_REGISTER without authorisation', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingUpsert.mockResolvedValue(
      draftRow({
        domainMode: ClientOnboardingDomainMode.KERSIVO_REGISTER,
        domainRegistrationAuthorised: false,
        preferredDomain1: 'x.com',
        existingDomain: null,
      }),
    );
    mockWorkspaceReady();
    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
  });

  it('POST submit fails for migration without lawful confirmation', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingUpsert.mockResolvedValue(
      draftRow({
        migrationRequested: true,
        migrationDataConfirmedLawful: false,
      }),
    );
    mockWorkspaceReady();
    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
  });

  it('unpaid Owner cannot PUT or submit', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    isPaidShop.mockReturnValue(false);
    shopSettingsFindUnique.mockResolvedValue({
      id: 'shop_1',
      shopPaidAt: null,
      smsRemindersEnabled: false,
    });
    const putRes = await PUT(makeContext('PUT', { tagline: 'x' }) as never);
    expect(putRes.status).toBe(403);
    const submitRes = await SUBMIT(makeContext('POST') as never);
    expect(submitRes.status).toBe(403);
  });
});
