import type { AdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  clientOnboardingDraftSchema,
  CLIENT_ONBOARDING_REQUIRES_PAID_CODE,
  clientOnboardingLockedResponse,
  isClientOnboardingWriteLocked,
  normalizeDomainInput,
  type ClientOnboardingDraftInput,
  type WorkspaceCompletionSnapshot,
  validateClientOnboardingSubmit,
} from '@/lib/admin/clientOnboarding/schema';
import { withClientOnboardingWriteLock } from '@/lib/admin/clientOnboarding/writeLock';
import { isPaidShop } from '@/lib/shop/paidShop';
import {
  ClientOnboardingDomainMode,
  ClientOnboardingStatus,
  EmailOutboundPurpose,
  type ClientOnboarding,
  type Prisma,
} from '@prisma/client';
import {
  buildClientOnboardingCustomerConfirmationEmail,
  buildClientOnboardingInternalNotificationEmail,
  getClientOnboardingContactInboxEmail,
} from '@/lib/email/clientOnboardingEmails';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { isPrismaUniqueConflict } from '@/lib/setup/saasCheckoutGuard';

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function requireClientOnboardingAccess(
  access: AdminAccess | null,
): Promise<AdminAccess | Response> {
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const [shop, saasSub] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: { id: true, shopPaidAt: true, smsRemindersEnabled: true },
    }),
    prisma.saasSubscription.findFirst({
      where: { shopId: access.shopId },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        currentPeriodEnd: true,
        pastDueSince: true,
        activatedAt: true,
      },
    }),
  ]);

  if (!shop || !isPaidShop(shop, saasSub)) {
    return new Response(
      JSON.stringify({
        error: 'Client onboarding requires an active paid subscription.',
        code: CLIENT_ONBOARDING_REQUIRES_PAID_CODE,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return access;
}

/** Race-safe ensure: upsert on unique shopId, with P2002 recovery fallback. */
export async function ensureClientOnboarding(
  shopId: string,
  db: DbClient = prisma,
): Promise<ClientOnboarding> {
  try {
    return await db.clientOnboarding.upsert({
      where: { shopId },
      create: { shopId },
      update: {},
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      const existing = await db.clientOnboarding.findUnique({ where: { shopId } });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function assertWritableClientOnboarding(
  shopId: string,
  db: DbClient = prisma,
): Promise<ClientOnboarding | Response> {
  const onboarding = await ensureClientOnboarding(shopId, db);
  if (isClientOnboardingWriteLocked(onboarding.status)) {
    return clientOnboardingLockedResponse();
  }
  return onboarding;
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
      writeLocked: isClientOnboardingWriteLocked(onboarding.status),
    },
  };
}

function mergeDraftFromRecord(row: ClientOnboarding) {
  return {
    domainMode: row.domainMode,
    domainRegistrationAuthorised: row.domainRegistrationAuthorised,
    existingDomain: row.existingDomain,
    preferredDomain1: row.preferredDomain1,
    preferredDomain2: row.preferredDomain2,
    preferredDomain3: row.preferredDomain3,
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

  // Normalize domain fields when present (schema already validates; keep defensive normalize)
  if (input.existingDomain !== undefined) {
    data.existingDomain = normalizeDomainInput(input.existingDomain);
  }
  if (input.preferredDomain1 !== undefined) {
    data.preferredDomain1 = normalizeDomainInput(input.preferredDomain1);
  }
  if (input.preferredDomain2 !== undefined) {
    data.preferredDomain2 = normalizeDomainInput(input.preferredDomain2);
  }
  if (input.preferredDomain3 !== undefined) {
    data.preferredDomain3 = normalizeDomainInput(input.preferredDomain3);
  }

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

  return data;
}

export async function saveClientOnboardingDraft(
  shopId: string,
  input: ClientOnboardingDraftInput,
): Promise<{ ok: true; onboarding: ReturnType<typeof serializeOnboarding> } | Response> {
  return withClientOnboardingWriteLock(shopId, async (tx) => {
    const writable = await assertWritableClientOnboarding(shopId, tx);
    if (writable instanceof Response) return writable;

    const updated = await tx.clientOnboarding.update({
      where: { id: writable.id },
      data: buildUpdateData(input),
    });
    return { ok: true as const, onboarding: serializeOnboarding(updated) };
  });
}

async function enqueueSubmitNotifications(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    onboarding: ClientOnboarding;
    now: Date;
    workspace: WorkspaceCompletionSnapshot;
    access: AdminAccess;
    shopName: string;
    barbers: Array<{ name: string }>;
    services: Array<{ name: string; pricePence: number; durationMinutes: number }>;
    openingHours: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>;
    assets: Array<{ kind: string; originalFileName: string; storagePath: string }>;
  },
): Promise<string[]> {
  const outboxIds: string[] = [];
  const internal = buildClientOnboardingInternalNotificationEmail({
    shopName: input.shopName,
    shopId: input.shopId,
    onboardingId: input.onboarding.id,
    submittedAtIso: input.now.toISOString(),
    onboarding: input.onboarding,
    barbers: input.barbers,
    services: input.services,
    openingHours: input.openingHours,
    assets: input.assets,
    workspace: input.workspace,
    ownerEmail: input.access.userEmail,
    ownerName: input.access.userName,
  });

  const internalRow = await enqueueEmail(tx, {
    shopId: input.shopId,
    purpose: EmailOutboundPurpose.CLIENT_ONBOARDING_INTERNAL,
    to: internal.to || getClientOnboardingContactInboxEmail(),
    subject: internal.subject,
    html: internal.html,
    replyTo: internal.replyTo,
    dedupeKey: `client-onboarding:internal:${input.onboarding.id}:${input.now.toISOString()}`,
  });
  outboxIds.push(internalRow.id);

  const customerEmail =
    input.onboarding.primaryContactEmail?.trim() ||
    input.access.userEmail?.trim() ||
    null;
  if (customerEmail) {
    const customer = buildClientOnboardingCustomerConfirmationEmail({
      contactName:
        input.onboarding.primaryContactName || input.access.userName || 'there',
    });
    const customerRow = await enqueueEmail(tx, {
      shopId: input.shopId,
      purpose: EmailOutboundPurpose.CLIENT_ONBOARDING_CUSTOMER_CONFIRMATION,
      to: customerEmail,
      subject: customer.subject,
      html: customer.html,
      replyTo: customer.replyTo,
      dedupeKey: `client-onboarding:customer:${input.onboarding.id}:${input.now.toISOString()}`,
    });
    outboxIds.push(customerRow.id);
  }

  return outboxIds;
}

export async function submitClientOnboarding(shopId: string, access: AdminAccess) {
  const workspace = await loadWorkspaceCompletionSnapshot(shopId);

  // Prefetch email context outside the advisory lock (reads only).
  const [barbers, services, openingHours, shop] = await Promise.all([
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

  type SubmitLockResult =
    | { kind: 'idempotent'; onboarding: ClientOnboarding }
    | { kind: 'validation'; errors: string[] }
    | { kind: 'submitted'; onboarding: ClientOnboarding; outboxIds: string[] }
    | { kind: 'error'; errors: string[] };

  const locked = await withClientOnboardingWriteLock(shopId, async (tx): Promise<SubmitLockResult> => {
    const onboarding = await ensureClientOnboarding(shopId, tx);

    if (
      onboarding.status === ClientOnboardingStatus.SUBMITTED ||
      onboarding.status === ClientOnboardingStatus.READY_FOR_BUILD
    ) {
      return { kind: 'idempotent', onboarding };
    }

    const errors = validateClientOnboardingSubmit({
      draft: mergeDraftFromRecord(onboarding),
      workspace,
    });
    if (errors.length) {
      return { kind: 'validation', errors };
    }

    const now = new Date();
    const claimed = await tx.clientOnboarding.updateMany({
      where: {
        id: onboarding.id,
        status: {
          in: [ClientOnboardingStatus.DRAFT, ClientOnboardingStatus.NEEDS_CHANGES],
        },
      },
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

    if (claimed.count === 0) {
      const again = await tx.clientOnboarding.findUnique({ where: { id: onboarding.id } });
      if (
        again &&
        (again.status === ClientOnboardingStatus.SUBMITTED ||
          again.status === ClientOnboardingStatus.READY_FOR_BUILD)
      ) {
        return { kind: 'idempotent', onboarding: again };
      }
      return { kind: 'error', errors: ['Unable to submit onboarding. Please retry.'] };
    }

    const updated = await tx.clientOnboarding.findUniqueOrThrow({
      where: { id: onboarding.id },
    });

    await tx.saasSubscription.updateMany({
      where: {
        shopId,
        onboardingSubmittedAt: null,
        status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] },
      },
      data: { onboardingSubmittedAt: now },
    });

    const assets = await tx.clientOnboardingAsset.findMany({
      where: { onboardingId: updated.id },
      orderBy: { createdAt: 'asc' },
    });

    const outboxIds = await enqueueSubmitNotifications(tx, {
      shopId,
      onboarding: updated,
      now,
      workspace,
      access,
      shopName,
      barbers,
      services,
      openingHours,
      assets: assets.map((a) => ({
        kind: a.kind,
        originalFileName: a.originalFileName,
        storagePath: a.storagePath,
      })),
    });

    return { kind: 'submitted', onboarding: updated, outboxIds };
  });

  if (locked.kind === 'validation' || locked.kind === 'error') {
    return { ok: false as const, errors: locked.errors };
  }

  if (locked.kind === 'idempotent') {
    return {
      ok: true as const,
      idempotent: true,
      onboarding: serializeOnboarding(locked.onboarding),
    };
  }

  for (const id of locked.outboxIds) {
    await tryDeliverOutboxEmail(id);
  }

  return {
    ok: true as const,
    idempotent: false,
    onboarding: serializeOnboarding(locked.onboarding),
  };
}
