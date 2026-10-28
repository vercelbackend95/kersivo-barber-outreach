import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import {
  COMMERCIAL_LINK_LIMIT,
  getInsightsCommercialNext,
  getInsightsRelatedLinks,
  isInsightsCommercialHref,
} from './insightsLinking';

const pagesRoot = join(process.cwd(), 'src/pages');

describe('Insights linking map', () => {
  it('points related and commercial destinations at routes that exist in the app', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const links = [...getInsightsRelatedLinks(article.slug)];
      const commercial = getInsightsCommercialNext(article.slug);
      if (commercial) links.push({ href: commercial.href, label: commercial.label, kind: 'guide' });

      for (const link of links) {
        const pathname = link.href.split('#')[0];
        if (pathname.startsWith('/insights/') && pathname !== '/insights') {
          const slug = pathname.replace('/insights/', '');
          expect(INSIGHTS_PUBLISHED_ARTICLES.some((item) => item.slug === slug), pathname).toBe(true);
          continue;
        }

        const candidates = [
          join(pagesRoot, pathname.slice(1), 'index.astro'),
          join(pagesRoot, `${pathname.slice(1)}.astro`),
        ];
        expect(
          candidates.some((candidate) => existsSync(candidate)),
          `${pathname} missing among ${candidates.join(' | ')}`,
        ).toBe(true);
      }
    }
  });
});

/** Commercial links in the article body, excluding the numbered References / Sources list. */
function bodyCommercialLinks(slug: string): string[] {
  const md = readFileSync(join(process.cwd(), 'editorial-staging/insights', `${slug}-display.md`), 'utf8');
  const refsAt = md.search(/^## (References|Sources)\b/m);
  const body = refsAt < 0 ? md : md.slice(0, refsAt);
  return [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter(isInsightsCommercialHref);
}

const BUYER_ADJACENT = [
  'barbershop-no-show-cost-when-deposit-makes-sense',
  'barbershop-walk-ins-vs-appointments',
  'google-business-profile-booking-link-barbershop',
  'do-barbers-need-a-website-uk',
  'barbershop-client-retention-second-visit',
  'barbershop-christmas-opening-hours-planning',
  'how-to-price-haircut-uk-barber',
  'google-reviews-barbershop-uk-rules',
  'get-more-barbershop-clients-locally-uk',
  'barbershop-card-payment-fees-uk',
];

const OFF_BUYER = [
  'making-tax-digital-barbers',
  'unfair-dismissal-six-months-barbershop-employers',
  'apprentice-barber-funding-costs-2026',
  'barbershop-business-rates-2026-england',
  'barber-commission-pay-minimum-wage-uk',
  'barber-dermatitis-skin-care-hse',
  'barbershop-gift-vouchers-uk',
];

describe('Insights commercial link budget (Batch 5)', () => {
  const commercialLinks = (slug: string) => [
    ...bodyCommercialLinks(slug),
    ...getInsightsRelatedLinks(slug).filter((link) => link.kind !== 'article').map((link) => link.href),
    ...(getInsightsCommercialNext(slug) ? [getInsightsCommercialNext(slug)!.href] : []),
  ];

  it('classifies every published article', () => {
    const neutral = ['how-much-do-barbershop-owners-make-uk', 'busy-barbershop-low-profit-chair-hour', 'barbershop-loyalty-scheme-uk'];
    expect([...BUYER_ADJACENT, ...OFF_BUYER, ...neutral].sort()).toEqual(
      INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.slug).sort(),
    );
  });

  it('keeps every article at or under the commercial link limit', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      expect(commercialLinks(article.slug).length, article.slug).toBeLessThanOrEqual(COMMERCIAL_LINK_LIMIT);
    }
  });

  it('gives each buyer-adjacent article one end box and at least one contextual product link', () => {
    for (const slug of BUYER_ADJACENT) {
      const next = getInsightsCommercialNext(slug);
      expect(next, slug).toBeDefined();
      expect(isInsightsCommercialHref(next!.href), slug).toBe(true);
      expect(commercialLinks(slug).length, slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('forces no product links into off-buyer articles', () => {
    for (const slug of OFF_BUYER) {
      expect(commercialLinks(slug), slug).toEqual([]);
    }
  });

  it('keeps 0% KERSIVO commission next to the Stripe fees note in end boxes', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const note = getInsightsCommercialNext(article.slug)?.note ?? '';
      if (/0% KERSIVO commission/.test(note)) expect(note, article.slug).toMatch(/Stripe[^.]*fees/);
    }
  });
});
