/**
 * Canonical Data Processing Agreement version (ISO date = "Last updated" on /dpa).
 *
 * DPA version is independent of Terms version. Because the DPA is incorporated
 * into the Terms by reference, a MATERIAL DPA update should also bump
 * CURRENT_TERMS_VERSION so new contractual acceptances record the updated
 * Terms package. Existing Clients must be handled through the applicable
 * contractual change / notice process; this version constant does not itself
 * force re-acceptance.
 */
export const CURRENT_DPA_VERSION = '2026-09-21';

/** Human-readable "Last updated" line for /dpa. */
export function formatDpaLastUpdated(version: string = CURRENT_DPA_VERSION): string {
  const d = new Date(`${version}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return version;

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}