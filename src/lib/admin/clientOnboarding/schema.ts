import { z } from 'zod';
import {
  ClientOnboardingDomainMode,
  ClientOnboardingStatus,
} from '@prisma/client';

const optionalTrimmed = z
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

const optionalLongText = z
  .string()
  .trim()
  .max(10_000)
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

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  });

const optionalColour = z
  .string()
  .trim()
  .max(32)
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  });

export const clientOnboardingDraftSchema = z
  .object({
    currentStep: z.number().int().min(0).max(50).optional(),

    legalBusinessName: optionalTrimmed,
    businessType: optionalTrimmed,
    companyNumber: optionalTrimmed,
    addressLine1: optionalTrimmed,
    addressLine2: optionalTrimmed,
    townCity: optionalTrimmed,
    postcode: optionalTrimmed,
    publicEmail: optionalEmail,
    publicPhone: optionalTrimmed,
    primaryContactName: optionalTrimmed,
    primaryContactEmail: optionalEmail,

    tagline: optionalTrimmed,
    shopDescription: optionalLongText,
    websiteNotes: optionalLongText,
    currentWebsiteUrl: optionalUrl,
    instagramUrl: optionalUrl,
    facebookUrl: optionalUrl,
    tiktokUrl: optionalUrl,
    otherSocialUrl: optionalUrl,
    brandNotes: optionalLongText,
    preferredPrimaryColour: optionalColour,
    preferredSecondaryColour: optionalColour,

    domainMode: z.nativeEnum(ClientOnboardingDomainMode).optional(),
    existingDomain: optionalTrimmed,
    domainRegistrar: optionalTrimmed,
    preferredDomain1: optionalTrimmed,
    preferredDomain2: optionalTrimmed,
    preferredDomain3: optionalTrimmed,
    domainRegistrationAuthorised: z.boolean().optional(),

    migrationRequested: z.boolean().optional(),
    migrationSource: optionalTrimmed,
    migrationSourceOther: optionalTrimmed,
    migrationNotes: optionalLongText,
    migrationDataConfirmedLawful: z.boolean().optional(),

    launchRetail: z.boolean().optional().nullable(),
    launchDeposits: z.boolean().optional().nullable(),
    retailProductsDeferred: z.boolean().optional(),
    notificationReplyToEmail: optionalEmail,
    additionalNotes: optionalLongText,

    portfolioConsent: z.boolean().optional(),
    socialMediaConsent: z.boolean().optional(),
    advertisingConsent: z.boolean().optional(),
    caseStudyConsent: z.boolean().optional(),

    contentRightsConfirmed: z.boolean().optional(),
    informationAccuracyConfirmed: z.boolean().optional(),
  })
  .strict();

export type ClientOnboardingDraftInput = z.infer<typeof clientOnboardingDraftSchema>;

export const clientOnboardingBarberProfileSchema = z.object({
  barberId: z.string().trim().min(1).max(120),
  bio: optionalLongText,
  showOnWebsite: z.boolean().optional(),
});

export const clientOnboardingBarberProfilesPayloadSchema = z.object({
  profiles: z.array(clientOnboardingBarberProfileSchema).max(50),
});

export type WorkspaceCompletionSnapshot = {
  shopName: string | null;
  activeBarberCount: number;
  activeServiceCount: number;
  activeShopOpenDayCount: number;
  activeBarberAvailabilityDayCount: number;
  productCount: number;
};

/** Fields required for server-side submit gating (subset of ClientOnboarding). */
export type SubmitValidationDraft = {
  domainMode: ClientOnboardingDomainMode;
  domainRegistrationAuthorised: boolean;
  migrationRequested: boolean;
  migrationDataConfirmedLawful: boolean;
  launchRetail: boolean | null;
  retailProductsDeferred: boolean;
  contentRightsConfirmed: boolean;
  informationAccuracyConfirmed: boolean;
  addressLine1: string | null;
  townCity: string | null;
  postcode: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
};

export type SubmitValidationContext = {
  draft: SubmitValidationDraft;
  workspace: WorkspaceCompletionSnapshot;
};

export function validateClientOnboardingSubmit(
  ctx: SubmitValidationContext,
): string[] {
  const errors: string[] = [];
  const { draft, workspace } = ctx;

  if (!workspace.shopName?.trim()) {
    errors.push('Shop name is required.');
  }
  if (!draft.primaryContactName?.trim()) {
    errors.push('Primary contact name is required.');
  }
  if (!draft.primaryContactEmail?.trim()) {
    errors.push('Primary contact email is required.');
  }
  if (!draft.addressLine1?.trim()) {
    errors.push('Street address is required.');
  }
  if (!draft.townCity?.trim()) {
    errors.push('Town / city is required.');
  }
  if (!draft.postcode?.trim()) {
    errors.push('Postcode is required.');
  }
  if (!draft.publicEmail?.trim() && !draft.publicPhone?.trim()) {
    errors.push('Provide a public contact email or phone number.');
  }
  if (workspace.activeBarberCount < 1) {
    errors.push('At least one active barber is required.');
  }
  if (workspace.activeServiceCount < 1) {
    errors.push('At least one active service is required.');
  }
  if (workspace.activeShopOpenDayCount < 1) {
    errors.push('At least one shop opening day is required.');
  }
  if (workspace.activeBarberAvailabilityDayCount < 1) {
    errors.push('At least one barber availability day is required.');
  }

  if (
    draft.domainMode === ClientOnboardingDomainMode.UNDECIDED ||
    draft.domainMode == null
  ) {
    errors.push('Choose a domain option before submitting.');
  }
  if (
    draft.domainMode === ClientOnboardingDomainMode.KERSIVO_REGISTER &&
    !draft.domainRegistrationAuthorised
  ) {
    errors.push(
      'Authorise KERSIVO to register and manage the selected domain before submitting.',
    );
  }

  // migrationRequested is boolean on the model; treat missing as invalid only if undefined in merged draft
  if (typeof draft.migrationRequested !== 'boolean') {
    errors.push('Confirm whether you need data migration.');
  } else if (draft.migrationRequested && !draft.migrationDataConfirmedLawful) {
    errors.push(
      'Confirm that migration data was obtained lawfully before submitting.',
    );
  }

  if (!draft.contentRightsConfirmed) {
    errors.push('Confirm content rights before submitting.');
  }
  if (!draft.informationAccuracyConfirmed) {
    errors.push('Confirm information accuracy before submitting.');
  }

  if (draft.launchRetail === true) {
    if (workspace.productCount < 1 && !draft.retailProductsDeferred) {
      errors.push(
        'Add at least one retail product, or confirm you will add products later.',
      );
    }
  }

  return errors;
}

export const MARKETING_CONSENT_DEFAULTS = {
  portfolioConsent: false,
  socialMediaConsent: false,
  advertisingConsent: false,
  caseStudyConsent: false,
} as const;

export { ClientOnboardingDomainMode, ClientOnboardingStatus };
