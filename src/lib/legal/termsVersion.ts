/**
 * Canonical Terms of Service version (ISO date = "Last updated" on /terms).
 * Bump this when Terms content changes in a material way.
 */
export const CURRENT_TERMS_VERSION = '2026-07-21';

export const TERMS_ACCEPTANCE_PURPOSES = {
  SAAS_CHECKOUT: 'SAAS_CHECKOUT',
  SETUP_DEPOSIT_CHECKOUT: 'SETUP_DEPOSIT_CHECKOUT',
} as const;

export type TermsAcceptancePurpose =
  (typeof TERMS_ACCEPTANCE_PURPOSES)[keyof typeof TERMS_ACCEPTANCE_PURPOSES];

/** Human-readable "Last updated" line for /terms. */
export function formatTermsLastUpdated(version: string = CURRENT_TERMS_VERSION): string {
  const d = new Date(`${version}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return version;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
