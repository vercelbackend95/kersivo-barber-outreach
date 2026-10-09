/**
 * Source of truth for editorial update dates on the public Privacy and Cookie
 * Policies. Both the visible "Last updated" labels and marketing sitemap
 * <lastmod> entries use these same dates.
 *
 * Advance a date only when the respective document materially changes.
 */
export const PRIVACY_POLICY_LAST_UPDATED_ISO = '2026-10-06';
export const COOKIE_POLICY_LAST_UPDATED_ISO = '2026-09-25';

export function formatLegalPageDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
