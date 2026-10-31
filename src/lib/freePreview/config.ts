/**
 * Free website preview configuration (docs/free-preview-spec.md §3).
 * Copy that mentions turnaround or expiry must read from here — never hardcode it.
 */

function readEnv(name: string): string | undefined {
  const fromMeta = (import.meta.env as Record<string, string | undefined> | undefined)?.[name];
  return fromMeta ?? process.env[name];
}

/**
 * Master switch for the public free-preview flow. Off by default: with it off, /free-preview and its
 * API return 404 and every public page behaves exactly as before. SSR pages read it per request;
 * the prerendered sitemap reads it at build time.
 */
export function isFreePreviewFlowEnabled(): boolean {
  return (readEnv('FREE_PREVIEW_FLOW_ENABLED') ?? '').trim().toLowerCase() === 'true';
}

/** Founder decision (29 Oct 2026): "a few working days", never a fixed number of days. */
export const PREVIEW_TURNAROUND_TEXT = 'usually within a few working days';
export const PREVIEW_TURNAROUND_TEXT_CAPITALISED = 'Usually within a few working days';
export const PREVIEW_TURNAROUND_TEXT_SHORT = 'within a few working days';

/** Previews are built by hand: requests beyond this many per Europe/London day are told to expect longer. */
export const FREE_PREVIEW_DEFAULT_DAILY_CAP = 3;

/** Founder wording (30 Oct 2026). Shown only to requests over the daily cap, on screen and in E1. */
export const PREVIEW_OVER_CAP_MESSAGE =
  "We've received your request. Because each preview is built by hand, yours may take up to 3 working days.";

/** FREE_PREVIEW_DAILY_CAP: a whole number, 0 included. Anything else falls back to the default. */
export function getFreePreviewDailyCap(): number {
  const raw = (readEnv('FREE_PREVIEW_DAILY_CAP') ?? '').trim();
  return /^\d+$/.test(raw) ? Number(raw) : FREE_PREVIEW_DEFAULT_DAILY_CAP;
}

/** Step 2 of the public form can update a request for this long after it was sent. */
export const PREVIEW_DETAILS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** The same shop and email again within this window is a retry: no second request or emails. */
export const PREVIEW_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export const PREVIEW_EXPIRY_DAYS = 30;
export const PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY = 90;
export const PREVIEW_FOLLOWUP_DAYS_AFTER_READY = 3;
export const PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE = 7;

export function getPreviewNotifyEmail(): string {
  return (readEnv('PREVIEW_NOTIFY_EMAIL') ?? '').trim() || 'hello@kersivo.co.uk';
}

/** Reply-to on every preview email (spec §9). */
export const PREVIEW_REPLY_TO_EMAIL = 'hello@kersivo.co.uk';

export const FREE_PREVIEW_PAGE_PATH = '/free-preview';
export const OPS_PREVIEW_REQUESTS_PATH = '/ops/preview-requests';

/** Private preview page: /preview/{token}. The static /preview/onboarding and /preview/dashboard routes win. */
export const PREVIEW_PAGE_PATH_PREFIX = '/preview/';

export function previewPagePath(token: string): string {
  return `${PREVIEW_PAGE_PATH_PREFIX}${encodeURIComponent(token)}`;
}

export function previewExpiryFrom(readyAt: Date): Date {
  return new Date(readyAt.getTime() + PREVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/** Shown in E3/E4 and on the preview, e.g. "28 November 2026" (UK time). */
export function formatPreviewExpiryDate(value: Date): string {
  return value.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Shortened onboarding after a free preview purchase (spec §7). */
export const PREVIEW_ONBOARDING_PATH = '/admin/preview-launch';
