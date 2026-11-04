/**
 * Canonical writes for a shop's public business details (ShopPublicProfile).
 *
 * Every admin surface that edits business details calls into here, so the public site reads one
 * record whatever the plan or the screen used:
 * - launch wizard (ClientOnboarding draft) → `profilePatchFromClientOnboarding`
 * - Starter / preview hub details → `profilePatchFromHubDetails`
 * - hub draft shop creation → `seedProfileFromPreviewRequest` (fills empty fields only)
 *
 * The ClientOnboarding / PreviewRequest columns are still written by their screens (older
 * readers: ops emails, the hub form). They are mirrors; getSiteData never reads them.
 */
import type { Prisma } from '@prisma/client';
import { BUSINESS_PROFILE_FIELDS, normaliseUkPostcode, type BusinessProfilePatch } from './schema';

export type ProfileField = (typeof BUSINESS_PROFILE_FIELDS)[number];
export type ProfileValues = Partial<Record<ProfileField, string | null>>;

type ProfileDb = {
  shopPublicProfile: Pick<Prisma.TransactionClient['shopPublicProfile'], 'upsert' | 'findUnique'>;
};

function definedOnly(values: ProfileValues): ProfileValues {
  const out: ProfileValues = {};
  for (const field of BUSINESS_PROFILE_FIELDS) {
    const value = values[field];
    if (value === undefined) continue;
    out[field] = value === null ? null : value.trim() || null;
  }
  if (out.postcode) out.postcode = normaliseUkPostcode(out.postcode) ?? out.postcode;
  return out;
}

/** Upsert the profile with the defined fields (undefined = untouched, null = cleared). */
export async function writeShopPublicProfile(
  db: ProfileDb,
  shopId: string,
  values: ProfileValues | BusinessProfilePatch,
): Promise<void> {
  const data = definedOnly(values as ProfileValues);
  if (Object.keys(data).length === 0) return;
  await db.shopPublicProfile.upsert({
    where: { shopId },
    create: { shopId, ...data },
    update: data,
  });
}

/**
 * Fill only the profile fields that are still empty. Used when a record is first linked to a
 * shop, so it never overwrites something the owner already saved in the canonical place.
 */
export async function fillEmptyShopPublicProfile(
  db: ProfileDb,
  shopId: string,
  values: ProfileValues,
): Promise<ProfileValues> {
  const incoming = definedOnly(values);
  const existing = await db.shopPublicProfile.findUnique({ where: { shopId } });
  const fill: ProfileValues = {};
  for (const field of BUSINESS_PROFILE_FIELDS) {
    const value = incoming[field];
    if (!value) continue;
    const current = existing ? (existing as Record<string, unknown>)[field] : null;
    if (current === null || current === undefined || current === '') fill[field] = value;
  }
  if (Object.keys(fill).length > 0) await writeShopPublicProfile(db, shopId, fill);
  return fill;
}

/** Launch-wizard (ClientOnboarding) field names → canonical profile fields. */
export function profilePatchFromClientOnboarding(input: {
  tagline?: string | null;
  shopDescription?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postcode?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  otherSocialUrl?: string | null;
  preferredPrimaryColour?: string | null;
  preferredSecondaryColour?: string | null;
}): ProfileValues {
  return {
    tagline: input.tagline,
    description: input.shopDescription,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    postcode: input.postcode,
    phone: input.publicPhone,
    email: input.publicEmail,
    instagramUrl: input.instagramUrl,
    facebookUrl: input.facebookUrl,
    tiktokUrl: input.tiktokUrl,
    otherSocialUrl: input.otherSocialUrl,
    brandPrimaryColour: input.preferredPrimaryColour,
    brandSecondaryColour: input.preferredSecondaryColour,
  };
}

/** Hub details (PreviewRequest) field names → canonical profile fields. */
export function profilePatchFromHubDetails(input: {
  aboutText?: string | null;
  instagramUrl?: string | null;
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
}): ProfileValues {
  return {
    description: input.aboutText,
    instagramUrl: input.instagramUrl,
    brandPrimaryColour: input.brandPrimaryColour,
    brandSecondaryColour: input.brandSecondaryColour,
  };
}
