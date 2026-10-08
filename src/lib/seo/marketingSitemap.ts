import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import {
  BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
  BARBER_COST_CALCULATOR_PAGE_PATH,
} from './barberCostCalculatorPage';
import {
  BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO,
  BOOKSY_ALTERNATIVE_PAGE_PATH,
} from './booksyAlternativeFaq';
import {
  FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
  FRESHA_ALTERNATIVE_PAGE_PATH,
} from './freshaAlternativeFaq';
import { SQUARE_ALTERNATIVE_LAST_UPDATED_ISO, SQUARE_ALTERNATIVE_PAGE_PATH } from './squareAlternativeFaq';
import { NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO, NEARCUT_ALTERNATIVE_PAGE_PATH } from './nearcutAlternativeFaq';
import { TIMELY_ALTERNATIVE_LAST_UPDATED_ISO, TIMELY_ALTERNATIVE_PAGE_PATH } from './timelyAlternativeFaq';
import { SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO, SQUIRE_ALTERNATIVE_PAGE_PATH } from './squireAlternativeFaq';
import { SETORA_ALTERNATIVE_LAST_UPDATED_ISO, SETORA_ALTERNATIVE_PAGE_PATH } from './setoraAlternativeFaq';
import { ABOUT_PAGE_LAST_UPDATED_ISO, ABOUT_PAGE_PATH } from './aboutPage';
import { buildAbsoluteUrl } from './meta';
import { PRICING_PAGE_LAST_UPDATED_ISO, PRICING_PAGE_PATH } from './pricingPage';
import { STARTER_PAGE_LAST_UPDATED_ISO, STARTER_PAGE_PATH } from './starterPage';

/**
 * Marketing-domain sitemap for kersivo.co.uk only.
 * Do not query the product table here — owner/tenant product URLs belong on
 * future per-shop sitemaps (shopId + customer domain), not the marketing domain.
 *
 * lastmod is optional and must be a reliable significant-modification date
 * (editorial "Last updated" / terms version). Omit when no such date exists.
 * Never derive lastmod from deploy/build/current/file times.
 */
export type MarketingSitemapEntry = {
  path: string;
  /** ISO date (YYYY-MM-DD). Omit when no reliable significant-modification date exists. */
  lastmod?: string;
};

export const MARKETING_SITEMAP_ENTRIES: readonly MarketingSitemapEntry[] = [
  { path: '/' },
  /** Matches the visible "Last updated" date on src/pages/pricing.astro. */
  { path: PRICING_PAGE_PATH, lastmod: PRICING_PAGE_LAST_UPDATED_ISO },
  /** KERSIVO Starter product-led acquisition page. */
  { path: STARTER_PAGE_PATH, lastmod: STARTER_PAGE_LAST_UPDATED_ISO },
  /** Matches the visible "Last updated" date on src/pages/about.astro. */
  { path: ABOUT_PAGE_PATH, lastmod: ABOUT_PAGE_LAST_UPDATED_ISO },
  /** Matches the visible "Last updated" date on src/pages/booksy-alternative/index.astro. */
  { path: BOOKSY_ALTERNATIVE_PAGE_PATH, lastmod: BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Matches the visible "Last updated" date on src/pages/fresha-alternative/index.astro. */
  { path: FRESHA_ALTERNATIVE_PAGE_PATH, lastmod: FRESHA_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Square Appointments alternative editorial last updated date. */
  { path: SQUARE_ALTERNATIVE_PAGE_PATH, lastmod: SQUARE_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Nearcut Alternative editorial last updated date. */
  { path: NEARCUT_ALTERNATIVE_PAGE_PATH, lastmod: NEARCUT_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Timely alternative source-backed comparison. */
  { path: TIMELY_ALTERNATIVE_PAGE_PATH, lastmod: TIMELY_ALTERNATIVE_LAST_UPDATED_ISO },
  /** SQUIRE comparison editorial facts checked 8 October 2026. */
  { path: SQUIRE_ALTERNATIVE_PAGE_PATH, lastmod: SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Setora UK comparison editorial update. */
  { path: SETORA_ALTERNATIVE_PAGE_PATH, lastmod: SETORA_ALTERNATIVE_LAST_UPDATED_ISO },
  /** Matches the visible "Last updated" date on src/pages/barber-software-cost-calculator/index.astro. */
  { path: BARBER_COST_CALCULATOR_PAGE_PATH, lastmod: BARBER_COST_CALCULATOR_LAST_UPDATED_ISO },
  /** Matches "Last updated" on src/pages/privacy.astro. */
  { path: '/privacy', lastmod: '2026-10-06' },
  /** Matches "Last updated" on src/pages/cookies.astro. */
  { path: '/cookies', lastmod: '2026-09-25' },
  /** Canonical DPA version = "Last updated" on /dpa. */
  { path: '/dpa', lastmod: CURRENT_DPA_VERSION },
  /** Canonical Terms version = "Last updated" on /terms. */
  { path: '/terms', lastmod: CURRENT_TERMS_VERSION },
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
    ...(entry.lastmod ? { lastmod: entry.lastmod } : {}),
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
