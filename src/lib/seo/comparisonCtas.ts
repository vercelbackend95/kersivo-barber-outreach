/**
 * Shared CTA copy for the comparison engine: /compare, the cost calculator and the
 * *-alternative pages. Full KERSIVO leads; Starter is a secondary text link.
 */

export const COMPARISON_HERO_PRIMARY_LABEL = 'See Full KERSIVO pricing';
export const COMPARISON_HERO_PRIMARY_HREF = '/pricing#plan';
export const COMPARISON_HERO_SECONDARY_LABEL = 'See it working';
export const COMPARISON_HERO_SECONDARY_HREF = '/demo';

export const COMPARISON_FINAL_CTA_HEADING = 'Move bookings onto your own website';
export const COMPARISON_FINAL_CTA_STARTER_LABEL =
  'Only need bookings for up to 4 barbers? Start on Starter (£0/month) →';

export function comparisonFinalCtaSwitchLabel(competitor: string): string {
  return `Ask us about switching from ${competitor} →`;
}
