/**
 * Canonical Terms of Service version (ISO date = "Last updated" on /terms).
 * Bump this when Terms content changes in a material way.
 * Material DPA updates also require a Terms bump because /dpa is incorporated by reference.
 */
export const CURRENT_TERMS_VERSION = '2026-10-06';

/**
 * Migration-only marker for a Full -> Starter continuation that was already EFFECTIVE before
 * the v1.19 Terms package shipped. It is not a claim that the v1.19 Terms were accepted.
 * New/future post-Full Starter choices must always store CURRENT_TERMS_VERSION instead.
 */
export const LEGACY_EFFECTIVE_POST_FULL_STARTER_TERMS_VERSION =
  'LEGACY_EFFECTIVE_PRE_V119';

export function postFullStarterTermsAllowService(version: string | null | undefined): boolean {
  return (
    version === CURRENT_TERMS_VERSION ||
    version === LEGACY_EFFECTIVE_POST_FULL_STARTER_TERMS_VERSION
  );
}

export const TERMS_ACCEPTANCE_PURPOSES = {
  SAAS_CHECKOUT: 'SAAS_CHECKOUT',
  SETUP_DEPOSIT_CHECKOUT: 'SETUP_DEPOSIT_CHECKOUT',
  FREE_BOOKING_ACTIVATION: 'FREE_BOOKING_ACTIVATION',
  FULL_TO_STARTER: 'FULL_TO_STARTER',
} as const;

export type TermsAcceptancePurpose =
  (typeof TERMS_ACCEPTANCE_PURPOSES)[keyof typeof TERMS_ACCEPTANCE_PURPOSES];

/** Human-readable "Last updated" line for /terms. */
export function formatTermsLastUpdated(version: string = CURRENT_TERMS_VERSION): string {
  const d = new Date(`${version}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return version;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
