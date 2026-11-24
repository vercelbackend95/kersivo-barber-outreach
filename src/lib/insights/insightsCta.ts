/**
 * Compact free preview / Starter CTA shown in the middle and at the end of owner-facing Insights articles.
 * Off-buyer articles (written for employed barbers or the general public) never get it: see
 * INSIGHTS_CTA_EXCLUDED_SLUGS and the Batch 5 commercial link budget in insightsLinking.
 */
import { offer } from '@/content/offer';
import { FREE_PREVIEW_PAGE_PATH, PREVIEW_TURNAROUND_TEXT } from '@/lib/freePreview/config';
import { FREE_PREVIEW_CTA_TRACK } from '@/lib/freePreview/fullPlanCta';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { PRICING_PAGE_PATH } from '@/lib/seo/pricingPage';
import { STARTER_PAGE_PATH } from '@/lib/seo/starterPage';

/** Off-buyer articles: no product CTA (founder decision, 24 Nov 2026). */
export const INSIGHTS_CTA_EXCLUDED_SLUGS: readonly string[] = [
  'making-tax-digital-barbers',
  'unfair-dismissal-six-months-barbershop-employers',
  'apprentice-barber-funding-costs-2026',
  'barbershop-business-rates-2026-england',
  'barber-commission-pay-minimum-wage-uk',
  'barber-dermatitis-skin-care-hse',
  'barbershop-gift-vouchers-uk',
];

export function hasInsightsCta(slug: string): boolean {
  return !INSIGHTS_CTA_EXCLUDED_SLUGS.includes(slug);
}

export type InsightsCtaPlacement = 'mid' | 'end';

export type InsightsCtaLink = { href: string; label: string; track: string };

export type InsightsCta = {
  placement: InsightsCtaPlacement;
  kicker: string;
  heading: string;
  body: string;
  primary: InsightsCtaLink;
  /** End placement only: the £0 Starter route as a lower-commitment text link. */
  secondary?: InsightsCtaLink;
};

const STARTER_LINK: InsightsCtaLink = {
  href: STARTER_PAGE_PATH,
  label: 'Or start on KERSIVO Starter: £0/month, up to 4 bookable barbers',
  track: FUNNEL_EVENTS.starter_plan_explore_click,
};

export function getInsightsCta(placement: InsightsCtaPlacement, freePreviewEnabled: boolean): InsightsCta {
  const primary: InsightsCtaLink = freePreviewEnabled
    ? { href: FREE_PREVIEW_PAGE_PATH, label: offer.cta.primary, track: FREE_PREVIEW_CTA_TRACK }
    : { href: PRICING_PAGE_PATH, label: `See Full KERSIVO: £${SAAS_MONTHLY_GBP}/month`, track: FUNNEL_EVENTS.plan_my_setup_click };

  const body = freePreviewEnabled
    ? `We build a free preview of your shop's own website with online booking, ${PREVIEW_TURNAROUND_TEXT}. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location if you go ahead.`
    : `Full KERSIVO gives your shop its own website with online booking for £${SAAS_MONTHLY_GBP}/month per location.`;

  if (placement === 'mid') {
    return {
      placement,
      kicker: freePreviewEnabled ? 'Free website preview' : 'Full KERSIVO',
      heading: 'See your own barbershop website first',
      body,
      primary,
    };
  }

  return {
    placement,
    kicker: freePreviewEnabled ? 'Free website preview' : 'Full KERSIVO',
    heading: 'Put this into practice in your own shop',
    body,
    primary,
    secondary: STARTER_LINK,
  };
}

/**
 * Splits rendered article HTML before the middle body <h2> (References/Sources excluded).
 * Returns undefined when there are fewer than two body sections to sit between.
 */
export function splitInsightsBodyAtMiddle(html: string): { before: string; after: string } | undefined {
  const refsAt = html.search(/<h2[^>]*>\s*(?:References|Sources)\b/);
  const body = refsAt >= 0 ? html.slice(0, refsAt) : html;
  const headings = [...body.matchAll(/<h2[\s>]/g)].map((match) => match.index!);
  if (headings.length < 2) return undefined;
  const splitAt = headings[Math.floor(headings.length / 2)];
  return { before: html.slice(0, splitAt), after: html.slice(splitAt) };
}

/** Index where References/Sources (and the rule just above them) start, or -1. */
export function findInsightsReferencesStart(html: string): number {
  const refsAt = html.search(/<h2[^>]*>\s*(?:References|Sources)\b/);
  if (refsAt < 0) return -1;
  const hrAt = html.slice(0, refsAt).search(/<hr\s*\/?>\s*$/);
  return hrAt >= 0 ? hrAt : refsAt;
}
