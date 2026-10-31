import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { z } from 'zod';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { prisma } from '@/lib/db/client';
import { enqueueEmailOnce, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { currentBookingSystemLabel } from '@/lib/forms/currentBookingSystems';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import {
  buildHubLaunchApprovedInternalEmail,
  buildHubSiteLiveEmail,
  buildHubSubscribedEmail,
  opsPreviewRequestUrl,
} from './emails';
import { isPreviewHubEnabled, PREVIEW_ONBOARDING_PATH } from './config';
import { isValidUkCompanyNumber, normalizeUkCompanyNumber } from './ukCompanyNumber';

export const LAUNCH_ITEMS = ['business', 'domain', 'payments', 'migration', 'approve'] as const;
export type LaunchItem = (typeof LAUNCH_ITEMS)[number];

export const OUR_LAUNCH_STEPS = ['domain', 'ssl', 'live'] as const;
export type OurLaunchStep = (typeof OUR_LAUNCH_STEPS)[number];

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  });

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  })
  .refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Invalid email address.',
  });

const optionalOffice = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  });

export const launchBusinessSchema = z.object({
  item: z.literal('business'),
  publicEmail: optionalEmail,
  publicPhone: optionalText,
  addressLine1: optionalText,
  townCity: optionalText,
  postcode: optionalText,
  primaryContactName: optionalText,
  primaryContactEmail: optionalEmail,
  isLimitedCompany: z.boolean().nullable(),
  legalBusinessName: optionalText,
  companyNumber: optionalText,
  registeredOfficeAddress: optionalOffice,
});

export const launchChecklistPatchSchema = z.discriminatedUnion('item', [
  launchBusinessSchema,
  z.object({ item: z.literal('payments'), skip: z.literal(true) }),
  z.object({
    item: z.literal('migration'),
    skip: z.boolean().optional(),
    migrationDataConfirmedLawful: z.boolean().optional(),
  }),
  z.object({
    item: z.literal('approve'),
    contentRightsConfirmed: z.boolean(),
    informationAccuracyConfirmed: z.boolean(),
  }),
]);

export type LaunchChecklistPatch = z.infer<typeof launchChecklistPatchSchema>;

export type LaunchItemState = {
  id: LaunchItem;
  done: boolean;
  optional: boolean;
};

export type OurStepState = {
  id: OurLaunchStep;
  done: boolean;
};

export type LaunchChecklistState = {
  shopName: string;
  shopId: string;
  previewRequestId: string;
  publicToken: string;
  sitePreviewUrl: string | null;
  liveUrl: string | null;
  launchApprovedAt: string | null;
  liveAt: string | null;
  ourStepDomainAt: string | null;
  ourStepSslAt: string | null;
  items: LaunchItemState[];
  ourSteps: OurStepState[];
  done: number;
  total: number;
  business: {
    shopName: string;
    publicEmail: string;
    publicPhone: string;
    addressLine1: string;
    townCity: string;
    postcode: string;
    primaryContactName: string;
    primaryContactEmail: string;
    isLimitedCompany: boolean | null;
    legalBusinessName: string;
    companyNumber: string;
    registeredOfficeAddress: string;
    complete: boolean;
  };
  domain: {
    mode: 'EXISTING' | 'KERSIVO_REGISTER' | null;
    hostname: string;
    confirmed: boolean;
    connected: boolean;
  };
  payments: {
    stripeConnected: boolean;
    skipped: boolean;
  };
  migration: {
    currentSystemLabel: string | null;
    skipped: boolean;
    uploaded: boolean;
    lawful: boolean;
  };
  approve: {
    contentRightsConfirmed: boolean;
    informationAccuracyConfirmed: boolean;
    canApprove: boolean;
  };
};

function hostnameOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export type BusinessDetailsInput = {
  publicEmail: string | null;
  publicPhone: string | null;
  addressLine1: string | null;
  townCity: string | null;
  postcode: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  isLimitedCompany: boolean | null;
  legalBusinessName: string | null;
  companyNumber: string | null;
  registeredOfficeAddress: string | null;
};

export function businessDetailsComplete(input: BusinessDetailsInput): boolean {
  if (
    !hasText(input.primaryContactName) ||
    !hasText(input.primaryContactEmail) ||
    !hasText(input.addressLine1) ||
    !hasText(input.townCity) ||
    !hasText(input.postcode) ||
    !hasText(input.publicEmail)
  ) {
    return false;
  }
  if (input.isLimitedCompany == null) return false;
  if (!input.isLimitedCompany) return true;
  return (
    hasText(input.legalBusinessName) &&
    Boolean(input.companyNumber && isValidUkCompanyNumber(input.companyNumber)) &&
    hasText(input.registeredOfficeAddress)
  );
}

export function businessDetailsErrors(input: BusinessDetailsInput): string[] {
  const errors: string[] = [];
  if (
    !hasText(input.primaryContactName) ||
    !hasText(input.primaryContactEmail) ||
    !hasText(input.addressLine1) ||
    !hasText(input.townCity) ||
    !hasText(input.postcode) ||
    !hasText(input.publicEmail)
  ) {
    errors.push('Add your contact details and shop address.');
  }
  if (input.isLimitedCompany === true) {
    if (
      !hasText(input.legalBusinessName) ||
      !hasText(input.registeredOfficeAddress) ||
      !input.companyNumber
    ) {
      errors.push('Limited companies need a registered name, number and office address.');
    } else if (!isValidUkCompanyNumber(input.companyNumber)) {
      errors.push('Enter a valid UK company number (8 digits, or SC, NI or OC plus 6 digits).');
    }
  }
  return errors;
}

function chosenHostname(input: {
  domainMode: string | null;
  existingDomain: string | null;
  preferredDomain1: string | null;
  websiteUrl?: string | null;
}): string {
  if (input.domainMode === 'EXISTING') {
    return (input.existingDomain || hostnameOf(input.websiteUrl)).replace(/^www\./, '');
  }
  if (input.domainMode === 'KERSIVO_REGISTER') {
    return (input.preferredDomain1 || '').replace(/^www\./, '');
  }
  return (input.existingDomain || input.preferredDomain1 || hostnameOf(input.websiteUrl)).replace(/^www\./, '');
}

export async function loadHubLaunchProgress(previewRequestId: string): Promise<HubLaunchProgress | null> {
  const request = await prisma.previewRequest.findUnique({
    where: { id: previewRequestId },
    select: {
      launchApprovedAt: true,
      liveAt: true,
      ourStepDomainAt: true,
      ourStepSslAt: true,
      websiteUrl: true,
      hasOwnDomain: true,
      draftShopId: true,
      events: {
        where: { action: { in: [...LAUNCH_EVENT_ACTIONS] } },
        select: { action: true },
      },
      draftShop: {
        select: {
          stripeConnectAccountId: true,
          stripeConnectChargesEnabled: true,
          stripeConnectDisconnectedAt: true,
          clientOnboarding: {
            select: {
              publicEmail: true,
              publicPhone: true,
              addressLine1: true,
              townCity: true,
              postcode: true,
              primaryContactName: true,
              primaryContactEmail: true,
              isLimitedCompany: true,
              legalBusinessName: true,
              companyNumber: true,
              registeredOfficeAddress: true,
              domainMode: true,
              existingDomain: true,
              preferredDomain1: true,
              assets: { where: { kind: 'MIGRATION_CSV' }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!request) return null;
  const onboarding = request.draftShop?.clientOnboarding ?? null;
  const actions = new Set(request.events.map((event) => event.action));
  const businessComplete = businessDetailsComplete({
    publicEmail: onboarding?.publicEmail ?? null,
    publicPhone: onboarding?.publicPhone ?? null,
    addressLine1: onboarding?.addressLine1 ?? null,
    townCity: onboarding?.townCity ?? null,
    postcode: onboarding?.postcode ?? null,
    primaryContactName: onboarding?.primaryContactName ?? null,
    primaryContactEmail: onboarding?.primaryContactEmail ?? null,
    isLimitedCompany: onboarding?.isLimitedCompany ?? null,
    legalBusinessName: onboarding?.legalBusinessName ?? null,
    companyNumber: onboarding?.companyNumber ?? null,
    registeredOfficeAddress: onboarding?.registeredOfficeAddress ?? null,
  });
  const domainMode =
    onboarding?.domainMode === 'EXISTING' || onboarding?.domainMode === 'KERSIVO_REGISTER'
      ? onboarding.domainMode
      : request.hasOwnDomain === 'yes'
        ? 'EXISTING'
        : request.hasOwnDomain === 'no'
          ? 'KERSIVO_REGISTER'
          : null;
  const hostname = chosenHostname({
    domainMode,
    existingDomain: onboarding?.existingDomain ?? null,
    preferredDomain1: onboarding?.preferredDomain1 ?? null,
    websiteUrl: request.websiteUrl,
  });
  const stripeConnected = Boolean(
    request.draftShop?.stripeConnectAccountId &&
      request.draftShop.stripeConnectChargesEnabled &&
      !request.draftShop.stripeConnectDisconnectedAt,
  );
  return hubLaunchProgressFrom({
    businessComplete,
    domainOwnerDone:
      domainMode === 'KERSIVO_REGISTER' ||
      actions.has(PREVIEW_REQUEST_ACTIONS.HUB_DOMAIN_CONFIRMED) ||
      Boolean(request.ourStepDomainAt),
    paymentsDone: stripeConnected || actions.has(PREVIEW_REQUEST_ACTIONS.HUB_PAYMENTS_SKIPPED),
    migrationDone: Boolean(onboarding?.assets.length) || actions.has(PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_SKIPPED),
    launchApprovedAt: request.launchApprovedAt,
    ourStepDomainAt: request.ourStepDomainAt,
    ourStepSslAt: request.ourStepSslAt,
    liveAt: request.liveAt,
    liveHostname: hostname,
  });
}

export function liveSiteUrl(hostname: string | null | undefined): string | null {
  const host = (hostname || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host) return null;
  return `https://${host}`;
}

const LAUNCH_EVENT_ACTIONS = [
  PREVIEW_REQUEST_ACTIONS.HUB_DOMAIN_CONFIRMED,
  PREVIEW_REQUEST_ACTIONS.HUB_PAYMENTS_SKIPPED,
  PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_SKIPPED,
  PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_UPLOADED,
] as const;

export async function loadLaunchChecklist(shopId: string): Promise<LaunchChecklistState | null> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      stripeConnectDisconnectedAt: true,
      sitePreviewUrl: true,
      clientOnboarding: {
        include: {
          assets: {
            where: { kind: 'MIGRATION_CSV' },
            select: { id: true },
            take: 1,
          },
        },
      },
      previewRequest: {
        select: {
          id: true,
          publicToken: true,
          websiteUrl: true,
          hasOwnDomain: true,
          currentBookingSystem: true,
          launchApprovedAt: true,
          liveAt: true,
          ourStepDomainAt: true,
          ourStepSslAt: true,
          events: {
            where: { action: { in: [...LAUNCH_EVENT_ACTIONS] } },
            select: { action: true },
          },
        },
      },
    },
  });
  const request = shop?.previewRequest;
  if (!shop || !request) return null;

  const onboarding = shop.clientOnboarding;
  const savedMode = onboarding?.domainMode;
  const domainMode =
    savedMode === 'EXISTING' || savedMode === 'KERSIVO_REGISTER'
      ? savedMode
      : request.hasOwnDomain === 'yes'
        ? 'EXISTING'
        : request.hasOwnDomain === 'no'
          ? 'KERSIVO_REGISTER'
          : null;
  const hostname = chosenHostname({
    domainMode,
    existingDomain: onboarding?.existingDomain ?? null,
    preferredDomain1: onboarding?.preferredDomain1 ?? null,
    websiteUrl: request.websiteUrl,
  });
  const actions = new Set(request.events.map((event) => event.action));
  const business: BusinessDetailsInput = {
    publicEmail: onboarding?.publicEmail ?? null,
    publicPhone: onboarding?.publicPhone ?? null,
    addressLine1: onboarding?.addressLine1 ?? null,
    townCity: onboarding?.townCity ?? null,
    postcode: onboarding?.postcode ?? null,
    primaryContactName: onboarding?.primaryContactName ?? null,
    primaryContactEmail: onboarding?.primaryContactEmail ?? null,
    isLimitedCompany: onboarding?.isLimitedCompany ?? null,
    legalBusinessName: onboarding?.legalBusinessName ?? null,
    companyNumber: onboarding?.companyNumber ?? null,
    registeredOfficeAddress: onboarding?.registeredOfficeAddress ?? null,
  };
  const businessDone = businessDetailsComplete(business);
  const domainConfirmed = actions.has(PREVIEW_REQUEST_ACTIONS.HUB_DOMAIN_CONFIRMED);
  const domainOwnerDone =
    domainMode === 'KERSIVO_REGISTER' || domainConfirmed || Boolean(request.ourStepDomainAt);
  const stripeConnected = Boolean(
    shop.stripeConnectAccountId && shop.stripeConnectChargesEnabled && !shop.stripeConnectDisconnectedAt,
  );
  const paymentsSkipped = actions.has(PREVIEW_REQUEST_ACTIONS.HUB_PAYMENTS_SKIPPED);
  const paymentsDone = stripeConnected || paymentsSkipped;
  const migrationUploaded = Boolean(onboarding?.assets.length);
  const migrationSkipped = actions.has(PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_SKIPPED);
  const migrationDone = migrationUploaded || migrationSkipped;
  const approved = Boolean(request.launchApprovedAt);
  const system = request.currentBookingSystem;

  const items: LaunchItemState[] = [
    { id: 'business', done: businessDone, optional: false },
    { id: 'domain', done: domainOwnerDone, optional: false },
    { id: 'payments', done: paymentsDone, optional: true },
    { id: 'migration', done: migrationDone, optional: true },
    { id: 'approve', done: approved, optional: false },
  ];
  const ourSteps: OurStepState[] = [
    { id: 'domain', done: Boolean(request.ourStepDomainAt) },
    { id: 'ssl', done: Boolean(request.ourStepSslAt) },
    { id: 'live', done: Boolean(request.liveAt) },
  ];
  const done = items.filter((item) => item.done).length;

  return {
    shopName: shop.name,
    shopId: shop.id,
    previewRequestId: request.id,
    publicToken: request.publicToken,
    sitePreviewUrl: shop.sitePreviewUrl,
    liveUrl: request.liveAt ? liveSiteUrl(hostname) : null,
    launchApprovedAt: request.launchApprovedAt?.toISOString() ?? null,
    liveAt: request.liveAt?.toISOString() ?? null,
    ourStepDomainAt: request.ourStepDomainAt?.toISOString() ?? null,
    ourStepSslAt: request.ourStepSslAt?.toISOString() ?? null,
    items,
    ourSteps,
    done,
    total: items.length,
    business: {
      shopName: shop.name,
      publicEmail: business.publicEmail ?? '',
      publicPhone: business.publicPhone ?? '',
      addressLine1: business.addressLine1 ?? '',
      townCity: business.townCity ?? '',
      postcode: business.postcode ?? '',
      primaryContactName: business.primaryContactName ?? '',
      primaryContactEmail: business.primaryContactEmail ?? '',
      isLimitedCompany: business.isLimitedCompany,
      legalBusinessName: business.legalBusinessName ?? '',
      companyNumber: business.companyNumber ?? '',
      registeredOfficeAddress: business.registeredOfficeAddress ?? '',
      complete: businessDone,
    },
    domain: {
      mode: domainMode,
      hostname,
      confirmed: domainConfirmed,
      connected: Boolean(request.ourStepDomainAt),
    },
    payments: {
      stripeConnected,
      skipped: paymentsSkipped,
    },
    migration: {
      currentSystemLabel: system && system !== 'none' ? currentBookingSystemLabel(system) : null,
      skipped: migrationSkipped,
      uploaded: migrationUploaded,
      lawful: onboarding?.migrationDataConfirmedLawful === true,
    },
    approve: {
      contentRightsConfirmed: onboarding?.contentRightsConfirmed === true,
      informationAccuracyConfirmed: onboarding?.informationAccuracyConfirmed === true,
      canApprove: businessDone && !approved,
    },
  };
}

export type HubLaunchProgress = {
  yourSteps: Array<{ id: LaunchItem; done: boolean; optional: boolean }>;
  ourSteps: Array<{ id: OurLaunchStep; status: 'pending' | 'done' }>;
  liveUrl: string | null;
  launchApproved: boolean;
  live: boolean;
};

/** Token-safe launch progress: states only, no address / Ltd / Stripe / CSV. */
export function hubLaunchProgressFrom(input: {
  businessComplete: boolean;
  domainOwnerDone: boolean;
  paymentsDone: boolean;
  migrationDone: boolean;
  launchApprovedAt: Date | null;
  ourStepDomainAt: Date | null;
  ourStepSslAt: Date | null;
  liveAt: Date | null;
  liveHostname?: string | null;
}): HubLaunchProgress {
  return {
    yourSteps: [
      { id: 'business', done: input.businessComplete, optional: false },
      { id: 'domain', done: input.domainOwnerDone, optional: false },
      { id: 'payments', done: input.paymentsDone, optional: true },
      { id: 'migration', done: input.migrationDone, optional: true },
      { id: 'approve', done: Boolean(input.launchApprovedAt), optional: false },
    ],
    ourSteps: [
      { id: 'domain', status: input.ourStepDomainAt ? 'done' : 'pending' },
      { id: 'ssl', status: input.ourStepSslAt ? 'done' : 'pending' },
      { id: 'live', status: input.liveAt ? 'done' : 'pending' },
    ],
    liveUrl: input.liveAt ? liveSiteUrl(input.liveHostname) : null,
    launchApproved: Boolean(input.launchApprovedAt),
    live: Boolean(input.liveAt),
  };
}

async function writeLaunchEvent(input: {
  previewRequestId: string;
  action: string;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: input.previewRequestId,
      action: input.action,
      meta: input.meta,
    },
  });
}

export async function saveLaunchBusinessDetails(input: {
  shopId: string;
  previewRequestId: string;
  data: z.infer<typeof launchBusinessSchema>;
  clientId?: string | null;
}): Promise<{ state: LaunchChecklistState; completedItem: boolean }> {
  const before = await loadLaunchChecklist(input.shopId);
  const limited = input.data.isLimitedCompany === true;
  const companyNumber =
    limited && input.data.companyNumber ? normalizeUkCompanyNumber(input.data.companyNumber) : null;
  await prisma.clientOnboarding.update({
    where: { shopId: input.shopId },
    data: {
      publicEmail: input.data.publicEmail,
      publicPhone: input.data.publicPhone,
      addressLine1: input.data.addressLine1,
      townCity: input.data.townCity,
      postcode: input.data.postcode,
      primaryContactName: input.data.primaryContactName,
      primaryContactEmail: input.data.primaryContactEmail,
      isLimitedCompany: input.data.isLimitedCompany,
      legalBusinessName: limited ? input.data.legalBusinessName : null,
      companyNumber: limited ? companyNumber : null,
      registeredOfficeAddress: limited ? input.data.registeredOfficeAddress : null,
    },
  });
  await writeLaunchEvent({
    previewRequestId: input.previewRequestId,
    action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_DETAILS_SAVED,
    meta: { isLimitedCompany: input.data.isLimitedCompany },
  });
  const state = await loadLaunchChecklist(input.shopId);
  if (!state) throw new Error('Launch checklist missing after save.');
  const completedItem = Boolean(state.business.complete && !before?.business.complete);
  if (completedItem) {
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_ITEM_COMPLETED,
        meta: { item: 'business' },
      },
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_checklist_item_completed,
      clientId: input.clientId ?? null,
      params: { item: 'business' },
    });
  }
  return { state, completedItem };
}

export async function confirmLaunchDomain(input: {
  shopId: string;
  previewRequestId: string;
  clientId?: string | null;
}): Promise<LaunchChecklistState> {
  const before = await loadLaunchChecklist(input.shopId);
  if (before && !before.domain.confirmed) {
    await writeLaunchEvent({
      previewRequestId: input.previewRequestId,
      action: PREVIEW_REQUEST_ACTIONS.HUB_DOMAIN_CONFIRMED,
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_ITEM_COMPLETED,
        meta: { item: 'domain' },
      },
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_checklist_item_completed,
      clientId: input.clientId ?? null,
      params: { item: 'domain' },
    });
  }
  const state = await loadLaunchChecklist(input.shopId);
  if (!state) throw new Error('Launch checklist missing after domain confirm.');
  return state;
}

export async function skipLaunchItem(input: {
  shopId: string;
  previewRequestId: string;
  item: 'payments' | 'migration';
  clientId?: string | null;
}): Promise<LaunchChecklistState> {
  const before = await loadLaunchChecklist(input.shopId);
  const already =
    input.item === 'payments' ? Boolean(before?.payments.skipped || before?.payments.stripeConnected) : Boolean(before?.migration.skipped);
  const action =
    input.item === 'payments'
      ? PREVIEW_REQUEST_ACTIONS.HUB_PAYMENTS_SKIPPED
      : PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_SKIPPED;
  if (!already) {
    if (input.item === 'migration') {
      await prisma.clientOnboarding.update({
        where: { shopId: input.shopId },
        data: { migrationRequested: false },
      });
    }
    await writeLaunchEvent({ previewRequestId: input.previewRequestId, action });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_ITEM_COMPLETED,
        meta: { item: input.item },
      },
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_checklist_item_completed,
      clientId: input.clientId ?? null,
      params: { item: input.item },
    });
  }
  const state = await loadLaunchChecklist(input.shopId);
  if (!state) throw new Error('Launch checklist missing after skip.');
  return state;
}

export async function markMigrationUploaded(input: {
  shopId: string;
  previewRequestId: string;
  lawful: boolean;
  clientId?: string | null;
}): Promise<LaunchChecklistState> {
  const before = await loadLaunchChecklist(input.shopId);
  await prisma.clientOnboarding.update({
    where: { shopId: input.shopId },
    data: {
      migrationRequested: true,
      migrationDataConfirmedLawful: input.lawful,
      migrationDataConfirmedAt: input.lawful ? new Date() : null,
    },
  });
  await writeLaunchEvent({
    previewRequestId: input.previewRequestId,
    action: PREVIEW_REQUEST_ACTIONS.HUB_MIGRATION_UPLOADED,
  });
  const state = await loadLaunchChecklist(input.shopId);
  if (!state) throw new Error('Launch checklist missing after migration upload.');
  if (state.items.find((item) => item.id === 'migration')?.done && !before?.items.find((item) => item.id === 'migration')?.done) {
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_ITEM_COMPLETED,
        meta: { item: 'migration' },
      },
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_checklist_item_completed,
      clientId: input.clientId ?? null,
      params: { item: 'migration' },
    });
  }
  return state;
}

export async function approveLaunch(input: {
  shopId: string;
  previewRequestId: string;
  contentRightsConfirmed: boolean;
  informationAccuracyConfirmed: boolean;
  clientId?: string | null;
  now?: Date;
}): Promise<{ ok: true; state: LaunchChecklistState } | { ok: false; code: 'BUSINESS_INCOMPLETE' | 'CONFIRMATIONS_REQUIRED' | 'NOT_FOUND' }> {
  const now = input.now ?? new Date();
  const current = await loadLaunchChecklist(input.shopId);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  if (!current.business.complete) return { ok: false, code: 'BUSINESS_INCOMPLETE' };
  if (!input.contentRightsConfirmed || !input.informationAccuracyConfirmed) {
    return { ok: false, code: 'CONFIRMATIONS_REQUIRED' };
  }

  await prisma.clientOnboarding.update({
    where: { shopId: input.shopId },
    data: {
      contentRightsConfirmed: true,
      informationAccuracyConfirmed: true,
      declarationsConfirmedAt: now,
    },
  });

  const firstApproval = !current.launchApprovedAt;
  if (firstApproval) {
    await prisma.previewRequest.update({
      where: { id: input.previewRequestId },
      data: { launchApprovedAt: now },
    });
    await writeLaunchEvent({
      previewRequestId: input.previewRequestId,
      action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_APPROVED,
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.HUB_LAUNCH_ITEM_COMPLETED,
        meta: { item: 'approve' },
      },
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_approved,
      clientId: input.clientId ?? null,
    });
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.launch_checklist_item_completed,
      clientId: input.clientId ?? null,
      params: { item: 'approve' },
    });
    if (isPreviewHubEnabled()) {
      await notifyOpsLaunchApproved({
        previewRequestId: input.previewRequestId,
        shopName: current.shopName,
      });
    }
  }

  const state = await loadLaunchChecklist(input.shopId);
  if (!state) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, state };
}

export async function notifyOpsLaunchApproved(input: { previewRequestId: string; shopName: string }) {
  const email = buildHubLaunchApprovedInternalEmail({
    id: input.previewRequestId,
    shopName: input.shopName,
  });
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_LAUNCH_APPROVED_INTERNAL,
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-launch-approved:${input.previewRequestId}`,
  });
  if (created) await tryDeliverOutboxEmail(row.id);
}

export async function notifyOwnerSubscribed(input: {
  to: string;
  firstName: string | null;
  shopName: string;
  previewRequestId: string;
}) {
  if (!isPreviewHubEnabled()) return 'skipped';
  const email = buildHubSubscribedEmail({
    to: input.to,
    firstName: input.firstName,
    shopName: input.shopName,
    checklistUrl: `${getPublicSiteUrl()}${PREVIEW_ONBOARDING_PATH}`,
  });
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_SUBSCRIBED,
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-subscribed:${input.previewRequestId}`,
  });
  if (created) await tryDeliverOutboxEmail(row.id);
  return created ? 'sent' : 'skipped';
}

export async function notifyOwnerSiteLive(input: {
  to: string;
  firstName: string | null;
  shopName: string;
  previewRequestId: string;
  liveUrl: string | null;
}) {
  if (!isPreviewHubEnabled()) return 'skipped';
  const email = buildHubSiteLiveEmail({
    to: input.to,
    firstName: input.firstName,
    shopName: input.shopName,
    liveUrl: input.liveUrl,
  });
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_SITE_LIVE,
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-site-live:${input.previewRequestId}`,
  });
  if (created) await tryDeliverOutboxEmail(row.id);
  return created ? 'sent' : 'skipped';
}

export async function setOpsLaunchStep(input: {
  previewRequestId: string;
  step: OurLaunchStep;
  actorEmail: string;
  now?: Date;
}): Promise<{ ok: true; liveAt: Date | null } | { ok: false; code: 'NOT_FOUND' }> {
  const now = input.now ?? new Date();
  const request = await prisma.previewRequest.findUnique({
    where: { id: input.previewRequestId },
    select: {
      id: true,
      email: true,
      firstName: true,
      shopName: true,
      liveAt: true,
      ourStepDomainAt: true,
      ourStepSslAt: true,
      websiteUrl: true,
      draftShop: {
        select: {
          clientOnboarding: { select: { existingDomain: true, preferredDomain1: true, domainMode: true } },
        },
      },
    },
  });
  if (!request) return { ok: false, code: 'NOT_FOUND' };

  const data =
    input.step === 'domain'
      ? { ourStepDomainAt: request.ourStepDomainAt ?? now }
      : input.step === 'ssl'
        ? { ourStepSslAt: request.ourStepSslAt ?? now }
        : { liveAt: request.liveAt ?? now };
  const action =
    input.step === 'domain'
      ? PREVIEW_REQUEST_ACTIONS.OPS_HUB_DOMAIN_CONNECTED
      : input.step === 'ssl'
        ? PREVIEW_REQUEST_ACTIONS.OPS_HUB_SSL_ACTIVE
        : PREVIEW_REQUEST_ACTIONS.OPS_HUB_MARK_LIVE;

  const first =
    input.step === 'domain'
      ? !request.ourStepDomainAt
      : input.step === 'ssl'
        ? !request.ourStepSslAt
        : !request.liveAt;

  await prisma.previewRequest.update({
    where: { id: request.id },
    data: {
      ...data,
      events: first
        ? {
            create: { action, actorEmail: input.actorEmail, meta: { step: input.step } },
          }
        : undefined,
    },
  });

  if (input.step === 'live' && first) {
    const hostname = chosenHostname({
      domainMode: request.draftShop?.clientOnboarding?.domainMode ?? null,
      existingDomain: request.draftShop?.clientOnboarding?.existingDomain ?? null,
      preferredDomain1: request.draftShop?.clientOnboarding?.preferredDomain1 ?? null,
      websiteUrl: request.websiteUrl,
    });
    await sendServerAnalyticsEvent({ name: FUNNEL_EVENTS.site_live, clientId: null });
    await notifyOwnerSiteLive({
      to: request.email,
      firstName: request.firstName,
      shopName: request.shopName,
      previewRequestId: request.id,
      liveUrl: liveSiteUrl(hostname),
    });
  }

  const updated = await prisma.previewRequest.findUnique({
    where: { id: request.id },
    select: { liveAt: true },
  });
  return { ok: true, liveAt: updated?.liveAt ?? null };
}

export function launchChecklistUrl(): string {
  return `${getPublicSiteUrl()}${PREVIEW_ONBOARDING_PATH}`;
}

export function opsLaunchUrl(previewRequestId: string): string {
  return opsPreviewRequestUrl(previewRequestId);
}
