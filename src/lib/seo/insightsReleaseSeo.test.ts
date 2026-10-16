import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  INSIGHTS_GOOGLE_REVIEWS,
  INSIGHTS_INDEX_DESCRIPTION,
  INSIGHTS_INDEX_PATH,
  INSIGHTS_INDEX_TITLE,
  buildInsightsArticleJsonLd,
  buildInsightsIndexJsonLd,
} from './insights';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_DIRECT_LINKS, buildMarketingNavTopLevelEntries } from '@/lib/nav/marketingNavigation';
import { resolvePageSeo } from './meta';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(here, file), 'utf8');

describe('KERSIVO Insights public indexing release gates', () => {
  it('uses two unique canonical, indexable UK marketing URLs with reliable editorial lastmod', () => {
    const hub = resolvePageSeo({ title: INSIGHTS_INDEX_TITLE, description: INSIGHTS_INDEX_DESCRIPTION, canonicalPath: INSIGHTS_INDEX_PATH });
    const article = resolvePageSeo({ title: INSIGHTS_GOOGLE_REVIEWS.seoTitle, description: INSIGHTS_GOOGLE_REVIEWS.description, canonicalPath: INSIGHTS_GOOGLE_REVIEWS.path, ogType: 'article', noindex: false });
    expect(hub.canonical).toBe('https://kersivo.co.uk/insights');
    expect(article.canonical).toBe('https://kersivo.co.uk/insights/google-reviews-barbershop-uk-rules');
    expect(hub.robotsContent).toBeUndefined();
    expect(article.robotsContent).toBeUndefined();
    expect(article.ogType).toBe('article');

    const entries = buildMarketingSitemapEntries();
    for (const url of [hub.canonical, article.canonical]) {
      const matches = entries.filter((entry) => entry.loc === url);
      expect(matches, url).toHaveLength(1);
      expect(matches[0].lastmod).toBe(INSIGHTS_GOOGLE_REVIEWS.publishedDate);
    }
  });

  it('keeps the hub and article linked via semantic HTML and one primary H1 each', () => {
    const hub = read('../../pages/insights/index.astro');
    const post = read('../../pages/insights/google-reviews-barbershop-uk-rules.astro');
    const body = read('../../../editorial-staging/insights/google-reviews-barbershop-uk-rules-display.md');
    const masthead = read('../../components/insights/InsightsMasthead.astro');
    const layout = read('../../layouts/InsightsArticleLayout.astro');
    const indexH1 = masthead.match(/<h1 class="insights-masthead__name">/g) ?? [];
    expect(indexH1).toHaveLength(1);
    expect(body.match(/^# /gm)).toHaveLength(1);
    expect(hub).toContain('canonicalPath="/insights"');
    expect(hub).toContain('href={articlePath}');
    expect(post).toContain('published={true}');
    expect(post).toContain('<ReviewArticle />');
    expect(layout).toContain('canonicalPath={path}');
    expect(layout).toContain('noindex={!published}');
    expect(layout).toContain('currentLabel={headline}');
    expect(layout).toContain('buildInsightsArticleJsonLd');
    expect(layout).toContain('<article class="insights-article"');
  });

  it('publishes owner-approved article schema, dates and honest editorial image attribution', () => {
    const data = buildInsightsArticleJsonLd(INSIGHTS_GOOGLE_REVIEWS);
    const article = data.find((entry) => entry['@type'] === 'Article')!;
    const breadcrumbs = data.find((entry) => entry['@type'] === 'BreadcrumbList')!;
    expect(article).toMatchObject({
      '@id': 'https://kersivo.co.uk/insights/google-reviews-barbershop-uk-rules#article',
      headline: INSIGHTS_GOOGLE_REVIEWS.headline,
      datePublished: INSIGHTS_GOOGLE_REVIEWS.publishedDate,
      dateModified: INSIGHTS_GOOGLE_REVIEWS.publishedDate,
      image: [INSIGHTS_GOOGLE_REVIEWS.heroImage],
      inLanguage: 'en-GB',
      isAccessibleForFree: true,
    });
    expect((breadcrumbs.itemListElement as Array<{ position: number }>).map((item) => item.position)).toEqual([1, 2, 3]);
    const manifest = JSON.parse(read('../../../editorial-staging/insights/google-reviews-barbershop-uk-rules.visuals.json')) as {
      publishApproved: boolean;
      publicationApproval?: { approvedBy?: string; approvedOn?: string };
      media: Array<{ licenceReviewed?: boolean; alt?: string; caption?: string }>;
    };
    expect(manifest.publishApproved).toBe(true);
    expect(manifest.publicationApproval?.approvedBy).toBe('owner');
    expect(manifest.publicationApproval?.approvedOn).toBe(INSIGHTS_GOOGLE_REVIEWS.publishedDate);
    expect(manifest.media.every((item) => item.licenceReviewed === true && !!item.alt && !!item.caption)).toBe(true);
  });

  it('includes Insights in global navigation and keeps article descendants active', () => {
    const link = MARKETING_NAV_DIRECT_LINKS.find((item) => item.id === 'insights');
    expect(link).toMatchObject({ href: '/insights', matchPrefix: '/insights' });
    const labels = buildMarketingNavTopLevelEntries().map((entry) =>
      entry.kind === 'group' ? entry.group.label : entry.link.label,
    );
    expect(labels).toEqual(['Platform', 'Websites', 'Compare', 'Insights', 'Resources', 'Starter', 'Pricing']);
    const hub = buildInsightsIndexJsonLd();
    const collection = hub.find((entry) => entry['@type'] === 'CollectionPage');
    expect(collection).toMatchObject({ url: 'https://kersivo.co.uk/insights', inLanguage: 'en-GB' });
  });
});
