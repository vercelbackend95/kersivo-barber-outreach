import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { INSIGHTS_HOME_LATEST } from '@/lib/insights/insightsHome';
import { getInsightsRelatedLinks } from '@/lib/insights/insightsLinking';
import {
  INSIGHTS_INDEX_PATH,
  INSIGHTS_INDEX_TITLE,
  INSIGHTS_PUBLISHED_ARTICLES,
  getInsightsIndexLastmod,
  buildInsightsArticleJsonLd,
  buildInsightsSitemapEntries,
  isInsightsArticlePublished,
} from './insights';

const here = dirname(fileURLToPath(import.meta.url));
const insightsPagesDir = join(here, '../../pages/insights');
const stagingDir = join(here, '../../../editorial-staging/insights');

describe('Insights publication safety', () => {
  it('keeps a unique owner-approved registry of published articles', () => {
    const slugs = INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.slug);
    const paths = INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.path);
    expect(slugs.length).toBeGreaterThanOrEqual(9);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      expect(article.path).toBe(`/insights/${article.slug}`);
      expect(isInsightsArticlePublished(article.slug)).toBe(true);
      expect(article.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.categoryId).toBeTruthy();
      // OG assets are either committed raster files or exact licensed Unsplash
      // photo crops matched to the approved source hero (never an arbitrary URL).
      if (article.ogImage.startsWith('/')) {
        expect(article.ogImage).toMatch(/^\/images\/insights\/og\//);
        expect(existsSync(join(here, '../../../public', article.ogImage.replace(/^\//, ''))), article.ogImage).toBe(
          true,
        );
      } else {
        const og = new URL(article.ogImage);
        const hero = new URL(article.heroImage);
        expect(og.protocol).toBe('https:');
        // Owner-approved editorial imagery may come from licensed Unsplash or Pexels sources.
        expect(['images.unsplash.com', 'images.pexels.com']).toContain(og.hostname);
        expect(og.hostname).toBe(hero.hostname);
        expect(og.pathname).toBe(hero.pathname);
        expect(og.searchParams.get('w')).toBe('1200');
        expect(og.searchParams.get('h')).toBe('630');
        const manifestPath = join(stagingDir, `${article.slug}.visuals.json`);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          media: Array<{ kind: string; licenceReviewed: boolean; creditUrl?: string }>;
        };
        const approvedCreditHost = og.hostname === 'images.pexels.com'
          ? 'www.pexels.com'
          : 'unsplash.com';
        expect(manifest.media.some((asset) => {
          if (asset.kind !== 'hero' || !asset.licenceReviewed || !asset.creditUrl) return false;
          try {
            return new URL(asset.creditUrl).hostname === approvedCreditHost;
          } catch {
            return false;
          }
        })).toBe(true);
      }
      expect(existsSync(join(stagingDir, `${article.slug}-display.md`)), article.slug).toBe(true);
    }
    expect(isInsightsArticlePublished('not-a-real-article')).toBe(false);
  });

  it('uses a single registry-driven [slug] route and does not keep per-article page files', () => {
    const pageFiles = readdirSync(insightsPagesDir).filter((name) => name.endsWith('.astro'));
    expect(pageFiles.sort()).toEqual(['[slug].astro', 'index.astro'].sort());

    const slugRoute = readFileSync(join(insightsPagesDir, '[slug].astro'), 'utf8');
    expect(slugRoute).toContain('export const prerender = true');
    expect(slugRoute).toContain('getStaticPaths');
    expect(slugRoute).toContain('INSIGHTS_PUBLISHED_ARTICLES');
    expect(slugRoute).toContain('published={isInsightsArticlePublished(article.slug)}');

    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      expect(existsSync(join(insightsPagesDir, `${article.slug}.astro`)), article.slug).toBe(false);
    }
  });

  it('keeps the hub Latest Thinking and sitemap aligned to the publication registry', () => {
    expect(INSIGHTS_INDEX_TITLE).toContain('Barbershop Business Insights');
    expect(INSIGHTS_HOME_LATEST.map((item) => item.id)).toEqual(
      INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.slug),
    );
    for (const item of INSIGHTS_HOME_LATEST) {
      expect(item.href).toBe(`/insights/${item.id}`);
      expect(isInsightsArticlePublished(item.id)).toBe(true);
    }

    const insightsSitemap = buildInsightsSitemapEntries();
    expect(insightsSitemap[0]).toEqual({
      path: INSIGHTS_INDEX_PATH,
      lastmod: getInsightsIndexLastmod(),
    });
    const publishedPaths = INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.path);
    const categories = [
      '/insights/category/business-profit',
      '/insights/category/clients-growth',
      '/insights/category/brand-marketing',
      '/insights/category/bookings-operations',
      '/insights/category/tools-payments',
      '/insights/category/industry-people',
    ];
    expect(insightsSitemap.slice(1).map((entry) => entry.path)).toEqual([
      ...publishedPaths,
      ...categories,
    ]);

    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs.filter((loc) => loc.includes('/insights')).length).toBe(1 + INSIGHTS_PUBLISHED_ARTICLES.length + categories.length);
    expect(locs.some((loc) => loc.includes('/design-preview/'))).toBe(false);
  });

  it('does not treat design-preview Insights as a published marketing surface', () => {
    const preview = join(here, '../../pages/design-preview/insights/index.astro');
    expect(existsSync(preview)).toBe(true);
    const source = readFileSync(preview, 'utf8');
    expect(source).toContain('noindex');
    expect(source).toContain('canonicalPath={GATE1_PREVIEW_PATH}');
  });

  it('gates indexability and Article JSON-LD on registry membership in the shared layout', () => {
    const layout = readFileSync(join(here, '../../layouts/InsightsArticleLayout.astro'), 'utf8');
    expect(layout).toContain('const isPublic = published && isInsightsArticlePublished(slug)');
    expect(layout).toContain('noindex={!isPublic}');
    expect(layout).toContain('buildInsightsArticleJsonLd');
    expect(layout).toContain('InsightsRelatedReading');
  });

  it('falls back to datePublished for dateModified and links publisher, author and site by @id', () => {
    const article = INSIGHTS_PUBLISHED_ARTICLES[0];
    const input = {
      path: article.path,
      headline: article.headline,
      description: article.description,
      publishedDate: article.publishedDate,
      verifiedDate: article.verifiedDate,
      heroImage: article.heroImage,
      ogImage: article.ogImage,
      categoryId: article.categoryId,
    };
    const [entity, jsonLd] = buildInsightsArticleJsonLd(input) as Record<string, any>[];
    expect(entity['@graph'].map((node: Record<string, unknown>) => node['@id'])).toEqual([
      'https://kersivo.co.uk/#organization',
      'https://kersivo.co.uk/#website',
    ]);
    expect(entity['@graph'][0].logo.url).toBe('https://kersivo.co.uk/images/logo_nobg.png');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd).toHaveProperty('datePublished', article.publishedDate);
    expect(jsonLd).toHaveProperty('dateModified', article.publishedDate);
    expect(jsonLd.publisher).toEqual({ '@id': 'https://kersivo.co.uk/#organization' });
    expect(jsonLd.author).toEqual({
      '@type': 'Organization',
      '@id': 'https://kersivo.co.uk/#organization',
      name: 'KERSIVO',
      url: 'https://kersivo.co.uk/about',
    });
    expect(jsonLd.isPartOf).toEqual({ '@id': 'https://kersivo.co.uk/#website' });
    expect(JSON.stringify(jsonLd)).not.toContain('logo-kersivo.png');

    const [, revised] = buildInsightsArticleJsonLd({ ...input, updatedDate: '2026-10-28' }) as Record<string, any>[];
    expect(revised).toHaveProperty('dateModified', '2026-10-28');
  });

  it('keeps related links on published destinations only', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const links = getInsightsRelatedLinks(article.slug);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.href.startsWith('/')).toBe(true);
        expect(link.href.includes('/design-preview/')).toBe(false);
        if (link.kind === 'article') {
          expect(isInsightsArticlePublished(link.href.replace('/insights/', ''))).toBe(true);
        }
      }
    }
  });
});
