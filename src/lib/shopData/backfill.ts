/**
 * One-off backfill into the canonical business-data places (site data contract).
 *
 * Idempotent and non-destructive:
 * - ShopPublicProfile: fills only EMPTY fields, from ClientOnboarding first, then PreviewRequest.
 * - ShopSettings.townCity: filled from ClientOnboarding.townCity only when empty.
 * - Barber.bio / showOnWebsite: copied from ClientOnboardingBarberProfile only when the profile row
 *   is newer than the barber row (so a later canonical edit is never overwritten on a re-run).
 * Nothing is deleted; legacy columns are left untouched.
 *
 * `planShopBackfill` is pure (tested). `scripts/site-data/backfill-canonical.ts` runs it.
 */
import { BUSINESS_PROFILE_FIELDS } from './schema';
import {
  profilePatchFromClientOnboarding,
  profilePatchFromHubDetails,
  type ProfileField,
  type ProfileValues,
} from './profile';
import { normaliseUkPostcode } from './schema';

export type BackfillShopInput = {
  shopId: string;
  townCity: string | null;
  profile: Partial<Record<ProfileField, string | null>> | null;
  onboarding: (Parameters<typeof profilePatchFromClientOnboarding>[0] & { townCity?: string | null }) | null;
  previewRequest: Parameters<typeof profilePatchFromHubDetails>[0] | null;
  barbers: Array<{
    id: string;
    bio: string | null;
    showOnWebsite: boolean;
    updatedAt: Date;
    onboardingProfile: { bio: string | null; showOnWebsite: boolean; updatedAt: Date } | null;
  }>;
};

export type BackfillShopPlan = {
  shopId: string;
  profileFill: ProfileValues;
  townCity: string | null;
  barberUpdates: Array<{ id: string; data: { bio?: string | null; showOnWebsite?: boolean } }>;
};

function clean(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function planShopBackfill(input: BackfillShopInput): BackfillShopPlan {
  const profileFill: ProfileValues = {};
  const sources: ProfileValues[] = [
    input.onboarding ? profilePatchFromClientOnboarding(input.onboarding) : {},
    input.previewRequest ? profilePatchFromHubDetails(input.previewRequest) : {},
  ];
  for (const field of BUSINESS_PROFILE_FIELDS) {
    if (clean(input.profile?.[field] ?? null)) continue;
    for (const source of sources) {
      const value = clean(source[field]);
      if (!value) continue;
      profilePatchValue(profileFill, field, value);
      break;
    }
  }

  const townCity = !clean(input.townCity) ? clean(input.onboarding?.townCity) : null;

  const barberUpdates: BackfillShopPlan['barberUpdates'] = [];
  for (const barber of input.barbers) {
    const legacy = barber.onboardingProfile;
    if (!legacy || legacy.updatedAt <= barber.updatedAt) continue;
    const data: { bio?: string | null; showOnWebsite?: boolean } = {};
    const legacyBio = clean(legacy.bio);
    if (legacyBio && legacyBio !== clean(barber.bio)) data.bio = legacyBio;
    if (legacy.showOnWebsite !== barber.showOnWebsite) data.showOnWebsite = legacy.showOnWebsite;
    if (Object.keys(data).length) barberUpdates.push({ id: barber.id, data });
  }

  return { shopId: input.shopId, profileFill, townCity, barberUpdates };
}

function profilePatchValue(target: ProfileValues, field: ProfileField, value: string) {
  target[field] = field === 'postcode' ? (normaliseUkPostcode(value) ?? value) : value;
}

export function isEmptyPlan(plan: BackfillShopPlan): boolean {
  return Object.keys(plan.profileFill).length === 0 && !plan.townCity && plan.barberUpdates.length === 0;
}
