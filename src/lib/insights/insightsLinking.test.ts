import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import {
  COMMERCIAL_LINK_LIMIT,
  getInsightsAudience,
  getInsightsCommercialNext,
  getInsightsOwnerNote,
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

/** Every link in the article body (Markdown links and HTML tool callouts), excluding the References / Sources list. */
function bodyLinks(slug: string): string[] {
  const md = readFileSync(join(process.cwd(), 'editorial-staging/insights', `${slug}-display.md`), 'utf8');
  const refsAt = md.search(/^## (References|Sources)\b/m);
  const body = refsAt < 0 ? md : md.slice(0, refsAt);
  return [
    ...[...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]),
    ...[...body.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]),
  ];
}

/** Commercial links in the article body, tool callouts included. */
function bodyCommercialLinks(slug: string): string[] {
  return bodyLinks(slug).filter(isInsightsCommercialHref);
}

/** Free tools: allowed in off-buyer articles, still counted in the commercial budget where listed as commercial. */
const FREE_TOOL_PATHS = [
  '/barbershop-no-show-calculator',
  '/barbershop-cancellation-policy-template',
  '/chair-rent-vs-commission-calculator',
  '/barber-software-cost-calculator',
];

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
    ...(getInsightsCommercialNext(slug)?.secondary ? [getInsightsCommercialNext(slug)!.secondary!.href] : []),
    ...(getInsightsOwnerNote(slug) ? [getInsightsOwnerNote(slug)!.href].filter(isInsightsCommercialHref) : []),
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

  it('forces no product links into off-buyer articles (free tools only)', () => {
    for (const slug of OFF_BUYER) {
      const productLinks = commercialLinks(slug).filter((href) => !FREE_TOOL_PATHS.includes(href.split('#')[0]));
      expect(productLinks, slug).toEqual([]);
      expect(getInsightsCommercialNext(slug), slug).toBeUndefined();
    }
  });

  it('keeps 0% KERSIVO commission next to the Stripe fees note in end boxes', () => {
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const note = getInsightsCommercialNext(article.slug)?.note ?? '';
      if (/0% KERSIVO commission/.test(note)) expect(note, article.slug).toMatch(/Stripe[^.]*fees/);
    }
  });
});

describe('Owner-intent bridges', () => {
  const OWNER_NOTE_SLUGS = [
    'apprentice-barber-funding-costs-2026',
    'barber-dermatitis-skin-care-hse',
    'barbershop-business-rates-2026-england',
    'barber-commission-pay-minimum-wage-uk',
  ];
  const sourceText = (slug: string) =>
    readFileSync(join(process.cwd(), 'editorial-staging/insights', `${slug}.md`), 'utf8');

  it('gives each off-buyer article that draws employed barbers an "If you own the shop" note', () => {
    for (const slug of OWNER_NOTE_SLUGS) {
      const note = getInsightsOwnerNote(slug);
      expect(note, slug).toBeDefined();
      expect(note!.href.startsWith('/insights/'), slug).toBe(true);
      expect(INSIGHTS_PUBLISHED_ARTICLES.some((a) => a.path === note!.href), slug).toBe(true);
      expect(isInsightsCommercialHref(note!.href), slug).toBe(false);
    }
  });

  it('only quotes figures that the linked owner article already publishes', () => {
    for (const slug of OWNER_NOTE_SLUGS) {
      const note = getInsightsOwnerNote(slug)!;
      const target = note.href.replace('/insights/', '');
      const corpus = sourceText(target) + sourceText(slug);
      for (const figure of note.body.match(/£[\d,]+|\d+%/g) ?? []) {
        expect(corpus.includes(figure), `${slug}: ${figure}`).toBe(true);
      }
    }
  });

  it('points the owner-earnings article at the free preview', () => {
    const next = getInsightsCommercialNext('how-much-do-barbershop-owners-make-uk');
    expect(next?.href).toBe('/free-preview');
    expect(next?.note).toMatch(/£39\/month per location/);
    expect(next?.note).toMatch(/0% KERSIVO commission[^]*Stripe[^.]*fees/);
    expect(getInsightsRelatedLinks('how-much-do-barbershop-owners-make-uk').filter((l) => l.kind !== 'article')).toEqual([]);
  });

  it('adds the free preview as a second step on the walk-ins end box', () => {
    expect(isInsightsCommercialHref('/free-preview')).toBe(true);
    expect(getInsightsCommercialNext('barbershop-walk-ins-vs-appointments')?.secondary?.href).toBe('/free-preview');
  });

  it('labels the audience only where the headline does not already name shop owners', () => {
    expect(getInsightsAudience('barber-commission-pay-minimum-wage-uk')).toBe('For shop owners who employ barbers');
    expect(getInsightsAudience('barber-dermatitis-skin-care-hse')).toBe('For barbershop owners and managers');
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      if (/owner/i.test(article.headline)) expect(getInsightsAudience(article.slug), article.slug).toBeUndefined();
    }
  });
});

describe('Insights → free tools contextual links', () => {
  /** Articles about no-shows, deposits or cancellations. */
  const NO_SHOW_TOPIC = [
    'barbershop-no-show-cost-when-deposit-makes-sense',
    'barbershop-walk-ins-vs-appointments',
    'do-barbers-need-a-website-uk',
  ];
  /** Articles about pay, commission or chair rent. */
  const PAY_TOPIC = [
    'barber-commission-pay-minimum-wage-uk',
    'how-much-do-barbershop-owners-make-uk',
    'busy-barbershop-low-profit-chair-hour',
  ];

  it('links no-show, deposit and cancellation articles to the no-show calculator and the policy template', () => {
    for (const slug of NO_SHOW_TOPIC) {
      expect(bodyLinks(slug), slug).toContain('/barbershop-no-show-calculator');
      expect(bodyLinks(slug), slug).toContain('/barbershop-cancellation-policy-template');
    }
  });

  it('links the card fees article (split deposit payments) to the no-show calculator', () => {
    expect(bodyLinks('barbershop-card-payment-fees-uk')).toContain('/barbershop-no-show-calculator');
  });

  it('links pay, commission and chair rent articles to the chair rent calculator', () => {
    for (const slug of PAY_TOPIC) {
      expect(bodyLinks(slug), slug).toContain('/chair-rent-vs-commission-calculator');
    }
  });
});
