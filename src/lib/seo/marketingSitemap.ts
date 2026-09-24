import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { buildAbsoluteUrl } from './meta';

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
  /** National SEO comparison landing page — no reliable editorial lastmod yet. */
  { path: '/booksy-alternative' },
  /** Matches "Last updated" on src/pages/privacy.astro. */
  { path: '/privacy', lastmod: '2026-09-23' },
  /** Matches "Last updated" on src/pages/cookies.astro. */
  { path: '/cookies', lastmod: '2026-09-24' },
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
