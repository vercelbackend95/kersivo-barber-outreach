import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { buildInsightsSitemapEntries, getInsightsIndexLastmod } from './insights';
import { COOKIE_POLICY_LAST_UPDATED_ISO, PRIVACY_POLICY_LAST_UPDATED_ISO, formatLegalPageDate } from '@/lib/legal/legalPageDates';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { HOMEPAGE_LAST_UPDATED_ISO } from './defaults';
import {
  buildMarketingSitemapEntries,
  buildMarketingSitemapXml,
  MARKETING_SITEMAP_ENTRIES,
  SITEMAP_CONTENT_TYPE,
} from './marketingSitemap';
import { CONTENT_CHANGED_ISO, getStaticPageLastModified, STATIC_PAGE_LAST_MODIFIED } from './pageDates';
import { GET } from '../../pages/sitemap.xml';

const EXPECTED_LOCS = [
  // Owner-approved Insights articles are published through one canonical registry.
  // Keep this explicit route contract for the remaining marketing pages.
  ...buildInsightsSitemapEntries().map(({ path }) => `https://kersivo.co.uk${path}`),
  'https://kersivo.co.uk/',
  'https://kersivo.co.uk/pricing',
  'https://kersivo.co.uk/starter',
  'https://kersivo.co.uk/barbershop-websites',
  'https://kersivo.co.uk/barbershop-websites/london',
  'https://kersivo.co.uk/barbershop-websites/birmingham',
  'https://kersivo.co.uk/barbershop-websites/bournemouth',
  'https://kersivo.co.uk/barbershop-website-design',
  'https://kersivo.co.uk/barbershop-online-booking',
  'https://kersivo.co.uk/barbershop-reports',
  'https://kersivo.co.uk/barbershop-retail-pickup',
  'https://kersivo.co.uk/about',
  'https://kersivo.co.uk/insights/editorial-standards',
  'https://kersivo.co.uk/compare',
  'https://kersivo.co.uk/booksy-alternative',
  'https://kersivo.co.uk/fresha-alternative',
  'https://kersivo.co.uk/vagaro-alternative',
  'https://kersivo.co.uk/square-appointments-alternative',
  'https://kersivo.co.uk/nearcut-alternative',
  'https://kersivo.co.uk/timely-alternative',
  'https://kersivo.co.uk/treatwell-alternative',
  'https://kersivo.co.uk/phorest-alternative',
  'https://kersivo.co.uk/squire-alternative',
  'https://kersivo.co.uk/setora-alternative',
  'https://kersivo.co.uk/barber-software-cost-calculator',
  'https://kersivo.co.uk/barber-booking-fees-uk',
  'https://kersivo.co.uk/booksy-vs-fresha',
  'https://kersivo.co.uk/kersivo-vs-booksy',
  'https://kersivo.co.uk/barbershop-cancellation-policy-template',
  'https://kersivo.co.uk/barbershop-price-list-template',
  'https://kersivo.co.uk/barbershop-no-show-calculator',
  'https://kersivo.co.uk/chair-rent-vs-commission-calculator',
  'https://kersivo.co.uk/barber-price-calculator',
  'https://kersivo.co.uk/free-tools',
  'https://kersivo.co.uk/privacy',
  'https://kersivo.co.uk/cookies',
  'https://kersivo.co.uk/dpa',
  'https://kersivo.co.uk/terms',
] as const;

const EXPECTED_COUNT = EXPECTED_LOCS.length;

describe('marketing sitemap', () => {
  it('S: excludes dynamic tenant booking URLs and QR redirects', async () => {
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs.some((loc) => new URL(loc).pathname.startsWith('/book/'))).toBe(false);
    expect(locs.some((loc) => new URL(loc).pathname.startsWith('/q/'))).toBe(false);

    const xml = await (await GET({} as Parameters<typeof GET>[0])).text();
    expect(xml).not.toContain('/book/');
    expect(xml).not.toContain('/q/');
  });

  it('builds canonical marketing URLs including /dpa with a content-date lastmod on every URL', () => {
    const entries = buildMarketingSitemapEntries();
    const locs = entries.map((entry) => entry.loc);

    expect(entries).toHaveLength(EXPECTED_COUNT);
    expect(locs).toEqual([...EXPECTED_LOCS]);
    expect(new Set(locs).size).toBe(EXPECTED_COUNT);

    const byLoc = Object.fromEntries(entries.map((entry) => [entry.loc, entry.lastmod]));
    expect(byLoc['https://kersivo.co.uk/insights']).toBe(getInsightsIndexLastmod());
    // Every article got the "Short answer" block on 26 Nov 2026 (INSIGHTS_ARTICLE_TEMPLATE_REVISED_ISO);
    // their visible "Updated" dates and Article dateModified stay as they were.
    const articleLocs = locs.filter((loc) => /\/insights\/(?!category\/|editorial-standards$)[^/]+$/.test(loc));
    expect(articleLocs.length).toBeGreaterThanOrEqual(20);
    for (const loc of articleLocs) expect(byLoc[loc], loc).toBe('2026-11-26');
    // Every URL has a content date. Archives use the newest dateModified of the articles they list.
    for (const entry of entries) expect(entry.lastmod, entry.loc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(byLoc['https://kersivo.co.uk/insights/category/business-profit']).toBe('2026-10-29');
    expect(byLoc['https://kersivo.co.uk/insights/category/clients-growth']).toBe('2026-10-18');
    expect(byLoc['https://kersivo.co.uk/insights/category/brand-marketing']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/category/bookings-operations']).toBe('2026-10-29');
    expect(byLoc['https://kersivo.co.uk/insights/category/tools-payments']).toBe('2026-10-19');
    expect(byLoc['https://kersivo.co.uk/insights/category/industry-people']).toBe('2026-10-29');
    // Same constant as the homepage WebPage dateModified.
    expect(byLoc['https://kersivo.co.uk/']).toBe(HOMEPAGE_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/pricing']).toBe('2026-11-26'); // rebuilt 14 Nov 2026, migration FAQ 26 Nov
    expect(byLoc['https://kersivo.co.uk/starter']).toBe('2026-11-26'); // reminders FAQ; visible date stays 14 Nov
    expect(byLoc['https://kersivo.co.uk/barbershop-websites']).toBe('2026-11-24'); // rebuilt 13 Nov, city cards 24 Nov
    expect(byLoc['https://kersivo.co.uk/barbershop-website-design']).toBe('2026-11-25'); // rebuilt 25 Nov 2026
    expect(byLoc['https://kersivo.co.uk/barbershop-online-booking']).toBe('2026-11-26'); // rebuilt 25 Nov, title 26 Nov
    expect(byLoc['https://kersivo.co.uk/about']).toBe('2026-11-26');
    expect(byLoc['https://kersivo.co.uk/compare']).toBe('2026-11-26'); // deposits table, app FAQ; visible date stays 13 Nov
    expect(byLoc['https://kersivo.co.uk/booksy-alternative']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/fresha-alternative']).toBe('2026-11-14');
    // "In short" answers (14 Nov 2026) and the new titles (26 Nov, audit P1) moved lastmod;
    // the visible "Last updated" dates stay as they were.
    expect(byLoc['https://kersivo.co.uk/vagaro-alternative']).toBe('2026-11-26');
    expect(byLoc['https://kersivo.co.uk/square-appointments-alternative']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/nearcut-alternative']).toBe('2026-11-26');
    expect(byLoc['https://kersivo.co.uk/timely-alternative']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/treatwell-alternative']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/phorest-alternative']).toBe('2026-11-26');
    expect(byLoc['https://kersivo.co.uk/squire-alternative']).toBe('2026-11-26');
    expect(byLoc['https://kersivo.co.uk/setora-alternative']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/barber-software-cost-calculator']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/barbershop-cancellation-policy-template']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/barbershop-no-show-calculator']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/chair-rent-vs-commission-calculator']).toBe('2026-11-14');
    expect(byLoc['https://kersivo.co.uk/barber-price-calculator']).toBe('2026-11-24');
    expect(byLoc['https://kersivo.co.uk/free-tools']).toBe('2026-11-24');
    expect(byLoc['https://kersivo.co.uk/privacy']).toBe(PRIVACY_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/cookies']).toBe(COOKIE_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/dpa']).toBe(CURRENT_DPA_VERSION);
    expect(byLoc['https://kersivo.co.uk/terms']).toBe(CURRENT_TERMS_VERSION);
    expect(CURRENT_DPA_VERSION).toBe('2026-10-06');
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-30');

    expect(EXPECTED_LOCS.some((loc) => loc === 'https://kersivo.co.uk/')).toBe(true);
    for (const loc of EXPECTED_LOCS) {
      if (loc === 'https://kersivo.co.uk/') continue;
      expect(loc.endsWith('/'), loc).toBe(false);
    }
    expect(locs.some((loc) => loc.includes('/design-preview/'))).toBe(false);
  });

  it('uses the same lastmod dates as the visible legal documents', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const privacy = readFileSync(join(here, '../../pages/privacy.astro'), 'utf8');
    const cookies = readFileSync(join(here, '../../pages/cookies.astro'), 'utf8');
    expect(privacy).toContain('Last updated: {formatLegalPageDate(PRIVACY_POLICY_LAST_UPDATED_ISO)}');
    expect(cookies).toContain('Last updated: {formatLegalPageDate(COOKIE_POLICY_LAST_UPDATED_ISO)}');
    expect(formatLegalPageDate(PRIVACY_POLICY_LAST_UPDATED_ISO)).toBe('31 October 2026');
    expect(formatLegalPageDate(COOKIE_POLICY_LAST_UPDATED_ISO)).toBe('25 September 2026');
    const byLoc = Object.fromEntries(buildMarketingSitemapEntries().map(({loc,lastmod})=>[loc,lastmod]));
    expect(byLoc['https://kersivo.co.uk/privacy']).toBe(PRIVACY_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/cookies']).toBe(COOKIE_POLICY_LAST_UPDATED_ISO);
  });

  it('moves lastmod forward for content changes that kept the visible date, never backwards', () => {
    const sitemapPaths = new Set(MARKETING_SITEMAP_ENTRIES.map((entry) => entry.path));
    for (const [path, changed] of Object.entries(CONTENT_CHANGED_ISO)) {
      expect(sitemapPaths.has(path), path).toBe(true);
      expect(changed, path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${changed}T00:00:00Z`)), path).toBe(false);
      // A content date older than the visible date would do nothing; it is a stale entry to remove.
      expect(changed > STATIC_PAGE_LAST_MODIFIED[path], path).toBe(true);
      expect(getStaticPageLastModified(path), path).toBe(changed);
    }
  });

  it('emits valid urlset XML without product, admin, or API paths and without stale global lastmod', () => {
    const xml = buildMarketingSitemapXml();
    const urlMatches = xml.match(/<url>/g) ?? [];
    const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(urlMatches).toHaveLength(EXPECTED_COUNT);
    expect(locMatches).toEqual([...EXPECTED_LOCS]);
    expect(xml).not.toContain('2026-07-18');
    expect(xml).not.toContain('<lastmod>2026-07-18</lastmod>');
    expect(xml).toContain('<lastmod>2026-09-25</lastmod>');
    expect(xml).not.toContain('<lastmod>2026-10-05</lastmod>');
    expect(xml).toContain('<lastmod>2026-10-06</lastmod>');
    expect(xml).toContain('<lastmod>2026-10-17</lastmod>');
    expect(xml).toContain(`<lastmod>${CURRENT_DPA_VERSION}</lastmod>`);
    expect(xml).toContain(`<lastmod>${CURRENT_TERMS_VERSION}</lastmod>`);
    expect(xml).toContain('<lastmod>2026-11-14</lastmod>');
    expect(xml).toContain('<lastmod>2026-11-26</lastmod>');
    expect(xml.match(/<lastmod>/g)?.length).toBe(EXPECTED_COUNT);
    expect(xml).not.toContain('<loc>https://kersivo.co.uk/shop</loc>');
    expect(xml).not.toContain('/design-preview/');

    expect(xml).not.toContain('demo-product-');
    expect(xml).not.toContain('cmmj3fcis0005l1kt8ii5itvd');
    expect(xml).not.toMatch(/\/shop\//);
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('kersivo.co.uk/demo');
    for (const loc of locMatches) expect(loc).toMatch(/^https:\/\/kersivo\.co\.uk\//);
    expect(xml).not.toContain('www.kersivo');
    expect(xml).not.toContain('/seo-growth');
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
