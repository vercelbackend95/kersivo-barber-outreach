import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOOKSY_ALTERNATIVE_DESCRIPTION,
  BOOKSY_ALTERNATIVE_FAQ_ITEMS,
  BOOKSY_ALTERNATIVE_H1,
  BOOKSY_ALTERNATIVE_H1_LINES,
  BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO,
  BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL,
  BOOKSY_ALTERNATIVE_PAGE_PATH,
  BOOKSY_ALTERNATIVE_TITLE,
  buildBooksyAlternativeFaqJsonLd,
} from './booksyAlternativeFaq';
import {
  BK_CARD_FEES,
  BK_COMMISSION_LEAD,
  BK_DOMAIN_LEAD,
  BK_DOMAIN_POINTS,
  BK_HERO_FACTS,
  BK_HERO_LEAD,
  BK_MIGRATION_MOVES,
  BK_OUTCOMES,
  BK_OUTCOMES_LEAD,
  BK_RELATIONSHIP_LEAD,
  BK_RELATIONSHIP_STEPS,
  BK_SCOREBOARD,
  BK_SWITCHING_LEAD,
  BOOKSY_BOOST_EXAMPLE,
  BOOKSY_BOOST_POINTS,
  BOOKSY_COSTS_INTRO,
  BOOKSY_COST_ITEMS,
  BOOKSY_FIT_CLOSING,
  BOOKSY_FIT_PATHS,
  BOOKSY_QUICK_ANSWER,
  BOOKSY_QUICK_ANSWER_FACTS,
  BOOKSY_QUICK_ANSWER_KICKER,
  BOOKSY_QUICK_ANSWER_TITLE,
  BOOKSY_SWITCHING_LIMITS,
  BOOKSY_SWITCHING_REASSURANCE,
  BOOKSY_SWITCHING_STEPS,
  BOOKSY_WORKED_EXAMPLES,
  BOOKSY_WORKED_EXAMPLES_NOTE,
} from './booksyAlternativeContent';
import { buildBooksyAlternativeWebPageJsonLd, buildBooksyAlternativeBreadcrumbJsonLd } from './booksyAlternativeJsonLd';
import {
  BOOKSY_ADDITIONAL_USER_GBP,
  BOOKSY_BASE_PRICE_GBP,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_COMPARE_SECTIONS,
  BOOKSY_COMPARISON_FOOTNOTE,
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_FACTS_CHECKED_ISO,
  BOOKSY_MOBILE_PAYMENTS_FIXED_GBP,
  BOOKSY_MOBILE_PAYMENTS_PERCENT,
  BOOKSY_SOURCES,
  BOOKSY_SOURCE_BOOST,
  BOOKSY_SOURCE_PRICING,
  BOOKSY_TRADEMARK_DISCLAIMER,
  BOOKSY_UK_COMMERCIAL_FACTS,
  type BooksyCommercialFactKey,
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
  getBooksySource,
  isVerifiedBooksyFact,
  requireVerifiedBooksyFact,
} from './booksyFacts';
import { SAAS_MONTHLY_GBP } from './defaults';
import { resolveCanonicalUrl } from './meta';
import { buildMarketingSitemapEntries, buildMarketingSitemapXml } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const componentDir = '../../components/booksyAlternative';
const pageSource = readRepoFile('../../pages/booksy-alternative/index.astro');
const homepageSource = readRepoFile('../../pages/index.astro');
const homepageIncludedSource = readRepoFile('../../components/homeV2/HomeV2Included.astro');
const calculatorBooksySource = readRepoFile('../../components/costCalculator/CostBooksy.astro');
const freshaFitSource = readRepoFile('../../components/freshaAlternative/FreshaFit.astro');
const factsSource = readRepoFile('booksyFacts.ts');
const contentSource = readRepoFile('booksyAlternativeContent.ts');
const faqSource = readRepoFile('booksyAlternativeFaq.ts');

const componentNames = [
  'BooksyHero',
  'BooksyAnswer',
  'BooksyOutcomes',
  'BooksyBill',
  'BooksyCommission',
  'BooksyScoreboard',
  'BooksyCompare',
  'BooksyOwnership',
  'BooksySwitching',
  'BooksyProof',
  'BooksyFit',
  'BooksyPricing',
  'BooksySources',
] as const;

type ComponentName = (typeof componentNames)[number];

const components = Object.fromEntries(
  componentNames.map((name) => [name, readRepoFile(componentDir, `${name}.astro`)]),
) as Record<ComponentName, string>;

const bodySources = [pageSource, ...Object.values(components)];

function countLinks(source: string, href: string): number {
  return source.split(`href="${href}"`).length - 1;
}

/** Every string a visitor can read on the page that comes from data modules. */
const visibleCopy = [
  BOOKSY_QUICK_ANSWER,
  ...BOOKSY_QUICK_ANSWER_FACTS.map((fact) => `${fact.label} ${fact.value}`),
  BK_HERO_LEAD,
  ...BK_HERO_FACTS,
  BK_OUTCOMES_LEAD,
  ...BK_OUTCOMES.map((outcome) => `${outcome.kicker} ${outcome.title} ${outcome.body}`),
  BOOKSY_COSTS_INTRO,
  ...BOOKSY_COST_ITEMS.flatMap((item) => [item.kicker, item.figure, item.unit, ...item.notes]),
  ...BOOKSY_WORKED_EXAMPLES.flatMap((row) => Object.values(row)),
  BOOKSY_WORKED_EXAMPLES_NOTE,
  BK_COMMISSION_LEAD,
  ...BOOKSY_BOOST_POINTS,
  BOOKSY_BOOST_EXAMPLE,
  ...BK_CARD_FEES.map((row) => `${row.label} ${row.booksy} ${row.kersivo}`),
  ...BK_SCOREBOARD.map((row) => `${row.label} ${row.booksy} ${row.kersivo}`),
  BK_DOMAIN_LEAD,
  ...BK_DOMAIN_POINTS,
  BK_RELATIONSHIP_LEAD,
  ...BK_RELATIONSHIP_STEPS.map((step) => `${step.title} ${step.body}`),
  BK_SWITCHING_LEAD,
  ...BK_MIGRATION_MOVES.map((item) => `${item.title} ${item.body}`),
  ...BOOKSY_COMPARE_SECTIONS.flatMap((section) => [
    section.title,
    section.subtitle,
    section.booksyLead,
    ...section.booksyPoints,
    section.kersivoLead,
    ...section.kersivoPoints,
  ]),
  BOOKSY_COMPARISON_FOOTNOTE,
  ...BOOKSY_FIT_PATHS.flatMap((path) => [
    path.label,
    path.descriptor,
    path.heading,
    ...path.points,
    ...(path.summary ?? []).map((row) => `${row.label} ${row.value}`),
  ]),
  BOOKSY_FIT_CLOSING,
  BOOKSY_SWITCHING_REASSURANCE,
  ...BOOKSY_SWITCHING_STEPS.map((step) => `${step.title} ${step.body}`),
  ...BOOKSY_SWITCHING_LIMITS,
  ...BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
  ...BOOKSY_SOURCES.map((source) => `${source.label} ${source.supports}`),
  BOOKSY_TRADEMARK_DISCLAIMER,
].join('\n');

const renderedCorpus = [visibleCopy, ...bodySources].join('\n');

describe('booksy-alternative: metadata and URL', () => {
  it('keeps the URL and uses a query-first title and a SERP-length description that sells the switch', () => {
    expect(BOOKSY_ALTERNATIVE_PAGE_PATH).toBe('/booksy-alternative');
    expect(BOOKSY_ALTERNATIVE_TITLE).toBe(`Booksy Alternative UK for Barbers: Own Site, £${SAAS_MONTHLY_GBP}/Month`);
    expect(BOOKSY_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
    expect(BOOKSY_ALTERNATIVE_H1).toBe('The Booksy alternative with your name on the door');
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    for (const phrase of ['Booksy', 'domain', `£${SAAS_MONTHLY_GBP}/month per location`, 'no per-barber fees', 'moving clients', '0% KERSIVO commission', 'Stripe fees apply']) {
      expect(BOOKSY_ALTERNATIVE_DESCRIPTION).toContain(phrase);
    }
  });

  it('wires LandingLayout with title, description, canonical and the JSON-LD blocks, without noindex', () => {
    expect(pageSource).toContain('title={BOOKSY_ALTERNATIVE_TITLE}');
    expect(pageSource).toContain('description={BOOKSY_ALTERNATIVE_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={BOOKSY_ALTERNATIVE_PAGE_PATH}');
    expect(pageSource).toContain(
      'jsonLd={[buildKersivoSoftwareApplicationJsonLd(), buildKersivoEntityJsonLd(), buildBooksyAlternativeWebPageJsonLd(), buildBooksyAlternativeBreadcrumbJsonLd(), buildBooksyAlternativeFaqJsonLd()]}',
    );
    expect(pageSource).not.toMatch(/noindex|Astro\.redirect/);
    expect(resolveCanonicalUrl(BOOKSY_ALTERNATIVE_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/booksy-alternative',
    );
    expect(MARKETING_NAV_ITEMS.some((item) => item.href === BOOKSY_ALTERNATIVE_PAGE_PATH)).toBe(true);
  });

  it('renders exactly one H1, in the hero, built from the H1 lines', () => {
    expect(BOOKSY_ALTERNATIVE_H1_LINES.join(' ')).toBe(BOOKSY_ALTERNATIVE_H1);
    const h1Count = bodySources.reduce((total, source) => total + (source.match(/<h1\b/g)?.length ?? 0), 0);
    expect(h1Count).toBe(1);
    expect(components.BooksyHero).toMatch(/<h1\b/);
    for (const line of ['{firstLine}', '{secondLine}', '{thirdLine}']) expect(components.BooksyHero).toContain(line);
  });
});

describe('booksy-alternative: owner-first structure', () => {
  it('runs the sections in the sales order', () => {
    const order = [
      '<BooksyHero',
      '<BooksyAnswer',
      '<BooksyOutcomes',
      '<BooksyBill',
      '<BooksyCommission',
      '<BooksyScoreboard',
      '<BooksyCompare',
      '<BooksyOwnership',
      '<BooksySwitching',
      '<BooksyProof',
      '<BooksyFit',
      '<BooksyPricing',
      '<Faq4',
      '<ComparisonFinalCta',
      '<Contact16',
      '<BooksySources',
      '<Footer50',
    ];
    const positions = order.map((tag) => pageSource.indexOf(tag));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const name of ['BooksyQuickAnswer', 'BooksyWhy', 'BooksyCosts']) {
      expect(existsSync(join(here, componentDir, `${name}.astro`))).toBe(false);
    }
  });

  it('uses its own scoped stylesheet on top of the shared comparison styles, and boots one page script', () => {
    expect(pageSource).toContain("import '@/styles/components/fresha-alternative.css';");
    expect(pageSource).toContain("import '@/styles/components/booksy-alternative.css';");
    expect(pageSource).toContain('<main class="fresha-alt bk landing-overflow-guard">');
    expect(pageSource).toContain("import { initBooksyPage } from '@/lib/landing/booksyPage';");
    const css = readRepoFile('../../styles/components/booksy-alternative.css');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.bk-motion [data-bk-reveal]:not(.is-in)');
  });

  it('hero carries the breadcrumb, approved CTAs, price and commission with Stripe nearby', () => {
    const hero = components.BooksyHero;
    expect(hero).toContain('<ComparisonHeroActions placement="booksy" />');
    expect(hero).toContain('£{SAAS_MONTHLY_GBP}/month per location');
    expect(hero).toContain('0% KERSIVO commission · Stripe fees apply');
    expect(hero).toContain('data-bk-browser');
    expect(hero).toContain('aria-pressed');
    expect(hero).not.toMatch(/iframe/i);
    expect(BK_HERO_FACTS.join(' ')).toContain('0% KERSIVO commission · Stripe fees apply');
    expect(BK_HERO_FACTS.join(' ')).toContain('a few days');
  });

  it('keeps proof, pricing and final CTA on the shared components', () => {
    for (const label of ['ADMIN SYSTEM', 'CLIENT BOOKING EXPERIENCE', 'RETAIL PICKUP SHOP']) {
      expect(components.BooksyProof).toContain(label);
    }
    expect(components.BooksyProof).not.toMatch(/prisma|@\/lib\/db|resolveLandingBookingData/);
    expect(components.BooksyPricing).toContain('id="pricing"');
    expect(components.BooksyPricing).toContain('<RateCard1Offer freePreview={freePreview} />');
    expect(components.BooksyPricing).toContain('KERSIVO Starter');
    expect(components.BooksyPricing).toContain('href="/starter"');
    expect(components.BooksyFit).toContain('<ModelComparison');
    expect(pageSource).toContain('<ComparisonFinalCta placement="booksy" competitor="Booksy" />');
    expect(pageSource).toContain('title="Still comparing KERSIVO and Booksy?"');
    expect(pageSource).not.toMatch(/id=["']contact["']/);
  });
});

describe('booksy-alternative: Quick Answer', () => {
  it('states the short version within 70–110 words with both commercial models', () => {
    expect(BOOKSY_QUICK_ANSWER_KICKER).toBe('The short version');
    expect(BOOKSY_QUICK_ANSWER_TITLE).toContain('leave Booksy');
    const words = BOOKSY_QUICK_ANSWER.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(70);
    expect(words).toBeLessThanOrEqual(110);
    expect(BOOKSY_QUICK_ANSWER).toContain(`Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location`);
    expect(BOOKSY_QUICK_ANSWER).toContain('KERSIVO Starter is £0/month for up to 4 barbers');
    expect(BOOKSY_QUICK_ANSWER.indexOf('Full KERSIVO')).toBeLessThan(BOOKSY_QUICK_ANSWER.indexOf('KERSIVO Starter'));
    expect(BOOKSY_QUICK_ANSWER).toContain('KERSIVO commission is 0%');
    expect(BOOKSY_QUICK_ANSWER).toContain('Stripe processing fees still apply');
    expect(BOOKSY_QUICK_ANSWER).toContain(`£${BOOKSY_BASE_PRICE_GBP} a month plus VAT`);
    expect(BOOKSY_QUICK_ANSWER).toContain(`£${BOOKSY_ADDITIONAL_USER_GBP} a month plus VAT for each additional user`);
    expect(BOOKSY_QUICK_ANSWER).toContain('Standard Marketplace bookings are free when Boost is off');
    expect(BOOKSY_QUICK_ANSWER_FACTS).toHaveLength(4);
    expect(components.BooksyAnswer).toContain('id="quick-answer"');
  });
});

describe('booksy-alternative: costs and commission', () => {
  it('renders the bill with the approved H2, an interactive team-size slider and checked-date sources', () => {
    const bill = components.BooksyBill;
    expect(bill).toContain('id="booksy-pricing"');
    expect(bill).toContain('Booksy pricing and fees for UK barbers');
    expect(bill).toContain('Subscription cost by team size');
    expect(bill).toContain('type="range"');
    expect(bill).toContain('data-bk-team');
    expect(bill).toContain("getBooksySource('pricingUk')");
    expect(bill).toContain("getBooksySource('boost')");
    expect(bill).toContain('rel="noopener noreferrer"');
    expect(BOOKSY_COSTS_INTRO).toContain(BOOKSY_FACTS_CHECKED_DATE);
  });

  it('computes the 1 / 3 / 5 worked examples from the verified facts', () => {
    expect(BOOKSY_WORKED_EXAMPLES.map((row) => [row.label, row.booksyExVat, row.booksyIncVat, row.kersivo])).toEqual([
      ['Solo barber', '£40', '£48', '£39 Full or £0 Starter'],
      ['3 users', '£50', '£60', '£39 Full or £0 Starter'],
      ['5 users', '£60', '£72', '£39 Full'],
    ]);
    for (const users of [1, 3, 5]) {
      const estimate = estimateBooksyMonthlySubscription(users);
      expect(estimate.exVatGbp).toBe(BOOKSY_BASE_PRICE_GBP + BOOKSY_ADDITIONAL_USER_GBP * (users - 1));
      expect(estimate.incVatGbp).toBeCloseTo(estimate.exVatGbp * 1.2, 2);
    }
    expect(contentSource).toContain('estimateBooksyMonthlySubscription(size)');
    expect(contentSource).not.toMatch(/'£(40|48|50|60|72)'/);
    expect(BOOKSY_WORKED_EXAMPLES_NOTE).toMatch(/^Subscription cost only/);
    expect(BOOKSY_WORKED_EXAMPLES_NOTE).toContain('Boost');
  });

  it('places exactly one plain calculator link directly after the worked-examples note', () => {
    const bill = components.BooksyBill;
    const paragraph = bill.match(/<p class="bk-bill__calculator">([\s\S]*?)<\/p>/)?.[0] ?? '';
    expect(paragraph.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).toBe(
      'Want to run the numbers for your own shop? Use the Barber Software Cost Calculator to compare Booksy, Fresha and KERSIVO using your own shop numbers.',
    );
    expect(paragraph).toContain('<a href="/barber-software-cost-calculator">Barber Software Cost Calculator</a>');
    expect(paragraph).not.toMatch(/target=|nofollow|btn/);
    expect(bill.indexOf('{BOOKSY_WORKED_EXAMPLES_NOTE}')).toBeLessThan(bill.indexOf('<p class="bk-bill__calculator">'));
  });

  it('explains Boost with a computed example, the commission-free channels and an estimator', () => {
    expect(BOOKSY_BOOST_POINTS.join(' ')).toContain('free to turn on');
    expect(BOOKSY_BOOST_POINTS.join(' ')).toContain('Google Search');
    expect(estimateBooksyBoostFee(25)).toBe(7.5);
    expect(estimateBooksyBoostFee(15)).toBe(BOOKSY_BOOST_MINIMUM_GBP);
    expect(BOOKSY_BOOST_EXAMPLE).toContain('£7.50 plus VAT');
    expect(BOOKSY_BOOST_EXAMPLE).toContain(`£${BOOKSY_BOOST_MINIMUM_GBP} minimum applies`);
    expect(components.BooksyCommission).toContain('id="booksy-commission"');
    expect(components.BooksyCommission).toContain('data-bk-boost');
    expect(components.BooksyCommission).toContain('Boost is optional');
    expect(components.BooksyCommission).toContain('Stripe fees apply');
  });
});

describe('booksy-alternative: domain, direct relationship and migration', () => {
  it('scopes the own domain to Full KERSIVO and keeps domain ownership with the shop', () => {
    expect(components.BooksyOwnership).toContain('id="own-domain"');
    expect(components.BooksyOwnership).toContain('id="direct-clients"');
    const domain = BK_DOMAIN_POINTS.join(' ');
    expect(domain).toContain('Full KERSIVO includes one standard domain per location');
    expect(domain).toContain('You keep ownership');
    expect(domain).toContain('transferred to you');
    expect(BK_RELATIONSHIP_STEPS).toHaveLength(4);
  });

  it('lists what moves across from Booksy honestly, including what does not', () => {
    expect(BK_MIGRATION_MOVES.map((item) => item.status)).toContain('not');
    expect(BK_MIGRATION_MOVES.find((item) => item.status === 'not')?.title).toBe('Saved payment cards');
    expect(BK_SWITCHING_LEAD).toContain('a few days');
    expect(BK_SWITCHING_LEAD).not.toMatch(/\d+\s?(days|weeks)/);
  });
});

describe('booksy-alternative: facts registry', () => {
  it('stores the re-verified official UK facts with VAT, unit, source and checked date', () => {
    const expected: Partial<Record<BooksyCommercialFactKey, Record<string, unknown>>> = {
      baseSubscription: { amountGbp: 40, vat: 'exclusive', sourceId: 'pricingUk' },
      additionalUser: { amountGbp: 5, vat: 'exclusive', sourceId: 'pricingUk' },
      standardMarketplaceBooking: { amountGbp: 0, sourceId: 'pricingUk' },
      boostNewClientFee: { percent: 30, minimumGbp: 5, vat: 'exclusive', sourceId: 'boost' },
      mobilePayments: { percent: 1.29, amountGbp: 0.2, vat: 'exclusive', sourceId: 'payments' },
      tapToPay: { percent: 0.99, amountGbp: 0.2, vat: 'exclusive', sourceId: 'tapToPay' },
    };
    for (const [key, values] of Object.entries(expected)) {
      const fact = requireVerifiedBooksyFact(key as BooksyCommercialFactKey);
      expect(fact).toMatchObject({ status: 'verified', checkedIso: BOOKSY_FACTS_CHECKED_ISO, ...values });
      expect(fact.per.length).toBeGreaterThan(2);
      expect(() => getBooksySource(fact.sourceId)).not.toThrow();
    }
    expect(BOOKSY_BASE_PRICE_GBP).toBe(40);
    expect(BOOKSY_ADDITIONAL_USER_GBP).toBe(5);
    expect(BOOKSY_BOOST_COMMISSION_PERCENT).toBe(30);
    expect(BOOKSY_MOBILE_PAYMENTS_PERCENT).toBe(1.29);
    expect(BOOKSY_MOBILE_PAYMENTS_FIXED_GBP).toBe(0.2);
  });

  it('refuses to render unresolved facts and keeps their notes off the page', () => {
    const unresolved = (Object.keys(BOOKSY_UK_COMMERCIAL_FACTS) as BooksyCommercialFactKey[]).filter(
      (key) => !isVerifiedBooksyFact(BOOKSY_UK_COMMERCIAL_FACTS[key]),
    );
    expect(unresolved.length).toBeGreaterThan(0);
    for (const key of unresolved) {
      expect(() => requireVerifiedBooksyFact(key)).toThrow(/unresolved/);
      const fact = BOOKSY_UK_COMMERCIAL_FACTS[key];
      if (fact.status === 'unresolved') expect(renderedCorpus).not.toContain(fact.note);
      for (const source of [contentSource, faqSource, ...bodySources]) {
        expect(source).not.toContain(`requireVerifiedBooksyFact('${key}')`);
      }
    }
  });

  it('registers every required official source with an en-gb URL and what it supports', () => {
    const ids = BOOKSY_SOURCES.map((source) => source.id);
    for (const id of ['pricingUk', 'boost', 'marketplace', 'onlineBooking', 'payments', 'tapToPay', 'noShowProtection']) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(BOOKSY_SOURCES.map((source) => source.url)).size).toBe(BOOKSY_SOURCES.length);
    for (const source of BOOKSY_SOURCES) {
      expect(source.url).toMatch(/^https:\/\/(biz|support)\.booksy\.com\/(en-gb|hc\/en-gb)\//);
      expect(source.supports.length).toBeGreaterThan(10);
    }
    expect(BOOKSY_SOURCE_PRICING).toBe('https://biz.booksy.com/en-gb/pricing');
    expect(BOOKSY_SOURCE_BOOST).toBe('https://biz.booksy.com/en-gb/features/boost');
    expect(BOOKSY_SOURCES.some((source) => /\/en-gb\/features\/?$/.test(source.url))).toBe(false);
    for (const section of BOOKSY_COMPARE_SECTIONS) {
      expect(section.booksySourceIds.length).toBeGreaterThan(0);
      for (const id of section.booksySourceIds) expect(ids).toContain(id);
    }
  });

  it('never renders the stale generic-Features Boost figures (40% / £10)', () => {
    expect(renderedCorpus).not.toMatch(/(?<![\d.])40\s?%/);
    expect(renderedCorpus).not.toMatch(/£10(?![\d.])/);
    expect(factsSource).not.toMatch(/(?<![\d.])40\s?%|£10(?![\d.])/);
  });

  it('keeps hand-written Booksy prices out of components', () => {
    for (const source of Object.values(components)) {
      expect(source).not.toMatch(/£\s?(40|5|48|60|72)\b/);
      expect(source).not.toMatch(/\b(30|1\.29|0\.99)\s?%/);
    }
  });
});

describe('booksy-alternative: comparison, fit, switching', () => {
  it('uses the six Fresha comparison categories with Booksy and KERSIVO sides', () => {
    expect(BOOKSY_COMPARE_SECTIONS.map((section) => section.title)).toEqual([
      'Bookings',
      'Payments & Deposits',
      'Brand & Domain',
      'Retail & Upsells',
      'Clients & Communication',
      'Reports & Admin',
    ]);
    for (const section of BOOKSY_COMPARE_SECTIONS) {
      expect(section.booksyLead.length).toBeGreaterThan(10);
      expect(section.booksyPoints.length).toBeGreaterThanOrEqual(3);
      expect(section.kersivoLead.length).toBeGreaterThan(10);
      expect(section.kersivoPoints.length).toBeGreaterThanOrEqual(3);
    }
    const compare = components.BooksyCompare;
    expect(compare).toContain('id="comparison"');
    expect(compare).toContain('BOOKSY_COMPARE_SECTIONS');
    expect(compare).toContain('data-booksy-comparison');
    expect(compare).toContain('<a href="#sources">See sources</a>');
    const booksyCopy = BOOKSY_COMPARE_SECTIONS.flatMap((s) => [s.booksyLead, ...s.booksyPoints]).join(' ');
    for (const feature of ['Reserve with Google', 'widget', 'Instagram', 'Marketplace', 'Booksy for Customers app', 'Deposits']) {
      expect(booksyCopy).toContain(feature);
    }
  });

  it('presents both models neutrally, with Booksy as marketplace + ecosystem', () => {
    const [booksy, kersivo] = BOOKSY_FIT_PATHS;
    expect(booksy.label).toBe('Booksy');
    expect(booksy.descriptor).toBe('Marketplace + booking ecosystem');
    expect(booksy.heading).toBe('Booksy may suit your shop if…');
    expect(booksy.points.join(' ')).toMatch(/Boost/);
    expect(booksy.points.join(' ')).toMatch(/additional user/);
    expect(kersivo.descriptor).toBe('Own-brand booking model');
    expect(kersivo.points.join(' ')).toContain('0% KERSIVO commission');
    const paymentSection = BOOKSY_COMPARE_SECTIONS.find((section) => section.id === 'payments');
    expect(paymentSection?.kersivoPoints.join(' ')).toContain('Starter: public bookings use a £5 deposit or Pay in full');
    expect(paymentSection?.kersivoPoints.join(' ')).toContain('Full: choose Pay at shop');
    expect(BOOKSY_FIT_CLOSING).toContain('Neither model is right for every barbershop');
  });

  it('describes switching in six cautious steps', () => {
    expect(components.BooksySwitching).toContain('Switching from Booksy to KERSIVO');
    expect(BOOKSY_SWITCHING_STEPS.map((step) => step.title)).toEqual([
      'Keep Booksy live',
      'Export what Booksy makes available',
      'We review and map compatible data',
      'We prepare your setup',
      'You review a private preview',
      'Switch when you approve',
    ]);
    expect(BOOKSY_SWITCHING_REASSURANCE).toBe('Keep Booksy live while your KERSIVO setup is prepared.');
    expect(BOOKSY_SWITCHING_LIMITS.join(' ')).toContain('depends on what Booksy sends');
    expect(getBooksySource('clientList').url).toContain('support.booksy.com/hc/en-gb');
  });
});

describe('booksy-alternative: FAQ and schema', () => {
  it('has 13 FAQs covering the required questions with no "best" claims', () => {
    expect(BOOKSY_ALTERNATIVE_FAQ_ITEMS).toHaveLength(13);
    const questions = BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => item.question.toLowerCase()).join('\n');
    for (const topic of [
      'good booksy alternative',
      'booksy cost',
      'boost work',
      'cheaper',
      'per barber',
      'commission',
      'move my clients from booksy',
      'keep booksy running',
      'app',
      'marketplace',
      'own domain',
      'how long',
    ]) {
      expect(questions).toContain(topic);
    }
    expect(renderedCorpus.toLowerCase()).not.toMatch(/\bbest\b/);
    expect(pageSource).toContain('faqs={BOOKSY_ALTERNATIVE_FAQ_ITEMS}');
  });

  it('FAQPage JSON-LD mirrors the visible FAQ exactly', () => {
    const faqLd = buildBooksyAlternativeFaqJsonLd();
    expect(faqLd['@id']).toBe('https://kersivo.co.uk/booksy-alternative#faq');
    const entities = faqLd.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities.map((entity) => entity.name)).toEqual(BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(
      BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => item.answer),
    );
  });

  it('WebPage JSON-LD carries canonical url, en-GB, dateModified and no review markup', () => {
    const webPage = buildBooksyAlternativeWebPageJsonLd();
    expect(webPage).toMatchObject({
      '@type': 'WebPage',
      '@id': 'https://kersivo.co.uk/booksy-alternative#webpage',
      url: 'https://kersivo.co.uk/booksy-alternative',
      name: BOOKSY_ALTERNATIVE_TITLE,
      description: BOOKSY_ALTERNATIVE_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO,
    });
    expect(webPage.isPartOf).toBeTruthy();
    expect(webPage.publisher).toBeTruthy();
    const serialized = JSON.stringify([webPage, buildBooksyAlternativeFaqJsonLd()]);
    for (const banned of ['Review', 'AggregateRating', 'aggregateRating', 'LocalBusiness', 'Product', 'SoftwareApplication']) {
      expect(serialized).not.toContain(banned);
    }
  });
});

describe('booksy-alternative: visible breadcrumb and BreadcrumbList JSON-LD', () => {
  it('links the WebPage breadcrumb to a canonical two-step list matching the visible navigation', () => {
    expect(components.BooksyHero).toContain('aria-label="Breadcrumb"');
    expect(components.BooksyHero).toContain('<a href="/">Home</a>');
    expect(components.BooksyHero).toContain('aria-current="page">Booksy alternative</span>');
    expect((components.BooksyHero.match(/aria-label="Breadcrumb"/g) ?? [])).toHaveLength(1);
    expect(pageSource).toContain('buildBooksyAlternativeBreadcrumbJsonLd()');

    const breadcrumb = buildBooksyAlternativeBreadcrumbJsonLd();
    const pageUrl = resolveCanonicalUrl(BOOKSY_ALTERNATIVE_PAGE_PATH);
    expect(breadcrumb['@context']).toBe('https://schema.org');
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb['@id']).toBe(`${pageUrl}#breadcrumb`);
    expect(breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://kersivo.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Booksy alternative', item: pageUrl },
    ]);
    expect(buildBooksyAlternativeWebPageJsonLd().breadcrumb).toEqual({ '@id': breadcrumb['@id'] });
  });
});

describe('booksy-alternative: freshness, sources and sitemap', () => {
  it('uses the real verification and update dates, never build time', () => {
    expect(BOOKSY_FACTS_CHECKED_DATE).toBe('15 November 2026');
    expect(BOOKSY_FACTS_CHECKED_ISO).toBe('2026-11-15');
    expect(BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO).toBe('2026-11-14');
    expect(BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL).toBe('14 November 2026');
    for (const source of [faqSource, factsSource, ...bodySources]) {
      expect(source).not.toMatch(/new Date\(\)\.toISOString|Date\.now\(\)/);
    }
  });

  it('sources section shows checked and updated dates, every source and the trademark notice', () => {
    const sources = components.BooksySources;
    expect(sources).toContain('id="sources"');
    expect(sources).toContain('Booksy facts checked <time datetime={BOOKSY_FACTS_CHECKED_ISO}>');
    expect(sources).toContain('Last updated <time datetime={BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO}>');
    expect(sources).toContain('BOOKSY_SOURCES.map');
    expect(sources).toContain('rel="noopener noreferrer"');
    expect(sources).toContain('{BOOKSY_TRADEMARK_DISCLAIMER}');
    expect(BOOKSY_TRADEMARK_DISCLAIMER).toContain('not affiliated with, endorsed by or sponsored by Booksy');
  });

  it('feeds the Last updated date into the sitemap lastmod', () => {
    const entry = buildMarketingSitemapEntries().find((item) => item.loc.endsWith('/booksy-alternative'));
    expect(entry).toEqual({
      loc: 'https://kersivo.co.uk/booksy-alternative',
      lastmod: BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO,
    });
    expect(buildMarketingSitemapXml()).toContain(
      `<loc>https://kersivo.co.uk/booksy-alternative</loc>\n    <lastmod>${BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO}</lastmod>`,
    );
  });
});

describe('booksy-alternative: internal links and claim safety', () => {
  it('links the body to Fresha and the calculator exactly once each', () => {
    const fresha = bodySources.reduce((total, source) => total + countLinks(source, '/fresha-alternative'), 0);
    const calculator = bodySources.reduce(
      (total, source) => total + countLinks(source, '/barber-software-cost-calculator'),
      0,
    );
    expect(fresha).toBe(1);
    expect(calculator).toBe(1);
    expect(countLinks(components.BooksyFit, '/fresha-alternative')).toBe(1);
    expect(components.BooksyFit).toContain('Also comparing Fresha?');
    expect(countLinks(components.BooksyBill, '/barber-software-cost-calculator')).toBe(1);
    expect(bodySources.reduce((total, source) => total + countLinks(source, '/booksy-alternative'), 0)).toBe(0);
  });

  it('keeps the inbound links from the homepage, Fresha and the calculator', () => {
    expect(homepageSource).toContain('<HomeV2Included />');
    expect(countLinks(homepageIncludedSource, '/booksy-alternative')).toBe(1);
    expect(countLinks(freshaFitSource, '/booksy-alternative')).toBe(1);
    expect(countLinks(calculatorBooksySource, '/booksy-alternative')).toBe(1);
  });

  it('avoids prohibited claims, fake reviews and commission-on-every-booking wording', () => {
    const lower = renderedCorpus.toLowerCase();
    for (const phrase of [
      'booksy owns your clients',
      'booksy takes your clients',
      'commission on every booking',
      'commission on all bookings',
      'only through the marketplace',
      '£39 forever',
      'one plan. one barbershop location',
      'unlimited sms',
      'guaranteed',
      'objectively better',
      'no fees whatsoever',
      'aggregaterating',
      'testimonial',
      '★',
    ]) {
      expect(lower).not.toContain(phrase);
    }
    expect(lower).not.toMatch(/(?<![a-z])no fees(?![a-z-])/);
  });

  it('does not host a contact form inside page modules', () => {
    for (const source of Object.values(components)) {
      expect(source).not.toContain('data-contact-form');
      expect(source).not.toContain('/api/contact');
    }
  });
});

describe('booksy-alternative: v1.18 Starter / Full distinction', () => {
  const sentences = renderedCorpus.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);

  it('never presents KERSIVO as one paid plan for one location', () => {
    expect(components.BooksyPricing).not.toContain('One plan. One barbershop location.');
    expect(components.BooksyPricing).toContain('KERSIVO Starter');
    expect(components.BooksyPricing).toContain('Full KERSIVO');
  });

  it('scopes unlimited barbers, branded site, own domain and Retail to Full KERSIVO', () => {
    for (const sentence of sentences.filter((s) => /unlimited barbers/i.test(s))) {
      expect(sentence, sentence).toMatch(/Full/);
    }
    for (const sentence of sentences.filter((s) => !s.endsWith('?') && /\b(own domain|standard domain)\b/i.test(s))) {
      expect(sentence, sentence).toMatch(/Full|Starter/);
    }
  });
});