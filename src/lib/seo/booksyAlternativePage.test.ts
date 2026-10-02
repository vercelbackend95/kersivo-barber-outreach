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
  BOOKSY_WHY_INTRO,
  BOOKSY_WHY_THEMES,
  BOOKSY_WORKED_EXAMPLES,
  BOOKSY_WORKED_EXAMPLES_NOTE,
  KERSIVO_MODEL_POINTS,
} from './booksyAlternativeContent';
import { buildBooksyAlternativeWebPageJsonLd } from './booksyAlternativeJsonLd';
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
const freshaPageSource = readRepoFile('../../pages/fresha-alternative/index.astro');
const homepageSource = readRepoFile('../../pages/index.astro');
const switcherSource = readRepoFile('../../components/landingSwitcherReassurance.astro');
const calculatorBooksySource = readRepoFile('../../components/costCalculator/CostBooksy.astro');
const freshaFitSource = readRepoFile('../../components/freshaAlternative/FreshaFit.astro');
const factsSource = readRepoFile('booksyFacts.ts');
const contentSource = readRepoFile('booksyAlternativeContent.ts');
const faqSource = readRepoFile('booksyAlternativeFaq.ts');

const componentNames = [
  'BooksyHero',
  'BooksyQuickAnswer',
  'BooksyWhy',
  'BooksyCosts',
  'BooksyCompare',
  'BooksyProof',
  'BooksyFit',
  'BooksySwitching',
  'BooksyPricing',
  'BooksyFinalCta',
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
  BOOKSY_WHY_INTRO,
  ...BOOKSY_WHY_THEMES.map((theme) => `${theme.title} ${theme.body}`),
  BOOKSY_COSTS_INTRO,
  ...BOOKSY_COST_ITEMS.flatMap((item) => [item.kicker, item.figure, item.unit, ...item.notes]),
  ...BOOKSY_WORKED_EXAMPLES.flatMap((row) => Object.values(row)),
  BOOKSY_WORKED_EXAMPLES_NOTE,
  ...KERSIVO_MODEL_POINTS,
  ...BOOKSY_BOOST_POINTS,
  BOOKSY_BOOST_EXAMPLE,
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
  it('keeps the existing URL, title and H1 and uses the new SERP-length meta description', () => {
    expect(BOOKSY_ALTERNATIVE_PAGE_PATH).toBe('/booksy-alternative');
    expect(BOOKSY_ALTERNATIVE_TITLE).toBe('Booksy Alternative for UK Barbers | KERSIVO');
    expect(BOOKSY_ALTERNATIVE_H1).toBe('A Booksy Alternative Built Around Your Barbershop');
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION).toBe(
      'Looking for a Booksy alternative in the UK? Compare KERSIVO and Booksy pricing, Boost fees, branding, bookings and switching for independent barbershops.',
    );
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(BOOKSY_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
  });

  it('wires LandingLayout with title, description, canonical and both JSON-LD blocks, without noindex', () => {
    expect(pageSource).toContain('title={BOOKSY_ALTERNATIVE_TITLE}');
    expect(pageSource).toContain('description={BOOKSY_ALTERNATIVE_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={BOOKSY_ALTERNATIVE_PAGE_PATH}');
    expect(pageSource).toContain(
      'jsonLd={[buildBooksyAlternativeWebPageJsonLd(), buildBooksyAlternativeFaqJsonLd()]}',
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
    expect(components.BooksyHero).toContain('{firstLine}');
    expect(components.BooksyHero).toContain('{secondLine}');
    expect(components.BooksyHero).toContain('{thirdLine}');
  });
});

describe('booksy-alternative: Fresha template structure', () => {
  it('renders sections in the Fresha order', () => {
    const order = [
      '<BooksyHero',
      '<BooksyQuickAnswer',
      '<BooksyWhy',
      '<BooksyCosts',
      '<BooksyCompare',
      '<BooksyProof',
      '<BooksyFit',
      '<BooksySwitching',
      '<BooksyPricing',
      '<Faq4',
      '<BooksyFinalCta',
      '<Contact16',
      '<BooksySources',
      '<Footer50',
    ];
    const positions = order.map((tag) => pageSource.indexOf(tag));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    const freshaOrder = order.map((tag) => tag.replace('Booksy', 'Fresha'));
    const freshaPositions = freshaOrder.map((tag) => freshaPageSource.indexOf(tag));
    expect(freshaPositions).toEqual([...freshaPositions].sort((a, b) => a - b));
  });

  it('reuses the Fresha stylesheet and shared editorial components instead of a second design system', () => {
    expect(pageSource).toContain("import '@/styles/components/fresha-alternative.css';");
    expect(pageSource).not.toContain('booksy-alternative.css');
    expect(existsSync(join(here, '../../styles/components/booksy-alternative.css'))).toBe(false);
    expect(pageSource).toContain('<main class="fresha-alt landing-overflow-guard">');
    expect(components.BooksyHero).toContain('<HeroDashboardShowcase />');
    expect(components.BooksyQuickAnswer).toContain('<EditorialIntro');
    expect(components.BooksyWhy).toContain('<InsightCards');
    expect(components.BooksyFit).toContain('<ModelComparison');
    expect(components.BooksySwitching).toContain('<ProcessTimeline');
    expect(components.BooksyProof).toContain('<LandingDemoPreview');
    expect(components.BooksyPricing).toContain('<RateCard1Offer />');
    for (const name of ['BooksyApproaches', 'BooksyJourney', 'BooksyDecision']) {
      expect(existsSync(join(here, componentDir, `${name}.astro`))).toBe(false);
    }
  });

  it('hero uses the approved eyebrow, CTAs and price meta', () => {
    const hero = components.BooksyHero;
    expect(hero).toContain('Booksy alternative for UK barbershops');
    expect(hero).toMatch(/href="\/demo"[\s\S]*?data-track="view_live_demo_click"[\s\S]*?See KERSIVO in Action/);
    expect(hero).toMatch(/href="#comparison"[\s\S]*?Compare KERSIVO and Booksy/);
    expect(hero).toContain('£{SAAS_MONTHLY_GBP}/month');
    expect(hero).toContain('0% KERSIVO commission');
    expect(hero).not.toMatch(/iframe/i);
  });

  it('proof, pricing and final CTA match the Fresha sections', () => {
    for (const label of ['ADMIN SYSTEM', 'CLIENT BOOKING EXPERIENCE', 'RETAIL PICKUP SHOP']) {
      expect(components.BooksyProof).toContain(label);
    }
    expect(components.BooksyProof).not.toMatch(/prisma|@\/lib\/db|resolveLandingBookingData/);
    expect(components.BooksyPricing).toContain('id="pricing"');
    expect(components.BooksyPricing).toContain('One plan. One barbershop location.');
    expect(components.BooksyPricing).toContain('{layout.conditionsLine1}');
    expect(components.BooksyPricing).not.toContain('barber-software-cost-calculator');
    expect(components.BooksyFinalCta).toContain('See KERSIVO in Action');
    expect(components.BooksyFinalCta).toContain('View the £{SAAS_MONTHLY_GBP} Plan');
    expect(pageSource).toContain('title="Still comparing KERSIVO and Booksy?"');
    expect(pageSource).not.toMatch(/id=["']contact["']/);
  });
});

describe('booksy-alternative: Quick Answer', () => {
  it('states the short version within 70–110 words with both commercial models', () => {
    expect(BOOKSY_QUICK_ANSWER_KICKER).toBe('The short version');
    expect(BOOKSY_QUICK_ANSWER_TITLE).toBe('A Booksy alternative built around your own brand.');
    const words = BOOKSY_QUICK_ANSWER.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(70);
    expect(words).toBeLessThanOrEqual(110);
    expect(BOOKSY_QUICK_ANSWER).toContain(`£${SAAS_MONTHLY_GBP} per month per location`);
    expect(BOOKSY_QUICK_ANSWER).toContain('0% KERSIVO commission on bookings and retail sales');
    expect(BOOKSY_QUICK_ANSWER).toContain('Stripe processing fees still apply');
    expect(BOOKSY_QUICK_ANSWER).toContain(`£${BOOKSY_BASE_PRICE_GBP} a month plus VAT`);
    expect(BOOKSY_QUICK_ANSWER).toContain(`£${BOOKSY_ADDITIONAL_USER_GBP} a month plus VAT for each additional user`);
    expect(BOOKSY_QUICK_ANSWER).toContain('Standard Marketplace bookings are free when Boost is off');
    expect(BOOKSY_QUICK_ANSWER).toContain('optional Boost');
    expect(BOOKSY_QUICK_ANSWER_FACTS).toHaveLength(3);
    expect(components.BooksyQuickAnswer).toContain('id="quick-answer"');
  });
});

describe('booksy-alternative: costs', () => {
  it('renders the costs section with the approved H2 and a checked-date source link', () => {
    const costs = components.BooksyCosts;
    expect(costs).toContain('id="booksy-pricing"');
    expect(costs).toContain('Booksy pricing and fees for UK barbers');
    expect(costs).toContain('Subscription cost by team size');
    expect(costs).toContain("getBooksySource('pricingUk')");
    expect(costs).toContain("getBooksySource('boost')");
    expect(costs).toContain('rel="noopener noreferrer"');
    expect(BOOKSY_COSTS_INTRO).toContain(BOOKSY_FACTS_CHECKED_DATE);
  });

  it('computes the 1 / 3 / 5 worked examples from the verified facts', () => {
    expect(BOOKSY_WORKED_EXAMPLES.map((row) => [row.label, row.booksyExVat, row.booksyIncVat, row.kersivo])).toEqual([
      ['Solo barber', '£40', '£48', '£39'],
      ['3 users', '£50', '£60', '£39'],
      ['5 users', '£60', '£72', '£39'],
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
    const costs = components.BooksyCosts;
    const paragraph = costs.match(/<p class="fresha-alt-costs__calculator">([\s\S]*?)<\/p>/)?.[0] ?? '';
    expect(paragraph.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).toBe(
      'Want to run the numbers for your own shop? Use the Barber Software Cost Calculator to compare Booksy, Fresha and KERSIVO using your own shop numbers.',
    );
    expect(paragraph).toContain('<a href="/barber-software-cost-calculator">Barber Software Cost Calculator</a>');
    expect(paragraph).not.toMatch(/target=|nofollow|btn/);
    const noteIndex = costs.indexOf('{BOOKSY_WORKED_EXAMPLES_NOTE}');
    const calculatorIndex = costs.indexOf('<p class="fresha-alt-costs__calculator">');
    expect(noteIndex).toBeGreaterThan(-1);
    expect(calculatorIndex).toBeGreaterThan(noteIndex);
    expect(costs.slice(noteIndex, calculatorIndex)).not.toMatch(/<(p|div|ul|table)\b/);
  });

  it('explains Boost with a computed example and the commission-free channels', () => {
    expect(BOOKSY_BOOST_POINTS.join(' ')).toContain('free to turn on');
    expect(BOOKSY_BOOST_POINTS.join(' ')).toContain('Google Search');
    expect(estimateBooksyBoostFee(25)).toBe(7.5);
    expect(estimateBooksyBoostFee(15)).toBe(BOOKSY_BOOST_MINIMUM_GBP);
    expect(BOOKSY_BOOST_EXAMPLE).toContain('£7.50 plus VAT');
    expect(BOOKSY_BOOST_EXAMPLE).toContain(`£${BOOKSY_BOOST_MINIMUM_GBP} minimum applies`);
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
    expect(BOOKSY_FIT_CLOSING).toContain('Neither model is right for every barbershop');
  });

  it('describes switching in six cautious steps', () => {
    expect(components.BooksySwitching).toContain('Switching from Booksy to KERSIVO');
    expect(BOOKSY_SWITCHING_STEPS.map((step) => step.title)).toEqual([
      'Keep Booksy live',
      'Export what Booksy makes available',
      'We review and map compatible data',
      'We prepare your setup and branded website',
      'You review a private preview',
      'Switch when you approve',
    ]);
    expect(BOOKSY_SWITCHING_REASSURANCE).toBe('Keep Booksy live while your KERSIVO setup is prepared.');
    expect(BOOKSY_SWITCHING_LIMITS.join(' ')).toContain('depends on what Booksy sends');
    expect(getBooksySource('clientList').url).toContain('support.booksy.com/hc/en-gb');
  });
});

describe('booksy-alternative: FAQ and schema', () => {
  it('has 10 FAQs covering the required questions with no "best" claims', () => {
    expect(BOOKSY_ALTERNATIVE_FAQ_ITEMS).toHaveLength(10);
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

describe('booksy-alternative: freshness, sources and sitemap', () => {
  it('uses the real verification and update dates, never build time', () => {
    expect(BOOKSY_FACTS_CHECKED_DATE).toBe('2 October 2026');
    expect(BOOKSY_FACTS_CHECKED_ISO).toBe('2026-10-02');
    expect(BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO).toBe('2026-10-02');
    expect(BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL).toBe('2 October 2026');
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
    expect(countLinks(components.BooksyCosts, '/barber-software-cost-calculator')).toBe(1);
    expect(bodySources.reduce((total, source) => total + countLinks(source, '/booksy-alternative'), 0)).toBe(0);
  });

  it('keeps the inbound links from the homepage, Fresha and the calculator', () => {
    expect(homepageSource).toMatch(/<LandingSwitcherReassurance showBooksyCompareLink\b[^>]*\/>/);
    expect(countLinks(switcherSource, '/booksy-alternative')).toBe(1);
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
