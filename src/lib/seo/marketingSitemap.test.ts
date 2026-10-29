import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_DPA_VERSION } from '@/lib/legal/dpaVersion';
import { buildInsightsSitemapEntries, getInsightsIndexLastmod } from './insights';
import { COOKIE_POLICY_LAST_UPDATED_ISO, PRIVACY_POLICY_LAST_UPDATED_ISO, formatLegalPageDate } from '@/lib/legal/legalPageDates';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import {
  buildMarketingSitemapEntries,
  buildMarketingSitemapXml,
  SITEMAP_CONTENT_TYPE,
} from './marketingSitemap';
import { GET } from '../../pages/sitemap.xml';

const EXPECTED_LOCS = [
  // Owner-approved Insights articles are published through one canonical registry.
  // Keep this explicit route contract for the remaining marketing pages.
  ...buildInsightsSitemapEntries().map(({ path }) => `https://kersivo.co.uk${path}`),
  'https://kersivo.co.uk/',
  'https://kersivo.co.uk/pricing',
  'https://kersivo.co.uk/starter',
  'https://kersivo.co.uk/barbershop-websites',
  'https://kersivo.co.uk/barbershop-website-design',
  'https://kersivo.co.uk/barbershop-online-booking',
  'https://kersivo.co.uk/about',
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
  'https://kersivo.co.uk/chair-rent-vs-commission-calculator',
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

  it('builds canonical marketing URLs including /dpa with accurate or omitted lastmod', () => {
    const entries = buildMarketingSitemapEntries();
    const locs = entries.map((entry) => entry.loc);

    expect(entries).toHaveLength(EXPECTED_COUNT);
    expect(locs).toEqual([...EXPECTED_LOCS]);
    expect(new Set(locs).size).toBe(EXPECTED_COUNT);

    const byLoc = Object.fromEntries(entries.map((entry) => [entry.loc, entry.lastmod]));
    expect(byLoc['https://kersivo.co.uk/insights']).toBe(getInsightsIndexLastmod());
    expect(byLoc['https://kersivo.co.uk/insights/barber-commission-pay-minimum-wage-uk']).toBe('2026-10-29');
    expect(byLoc['https://kersivo.co.uk/insights/barbershop-client-retention-second-visit']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/barber-dermatitis-skin-care-hse']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/barbershop-christmas-opening-hours-planning']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/how-to-price-haircut-uk-barber']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/barbershop-gift-vouchers-uk']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/barbershop-card-payment-fees-uk']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/get-more-barbershop-clients-locally-uk']).toBe('2026-10-17');
    expect(byLoc['https://kersivo.co.uk/insights/google-reviews-barbershop-uk-rules']).toBe('2026-10-17');
    // Categories are indexable even when empty; do not invent a lastmod date.
    expect(byLoc['https://kersivo.co.uk/insights/category/business-profit']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/insights/category/clients-growth']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/insights/category/brand-marketing']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/insights/category/bookings-operations']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/insights/category/tools-payments']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/insights/category/industry-people']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/']).toBeUndefined();
    expect(byLoc['https://kersivo.co.uk/pricing']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/starter']).toBe('2026-10-28');
    for (const path of ['/barbershop-websites', '/barbershop-website-design', '/barbershop-online-booking']) {
      expect(byLoc[`https://kersivo.co.uk${path}`]).toBeUndefined(); // No fabricated editorial lastmod
    }
    expect(byLoc['https://kersivo.co.uk/about']).toBe('2026-10-27');
    expect(byLoc['https://kersivo.co.uk/compare']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/booksy-alternative']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/fresha-alternative']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/vagaro-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/square-appointments-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/nearcut-alternative']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/timely-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/treatwell-alternative']).toBe('2026-10-28');
    expect(byLoc['https://kersivo.co.uk/phorest-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/squire-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/setora-alternative']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/barber-software-cost-calculator']).toBe('2026-10-08');
    expect(byLoc['https://kersivo.co.uk/chair-rent-vs-commission-calculator']).toBe('2026-10-29');
    expect(byLoc['https://kersivo.co.uk/privacy']).toBe(PRIVACY_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/cookies']).toBe(COOKIE_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/dpa']).toBe(CURRENT_DPA_VERSION);
    expect(byLoc['https://kersivo.co.uk/terms']).toBe(CURRENT_TERMS_VERSION);
    expect(CURRENT_DPA_VERSION).toBe('2026-10-06');
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-27');

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
    expect(formatLegalPageDate(PRIVACY_POLICY_LAST_UPDATED_ISO)).toBe('6 October 2026');
    expect(formatLegalPageDate(COOKIE_POLICY_LAST_UPDATED_ISO)).toBe('25 September 2026');
    const byLoc = Object.fromEntries(buildMarketingSitemapEntries().map(({loc,lastmod})=>[loc,lastmod]));
    expect(byLoc['https://kersivo.co.uk/privacy']).toBe(PRIVACY_POLICY_LAST_UPDATED_ISO);
    expect(byLoc['https://kersivo.co.uk/cookies']).toBe(COOKIE_POLICY_LAST_UPDATED_ISO);
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
    expect(xml).toContain('<lastmod>2026-10-27</lastmod>');
    expect(xml).toContain('<lastmod>2026-10-08</lastmod>');
    // Homepage, six Insights categories and three Websites cluster pages have no source-backed lastmod.
    expect(xml.match(/<lastmod>/g)?.length).toBe(EXPECTED_COUNT - 10);
    expect(xml).not.toContain('<loc>https://kersivo.co.uk/shop</loc>');
    expect(xml).not.toContain('/design-preview/');

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
