import { z } from 'zod';
import { CURRENT_BOOKING_SYSTEMS } from '@/lib/forms/currentBookingSystems';

/** Select options (spec §4). Values are stored; labels are shown. */
export const FREE_PREVIEW_BARBER_COUNTS = [
  { value: '1', label: '1' },
  { value: '2-3', label: '2–3' },
  { value: '4-6', label: '4–6' },
  { value: '7+', label: '7+' },
] as const;

/** Same list as the site-wide contact form (`CURRENT_BOOKING_SYSTEMS`). */
export const FREE_PREVIEW_BOOKING_SYSTEMS = CURRENT_BOOKING_SYSTEMS;

export const FREE_PREVIEW_DOMAIN_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

/** Internal CTA locations allowed in `?from=` (kept short and enumerable; no campaign attribution). */
export const FREE_PREVIEW_ENTRY_POINT_PATTERN = /^[a-z0-9-]{1,40}$/;

export const FREE_PREVIEW_NOTES_MAX = 1000;
export const FREE_PREVIEW_LINK_FIELDS = [
  'bookingPageUrl',
  'instagramUrl',
  'googleListingUrl',
  'websiteUrl',
] as const;

export const FREE_PREVIEW_AUTHORISATION_LABEL =
  "I'm the owner or manager of this barbershop, and KERSIVO can use the details and photos from the links above to create a private preview for me.";
export const FREE_PREVIEW_MARKETING_LABEL =
  'Send me occasional KERSIVO product news and tips. You can unsubscribe at any time.';
export const FREE_PREVIEW_LINKS_REQUIRED_MESSAGE =
  'Add at least one link: your booking page, Instagram, Google listing or website.';

function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((option) => option.value) as [T[number]['value'], ...T[number]['value'][]];
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

/** Accepts "instagram.com/shop" as well as full URLs; stores a normalised https URL. */
export function normaliseLinkInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) return null;
  return url.toString();
}

const linkField = z
  .string()
  .max(500, 'Links must be 500 characters or fewer.')
  .optional()
  .superRefine((value, ctx) => {
    if (value && value.trim() && !normaliseLinkInput(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid link, for example instagram.com/yourshop.' });
    }
  })
  .transform((value) => (value ? normaliseLinkInput(value) : null));

export const freePreviewRequestSchema = z
  .object({
    firstName: optionalText(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
    shopName: z.string().trim().min(2, 'Enter your barbershop name.').max(120),
    townCity: z.string().trim().min(2, 'Enter your town or city.').max(120),
    bookingPageUrl: linkField,
    instagramUrl: linkField,
    googleListingUrl: linkField,
    websiteUrl: linkField,
    barberCount: z.enum(valuesOf(FREE_PREVIEW_BARBER_COUNTS), {
      errorMap: () => ({ message: 'Choose how many barbers work in your shop.' }),
    }),
    currentBookingSystem: z.enum(valuesOf(FREE_PREVIEW_BOOKING_SYSTEMS), {
      errorMap: () => ({ message: 'Choose your current booking system.' }),
    }),
    hasOwnDomain: z.enum(valuesOf(FREE_PREVIEW_DOMAIN_OPTIONS), {
      errorMap: () => ({ message: 'Tell us whether you have your own domain.' }),
    }),
    notes: optionalText(FREE_PREVIEW_NOTES_MAX),
    authorisationConsent: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm you can request a preview for this barbershop.' }),
    }),
    marketingOptIn: z.boolean().optional().default(false),
    entryPoint: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim().toLowerCase() ?? '';
        return FREE_PREVIEW_ENTRY_POINT_PATTERN.test(trimmed) ? trimmed : null;
      }),
  })
  .superRefine((value, ctx) => {
    if (!FREE_PREVIEW_LINK_FIELDS.some((field) => value[field])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['links'],
        message: FREE_PREVIEW_LINKS_REQUIRED_MESSAGE,
      });
    }
  });

export type FreePreviewRequestInput = z.output<typeof freePreviewRequestSchema>;

export type FreePreviewParseResult =
  | { ok: true; value: FreePreviewRequestInput }
  | { ok: false; fieldErrors: Record<string, string> };

/** Validates the public form body. Field errors are keyed by input name (`links` for the group). */
export function parseFreePreviewRequest(body: unknown): FreePreviewParseResult {
  const parsed = freePreviewRequestSchema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  return options.find((option) => option.value === value)?.label ?? value ?? '—';
}
