import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import {
  buildMarketingSitemapEntries,
  buildMarketingSitemapXml,
  SITEMAP_CONTENT_TYPE,
} from './marketingSitemap';
import { GET } from '../../pages/sitemap.xml';

const EXPECTED_LOCS = [
  'https://kersivo.co.uk/',
  'https://kersivo.co.uk/booksy-alternative',
  'https://kersivo.co.uk/privacy',
  'https://kersivo.co.uk/cookies',
  'https://kersivo.co.uk/terms',
] as const;

describe('marketing sitemap', () => {
  it('builds exactly five canonical marketing URLs with accurate or omitted lastmod', () => {
    const entries = buildMarketingSitemapEntries();
    const locs = entries.map((entry) => entry.loc);

    expect(entries).toHaveLength(5);
    expect(locs).toEqual([...EXPECTED_LOCS]);
    expect(new Set(locs).size).toBe(5);

    const byLoc = Object.fromEntries(entries.map((entry) => [entry.loc, entry.lastmod]));
    expect(byLoc['https://kersivo.co.uk/']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/booksy-alternative']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/privacy']).toBe('2026-09-18');
    expect(byLoc['https://kersivo.co.uk/cookies']).toBe('2026-09-18');
    expect(byLoc['https://kersivo.co.uk/terms']).toBe(CURRENT_TERMS_VERSION);

    expect(EXPECTED_LOCS[0].endsWith('/')).toBe(true);
    for (const loc of EXPECTED_LOCS.slice(1)) {
      expect(loc.endsWith('/')).toBe(false);
    }
  });

  it('emits valid urlset XML without product, admin, or API paths and without stale global lastmod', () => {
    const xml = buildMarketingSitemapXml();
    const urlMatches = xml.match(/<url>/g) ?? [];
    const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(urlMatches).toHaveLength(5);
    expect(locMatches).toEqual([...EXPECTED_LOCS]);
    expect(xml).not.toContain('2026-07-18');
    expect(xml).not.toContain('<lastmod>2026-07-18</lastmod>');
    expect(xml).toContain('<lastmod>2026-09-18</lastmod>');
    expect(xml).toContain(`<lastmod>${CURRENT_TERMS_VERSION}</lastmod>`);
    expect(xml.match(/<lastmod>/g)?.length).toBe(3);
    expect(xml).not.toContain('<loc>https://kersivo.co.uk/shop</loc>');

    expect(xml).not.toContain('demo-product-');
    expect(xml).not.toContain('cmmj3fcis0005l1kt8ii5itvd');
    expect(xml).not.toMatch(/\/shop\//);
    expect(xml).not.toContain('/admin');
    expect(xml).not.toMatch(/\/book(?:\/|"|<|\s|$)/);
    expect(xml).not.toContain('/api');
    expect(xml).not.toContain('/setup');
    expect(xml).not.toContain('/shop/success');
    expect(xml).not.toContain('/shop/cancelled');
    expect(xml).not.toContain('/shop/demo/');
    expect(xml).not.toMatch(/\/shop\/[^/<]+\/success/);
    expect(xml).not.toMatch(/\/shop\/[^/<]+\/cancelled/);
  });

  it('GET returns application/xml with the marketing sitemap body', async () => {
    // Empty context is safe: sitemap GET ignores all APIRoute context fields.
    const response = await GET({} as Parameters<typeof GET>[0]);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(SITEMAP_CONTENT_TYPE);
    expect(body).toBe(buildMarketingSitemapXml());
  });

  it('sitemap route and generator do not import Prisma or query the database', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sitemapRoute = readFileSync(join(here, '../../pages/sitemap.xml.ts'), 'utf8');
    const generator = readFileSync(join(here, 'marketingSitemap.ts'), 'utf8');

    for (const source of [sitemapRoute, generator]) {
      expect(source).not.toMatch(/from ['"]@\/lib\/db/);
      expect(source).not.toMatch(/from ['"].*prisma/i);
      expect(source).not.toContain('findMany');
      expect(source).not.toContain('withPrismaQuotaFallback');
      expect(source).not.toContain('resolveShopId');
    }
  });
});
