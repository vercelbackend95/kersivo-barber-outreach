import type { ClientOnboardingDomainMode, ClientOnboardingStatus } from '@prisma/client';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type DraftFields = {
  currentStep: number;
  legalBusinessName: string | null;
  businessType: string | null;
  companyNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  townCity: string | null;
  postcode: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  tagline: string | null;
  shopDescription: string | null;
  websiteNotes: string | null;
  currentWebsiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  otherSocialUrl: string | null;
  brandNotes: string | null;
  preferredPrimaryColour: string | null;
  preferredSecondaryColour: string | null;
  domainMode: ClientOnboardingDomainMode;
  existingDomain: string | null;
  domainRegistrar: string | null;
  preferredDomain1: string | null;
  preferredDomain2: string | null;
  preferredDomain3: string | null;
  domainRegistrationAuthorised: boolean;
  migrationRequested: boolean | null;
  migrationSource: string | null;
  migrationSourceOther: string | null;
  migrationNotes: string | null;
  migrationDataConfirmedLawful: boolean;
  launchRetail: boolean | null;
  launchDeposits: boolean | null;
  retailProductsDeferred: boolean;
  notificationReplyToEmail: string | null;
  additionalNotes: string | null;
  portfolioConsent: boolean;
  socialMediaConsent: boolean;
  advertisingConsent: boolean;
  caseStudyConsent: boolean;
  contentRightsConfirmed: boolean;
  informationAccuracyConfirmed: boolean;
};

export type OnboardingAsset = {
  id: string;
  kind: string;
  storagePath: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type OnboardingBarber = {
  id: string;
  name: string;
  active: boolean;
  avatarUrl: string | null;
  sortOrder: number;
  bio: string | null;
  showOnWebsite: boolean;
};

export type OnboardingService = {
  id: string;
  name: string;
  isActive: boolean;
  pricePence: number;
  durationMinutes: number;
};

export type OpeningHourRow = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  active: boolean;
};

export type ClientOnboardingState = {
  onboarding: DraftFields & {
    id: string;
    shopId: string;
    status: ClientOnboardingStatus;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  shop: {
    id: string;
    name: string | null;
    townCity: string | null;
    logoUrl: string | null;
    onboardingCompleted: boolean;
    shopPaidAt: string | null;
    retailEnabled: boolean;
    depositsEnabled: boolean;
  } | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  workspace: {
    shopName: string | null;
    activeBarberCount: number;
    activeServiceCount: number;
    activeShopOpenDayCount: number;
    activeBarberAvailabilityDayCount: number;
    productCount: number;
  };
  barbers: OnboardingBarber[];
  services: OnboardingService[];
  openingHours: OpeningHourRow[];
  assets: OnboardingAsset[];
  completion: {
    readyToSubmit: boolean;
    missing: string[];
    submitted: boolean;
    writeLocked: boolean;
  };
};

export type WeeklyRule = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export const STEP_META = [
  { id: 0, title: 'Welcome', short: 'Welcome' },
  { id: 1, title: 'Your business', short: 'Business' },
  { id: 2, title: 'Your brand', short: 'Brand' },
  { id: 3, title: 'Your domain', short: 'Domain' },
  { id: 4, title: 'Your team', short: 'Team' },
  { id: 5, title: 'Your services', short: 'Services' },
  { id: 6, title: 'Opening hours', short: 'Hours' },
  { id: 7, title: 'Barber availability', short: 'Availability' },
  { id: 8, title: 'Moving from another system', short: 'Migration' },
  { id: 9, title: 'Retail & deposits', short: 'Launch' },
  { id: 10, title: 'Final details', short: 'Details' },
  { id: 11, title: 'Review & submit', short: 'Review' },
] as const;

export const SETUP_STEP_COUNT = 11;

export function draftFromOnboarding(
  onboarding: ClientOnboardingState['onboarding'],
): DraftFields {
  return {
    currentStep: onboarding.currentStep ?? 0,
    legalBusinessName: onboarding.legalBusinessName,
    businessType: onboarding.businessType,
    companyNumber: onboarding.companyNumber,
    addressLine1: onboarding.addressLine1,
    addressLine2: onboarding.addressLine2,
    townCity: onboarding.townCity,
    postcode: onboarding.postcode,
    publicEmail: onboarding.publicEmail,
    publicPhone: onboarding.publicPhone,
    primaryContactName: onboarding.primaryContactName,
    primaryContactEmail: onboarding.primaryContactEmail,
    tagline: onboarding.tagline,
    shopDescription: onboarding.shopDescription,
    websiteNotes: onboarding.websiteNotes,
    currentWebsiteUrl: onboarding.currentWebsiteUrl,
    instagramUrl: onboarding.instagramUrl,
    facebookUrl: onboarding.facebookUrl,
    tiktokUrl: onboarding.tiktokUrl,
    otherSocialUrl: onboarding.otherSocialUrl,
    brandNotes: onboarding.brandNotes,
    preferredPrimaryColour: onboarding.preferredPrimaryColour,
    preferredSecondaryColour: onboarding.preferredSecondaryColour,
    domainMode: onboarding.domainMode,
    existingDomain: onboarding.existingDomain,
    domainRegistrar: onboarding.domainRegistrar,
    preferredDomain1: onboarding.preferredDomain1,
    preferredDomain2: onboarding.preferredDomain2,
    preferredDomain3: onboarding.preferredDomain3,
    domainRegistrationAuthorised: onboarding.domainRegistrationAuthorised,
    migrationRequested: onboarding.migrationRequested,
    migrationSource: onboarding.migrationSource,
    migrationSourceOther: onboarding.migrationSourceOther,
    migrationNotes: onboarding.migrationNotes,
    migrationDataConfirmedLawful: onboarding.migrationDataConfirmedLawful,
    launchRetail: onboarding.launchRetail,
    launchDeposits: onboarding.launchDeposits,
    retailProductsDeferred: onboarding.retailProductsDeferred,
    notificationReplyToEmail: onboarding.notificationReplyToEmail,
    additionalNotes: onboarding.additionalNotes,
    portfolioConsent: onboarding.portfolioConsent,
    socialMediaConsent: onboarding.socialMediaConsent,
    advertisingConsent: onboarding.advertisingConsent,
    caseStudyConsent: onboarding.caseStudyConsent,
    contentRightsConfirmed: onboarding.contentRightsConfirmed,
    informationAccuracyConfirmed: onboarding.informationAccuracyConfirmed,
  };
}

export function isBlankField(value: string | null | undefined) {
  return value == null || !String(value).trim();
}

/** Seed only empty ClientOnboarding fields from shop/owner. Never invents public contact or legal name. */
export function buildEmptyFieldPrefill(
  state: ClientOnboardingState,
): Partial<DraftFields> {
  const seed: Partial<DraftFields> = {};
  if (isBlankField(state.onboarding.townCity) && state.shop?.townCity?.trim()) {
    seed.townCity = state.shop.townCity.trim();
  }
  if (isBlankField(state.onboarding.primaryContactName) && state.owner?.name?.trim()) {
    seed.primaryContactName = state.owner.name.trim();
  }
  if (isBlankField(state.onboarding.primaryContactEmail) && state.owner?.email?.trim()) {
    seed.primaryContactEmail = state.owner.email.trim();
  }
  return seed;
}

export type PrefillKind = 'none' | 'fields' | 'canonical';

export function hasCanonicalPrefill(state: ClientOnboardingState): boolean {
  return (
    state.barbers.some((b) => b.active) ||
    state.services.some((s) => s.isActive) ||
    state.openingHours.some((h) => h.active)
  );
}

export function hasPrefillSignal(state: ClientOnboardingState): boolean {
  const o = state.onboarding;
  const shop = state.shop;
  return Boolean(
    shop?.name?.trim() ||
      shop?.townCity?.trim() ||
      o.primaryContactName?.trim() ||
      o.primaryContactEmail?.trim() ||
      o.addressLine1?.trim() ||
      hasCanonicalPrefill(state),
  );
}

export function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function timeToMinutes(value: string) {
  const [hh, mm] = value.split(':').map(Number);
  return hh * 60 + mm;
}

export function openingHoursToRules(rows: OpeningHourRow[]): WeeklyRule[] {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      active: row?.active ?? false,
      startTime: minutesToTime(row?.startMinutes ?? 9 * 60),
      endTime: minutesToTime(row?.endMinutes ?? 18 * 60),
    };
  });
}

export function formatGbp(pence: number) {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

export function domainModeLabel(mode: ClientOnboardingDomainMode | string) {
  if (mode === 'EXISTING') return 'I already have a domain';
  if (mode === 'KERSIVO_REGISTER') return 'I’d like KERSIVO to register a domain';
  return 'I’m not sure yet';
}

export function looksLikePublicBlobUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export async function readJsonError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; code?: string; missing?: string[] };
    return body;
  } catch {
    return { error: 'Something went wrong. Please try again.' };
  }
}
