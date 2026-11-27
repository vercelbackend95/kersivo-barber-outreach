import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { COOKIE_POLICY_LAST_UPDATED_ISO, PRIVACY_POLICY_LAST_UPDATED_ISO } from '@/lib/legal/legalPageDates';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { ABOUT_PAGE_LAST_UPDATED_ISO, ABOUT_PAGE_PATH } from './aboutPage';
import { EDITORIAL_STANDARDS_LAST_UPDATED_ISO, EDITORIAL_STANDARDS_PATH } from '@/lib/insights/editorialStandards';
import { ALTERNATIVES_HUB_LAST_UPDATED_ISO, ALTERNATIVES_HUB_PAGE_PATH } from './alternativesHubSeo';
import { BARBER_COST_CALCULATOR_LAST_UPDATED_ISO, BARBER_COST_CALCULATOR_PAGE_PATH } from './barberCostCalculatorPage';
import { BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO, BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from './barbershopOnlineBookingPage';
import {
  CANCELLATION_POLICY_LAST_UPDATED_ISO,
  CANCELLATION_POLICY_PAGE_PATH,
} from './cancellationPolicyTemplatePage';
import { NO_SHOW_CALCULATOR_LAST_UPDATED_ISO, NO_SHOW_CALCULATOR_PAGE_PATH } from './noShowCalculatorPage';
import { CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO, CHAIR_RENT_CALCULATOR_PAGE_PATH } from './chairRentCalculatorPage';
import { BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO, BARBER_TAX_CALCULATOR_PAGE_PATH } from './barberTaxCalculatorPage';
import { PRICE_CALCULATOR_LAST_UPDATED_ISO, PRICE_CALCULATOR_PAGE_PATH } from './priceCalculatorPage';
import { RETAIL_PICKUP_LAST_UPDATED_ISO, RETAIL_PICKUP_PAGE_PATH } from './retailPickupPage';
import { FREE_TOOLS_LAST_UPDATED_ISO, FREE_TOOLS_PAGE_PATH } from './freeToolsPage';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH } from './barbershopWebsiteDesignPage';
import { BARBERSHOP_WEBSITES_PAGE_PATH } from './barbershopWebsitesPage';
import { PUBLISHED_CITY_PAGES, getCityPagePath } from './cityPages';
import { BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO, BOOKSY_ALTERNATIVE_PAGE_PATH } from './booksyAlternativeFaq';
import { HOMEPAGE_LAST_UPDATED_ISO } from './defaults';
import { FRESHA_ALTERNATIVE_LAST_UPDATED_ISO, FRESHA_ALTERNATIVE_PAGE_PATH } from './freshaAlternativeFaq';
import { FREE_PREVIEW_PAGE_LAST_UPDATED_ISO } from './freePreviewPage';
import { FREE_PREVIEW_PAGE_PATH } from '@/lib/freePreview/config';
import { NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO, NEARCUT_ALTERNATIVE_PAGE_PATH } from './nearcutAlternativeFaq';
import { PHOREST_ALTERNATIVE_LAST_UPDATED_ISO, PHOREST_ALTERNATIVE_PAGE_PATH } from './phorestAlternativeFaq';
import { PRICING_PAGE_CONTENT_MODIFIED_ISO, PRICING_PAGE_PATH } from './pricingPage';
import { SETORA_ALTERNATIVE_LAST_UPDATED_ISO, SETORA_ALTERNATIVE_PAGE_PATH } from './setoraAlternativeFaq';
import { SQUARE_ALTERNATIVE_LAST_UPDATED_ISO, SQUARE_ALTERNATIVE_PAGE_PATH } from './squareAlternativeFaq';
import { SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO, SQUIRE_ALTERNATIVE_PAGE_PATH } from './squireAlternativeFaq';
import { STARTER_PAGE_LAST_UPDATED_ISO, STARTER_PAGE_PATH } from './starterPage';
import { TIMELY_ALTERNATIVE_LAST_UPDATED_ISO, TIMELY_ALTERNATIVE_PAGE_PATH } from './timelyAlternativeFaq';
import { TREATWELL_ALTERNATIVE_LAST_UPDATED_ISO, TREATWELL_ALTERNATIVE_PAGE_PATH } from './treatwellAlternativeFaq';
import { BOOKSY_VS_FRESHA_LAST_UPDATED_ISO, BOOKSY_VS_FRESHA_PAGE_PATH } from './booksyVsFresha';
import { KVB_LAST_UPDATED_ISO, KVB_PAGE_PATH } from './kersivoVsBooksyExperience';
import { KAR_LAST_UPDATED_ISO, KAR_PAGE_PATH } from './adminReportsExperience';
import { PRICE_LIST_LAST_UPDATED_ISO, PRICE_LIST_PAGE_PATH } from './priceListTemplatePage';
import { FEES_REPORT_LAST_UPDATED_ISO, FEES_REPORT_PAGE_PATH } from './feesReport';
import { VAGARO_ALTERNATIVE_LAST_UPDATED_ISO, VAGARO_ALTERNATIVE_PAGE_PATH } from './vagaroAlternativeFaq';

/**
 * Content last-modified dates (YYYY-MM-DD) for static marketing pages — the single lookup
 * for sitemap <lastmod>. Pages with a visible "Last updated" line keep that constant as the
 * source; pages without one are dated here. Update a date only when the page's content
 * meaningfully changes. Never derive it from build, deploy or file-system times.
 * Insights articles/archives are dated from the Insights registry (updatedDate ?? publishedDate).
 */
/**
 * Seeded from `git log -1 --format=%cs -- <page source>` on 28 October 2026, then updated by hand
 * when a page was rebuilt: /barbershop-websites on 13 Nov 2026 (city guide cards added 24 Nov 2026, city
 * guide links in the check-up 26 Nov 2026), /barbershop-website-design on 14 Nov 2026, 25 Nov 2026 and
 * 26 Nov 2026 (free-preview title and description, local guides under the FAQ; audit P2).
 */
export const BARBERSHOP_WEBSITES_LAST_MODIFIED_ISO = '2026-11-26';
export const BARBERSHOP_WEBSITE_DESIGN_LAST_MODIFIED_ISO = '2026-11-26';
/** /barbershop-online-booking dates itself (rebuilt 25 Nov 2026); re-exported for the sitemap. */
export { BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO };

export const STATIC_PAGE_LAST_MODIFIED: Readonly<Record<string, string>> = {
  /** Same constant as the homepage WebPage dateModified. */
  '/': HOMEPAGE_LAST_UPDATED_ISO,
  [PRICING_PAGE_PATH]: PRICING_PAGE_CONTENT_MODIFIED_ISO,
  [STARTER_PAGE_PATH]: STARTER_PAGE_LAST_UPDATED_ISO,
  [BARBERSHOP_WEBSITES_PAGE_PATH]: BARBERSHOP_WEBSITES_LAST_MODIFIED_ISO,
  [BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH]: BARBERSHOP_WEBSITE_DESIGN_LAST_MODIFIED_ISO,
  [BARBERSHOP_ONLINE_BOOKING_PAGE_PATH]: BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO,
  /** City pages (/barbershop-websites/{city}) are dated by their research check date. */
  ...Object.fromEntries(PUBLISHED_CITY_PAGES.map((city) => [getCityPagePath(city), city.checkedIso])),
  [ABOUT_PAGE_PATH]: ABOUT_PAGE_LAST_UPDATED_ISO,
  [EDITORIAL_STANDARDS_PATH]: EDITORIAL_STANDARDS_LAST_UPDATED_ISO,
  [ALTERNATIVES_HUB_PAGE_PATH]: ALTERNATIVES_HUB_LAST_UPDATED_ISO,
  [BOOKSY_ALTERNATIVE_PAGE_PATH]: BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO,
  [FRESHA_ALTERNATIVE_PAGE_PATH]: FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
  [VAGARO_ALTERNATIVE_PAGE_PATH]: VAGARO_ALTERNATIVE_LAST_UPDATED_ISO,
  [SQUARE_ALTERNATIVE_PAGE_PATH]: SQUARE_ALTERNATIVE_LAST_UPDATED_ISO,
  [NEARCUT_ALTERNATIVE_PAGE_PATH]: NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO,
  [TIMELY_ALTERNATIVE_PAGE_PATH]: TIMELY_ALTERNATIVE_LAST_UPDATED_ISO,
  [TREATWELL_ALTERNATIVE_PAGE_PATH]: TREATWELL_ALTERNATIVE_LAST_UPDATED_ISO,
  [PHOREST_ALTERNATIVE_PAGE_PATH]: PHOREST_ALTERNATIVE_LAST_UPDATED_ISO,
  [SQUIRE_ALTERNATIVE_PAGE_PATH]: SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO,
  [SETORA_ALTERNATIVE_PAGE_PATH]: SETORA_ALTERNATIVE_LAST_UPDATED_ISO,
  [BARBER_COST_CALCULATOR_PAGE_PATH]: BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
  [FEES_REPORT_PAGE_PATH]: FEES_REPORT_LAST_UPDATED_ISO,
  [BOOKSY_VS_FRESHA_PAGE_PATH]: BOOKSY_VS_FRESHA_LAST_UPDATED_ISO,
  [KVB_PAGE_PATH]: KVB_LAST_UPDATED_ISO,
  [KAR_PAGE_PATH]: KAR_LAST_UPDATED_ISO,
  [CANCELLATION_POLICY_PAGE_PATH]: CANCELLATION_POLICY_LAST_UPDATED_ISO,
  [PRICE_LIST_PAGE_PATH]: PRICE_LIST_LAST_UPDATED_ISO,
  [NO_SHOW_CALCULATOR_PAGE_PATH]: NO_SHOW_CALCULATOR_LAST_UPDATED_ISO,
  [CHAIR_RENT_CALCULATOR_PAGE_PATH]: CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO,
  [PRICE_CALCULATOR_PAGE_PATH]: PRICE_CALCULATOR_LAST_UPDATED_ISO,
  [BARBER_TAX_CALCULATOR_PAGE_PATH]: BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO,
  [RETAIL_PICKUP_PAGE_PATH]: RETAIL_PICKUP_LAST_UPDATED_ISO,
  [FREE_TOOLS_PAGE_PATH]: FREE_TOOLS_LAST_UPDATED_ISO,
  [FREE_PREVIEW_PAGE_PATH]: FREE_PREVIEW_PAGE_LAST_UPDATED_ISO,
  '/privacy': PRIVACY_POLICY_LAST_UPDATED_ISO,
  '/cookies': COOKIE_POLICY_LAST_UPDATED_ISO,
  /** Canonical DPA / Terms versions are their "Last updated" dates. */
  '/dpa': CURRENT_DPA_VERSION,
  '/terms': CURRENT_TERMS_VERSION,
};

/**
 * Content added without moving the page's visible "Last updated" / "Updated" date (and the WebPage
 * dateModified that mirrors it): an "In short" answer, an FAQ or a section, while the prices, facts and
 * claims stayed the same — the same rule as Insights articles in GEO/AEO stage 1. The sitemap <lastmod>,
 * and so IndexNow, must still see the change, so they use the later of the two dates.
 * Add a line in the same PR as the content change, dated the day it ships.
 */
export const CONTENT_CHANGED_ISO: Readonly<Record<string, string>> = {
  [STARTER_PAGE_PATH]: '2026-11-26', // FAQ: booking reminders (GEO/AEO stage 2)
  [ALTERNATIVES_HUB_PAGE_PATH]: '2026-11-26', // deposits table (15 Nov), FAQ: customer app (GEO/AEO stage 2)
  [FEES_REPORT_PAGE_PATH]: '2026-11-26', // "For writers and press" card and CSV download (GEO/AEO stage 3)
  // "In short" answer (14 Nov); new title and a description with "Stripe fees apply" (26 Nov, audit P1).
  [VAGARO_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [NEARCUT_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [PHOREST_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [SQUIRE_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  // Title hook now names "0% KERSIVO Commission" instead of a zero-fees claim (26 Nov, audit P1).
  [BARBERSHOP_ONLINE_BOOKING_PAGE_PATH]: '2026-11-26',
  [RETAIL_PICKUP_PAGE_PATH]: '2026-11-26',
  // Comparative title and description with a price hook from the facts modules (26 Nov, audit P2-3);
  // Square and Setora also gained an "In short" answer on 14 Nov.
  [BOOKSY_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [FRESHA_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [TREATWELL_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [TIMELY_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [SQUARE_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  [SETORA_ALTERNATIVE_PAGE_PATH]: '2026-11-26',
  // Title within 60 characters, led by the problem the reports answer (26 Nov, audit P2-6).
  [KAR_PAGE_PATH]: '2026-11-26',
  // Each city's own title and description from its research (26 Nov, audit P2-4); the visible research date stays.
  ...Object.fromEntries(PUBLISHED_CITY_PAGES.map((city) => [getCityPagePath(city), '2026-11-26'])),
};

export function getStaticPageLastModified(path: string): string {
  const date = STATIC_PAGE_LAST_MODIFIED[path];
  if (!date) throw new Error(`No lastModified date for static page ${path} (add it to src/lib/seo/pageDates.ts)`);
  const contentChanged = CONTENT_CHANGED_ISO[path];
  return contentChanged && contentChanged > date ? contentChanged : date;
}
