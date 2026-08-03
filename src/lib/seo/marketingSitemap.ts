import { STATIC_SITEMAP_LASTMOD } from './defaults';
import { buildAbsoluteUrl } from './meta';

/**
 * Marketing-domain sitemap for kersivo.co.uk only.
 * Do not query the product table here — owner/tenant product URLs belong on
 * future per-shop sitemaps (shopId + customer domain), not the marketing domain.
 */
export type MarketingSitemapEntry = {
  path: string;
  lastmod: string;
};

export const MARKETING_SITEMAP_ENTRIES: readonly MarketingSitemapEntry[] = [
  { path: '/', lastmod: STATIC_SITEMAP_LASTMOD },
  { path: '/barbershop-booking-software', lastmod: '2026-08-03' },
  { path: '/privacy', lastmod: STATIC_SITEMAP_LASTMOD },
  { path: '/cookies', lastmod: STATIC_SITEMAP_LASTMOD },
  { path: '/terms', lastmod: STATIC_SITEMAP_LASTMOD },
  { path: '/shop', lastmod: STATIC_SITEMAP_LASTMOD },
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

export function buildMarketingSitemapEntries(): Array<{ loc: string; lastmod: string }> {
  return MARKETING_SITEMAP_ENTRIES.map((entry) => ({
    loc: buildAbsoluteUrl(entry.path),
    lastmod: entry.lastmod,
  }));
}

export function toSitemapXml(entries: Array<{ loc: string; lastmod: string }> = buildMarketingSitemapEntries()): string {
  const urlNodes = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
  </url>`
    )
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
