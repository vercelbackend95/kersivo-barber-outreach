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
