import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import {
  INSIGHTS_CTA_EXCLUDED_SLUGS,
  findInsightsReferencesStart,
  getInsightsCta,
  hasInsightsCta,
  splitInsightsBodyAtMiddle,
} from './insightsCta';

const displayHtml = (slug: string) => readFileSync(`editorial-staging/insights/${slug}-display.md`, 'utf8');

describe('Insights free preview / Starter CTA', () => {
  it('skips exactly the off-buyer articles and covers every other published article', () => {
    const slugs = INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.slug);
    for (const slug of INSIGHTS_CTA_EXCLUDED_SLUGS) expect(slugs, slug).toContain(slug);
    const withCta = slugs.filter(hasInsightsCta);
    expect(withCta.length).toBe(slugs.length - INSIGHTS_CTA_EXCLUDED_SLUGS.length);
    expect(withCta).toContain('barbershop-walk-ins-vs-appointments');
    expect(hasInsightsCta('making-tax-digital-barbers')).toBe(false);
  });

  it('leads with the free preview and keeps Starter as the secondary end link', () => {
    const mid = getInsightsCta('mid', true);
    const end = getInsightsCta('end', true);
    expect(mid.primary).toMatchObject({ href: '/free-preview', label: 'Get my free preview' });
    expect(mid.secondary).toBeUndefined();
    expect(end.primary.href).toBe('/free-preview');
    expect(end.secondary).toMatchObject({ href: '/starter' });
    expect(end.secondary!.label).toContain('£0/month');
    expect(mid.body).toContain('£39/month per location');
  });

  it('falls back to Full KERSIVO pricing when the free preview flow is off', () => {
    const mid = getInsightsCta('mid', false);
    expect(mid.primary.href).toBe('/pricing');
    expect(mid.body).not.toMatch(/preview/i);
    expect(getInsightsCta('end', false).secondary?.href).toBe('/starter');
  });

  it('splits before the middle body heading, never inside References', () => {
    const html = '<p>a</p><h2 id="one">One</h2><p>b</p><h2 id="two">Two</h2><p>c</p><h2 id="three">Three</h2><hr><h2 id="references">References</h2>';
    const split = splitInsightsBodyAtMiddle(html.slice(0, findInsightsReferencesStart(html)))!;
    expect(split.after.startsWith('<h2 id="two">')).toBe(true);
    expect(findInsightsReferencesStart(html)).toBe(html.indexOf('<hr>'));
    expect(splitInsightsBodyAtMiddle('<p>a</p><h2>Only</h2><p>b</p>')).toBeUndefined();
  });

  it('every owner-facing article has at least two body sections to place the mid CTA between', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES.filter((a) => hasInsightsCta(a.slug))) {
      const headings = displayHtml(article.slug)
        .split(/\n(?=#{2} )/)
        .filter((block) => /^## /.test(block) && !/^## (References|Sources)\b/.test(block));
      expect(headings.length, article.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('the article layout renders both CTAs only for owner-facing articles', () => {
    const layout = readFileSync('src/layouts/InsightsArticleLayout.astro', 'utf8');
    expect(layout).toContain('const showCta = isPublic && hasInsightsCta(slug);');
    expect(layout).toContain('<InsightsCta cta={midCta} />');
    expect(layout).toContain('<InsightsCta cta={endCta} />');
  });
});

describe('Contextual cross-links', () => {
  it('the cost calculator links to the fees report and back', () => {
    expect(readFileSync('src/components/costCalculator/CostMarketplaceFees.astro', 'utf8')).toContain('href={FEES_REPORT_PAGE_PATH}');
    expect(readFileSync('src/pages/barber-booking-fees-uk/index.astro', 'utf8')).toContain('href="/barber-software-cost-calculator"');
  });

  it('the walk-ins article links to /barbershop-online-booking', () => {
    expect(displayHtml('barbershop-walk-ins-vs-appointments')).toContain('](/barbershop-online-booking)');
  });
});
