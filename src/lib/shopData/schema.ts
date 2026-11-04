/**
 * The ONE validation schema for a shop's business data (docs/site-data-contract.md).
 *
 * Used by the paid dashboard routes, the Starter/preview hub, the launch wizard and the public
 * site loader. Field-level rules live here so every write path agrees on what is valid:
 * - times are "HH:mm" (24-hour), closing strictly after opening;
 * - prices are integer pence, never negative;
 * - names are required and trimmed;
 * - UK postcodes are checked leniently (format only, any spacing/case).
 *
 * Browser-safe: no Prisma or server imports.
 */
import { z } from 'zod';

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes from midnight for an "HH:mm" string (assumes it already passed HHMM_RE). */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True when both are valid "HH:mm" and closes is strictly after opens (no overnight periods). */
export function isValidOpeningPeriod(opens: string, closes: string): boolean {
  return HHMM_RE.test(opens) && HHMM_RE.test(closes) && hhmmToMinutes(closes) > hhmmToMinutes(opens);
}

export const hhmmSchema = z.string().regex(HHMM_RE, 'Use a 24-hour time, e.g. 09:00.');

/** ISO weekday: 1 = Monday … 7 = Sunday (matches ShopOpeningHours.dayOfWeek). */
export const isoWeekdaySchema = z.number().int().min(1).max(7);

// ---------------------------------------------------------------------------
// Opening hours
// ---------------------------------------------------------------------------

/** One opening period. A day may later hold several (lunch breaks); today the UI uses one. */
export const openingPeriodSchema = z
  .object({ opens: hhmmSchema, closes: hhmmSchema })
  .refine((p) => isValidOpeningPeriod(p.opens, p.closes), {
    message: 'Closing time must be after opening time.',
  });

/** Canonical day shape (contract): isOpen + opens/closes. */
export const openingHoursDaySchema = z
  .object({
    dayOfWeek: isoWeekdaySchema,
    isOpen: z.boolean(),
    opens: hhmmSchema,
    closes: hhmmSchema,
  })
  .refine((d) => !d.isOpen || isValidOpeningPeriod(d.opens, d.closes), {
    message: 'Closing time must be after opening time.',
  });

export const openingHoursWeekSchema = z
  .array(openingHoursDaySchema)
  .length(7, 'Send all seven days, Monday to Sunday.')
  .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === 7, {
    message: 'Send each day of the week once.',
  });

/**
 * Legacy row shape used by the dashboard and onboarding hours routes
 * ({ dayOfWeek, active, startTime, endTime }). Kept so those APIs stay backward-compatible.
 */
export const legacyHoursRowSchema = z.object({
  dayOfWeek: isoWeekdaySchema,
  active: z.boolean(),
  startTime: z.string().regex(HHMM_RE),
  endTime: z.string().regex(HHMM_RE),
});

export const legacyHoursPayloadSchema = z.object({
  rules: z.array(legacyHoursRowSchema).length(7),
});

export type LegacyHoursRow = z.infer<typeof legacyHoursRowSchema>;

/**
 * Cross-row rules for a weekly schedule. Returns a user-facing message or null.
 * `emptyMessage` keeps each screen's existing wording.
 */
export function validateWeeklyHoursRows(
  rules: ReadonlyArray<{ dayOfWeek: number; active: boolean; startTime: string; endTime: string }>,
  options: { emptyMessage: string } = { emptyMessage: 'Open the shop on at least one day.' },
): string | null {
  let activeCount = 0;
  for (const rule of rules) {
    if (!rule.active) continue;
    activeCount += 1;
    if (!isValidOpeningPeriod(rule.startTime, rule.endTime)) {
      return `Day ${rule.dayOfWeek}: end time must be later than start time.`;
    }
  }
  if (activeCount === 0) return options.emptyMessage;
  return null;
}

/** A date-specific exception (bank holiday, closure, special hours). */
export const openingExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-25.'),
    closed: z.boolean(),
    opens: hhmmSchema.optional().nullable(),
    closes: hhmmSchema.optional().nullable(),
    label: z.string().trim().max(80).optional().nullable(),
  })
  .refine((e) => e.closed || (e.opens && e.closes && isValidOpeningPeriod(e.opens, e.closes)), {
    message: 'Closing time must be after opening time.',
  });

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const pricePenceSchema = z
  .number()
  .int('Price must be a whole number of pence.')
  .min(0, 'Price cannot be negative.');

// ---------------------------------------------------------------------------
// Team, services, products (field rules shared with the admin routes)
// ---------------------------------------------------------------------------

export const requiredNameSchema = z.string().trim().min(1, 'Name is required.').max(120);

const optionalText = (max: number) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null));

export const TEAM_TITLE_MAX = 60;
export const TEAM_BIO_MAX = 600;

export const teamMemberPublicFieldsSchema = z.object({
  title: optionalText(TEAM_TITLE_MAX),
  bio: optionalText(TEAM_BIO_MAX),
  showOnWebsite: z.boolean().optional(),
});

export const serviceFieldsSchema = z.object({
  name: requiredNameSchema,
  category: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(280).optional().nullable(),
  durationMinutes: z.number().int().min(5).max(480),
  pricePence: pricePenceSchema,
  priceFrom: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const productFieldsSchema = z.object({
  name: requiredNameSchema,
  description: z.string().trim().max(2000).optional().nullable(),
  pricePence: pricePenceSchema,
  inStock: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// Business / location details
// ---------------------------------------------------------------------------

/**
 * Lenient UK postcode check: outward code + inward code, any case, optional single space.
 * Accepts GIR 0AA. Does not check that the postcode exists.
 */
export const UK_POSTCODE_RE = /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i;

/** "sw1a1aa" → "SW1A 1AA". Returns null when the value is not a UK postcode. */
export function normaliseUkPostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  if (!UK_POSTCODE_RE.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isAllowedHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const optionalPostcode = z
  .union([z.string().max(16), z.null()])
  .optional()
  .superRefine((v, ctx) => {
    if (v === undefined || v === null || !v.trim()) return;
    if (!normaliseUkPostcode(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a UK postcode, e.g. M1 1AE.' });
    }
  })
  .transform((v) => (v === undefined ? undefined : v === null || !v.trim() ? null : normaliseUkPostcode(v)));

const optionalEmail = z
  .union([z.string().max(320), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
  .refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email address.' });

const optionalPhone = z
  .union([z.string().max(40), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
  .refine((v) => v == null || /^[+\d][\d\s()-]{6,}$/.test(v), { message: 'Enter a valid phone number.' });

const optionalUrl = z
  .union([z.string().max(2048), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
  .refine((v) => v == null || isAllowedHttpUrl(v), {
    message: 'URL must be a valid http:// or https:// address.',
  });

const optionalHex = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
  .refine((v) => v == null || /^#[0-9a-f]{6}$/i.test(v), { message: 'Colour must be #RRGGBB.' })
  .transform((v) => (v == null ? v : v.toUpperCase()));

/** Patch for ShopPublicProfile. Every field optional: undefined = leave as is, null = clear. */
export const businessProfilePatchSchema = z.object({
  tagline: optionalText(160),
  description: optionalText(10_000),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  postcode: optionalPostcode,
  phone: optionalPhone,
  email: optionalEmail,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  otherSocialUrl: optionalUrl,
  brandPrimaryColour: optionalHex,
  brandSecondaryColour: optionalHex,
});

export type BusinessProfilePatch = z.infer<typeof businessProfilePatchSchema>;

export const BUSINESS_PROFILE_FIELDS = [
  'tagline',
  'description',
  'addressLine1',
  'addressLine2',
  'postcode',
  'phone',
  'email',
  'instagramUrl',
  'facebookUrl',
  'tiktokUrl',
  'otherSocialUrl',
  'brandPrimaryColour',
  'brandSecondaryColour',
] as const satisfies ReadonlyArray<keyof BusinessProfilePatch>;
