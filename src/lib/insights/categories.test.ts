import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  INSIGHTS_CATEGORIES,
  INSIGHTS_CATEGORY_IDS,
  getIndexableInsightsCategorySitemapEntries,
  getInsightsCategory,
  getInsightsTopicStripItems,
  isInsightsCategoryId,
} from './categories';
import {
  INSIGHTS_PUBLISHED_ARTICLES,
  buildInsightsSitemapEntries,
  getPublishedArticlesByCategory,
} from '@/lib/seo/insights';

const here = dirname(fileURLToPath(import.meta.url));

describe('Insights six-category taxonomy', () => {
  it('defines exactly six ordered categories with unique ids and paths', () => {
    expect(INSIGHTS_CATEGORY_IDS).toHaveLength(6);
    expect(INSIGHTS_CATEGORIES).toHaveLength(6);
    expect(INSIGHTS_CATEGORIES.map((category) => category.id)).toEqual([...INSIGHTS_CATEGORY_IDS]);
    expect(INSIGHTS_CATEGORIES.map((category) => category.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(INSIGHTS_CATEGORIES.map((category) => category.id)).size).toBe(6);
    expect(new Set(INSIGHTS_CATEGORIES.map((category) => category.path)).size).toBe(6);
    expect(new Set(INSIGHTS_CATEGORIES.map((category) => category.name)).size).toBe(6);
  });

  it('locks the approved names, descriptors and paths', () => {
    expect(INSIGHTS_CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
      descriptor: category.descriptor,
      path: category.path,
    }))).toEqual([
      {
        id: 'business-profit',
        name: 'Business & Profit',
        descriptor: 'Pricing · Revenue · Margins',
        path: '/insights/category/business-profit',
      },
      {
        id: 'clients-growth',
        name: 'Clients & Growth',
        descriptor: 'Acquisition · Retention · Loyalty',
        path: '/insights/category/clients-growth',
      },
      {
        id: 'brand-marketing',
        name: 'Brand & Marketing',
        descriptor: 'Reputation · Google · Social',
        path: '/insights/category/brand-marketing',
      },
      {
        id: 'bookings-operations',
        name: 'Bookings & Operations',
        descriptor: 'Scheduling · No-shows · Teams',
        path: '/insights/category/bookings-operations',
      },
      {
        id: 'tools-payments',
        name: 'Tools & Payments',
        descriptor: 'Software · Websites · Payments',
        path: '/insights/category/tools-payments',
      },
      {
        id: 'industry-people',
        name: 'Industry & People',
        descriptor: 'Barbers · Trends · Culture',
        path: '/insights/category/industry-people',
      },
    ]);
  });

  it('gives every category a unique icon, SEO copy and explicit indexability flag', () => {
    const icons = INSIGHTS_CATEGORIES.map((category) => category.icon);
    expect(new Set(icons).size).toBe(6);
    for (const category of INSIGHTS_CATEGORIES) {
      expect(category.intro.length).toBeGreaterThan(40);
      expect(category.seoTitle).toContain(category.name.split('&')[0].trim());
      expect(category.seoDescription.length).toBeGreaterThan(40);
      expect(typeof category.indexable).toBe('boolean');
      expect(isInsightsCategoryId(category.id)).toBe(true);
      expect(getInsightsCategory(category.id).path).toBe(category.path);
    }
  });

  it('keeps the topic strip aligned to the taxonomy order with real category hrefs', () => {
    const topics = getInsightsTopicStripItems();
    expect(topics.map((topic) => topic.id)).toEqual([...INSIGHTS_CATEGORY_IDS]);
    for (const topic of topics) {
      expect(topic.href).toBe(`/insights/category/${topic.id}`);
    }
  });

  it('assigns each published article to exactly one valid primary category', () => {
    const expected: Record<string, string> = {
      'google-reviews-barbershop-uk-rules': 'brand-marketing',
      'get-more-barbershop-clients-locally-uk': 'clients-growth',
      'barbershop-card-payment-fees-uk': 'tools-payments',
      'barbershop-gift-vouchers-uk': 'business-profit',
      'how-to-price-haircut-uk-barber': 'business-profit',
      'barbershop-christmas-opening-hours-planning': 'bookings-operations',
    };
    expect(INSIGHTS_PUBLISHED_ARTICLES).toHaveLength(6);
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      expect(isInsightsCategoryId(article.categoryId)).toBe(true);
      expect(article.categoryId).toBe(expected[article.slug]);
    }
    expect(getPublishedArticlesByCategory('business-profit')).toHaveLength(2);
    expect(getPublishedArticlesByCategory('clients-growth')).toHaveLength(1);
    expect(getPublishedArticlesByCategory('brand-marketing')).toHaveLength(1);
    expect(getPublishedArticlesByCategory('bookings-operations')).toHaveLength(1);
    expect(getPublishedArticlesByCategory('tools-payments')).toHaveLength(1);
    expect(getPublishedArticlesByCategory('industry-people')).toHaveLength(0);

    const all = INSIGHTS_CATEGORY_IDS.flatMap((id) => getPublishedArticlesByCategory(id));
    expect(all).toHaveLength(6);
    expect(new Set(all.map((article) => article.slug)).size).toBe(6);
  });

  it('sitemaps every owner-approved category even when it has no published articles', () => {
    expect(INSIGHTS_CATEGORIES.every((category) => category.indexable === true)).toBe(true);
    const categoryEntries = getIndexableInsightsCategorySitemapEntries();
    expect(categoryEntries.map((entry) => entry.path)).toEqual(
      INSIGHTS_CATEGORIES.map((category) => category.path),
    );
    // An empty category must remain indexable; no fake articles are added.
    expect(getPublishedArticlesByCategory('industry-people')).toHaveLength(0);
    expect(categoryEntries.some((entry) => entry.path === '/insights/category/industry-people')).toBe(true);

    const locs = buildInsightsSitemapEntries().map((entry) => entry.path);
    expect(locs).toHaveLength(1 + INSIGHTS_PUBLISHED_ARTICLES.length + INSIGHTS_CATEGORIES.length);
    expect(locs[0]).toBe('/insights');
    expect(locs.slice(1, 1 + INSIGHTS_PUBLISHED_ARTICLES.length)).toEqual(
      INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.path),
    );
    expect(locs.slice(1 + INSIGHTS_PUBLISHED_ARTICLES.length)).toEqual(
      INSIGHTS_CATEGORIES.map((category) => category.path),
    );
  });

  it('renders category modules as anchors in the topic strip component', () => {
    const source = readFileSync(join(here, '../../components/insights/InsightsTopicStrip.astro'), 'utf8');
    expect(source).toContain('<nav class="ins-topics"');
    expect(source).toContain('<a class="ins-topics__module" href={topic.href}');
    expect(source).not.toContain('tabindex="0"');
  });

  it('uses a single category archive template under insights/category', () => {
    const page = readFileSync(join(here, '../../pages/insights/category/[category].astro'), 'utf8');
    expect(page).toContain('export const prerender = true');
    expect(page).toContain('getStaticPaths');
    expect(page).toContain('INSIGHTS_CATEGORIES');
    expect(page).toContain('noindex={!indexable}');
    expect(page).toContain('const indexable = category.indexable;');
    expect(page).not.toContain('indexable && count > 0');
    expect(page).toContain('No articles published in this topic yet');
    expect(page).toContain('Elsewhere in Insights');
  });
});
