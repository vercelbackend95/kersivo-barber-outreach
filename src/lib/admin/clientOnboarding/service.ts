import type { AdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  clientOnboardingDraftSchema,
  type ClientOnboardingDraftInput,
  type WorkspaceCompletionSnapshot,
  validateClientOnboardingSubmit,
} from '@/lib/admin/clientOnboarding/schema';
import {
  ClientOnboardingDomainMode,
  ClientOnboardingStatus,
  type ClientOnboarding,
  type Prisma,
} from '@prisma/client';
import {
  sendClientOnboardingCustomerConfirmationEmail,
  sendClientOnboardingInternalNotificationEmail,
} from '@/lib/email/clientOnboardingEmails';

export async function requireClientOnboardingAccess(
  access: AdminAccess | null,
): Promise<AdminAccess | Response> {
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  return access;
}

export async function ensureClientOnboarding(shopId: string): Promise<ClientOnboarding> {
  const existing = await prisma.clientOnboarding.findUnique({ where: { shopId } });
  if (existing) return existing;
  return prisma.clientOnboarding.create({
    data: { shopId },
  });
}

export async function loadWorkspaceCompletionSnapshot(
  shopId: string,
): Promise<WorkspaceCompletionSnapshot> {
  const [shop, activeBarberCount, activeServiceCount, activeShopOpenDayCount, availability, productCount] =
    await Promise.all([
      prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: { name: true },
      }),
      prisma.barber.count({ where: { shopId, active: true } }),
      prisma.service.count({ where: { shopId, isActive: true } }),
      prisma.shopOpeningHours.count({ where: { shopId, active: true } }),
      prisma.availabilityRule.findMany({
        where: { active: true, barber: { shopId, active: true } },
        select: { barberId: true, dayOfWeek: true },
      }),
      prisma.product.count({ where: { shopId, active: true } }),
    ]);

  const availabilityKeys = new Set(
    availability.map((r) => `${r.barberId}:${r.dayOfWeek}`),
  );

  return {
    shopName: shop?.name ?? null,
    activeBarberCount,
    activeServiceCount,
    activeShopOpenDayCount,
    activeBarberAvailabilityDayCount: availabilityKeys.size,
    productCount,
  };
}

function serializeAsset(asset: {
  id: string;
  kind: string;
  storagePath: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    kind: asset.kind,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function loadClientOnboardingState(shopId: string, access: AdminAccess) {
  const onboarding = await ensureClientOnboarding(shopId);

  const [shop, workspace, barbers, services, openingHours, assets, barberProfiles, owner] =
    await Promise.all([
      prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          name: true,
          townCity: true,
          logoUrl: true,
          onboardingCompleted: true,
          shopPaidAt: true,
          retailEnabled: true,
          depositsEnabled: true,
        },
      }),
      loadWorkspaceCompletionSnapshot(shopId),
      prisma.barber.findMany({
        where: { shopId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          active: true,
          avatarUrl: true,
          sortOrder: true,
        },
      }),
      prisma.service.findMany({
        where: { shopId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          isActive: true,
          pricePence: true,
          durationMinutes: true,
        },
      }),
      prisma.shopOpeningHours.findMany({
        where: { shopId },
        orderBy: { dayOfWeek: 'asc' },
        select: {
          dayOfWeek: true,
          startMinutes: true,
          endMinutes: true,
          active: true,
        },
      }),
      prisma.clientOnboardingAsset.findMany({
        where: { onboardingId: onboarding.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clientOnboardingBarberProfile.findMany({
        where: { onboardingId: onboarding.id },
        select: {
          barberId: true,
          bio: true,
          showOnWebsite: true,
        },
      }),
      access.userId
        ? prisma.user.findUnique({
            where: { id: access.userId },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),
    ]);

  const profileByBarber = new Map(barberProfiles.map((p) => [p.barberId, p]));

  const submitErrors = validateClientOnboardingSubmit({
    draft: mergeDraftFromRecord(onboarding),
    workspace,
  });

  return {
    onboarding: serializeOnboarding(onboarding),
    shop,
    owner: owner
      ? { id: owner.id, name: owner.name, email: owner.email }
      : null,
    workspace,
    barbers: barbers.map((b) => ({
      ...b,
      bio: profileByBarber.get(b.id)?.bio ?? null,
      showOnWebsite: profileByBarber.get(b.id)?.showOnWebsite ?? true,
    })),
    services,
    openingHours,
    assets: assets.map(serializeAsset),
    completion: {
      readyToSubmit: submitErrors.length === 0,
      missing: submitErrors,
      submitted: onboarding.status === ClientOnboardingStatus.SUBMITTED,
    },
  };
}

function mergeDraftFromRecord(row: ClientOnboarding) {
  return {
    domainMode: row.domainMode,
    domainRegistrationAuthorised: row.domainRegistrationAuthorised,
    migrationRequested: row.migrationRequested,
    migrationDataConfirmedLawful: row.migrationDataConfirmedLawful,
    launchRetail: row.launchRetail,
    retailProductsDeferred: row.retailProductsDeferred,
    contentRightsConfirmed: row.contentRightsConfirmed,
    informationAccuracyConfirmed: row.informationAccuracyConfirmed,
    addressLine1: row.addressLine1,
    townCity: row.townCity,
    postcode: row.postcode,
    publicEmail: row.publicEmail,
    publicPhone: row.publicPhone,
    primaryContactName: row.primaryContactName,
    primaryContactEmail: row.primaryContactEmail,
  };
}

function serializeOnboarding(row: ClientOnboarding) {
  return {
    id: row.id,
    shopId: row.shopId,
    status: row.status,
    currentStep: row.currentStep,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),

    legalBusinessName: row.legalBusinessName,
    businessType: row.businessType,
    companyNumber: row.companyNumber,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    townCity: row.townCity,
    postcode: row.postcode,
    publicEmail: row.publicEmail,
    publicPhone: row.publicPhone,
    primaryContactName: row.primaryContactName,
    primaryContactEmail: row.primaryContactEmail,

    tagline: row.tagline,
    shopDescription: row.shopDescription,
    websiteNotes: row.websiteNotes,
    currentWebsiteUrl: row.currentWebsiteUrl,
    instagramUrl: row.instagramUrl,
    facebookUrl: row.facebookUrl,
    tiktokUrl: row.tiktokUrl,
    otherSocialUrl: row.otherSocialUrl,
    brandNotes: row.brandNotes,
    preferredPrimaryColour: row.preferredPrimaryColour,
    preferredSecondaryColour: row.preferredSecondaryColour,

    domainMode: row.domainMode,
    existingDomain: row.existingDomain,
    domainRegistrar: row.domainRegistrar,
    preferredDomain1: row.preferredDomain1,
    preferredDomain2: row.preferredDomain2,
    preferredDomain3: row.preferredDomain3,
    domainRegistrationAuthorised: row.domainRegistrationAuthorised,
    domainRegistrationAuthorisedAt:
      row.domainRegistrationAuthorisedAt?.toISOString() ?? null,

    migrationRequested: row.migrationRequested,
    migrationSource: row.migrationSource,
    migrationSourceOther: row.migrationSourceOther,
    migrationNotes: row.migrationNotes,
    migrationDataConfirmedLawful: row.migrationDataConfirmedLawful,
    migrationDataConfirmedAt: row.migrationDataConfirmedAt?.toISOString() ?? null,

    launchRetail: row.launchRetail,
    launchDeposits: row.launchDeposits,
    retailProductsDeferred: row.retailProductsDeferred,
    notificationReplyToEmail: row.notificationReplyToEmail,
    additionalNotes: row.additionalNotes,

    portfolioConsent: row.portfolioConsent,
    socialMediaConsent: row.socialMediaConsent,
    advertisingConsent: row.advertisingConsent,
    caseStudyConsent: row.caseStudyConsent,
    marketingConsentUpdatedAt: row.marketingConsentUpdatedAt?.toISOString() ?? null,

    contentRightsConfirmed: row.contentRightsConfirmed,
    informationAccuracyConfirmed: row.informationAccuracyConfirmed,
    declarationsConfirmedAt: row.declarationsConfirmedAt?.toISOString() ?? null,
  };
}

export function parseDraftBody(body: unknown) {
  return clientOnboardingDraftSchema.safeParse(body);
}

function buildUpdateData(input: ClientOnboardingDraftInput): Prisma.ClientOnboardingUpdateInput {
  const data: Prisma.ClientOnboardingUpdateInput = {};
  const assign = <K extends keyof ClientOnboardingDraftInput>(key: K) => {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      (data as Record<string, unknown>)[key as string] = input[key];
    }
  };

  const keys: (keyof ClientOnboardingDraftInput)[] = [
    'currentStep',
    'legalBusinessName',
    'businessType',
    'companyNumber',
    'addressLine1',
    'addressLine2',
    'townCity',
    'postcode',
    'publicEmail',
    'publicPhone',
    'primaryContactName',
    'primaryContactEmail',
    'tagline',
    'shopDescription',
    'websiteNotes',
    'currentWebsiteUrl',
    'instagramUrl',
    'facebookUrl',
    'tiktokUrl',
    'otherSocialUrl',
    'brandNotes',
    'preferredPrimaryColour',
    'preferredSecondaryColour',
    'domainMode',
    'existingDomain',
    'domainRegistrar',
    'preferredDomain1',
    'preferredDomain2',
    'preferredDomain3',
    'domainRegistrationAuthorised',
    'migrationRequested',
    'migrationSource',
    'migrationSourceOther',
    'migrationNotes',
    'migrationDataConfirmedLawful',
    'launchRetail',
    'launchDeposits',
    'retailProductsDeferred',
    'notificationReplyToEmail',
    'additionalNotes',
    'portfolioConsent',
    'socialMediaConsent',
    'advertisingConsent',
    'caseStudyConsent',
    'contentRightsConfirmed',
    'informationAccuracyConfirmed',
  ];

  for (const key of keys) assign(key);

  if (input.domainRegistrationAuthorised === true) {
    data.domainRegistrationAuthorisedAt = new Date();
  } else if (input.domainRegistrationAuthorised === false) {
    data.domainRegistrationAuthorisedAt = null;
  }

  if (input.migrationDataConfirmedLawful === true) {
    data.migrationDataConfirmedAt = new Date();
  } else if (input.migrationDataConfirmedLawful === false) {
    data.migrationDataConfirmedAt = null;
  }

  const marketingTouched =
    input.portfolioConsent !== undefined ||
    input.socialMediaConsent !== undefined ||
    input.advertisingConsent !== undefined ||
    input.caseStudyConsent !== undefined;
  if (marketingTouched) {
    data.marketingConsentUpdatedAt = new Date();
  }

  if (
    input.contentRightsConfirmed !== undefined ||
    input.informationAccuracyConfirmed !== undefined
  ) {
    if (input.contentRightsConfirmed === true && input.informationAccuracyConfirmed === true) {
      data.declarationsConfirmedAt = new Date();
    }
  }

  // Never allow draft save to flip status to SUBMITTED
  return data;
}

export async function saveClientOnboardingDraft(
  shopId: string,
  input: ClientOnboardingDraftInput,
) {
  const onboarding = await ensureClientOnboarding(shopId);
  const updated = await prisma.clientOnboarding.update({
    where: { id: onboarding.id },
    data: buildUpdateData(input),
  });
  return serializeOnboarding(updated);
}

export async function submitClientOnboarding(shopId: string, access: AdminAccess) {
  const onboarding = await ensureClientOnboarding(shopId);

  if (
    onboarding.status === ClientOnboardingStatus.SUBMITTED &&
    onboarding.submittedAt
  ) {
    return {
      ok: true as const,
      idempotent: true,
      onboarding: serializeOnboarding(onboarding),
    };
  }

  const workspace = await loadWorkspaceCompletionSnapshot(shopId);
  const errors = validateClientOnboardingSubmit({
    draft: mergeDraftFromRecord(onboarding),
    workspace,
  });
  if (errors.length) {
    return { ok: false as const, errors };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.clientOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: ClientOnboardingStatus.SUBMITTED,
        submittedAt: now,
        declarationsConfirmedAt: now,
        ...(onboarding.domainMode === ClientOnboardingDomainMode.KERSIVO_REGISTER
          ? {
              domainRegistrationAuthorised: true,
              domainRegistrationAuthorisedAt:
                onboarding.domainRegistrationAuthorisedAt ?? now,
            }
          : {}),
        ...(onboarding.migrationRequested
          ? {
              migrationDataConfirmedLawful: true,
              migrationDataConfirmedAt: onboarding.migrationDataConfirmedAt ?? now,
            }
          : {}),
      },
    });

    await tx.saasSubscription.updateMany({
      where: {
        shopId,
        onboardingSubmittedAt: null,
        status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] },
      },
      data: { onboardingSubmittedAt: now },
    });

    return row;
  });

  const [assets, barbers, services, openingHours, shop] = await Promise.all([
    prisma.clientOnboardingAsset.findMany({
      where: { onboardingId: updated.id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.barber.findMany({
      where: { shopId, active: true },
      select: { name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.service.findMany({
      where: { shopId, isActive: true },
      select: { name: true, pricePence: true, durationMinutes: true },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.shopOpeningHours.findMany({
      where: { shopId, active: true },
      select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
      orderBy: { dayOfWeek: 'asc' },
    }),
    prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { name: true },
    }),
  ]);

  const shopName = shop?.name?.trim() || 'Shop';
  const customerEmail =
    updated.primaryContactEmail?.trim() ||
    access.userEmail?.trim() ||
    null;

  try {
    await sendClientOnboardingInternalNotificationEmail({
      shopName,
      shopId,
      onboardingId: updated.id,
      submittedAtIso: now.toISOString(),
      onboarding: updated,
      barbers,
      services,
      openingHours,
      assets: assets.map((a) => ({
        kind: a.kind,
        originalFileName: a.originalFileName,
        storagePath: a.storagePath,
      })),
      workspace,
      ownerEmail: access.userEmail,
      ownerName: access.userName,
    });
  } catch (error) {
    console.error('[client-onboarding] internal email failed', error);
  }

  if (customerEmail) {
    try {
      await sendClientOnboardingCustomerConfirmationEmail({
        to: customerEmail,
        shopName,
        contactName: updated.primaryContactName || access.userName || 'there',
      });
    } catch (error) {
      console.error('[client-onboarding] customer email failed', error);
    }
  }

  return {
    ok: true as const,
    idempotent: false,
    onboarding: serializeOnboarding(updated),
  };
}
