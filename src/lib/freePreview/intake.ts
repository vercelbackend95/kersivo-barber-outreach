import { z } from 'zod';
import { CURRENT_BOOKING_SYSTEMS } from '@/lib/forms/currentBookingSystems';
import { dedupeWorkLinks, parseLinkInput, workLinksToLegacyFields } from './workLinkNormalise';
import { SMART_LINK_COPY, WORK_LINKS_MAX, WORK_LINK_VALUE_MAX, type WorkLink } from './workPlatforms';

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
export const FREE_PREVIEW_FIRST_NAME_MAX = 80;

/**
 * Shown under the submit button. Submitting is the confirmation, recorded with this version:
 * changing the wording means a new version.
 */
export const FREE_PREVIEW_AUTHORISATION_STATEMENT =
  'By sending this, you confirm you own or manage this barbershop and that KERSIVO can use the details and photos from your links to build your private preview.';
export const FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION = '2026-10-31';
export const FREE_PREVIEW_MARKETING_LABEL =
  'Send me occasional KERSIVO product news and tips. You can unsubscribe at any time.';

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

const barberCountField = z.enum(valuesOf(FREE_PREVIEW_BARBER_COUNTS), {
  errorMap: () => ({ message: 'Choose how many barbers work in your shop.' }),
});
const bookingSystemField = z.enum(valuesOf(FREE_PREVIEW_BOOKING_SYSTEMS), {
  errorMap: () => ({ message: 'Choose your current booking system.' }),
});
const ownDomainField = z.enum(valuesOf(FREE_PREVIEW_DOMAIN_OPTIONS), {
  errorMap: () => ({ message: 'Tell us whether you have your own domain.' }),
});

export const freePreviewRequestSchema = z
  .object({
    firstName: optionalText(FREE_PREVIEW_FIRST_NAME_MAX),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(254),
    shopName: z.string().trim().min(2, 'Please enter your barbershop name.').max(120),
    townCity: z.string().trim().min(2, 'Please enter your town or city.').max(120),
    /** The platform a client sends is never trusted: it is detected again from the URL. */
    links: z
      .array(
        z.object({
          url: z.string().max(WORK_LINK_VALUE_MAX, SMART_LINK_COPY.invalid),
          platform: z.string().optional(),
        }),
      )
      .max(WORK_LINKS_MAX, SMART_LINK_COPY.max)
      .optional()
      .transform((items, ctx): WorkLink[] => {
        const links: WorkLink[] = [];
        for (const item of items ?? []) {
          const link = parseLinkInput(item.url);
          if (!link) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: SMART_LINK_COPY.invalid });
            return z.NEVER;
          }
          links.push(link);
        }
        return dedupeWorkLinks(links);
      }),
    barberCount: barberCountField.optional().transform((value) => value ?? null),
    currentBookingSystem: bookingSystemField.optional().transform((value) => value ?? null),
    hasOwnDomain: ownDomainField.optional().transform((value) => value ?? null),
    notes: optionalText(FREE_PREVIEW_NOTES_MAX),
    marketingOptIn: z.boolean().optional().default(false),
    entryPoint: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim().toLowerCase() ?? '';
        return FREE_PREVIEW_ENTRY_POINT_PATTERN.test(trimmed) ? trimmed : null;
      }),
  })
  .transform(({ links, ...value }) => ({
    ...value,
    workLinks: links,
    ...workLinksToLegacyFields(links),
  }));

export type FreePreviewRequestInput = z.output<typeof freePreviewRequestSchema>;

/** Step 2 accepts these fields and nothing else. Omitted fields keep their stored value. */
export const freePreviewDetailsSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    barberCount: barberCountField.optional(),
    currentBookingSystem: bookingSystemField.optional(),
    hasOwnDomain: ownDomainField.optional(),
    firstName: z.string().trim().max(FREE_PREVIEW_FIRST_NAME_MAX).optional(),
    notes: z.string().trim().max(FREE_PREVIEW_NOTES_MAX).optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export type FreePreviewDetailsInput = z.output<typeof freePreviewDetailsSchema>;

type ParseResult<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

/** Field errors are keyed by input name (`form` for anything that isn't a field). */
function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): ParseResult<T> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}

export function parseFreePreviewRequest(body: unknown): ParseResult<FreePreviewRequestInput> {
  return parseWith(freePreviewRequestSchema, body);
}

export function parseFreePreviewDetails(body: unknown): ParseResult<FreePreviewDetailsInput> {
  return parseWith(freePreviewDetailsSchema, body);
}

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  return options.find((option) => option.value === value)?.label ?? value ?? '—';
}
