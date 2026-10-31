import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GET as robotsTxt } from '@/pages/robots.txt';
import { buildMarketingSitemapXml } from '@/lib/seo/marketingSitemap';

/**
 * Spec §6: previews send X-Robots-Tag: noindex, nofollow plus a robots meta tag, stay out of the sitemap,
 * and are NOT blocked in robots.txt (a block would stop crawlers from seeing the noindex).
 */
describe('private preview indexing', () => {
  it('is not disallowed in robots.txt', async () => {
    const body = await (await robotsTxt({} as never)).text();
    const disallows = body.split('\n').filter((line) => /^\s*disallow:/i.test(line));
    expect(disallows.some((line) => /\/preview/.test(line))).toBe(false);
  });

  it('is never in the sitemap', () => {
    expect(buildMarketingSitemapXml()).not.toMatch(/\/preview\//);
  });

  it('sends noindex, nofollow by header and meta, private no-store, and no referrer', () => {
    const headers = readFileSync('src/lib/freePreview/previewHeaders.ts', 'utf8');
    expect(headers).toContain("'X-Robots-Tag': 'noindex, nofollow'");
    expect(headers).toContain("'Cache-Control': 'private, no-store'");
    expect(headers).toContain("'Referrer-Policy': 'no-referrer'");

    const page = readFileSync('src/pages/preview/[token].astro', 'utf8');
    expect(page).toContain('PRIVATE_PREVIEW_HEADERS');
    expect(page).toMatch(/noindex=\{true\}\s+robotsFollow=\{false\}/);
    expect(page).toContain('referrerpolicy="no-referrer"');
  });
});
