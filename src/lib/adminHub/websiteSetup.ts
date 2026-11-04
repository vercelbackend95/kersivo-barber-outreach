/**
 * Overview › Add to your website: the setup form's view-model. Client-safe, no I/O.
 *
 * This screen collects what KERSIVO needs to build the owner's website (business details and opening
 * hours), saved to the hub's draft shop through /api/admin-hub/* only. Services, team and products have
 * their own hub tabs; nothing here reads or writes the paid dashboard's /api/admin/* routes.
 *
 * Statuses and the completion count come from saved data only, never from unsaved edits.
 */
import type { OpeningDay } from '@/lib/shopData/openingHours';

export const SETUP_SECTION_IDS = ['business', 'hours'] as const;
export type SetupSectionId = (typeof SETUP_SECTION_IDS)[number];

export const SETUP_COPY = {
  title: 'Set up your website',
  intro: 'Work through each section at your own pace. You can come back to any of them later.',
  hint: 'Saved changes show on your website preview the next time it loads.',
  complete: 'Complete',
  notSetUp: 'Not set up',
  progress: (done: number, total: number) => `${done} of ${total} sections complete`,
  save: 'Save changes',
  saving: 'Saving…',
  discard: 'Discard',
  saved: 'Changes saved.',
  unsaved: 'You have unsaved changes.',
  saveFailed: 'Some changes could not be saved. Check the highlighted sections and try again.',
  readOnly: 'These details are managed from your KERSIVO dashboard now.',
  loading: 'Loading…',
  loadFailed: {
    business: 'We could not load your business details.',
    hours: 'We could not load your opening hours.',
  },
  retry: 'Try again',
  hoursSaved: 'Opening hours saved.',
  sections: {
    business: { title: 'Business details', description: 'The details customers see on your website.' },
    hours: { title: 'Opening hours', description: 'When customers can visit and book.' },
    text: { title: 'Website text', description: 'About your shop, your Instagram and anything else for your website.' },
    files: { title: 'Photos, logo and files', description: 'Images and files for your website.' },
  },
} as const;

// ---------------------------------------------------------------------------
// Business details
// ---------------------------------------------------------------------------

/** Form order. shopName / townCity live on the draft ShopSettings row; the rest on ShopPublicProfile. */
export const BUSINESS_FIELDS = [
  'shopName',
  'townCity',
  'addressLine1',
  'addressLine2',
  'postcode',
  'phone',
  'email',
] as const;
export type BusinessField = (typeof BUSINESS_FIELDS)[number];
export type BusinessDraft = Record<BusinessField, string>;

export const BUSINESS_FIELD_SPEC: Record<
  BusinessField,
  {
    label: string;
    maxLength: number;
    type?: 'text' | 'email' | 'tel';
    autoComplete: string;
    inputMode?: 'text' | 'email' | 'tel';
    required?: boolean;
  }
> = {
  shopName: { label: 'Barbershop name', maxLength: 120, autoComplete: 'organization', required: true },
  townCity: { label: 'Town or city (optional)', maxLength: 120, autoComplete: 'address-level2' },
  addressLine1: { label: 'Address line 1', maxLength: 200, autoComplete: 'address-line1' },
  addressLine2: { label: 'Address line 2 (optional)', maxLength: 200, autoComplete: 'address-line2' },
  postcode: { label: 'Postcode', maxLength: 16, autoComplete: 'postal-code' },
  phone: { label: 'Phone', maxLength: 40, type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  email: { label: 'Email', maxLength: 320, type: 'email', inputMode: 'email', autoComplete: 'email' },
};

export function emptyBusinessDraft(): BusinessDraft {
  return { shopName: '', townCity: '', addressLine1: '', addressLine2: '', postcode: '', phone: '', email: '' };
}

/** GET /api/admin-hub/profile → form values (missing / null → ''). */
export function businessDraftFromApi(profile: Partial<Record<string, string | null>> | null | undefined): BusinessDraft {
  const draft = emptyBusinessDraft();
  for (const field of BUSINESS_FIELDS) draft[field] = profile?.[field] ?? '';
  return draft;
}

/** Complete once the shop has a name, customers can find it (street line or postcode) and reach it (phone or email). */
export function businessComplete(saved: BusinessDraft): boolean {
  const hasName = Boolean(saved.shopName.trim());
  const hasAddress = Boolean(saved.addressLine1.trim() || saved.postcode.trim());
  const hasContact = Boolean(saved.phone.trim() || saved.email.trim());
  return hasName && hasAddress && hasContact;
}

export function businessDirty(saved: BusinessDraft, draft: BusinessDraft): boolean {
  return BUSINESS_FIELDS.some((field) => saved[field].trim() !== draft[field].trim());
}

/**
 * Changed fields only for PATCH /api/admin-hub/profile. Cleared optional fields are sent as null (the API
 * treats null as "clear"); the barbershop name is required and is never sent empty.
 */
export function businessPatch(saved: BusinessDraft, draft: BusinessDraft): Partial<Record<BusinessField, string | null>> {
  const patch: Partial<Record<BusinessField, string | null>> = {};
  for (const field of BUSINESS_FIELDS) {
    const next = draft[field].trim();
    if (saved[field].trim() === next) continue;
    if (field === 'shopName' && !next) continue;
    patch[field] = next || null;
  }
  return patch;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inline field errors before anything is sent (the endpoint validates again). */
export function businessFieldErrors(draft: BusinessDraft): Partial<Record<BusinessField, string>> {
  const errors: Partial<Record<BusinessField, string>> = {};
  if (!draft.shopName.trim()) errors.shopName = 'Enter your barbershop name.';
  const email = draft.email.trim();
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter an email address like name@example.co.uk.';
  return errors;
}

// ---------------------------------------------------------------------------
// Website text (saved on the hub request through /api/admin-hub/details)
// ---------------------------------------------------------------------------

export const TEXT_FIELDS = ['aboutText', 'instagramUrl', 'websiteExtraText'] as const;
export type TextDraft = Record<(typeof TEXT_FIELDS)[number], string>;

export function textDraftFromDetails(details: object | null | undefined): TextDraft {
  const source = (details ?? {}) as Record<string, unknown>;
  const read = (key: string) => (typeof source[key] === 'string' ? (source[key] as string) : '');
  return { aboutText: read('aboutText'), instagramUrl: read('instagramUrl'), websiteExtraText: read('websiteExtraText') };
}

export function textDirty(saved: TextDraft, draft: TextDraft): boolean {
  return TEXT_FIELDS.some((field) => saved[field].trim() !== draft[field].trim());
}

/** Changed fields only for PATCH /api/admin-hub/details, null when cleared. */
export function textPatch(saved: TextDraft, draft: TextDraft): Partial<Record<keyof TextDraft, string | null>> {
  const patch: Partial<Record<keyof TextDraft, string | null>> = {};
  for (const field of TEXT_FIELDS) {
    const next = draft[field].trim();
    if (saved[field].trim() !== next) patch[field] = next || null;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export type SetupSavedState = {
  /** Null while the section is loading or failed to load (counts as not complete). */
  business: BusinessDraft | null;
  hoursSaved: boolean;
};

export function setupSectionStatus(saved: SetupSavedState): Record<SetupSectionId, boolean> {
  return {
    business: saved.business ? businessComplete(saved.business) : false,
    hours: saved.hoursSaved,
  };
}

export function setupCompletion(saved: SetupSavedState): { done: number; total: number; label: string } {
  const status = setupSectionStatus(saved);
  const done = SETUP_SECTION_IDS.filter((id) => status[id]).length;
  const total = SETUP_SECTION_IDS.length;
  return { done, total, label: SETUP_COPY.progress(done, total) };
}

export type { OpeningDay };
