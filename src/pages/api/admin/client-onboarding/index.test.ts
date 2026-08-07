import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { ClientOnboardingDomainMode, ClientOnboardingStatus } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();

const clientOnboardingFindUnique = vi.fn();
const clientOnboardingCreate = vi.fn();
const clientOnboardingUpdate = vi.fn();
const shopSettingsFindUnique = vi.fn();
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
const saasUpdateMany = vi.fn();
const txClientOnboardingUpdate = vi.fn();
const txSaasUpdateMany = vi.fn();
const transaction = vi.fn();

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

vi.mock('@/lib/db/client', () => ({
  prisma: {
    clientOnboarding: {
      findUnique: (...args: unknown[]) => clientOnboardingFindUnique(...args),
      create: (...args: unknown[]) => clientOnboardingCreate(...args),
      update: (...args: unknown[]) => clientOnboardingUpdate(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
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
    saasSubscription: {
      updateMany: (...args: unknown[]) => saasUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/email/clientOnboardingEmails', () => ({
  sendClientOnboardingInternalNotificationEmail: vi.fn(async () => undefined),
  sendClientOnboardingCustomerConfirmationEmail: vi.fn(async () => undefined),
}));

import { GET, PUT } from './index';
import { POST as SUBMIT } from './submit';
import {
  sendClientOnboardingCustomerConfirmationEmail,
  sendClientOnboardingInternalNotificationEmail,
} from '@/lib/email/clientOnboardingEmails';
import { looksLikePublicBlobUrl } from '@/lib/storage/privateOnboardingBlob';

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
    requirePermission.mockImplementation((access: { role: string }, permission: string) => {
      if (access.role === 'OWNER' && permission === 'billing.manage') return null;
      return new Response(
        JSON.stringify({ error: 'Forbidden', permission }),
        { status: 403 },
      );
    });
    clientOnboardingFindUnique.mockResolvedValue(draftRow());
    clientOnboardingCreate.mockResolvedValue(draftRow());
    clientOnboardingUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      draftRow(data),
    );
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        clientOnboarding: {
          update: (...args: unknown[]) => txClientOnboardingUpdate(...args),
        },
        saasSubscription: {
          updateMany: (...args: unknown[]) => txSaasUpdateMany(...args),
        },
      };
      return fn(tx);
    });
  });

  it('GET allows owner', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const res = await GET(makeContext('GET') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboarding.portfolioConsent).toBe(false);
    expect(body.onboarding.socialMediaConsent).toBe(false);
    expect(body.onboarding.advertisingConsent).toBe(false);
    expect(body.onboarding.caseStudyConsent).toBe(false);
    const payload = JSON.stringify(body);
    expect(looksLikePublicBlobUrl(body.assets[0].storagePath)).toBe(false);
    expect(payload).not.toContain('public.blob.vercel-storage.com');
    expect(payload).not.toContain('BLOB_READ_WRITE_TOKEN');
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
    const data = clientOnboardingUpdate.mock.calls[0][0].data;
    expect(data.tagline).toBe('Sharp cuts');
    expect(data.status).toBeUndefined();
  });

  it('POST submit succeeds and stamps onboardingSubmittedAt', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    mockWorkspaceReady();
    const submitted = draftRow({
      status: ClientOnboardingStatus.SUBMITTED,
      submittedAt: new Date('2026-08-07T12:00:00.000Z'),
    });
    txClientOnboardingUpdate.mockResolvedValue(submitted);
    txSaasUpdateMany.mockResolvedValue({ count: 1 });

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(false);
    expect(txSaasUpdateMany).toHaveBeenCalled();
    expect(txSaasUpdateMany.mock.calls[0][0].data.onboardingSubmittedAt).toBeInstanceOf(Date);
    expect(sendClientOnboardingInternalNotificationEmail).toHaveBeenCalled();
    expect(sendClientOnboardingCustomerConfirmationEmail).toHaveBeenCalled();
  });

  it('POST submit fails when required fields missing', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingFindUnique.mockResolvedValue(
      draftRow({
        primaryContactName: null,
        contentRightsConfirmed: false,
        domainMode: ClientOnboardingDomainMode.UNDECIDED,
      }),
    );
    mockWorkspaceReady();

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing.length).toBeGreaterThan(0);
    expect(txClientOnboardingUpdate).not.toHaveBeenCalled();
  });

  it('POST submit is idempotent when already submitted', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingFindUnique.mockResolvedValue(
      draftRow({
        status: ClientOnboardingStatus.SUBMITTED,
        submittedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );

    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(sendClientOnboardingInternalNotificationEmail).not.toHaveBeenCalled();
  });

  it('POST submit fails for KERSIVO_REGISTER without authorisation', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingFindUnique.mockResolvedValue(
      draftRow({
        domainMode: ClientOnboardingDomainMode.KERSIVO_REGISTER,
        domainRegistrationAuthorised: false,
      }),
    );
    mockWorkspaceReady();
    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing.some((m: string) => m.toLowerCase().includes('authorise'))).toBe(
      true,
    );
  });

  it('POST submit fails for migration without lawful confirmation', async () => {
    resolveAdminAccess.mockResolvedValue(accessFor('OWNER'));
    clientOnboardingFindUnique.mockResolvedValue(
      draftRow({
        migrationRequested: true,
        migrationDataConfirmedLawful: false,
      }),
    );
    mockWorkspaceReady();
    const res = await SUBMIT(makeContext('POST') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing.some((m: string) => m.toLowerCase().includes('lawfully'))).toBe(
      true,
    );
  });
});
