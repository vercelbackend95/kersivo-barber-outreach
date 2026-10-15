import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { buildAbsoluteUrl, resolveRobotsContent } from './meta';
import {
  SEO_GROWTH_CONTACT,
  SEO_GROWTH_INTRO_PARAGRAPHS,
  SEO_GROWTH_PAGE_DESCRIPTION,
  SEO_GROWTH_PAGE_H1,
  SEO_GROWTH_PAGE_PATH,
  SEO_GROWTH_PAGE_SUBTITLE,
  SEO_GROWTH_PAGE_TITLE,
  SEO_GROWTH_PRIVACY_PARAGRAPHS,
} from './seoGrowthPage';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, '../../pages/seo-growth/index.astro'), 'utf8');

describe('/seo-growth page', () => {
  it('uses the agreed path, title and headings', () => {
    expect(SEO_GROWTH_PAGE_PATH).toBe('/seo-growth');
    expect(SEO_GROWTH_PAGE_TITLE).toBe('KERSIVO SEO Growth | Internal SEO Research Tool');
    expect(SEO_GROWTH_PAGE_H1).toBe('KERSIVO SEO Growth');
    expect(SEO_GROWTH_PAGE_SUBTITLE).toBe('Internal Search Research & Analytics Tool');
    expect(SEO_GROWTH_PAGE_DESCRIPTION).toMatch(/Google Ads API/);
    expect(SEO_GROWTH_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(170);
  });

  it('builds a canonical URL ending in /seo-growth', () => {
    expect(buildAbsoluteUrl(SEO_GROWTH_PAGE_PATH)).toMatch(/\/seo-growth$/);
    expect(pageSource).toContain('canonicalPath={SEO_GROWTH_PAGE_PATH}');
  });

  it('is noindex, follow', () => {
    expect(pageSource).toMatch(/^\s+noindex$/m);
    expect(pageSource).toMatch(/^\s+robotsFollow$/m);
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
  });

  it('is not listed in the marketing sitemap', () => {
    expect(MARKETING_SITEMAP_ENTRIES.some((entry) => entry.path === SEO_GROWTH_PAGE_PATH)).toBe(false);
  });

  it('describes the integration as in development without data sharing or retention claims', () => {
    const copy = [...SEO_GROWTH_INTRO_PARAGRAPHS, ...SEO_GROWTH_PRIVACY_PARAGRAPHS].join(' ');
    expect(copy).toContain('not yet active');
    expect(copy).not.toMatch(/\b(sold|shared with|retain|retention|deleted|stored)\b/i);
  });

  it('links to the Privacy Policy, Terms and contact details', () => {
    expect(pageSource).toContain('FOOTER_LEGAL_LINKS.privacy.href');
    expect(pageSource).toContain('FOOTER_LEGAL_LINKS.terms.href');
    expect(SEO_GROWTH_CONTACT.email).toBe('bartosz@kersivo.co.uk');
    expect(SEO_GROWTH_CONTACT.websiteUrl).toBe('https://kersivo.co.uk');
  });
});
