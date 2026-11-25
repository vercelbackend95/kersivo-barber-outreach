import { BARBER_COST_CALCULATOR_PAGE_PATH } from './barberCostCalculatorPage';
import { CANCELLATION_POLICY_PAGE_PATH } from './cancellationPolicyTemplatePage';
import { BOOKSY_ALTERNATIVE_PAGE_PATH } from './booksyAlternativeFaq';
import { FRESHA_ALTERNATIVE_PAGE_PATH } from './freshaAlternativeFaq';
import { VAGARO_ALTERNATIVE_PAGE_PATH } from './vagaroAlternativeFaq';
import { SQUARE_ALTERNATIVE_PAGE_PATH } from './squareAlternativeFaq';
import { TREATWELL_ALTERNATIVE_PAGE_PATH } from './treatwellAlternativeFaq';
import { NEARCUT_ALTERNATIVE_PAGE_PATH } from './nearcutAlternativeFaq';
import { TIMELY_ALTERNATIVE_PAGE_PATH } from './timelyAlternativeFaq';
import { PHOREST_ALTERNATIVE_PAGE_PATH } from './phorestAlternativeFaq';
import { SQUIRE_ALTERNATIVE_PAGE_PATH } from './squireAlternativeFaq';
import { SETORA_ALTERNATIVE_PAGE_PATH } from './setoraAlternativeFaq';
import { ABOUT_PAGE_PATH } from './aboutPage';
import { BOOKSY_VS_FRESHA_PAGE_PATH } from './booksyVsFresha';
import { KVB_PAGE_PATH } from './kersivoVsBooksyExperience';
import { FEES_REPORT_PAGE_PATH } from './feesReport';
import { PRICE_LIST_PAGE_PATH } from './priceListTemplatePage';
import { ALTERNATIVES_HUB_PAGE_PATH } from './alternativesHubSeo';
import { buildAbsoluteUrl } from './meta';
import { NO_SHOW_CALCULATOR_PAGE_PATH } from './noShowCalculatorPage';
import { CHAIR_RENT_CALCULATOR_PAGE_PATH } from './chairRentCalculatorPage';
import { PRICE_CALCULATOR_PAGE_PATH } from './priceCalculatorPage';
import { FREE_TOOLS_PAGE_PATH } from './freeToolsPage';
import { RETAIL_PICKUP_PAGE_PATH } from './retailPickupPage';
import { buildInsightsSitemapEntries } from './insights';
import { getStaticPageLastModified } from './pageDates';
import { PRICING_PAGE_PATH } from './pricingPage';
import { STARTER_PAGE_PATH } from './starterPage';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE, BARBERSHOP_WEBSITES_PAGE_PATH } from './barbershopWebsitesPage';
import { PUBLISHED_CITY_PAGES, getCityPagePath } from './cityPages';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE, BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH } from './barbershopWebsiteDesignPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE, BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from './barbershopOnlineBookingPage';
import { FREE_PREVIEW_PAGE_PATH, isFreePreviewFlowEnabled } from '@/lib/freePreview/config';

/**
 * Marketing-domain sitemap for kersivo.co.uk only.
 * Do not query the product table here — owner/tenant product URLs belong on
 * future per-shop sitemaps (shopId + customer domain), not the marketing domain.
 *
 * Every URL carries lastmod = the date its content last changed:
 * - static pages: src/lib/seo/pageDates.ts (visible "Last updated" constants or a maintained date)
 * - Insights: updatedDate ?? publishedDate; hub and archives use their newest article.
 * Never derive lastmod from deploy/build/current/file times.
 * noindex routes (/demo*, /book, /admin*, /seo-growth) are never listed.
 */
export type MarketingSitemapEntry = {
  path: string;
  /** ISO date (YYYY-MM-DD). */
  lastmod: string;
};

const staticPage = (path: string): MarketingSitemapEntry => ({ path, lastmod: getStaticPageLastModified(path) });

export const MARKETING_SITEMAP_ENTRIES: readonly MarketingSitemapEntry[] = [
  /** KERSIVO Insights hub + owner-approved published articles only. */
  ...buildInsightsSitemapEntries(),
  staticPage('/'),
  staticPage(PRICING_PAGE_PATH),
  /** KERSIVO Starter product-led acquisition page. */
  staticPage(STARTER_PAGE_PATH),
  /** Published Websites pillar and supporting guides. */
  ...(BARBERSHOP_WEBSITES_PAGE_INDEXABLE ? [staticPage(BARBERSHOP_WEBSITES_PAGE_PATH)] : []),
  /** City pages under the pillar (/barbershop-websites/{city}), one per published city research file. */
  ...(BARBERSHOP_WEBSITES_PAGE_INDEXABLE
    ? PUBLISHED_CITY_PAGES.map((city) => staticPage(getCityPagePath(city))) : []),
  ...(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE
    ? [staticPage(BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH)] : []),
  ...(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE
    ? [staticPage(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)] : []),
  /** Retail pickup (click and collect) feature explainer. */
  staticPage(RETAIL_PICKUP_PAGE_PATH),
  staticPage(ABOUT_PAGE_PATH),
  /** /free-preview 404s while FREE_PREVIEW_FLOW_ENABLED is off; the sitemap follows the flag at build time. */
  ...(isFreePreviewFlowEnabled() ? [staticPage(FREE_PREVIEW_PAGE_PATH)] : []),
  /** Alternatives Hub. */
  staticPage(ALTERNATIVES_HUB_PAGE_PATH),
  staticPage(BOOKSY_ALTERNATIVE_PAGE_PATH),
  staticPage(FRESHA_ALTERNATIVE_PAGE_PATH),
  staticPage(VAGARO_ALTERNATIVE_PAGE_PATH),
  staticPage(SQUARE_ALTERNATIVE_PAGE_PATH),
  staticPage(NEARCUT_ALTERNATIVE_PAGE_PATH),
  staticPage(TIMELY_ALTERNATIVE_PAGE_PATH),
  staticPage(TREATWELL_ALTERNATIVE_PAGE_PATH),
  staticPage(PHOREST_ALTERNATIVE_PAGE_PATH),
  staticPage(SQUIRE_ALTERNATIVE_PAGE_PATH),
  staticPage(SETORA_ALTERNATIVE_PAGE_PATH),
  staticPage(BARBER_COST_CALCULATOR_PAGE_PATH),
  staticPage(FEES_REPORT_PAGE_PATH),
  staticPage(BOOKSY_VS_FRESHA_PAGE_PATH),
  staticPage(KVB_PAGE_PATH),
  staticPage(CANCELLATION_POLICY_PAGE_PATH),
  staticPage(PRICE_LIST_PAGE_PATH),
  staticPage(NO_SHOW_CALCULATOR_PAGE_PATH),
  staticPage(CHAIR_RENT_CALCULATOR_PAGE_PATH),
  staticPage(PRICE_CALCULATOR_PAGE_PATH),
  staticPage(FREE_TOOLS_PAGE_PATH),
  staticPage('/privacy'),
  staticPage('/cookies'),
  staticPage('/dpa'),
  staticPage('/terms'),
] as const;

export const SITEMAP_CONTENT_TYPE = 'application/xml; charset=utf-8';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildMarketingSitemapEntries(): Array<{ loc: string; lastmod?: string }> {
  return MARKETING_SITEMAP_ENTRIES.map((entry) => ({
    loc: buildAbsoluteUrl(entry.path),
    lastmod: entry.lastmod,
  }));
}

export function toSitemapXml(
  entries: Array<{ loc: string; lastmod?: string }> = buildMarketingSitemapEntries(),
): string {
  const urlNodes = entries
    .map((entry) => {
      const lastmodLine = entry.lastmod
        ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
        : '';
      return `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${lastmodLine}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>
`;
}

export function buildMarketingSitemapXml(): string {
  return toSitemapXml(buildMarketingSitemapEntries());
}
