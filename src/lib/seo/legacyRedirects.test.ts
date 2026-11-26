import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';

type Redirect = { source: string; destination: string; permanent?: boolean; has?: unknown[] };

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { redirects: Redirect[] };
const sitemapPaths = new Set(MARKETING_SITEMAP_ENTRIES.map((entry) => entry.path));

function redirectFor(source: string): Redirect | undefined {
  return vercel.redirects.find((rule) => rule.source === source && !rule.has);
}

/**
 * URLs from the site that ran on kersivo.co.uk before this one (and an old booking page) that Bingbot
 * still requested in November 2026. Each goes to the page that does the same job today, so crawlers
 * stop getting 404s and any old links pass to a live page.
 */
const LEGACY_REDIRECTS = [
  { source: '/packages', destination: '/pricing' },
  { source: '/contact', destination: '/#contact' },
  { source: '/process', destination: '/#setup' },
  { source: '/work', destination: '/barbershop-websites' },
  { source: '/barbershop-booking-system', destination: '/barbershop-online-booking' },
] as const;

describe('legacy URL redirects (vercel.json)', () => {
  it.each(LEGACY_REDIRECTS)('$source redirects permanently to $destination', ({ source, destination }) => {
    const rule = redirectFor(source);
    expect(rule, source).toBeDefined();
    expect(rule?.destination).toBe(destination);
    expect(rule?.permanent).toBe(true);
  });

  it.each(LEGACY_REDIRECTS)('$destination is an indexable sitemap page', ({ destination }) => {
    const path = destination.split('#')[0] || '/';
    expect(sitemapPaths.has(path), path).toBe(true);
  });

  it('the anchors the homepage redirects point at exist on the homepage', () => {
    const home = readFileSync('src/pages/index.astro', 'utf8');
    expect(home).toMatch(/<HomeV2Steps\b/);
    expect(home).toMatch(/<Contact16\b/);
    expect(readFileSync('src/components/homeV2/HomeV2Steps.astro', 'utf8')).toMatch(/<section id="setup"/);
    expect(readFileSync('src/components/contact16.astro', 'utf8')).toMatch(/<section id="contact"/);
  });

  it('/work redirects only the bare path, so /work/sewing-ataga keeps its 410', () => {
    expect(redirectFor('/work')).toBeDefined();
    expect(vercel.redirects.some((rule) => rule.source.startsWith('/work/') || rule.source.startsWith('/work:'))).toBe(false);
  });
});
