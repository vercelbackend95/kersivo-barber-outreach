import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BARBER_COST_CALCULATOR_DESCRIPTION,
  BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
  BARBER_COST_CALCULATOR_PAGE_PATH,
  BARBER_COST_CALCULATOR_TITLE,
  COST_AT_A_GLANCE_MODELS,
  COST_CALC_HERO,
  COST_SCENARIOS,
  METHODOLOGY_INTRO,
  PAYMENTS_INTRO,
  PAYMENTS_POINTS,
  TEAM_SIZE_CLOSING,
  VAT_DISCLAIMER,
  VAT_PARAGRAPHS,
} from './barberCostCalculatorPage';
import { BARBER_COST_CALCULATOR_FAQ_ITEMS } from './barberCostCalculatorFaq';
import { buildBarberCostCalculatorJsonLd } from './barberCostCalculatorJsonLd';
import { COST_CALCULATOR_SOURCES } from './barberCostCalculatorSources';
import {
  BOOKSY_ADDITIONAL_USER_GBP,
  BOOKSY_BASE_PRICE_GBP,
  BOOKSY_BASE_PRICE_LABEL,
  BOOKSY_PER_ADDITIONAL_USER_LABEL,
  BOOKSY_SOURCE_BOOST,
  BOOKSY_SOURCE_PRICING,
} from './booksyFacts';
import { SAAS_MONTHLY_GBP } from './defaults';
import {
  FRESHA_UK_COMMERCIAL_FACTS,
  formatGbp,
  isVerifiedCommercialFact,
  requireVerifiedFreshaFact,
} from './freshaFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { requireVerifiedSetoraFact } from './setoraFacts';
import { resolveCanonicalUrl } from './meta';

const here = dirname(fileURLToPath(import.meta.url));
const componentDir = join(here, '../../components/costCalculator');

function read(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const pageSource = read('../../pages/barber-software-cost-calculator/index.astro');
const componentFiles = readdirSync(componentDir).filter((file) => file.endsWith('.astro'));
const components = Object.fromEntries(
  componentFiles.map((file) => [file, readFileSync(join(componentDir, file), 'utf8')]),
);
const componentSources = Object.values(components);
const heroSource = components['CostCalcHero.astro'];
const contentSource = read('barberCostCalculatorPage.ts');
const faqSource = read('barberCostCalculatorFaq.ts');

const visibleCopy = [
  contentSource,
  faqSource,
  ...BARBER_COST_CALCULATOR_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
].join('\n');

describe('barber software cost calculator SEO foundation', () => {
  it('uses the evergreen route, exact title, description and canonical', () => {
    expect(BARBER_COST_CALCULATOR_PAGE_PATH).toBe('/barber-software-cost-calculator');
    expect(BARBER_COST_CALCULATOR_TITLE).toBe('Booksy, Fresha, Timely & More: UK Costs | KERSIVO');
    expect(BARBER_COST_CALCULATOR_TITLE.length).toBeLessThanOrEqual(60);
    expect(existsSync(join(here, '../../pages/barber-software-cost-calculator/index.astro'))).toBe(true);
    expect(BARBER_COST_CALCULATOR_DESCRIPTION).toBe(
      'Compare Booksy, Fresha, Nearcut, Timely, Setora and KERSIVO costs in the UK. Model subscriptions, TimelyPay fees, VAT, deposits and 3-year totals.',
    );
    expect(resolveCanonicalUrl(BARBER_COST_CALCULATOR_PAGE_PATH)).toBe(
      'https://kersivo.co.uk/barber-software-cost-calculator',
    );
  });

  it('wires LandingLayout with the central metadata and JSON-LD and stays indexable', () => {
    expect(pageSource).toContain('title={BARBER_COST_CALCULATOR_TITLE}');
    expect(pageSource).toContain('description={BARBER_COST_CALCULATOR_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={BARBER_COST_CALCULATOR_PAGE_PATH}');
    expect(pageSource).toContain('jsonLd={buildBarberCostCalculatorJsonLd()}');
    for (const source of [pageSource, ...componentSources]) {
      expect(source).not.toMatch(/noindex/i);
    }
  });

  it('renders exactly one H1 with the approved hero copy', () => {
    expect(heroSource.match(/<h1\b/g)).toHaveLength(1);
    expect(heroSource).toContain('{COST_CALC_HERO.title}');
    expect(COST_CALC_HERO.title).toBe('Barber Booking Software Cost Calculator');
    expect(COST_CALC_HERO.eyebrow).toBe('UK BARBER SOFTWARE COST CALCULATOR');
    expect(COST_CALC_HERO.lead).toBe(
      'Compare Booksy, Fresha, Nearcut, Timely, Setora and KERSIVO with your UK barbershop numbers. Enter a real Timely UK invoice for its custom-priced subscription.',
    );
    for (const [file, source] of Object.entries(components)) {
      if (file !== 'CostCalcHero.astro') expect(source).not.toMatch(/<h1\b/);
    }
    expect(pageSource).not.toMatch(/<h1\b/);
  });

  it('includes every key SEO H2', () => {
    const corpus = componentSources.join('\n');
    for (const heading of [
      'Booksy, Fresha, Nearcut, Timely & Setora vs KERSIVO: cost at a glance',
      'How much does Booksy cost in the UK?',
      'How much does Fresha cost in the UK?',
      'How much does Nearcut cost in the UK?',
      'How much does Setora cost in the UK?',
      'How team size changes your booking software cost',
      'Booksy Boost and Fresha Marketplace fees explained',
      'How VAT changes the real cost',
      'Payment processing costs',
      'Cost examples for different UK barbershops',
      'How the calculator works',
      'Pricing sources and methodology',
      'How much does Timely cost for UK barbershops?',
    ]) {
      expect(corpus).toMatch(new RegExp(`<h2[^>]*>${heading.replace(/[?]/g, '\\?')}</h2>`));
    }
  });

  it('renders sections in the agreed order', () => {
    const order = [
      '<CostCalcHero',
      '<CostResults',
      '<CostAtAGlance',
      '<CostBooksy',
      '<CostFresha',
      '<CostNearcut',
      '<CostTimely',
      '<CostSetora',
      '<CostTeamSize',
      '<CostMarketplaceFees',
      '<CostVat',
      '<CostPayments',
      '<CostScenarios',
      '<CostMethodology',
      '<CostSources',
      '<Faq4',
      '<Footer50',
    ].map((tag) => pageSource.indexOf(tag));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('links to all four comparison pages with natural anchor text', () => {
    expect(components['CostFresha.astro']).toContain(
      '<a href="/fresha-alternative">See the full KERSIVO vs Fresha comparison</a>',
    );
    expect(components['CostBooksy.astro']).toContain(
      '<a href="/booksy-alternative">See the full KERSIVO vs Booksy comparison</a>',
    );
    expect(components['CostNearcut.astro']).toContain('<a href="/nearcut-alternative">See the full KERSIVO vs Nearcut comparison</a>');
    expect(components['CostSetora.astro']).toContain('<a href="/setora-alternative">See the full KERSIVO vs Setora comparison</a>');
  });

  it('lists the page once in the sitemap with the visible last-updated date', () => {
    const matches = buildMarketingSitemapEntries().filter(
      (entry) => entry.loc === 'https://kersivo.co.uk/barber-software-cost-calculator',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].lastmod).toBe(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO);
    expect(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO).toBe('2026-10-08');
    expect(heroSource).toContain('datetime={BARBER_COST_CALCULATOR_LAST_UPDATED_ISO}');
  });
});

describe('barber software cost calculator structured data', () => {
  const blocks = buildBarberCostCalculatorJsonLd();
  const types = blocks.map((block) => block['@type']);
  const byType = (type: string) => blocks.find((block) => block['@type'] === type)!;
  const PAGE_URL = 'https://kersivo.co.uk/barber-software-cost-calculator';

  it('emits WebPage, WebApplication, BreadcrumbList and FAQPage', () => {
    expect(types).toEqual(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']);
    const webPage = byType('WebPage');
    expect(webPage.url).toBe(PAGE_URL);
    expect(webPage['@id']).toBe(`${PAGE_URL}#webpage`);
    expect(webPage.name).toBe(BARBER_COST_CALCULATOR_TITLE);
    expect(webPage.description).toBe(BARBER_COST_CALCULATOR_DESCRIPTION);
    expect(webPage.dateModified).toBe(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO);
    expect(webPage.breadcrumb).toEqual({ '@id': `${PAGE_URL}#breadcrumb` });
  });

  it('describes the interactive calculator as a conservative WebApplication', () => {
    const app = byType('WebApplication');
    expect(app).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${PAGE_URL}#calculator`,
      name: 'Barber Booking Software Cost Calculator',
      url: PAGE_URL,
      description: expect.stringContaining('Booksy, Fresha, Nearcut, Timely, Setora and KERSIVO'),
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Any',
      inLanguage: 'en-GB',
      isPartOf: { '@id': `${PAGE_URL}#webpage` },
      publisher: { '@id': 'https://kersivo.co.uk/#organization' },
    });
    expect(byType('WebPage').mainEntity).toEqual({ '@id': `${PAGE_URL}#calculator` });
  });

  it('never puts query parameters or scenario values into schema URLs', () => {
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toMatch(/\?[a-z]+=|[?&](b|a|v|m|period|dp|db)=/);
    const app = JSON.stringify(byType('WebApplication'));
    expect(app).not.toMatch(/£|\d+\.\d{2}|offers|price/i);
  });

  it('builds a two-level breadcrumb ending at the canonical URL', () => {
    const items = byType('BreadcrumbList').itemListElement as Array<{ position: number; item: string }>;
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[0].item).toBe('https://kersivo.co.uk/');
    expect(items[1].item).toBe('https://kersivo.co.uk/barber-software-cost-calculator');
  });

  it('keeps FAQ JSON-LD identical to the visible FAQ', () => {
    expect(pageSource).toContain('faqs={BARBER_COST_CALCULATOR_FAQ_ITEMS}');
    const entities = byType('FAQPage').mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities).toHaveLength(BARBER_COST_CALCULATOR_FAQ_ITEMS.length);
    BARBER_COST_CALCULATOR_FAQ_ITEMS.forEach((item, index) => {
      expect(entities[index].name).toBe(item.question);
      expect(entities[index].acceptedAnswer.text).toBe(item.answer);
    });
  });

  it('makes no rating, review, offer, install, download or version claims', () => {
    const serialized = JSON.stringify(blocks);
    for (const banned of [
      'SoftwareApplication',
      'MobileApplication',
      'AggregateRating',
      'aggregateRating',
      'reviewCount',
      '"review"',
      '"Review"',
      'offers',
      'installUrl',
      'downloadUrl',
      'InstallAction',
      'softwareVersion',
      'award',
      'interactionStatistic',
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it('keeps the canonical independent of query parameters', () => {
    expect(resolveCanonicalUrl(BARBER_COST_CALCULATOR_PAGE_PATH)).toBe(PAGE_URL);
    expect(pageSource).toContain('canonicalPath={BARBER_COST_CALCULATOR_PAGE_PATH}');
    expect(pageSource).not.toMatch(/Astro\.url\.search|searchParams/);
  });
});

describe('barber software cost calculator content safety', () => {
  it('answers search-intent FAQ questions for every modelled platform', () => {
    expect(BARBER_COST_CALCULATOR_FAQ_ITEMS.map((item) => item.question)).toEqual([
      'How much is Booksy a month?',
      'How much does Booksy cost in the UK?',
      'Does Booksy charge per barber?',
      'Does Booksy take commission?',
      'How much is Fresha a month?',
      'How much does Fresha cost?',
      'Is Fresha free for businesses?',
      'What are Fresha fees?',
      'Does Fresha charge per barber?',
      'What is the Fresha Marketplace fee?',
      'Is Nearcut free for barbershops?',
      'How much does Nearcut Subscription cost in the UK?',
      'How much does Setora cost for a UK barbershop?',
      'Does Setora charge VAT or payment processing fees?',
      'Is Booksy or Fresha cheaper for a barbershop?',
      'Which booking system costs less for a larger barber team?',
    ]);
  });

  it('explains that comparison answers depend on the shop', () => {
    for (const question of [
      'Is Booksy or Fresha cheaper for a barbershop?',
      'Which booking system costs less for a larger barber team?',
    ]) {
      const answer = BARBER_COST_CALCULATOR_FAQ_ITEMS.find((item) => item.question === question)!.answer;
      for (const factor of ['team size', 'marketplace', 'add-ons', 'payments']) {
        expect(answer).toContain(factor);
      }
    }
  });

  it('keeps hand-written figures out of components and copy modules', () => {
    for (const source of [...componentSources, contentSource, faqSource]) {
      expect(source).not.toMatch(/£\s?\d/);
      expect(source).not.toMatch(/(?<![\d.])(?!0%)\d+(\.\d+)?\s?%/);
    }
  });

  it('describes the live calculator in the present tense', () => {
    expect(TEAM_SIZE_CLOSING).toContain('The calculator lets you enter your own number of bookable barbers');
    expect(VAT_PARAGRAPHS).toContain(
      'The calculator shows cash cost and estimated net cost separately, so you can see both views side by side.',
    );
    expect(METHODOLOGY_INTRO).toMatch(/These are the factors it uses\.$/);
    for (const stale of ['calculator will let you enter', 'calculator will show', 'factors it will use']) {
      expect(visibleCopy).not.toContain(stale);
    }
    expect(visibleCopy).not.toMatch(/\b(calculator|it) will (let|show|use)\b/);
  });

  it('never renders unresolved Fresha facts', () => {
    const unresolvedKeys = Object.entries(FRESHA_UK_COMMERCIAL_FACTS)
      .filter(([, fact]) => !isVerifiedCommercialFact(fact))
      .map(([key]) => key);
    expect(unresolvedKeys.length).toBeGreaterThan(0);
    for (const key of unresolvedKeys) {
      expect(visibleCopy).not.toContain(key);
    }
  });

  it('includes the VAT disclaimer and does not crown a winner', () => {
    expect(VAT_DISCLAIMER).toBe(
      'VAT treatment depends on your business circumstances. Check with your accountant for your own VAT position.',
    );
    const lower = visibleCopy.toLowerCase();
    for (const phrase of ['independent comparison', 'kersivo is cheapest', 'always cheaper', 'the clear winner', 'unbiased']) {
      expect(lower).not.toContain(phrase);
    }
    expect(lower).toContain('built by kersivo');
  });

  it('does not imply KERSIVO offers marketplace acquisition', () => {
    expect(contentSource).toContain('does not provide marketplace client acquisition');
  });

  it('keeps scenarios as structure only, with no totals', () => {
    expect(COST_SCENARIOS.map((scenario) => scenario.label)).toEqual([
      'Solo barber',
      '3-barber shop',
      '5-barber shop',
      '8-barber shop',
    ]);
    for (const scenario of COST_SCENARIOS) {
      expect(scenario.body).not.toMatch(/£|\d+(\.\d+)?%/);
    }
  });

  it('lists official sources with checked dates, including the deposit payment sources', () => {
    const urls = COST_CALCULATOR_SOURCES.map((source) => source.url);
    expect(urls).toContain(BOOKSY_SOURCE_PRICING);
    expect(urls).toContain(BOOKSY_SOURCE_BOOST);
    expect(urls).toContain('https://www.fresha.com/en-GB/pricing');
    expect(urls).toContain('/#pricing');
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://biz.booksy.com/en-gb/features/no-show-protection',
        'https://biz.booksy.com/en-gb/features/payments',
        'https://www.fresha.com/help-center/knowledge-base/payments/101660-set-up-payment-policies',
        'https://stripe.com/gb/pricing',
      ]),
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain('https://www.setora.co.uk/pricing');
    expect(urls).toContain('https://www.setora.co.uk/barbershop-booking-software');
    const setora = COST_CALCULATOR_SOURCES.filter((source) => source.provider === 'Setora');
    expect(setora).toHaveLength(2);
    expect(setora.every((source) => source.checkedIso === '2026-10-08')).toBe(true);
    const stripe = COST_CALCULATOR_SOURCES.find((source) => source.provider === 'Stripe')!;
    expect(stripe).toMatchObject({ checkedIso: '2026-10-01', checkedLabel: '1 October 2026', external: true });
    const policies = COST_CALCULATOR_SOURCES.find((source) => source.url.includes('101660'))!;
    expect(policies.checkedIso).toBe('2026-10-01');
    for (const source of COST_CALCULATOR_SOURCES.filter((entry) => entry.provider !== 'KERSIVO')) {
      expect(source.checkedIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const sourcesComponent = components['CostSources.astro'];
    expect(sourcesComponent).toContain('rel="noopener noreferrer"');
    expect(sourcesComponent).toContain('BOOKSY_TRADEMARK_DISCLAIMER');
    expect(sourcesComponent).toContain('FRESHA_TRADEMARK_DISCLAIMER');
    expect(sourcesComponent).toContain('SETORA_TRADEMARK_DISCLAIMER');
  });
});

describe('booking deposit payment processing copy', () => {
  const copy = [PAYMENTS_INTRO, ...PAYMENTS_POINTS.flatMap((point) => [point.title, point.body])].join(' ');

  it('explains the optional like-for-like deposit model with bound rates', () => {
    expect(PAYMENTS_INTRO).toContain('the same £5 online booking deposit');
    expect(PAYMENTS_INTRO).toContain('remaining appointment balance');
    expect(PAYMENTS_POINTS.map((point) => point.title)).toEqual([
      'Booksy Mobile Payments',
      'Fresha Online Payments',
      'Setora via Stripe',
      'KERSIVO via Stripe Checkout',
      'What is not modelled',
    ]);
    expect(copy).toContain('1.29% + £0.20 per transaction plus VAT');
    expect(copy).toContain('1.40% + £0.25 per transaction plus VAT');
    expect(copy).toContain(
      'The KERSIVO estimate assumes the connected barbershop pays Stripe’s standard UK card rate of 1.50% + £0.20',
    );
    expect(copy).not.toMatch(/KERSIVO deposits are processed by Stripe Checkout at/);
    expect(copy).toMatch(/Refund-related processing costs are excluded/);
    expect(copy).toMatch(/rates can change/i);
  });

  it('never claims to model full appointment, terminal or retail payment processing', () => {
    expect(copy).not.toMatch(/full appointment|tap to pay|terminal fee/i);
  });
});

describe('cost at a glance base pricing', () => {
  const [booksy, fresha, nearcut, timely, setora, kersivo] = COST_AT_A_GLANCE_MODELS;
  const independent = requireVerifiedFreshaFact('independentPlan');
  const team = requireVerifiedFreshaFact('teamPlanPerMember');

  it('shows the headline base price for each platform from central facts', () => {
    expect(COST_AT_A_GLANCE_MODELS.map((model) => model.name)).toEqual(['Booksy', 'Fresha', 'Nearcut', 'Timely', 'Setora', 'Full KERSIVO']);

    expect(booksy.price).toBe(BOOKSY_BASE_PRICE_LABEL);
    expect(booksy.price).toBe(`£${BOOKSY_BASE_PRICE_GBP}/month + VAT`);
    expect(booksy.priceNote).toBe(`+ ${BOOKSY_PER_ADDITIONAL_USER_LABEL}`);
    expect(booksy.priceNote).toBe(`+ £${BOOKSY_ADDITIONAL_USER_GBP}/month + VAT per additional user`);

    expect(fresha.price).toBe(`${formatGbp(independent.amountGbp!)}/month + VAT`);
    expect(fresha.priceNote).toBe('Independent — 1 bookable team member');
    expect(fresha.secondaryPrice).toBe(
      `Team: ${formatGbp(team.amountGbp!)} per bookable team member/month + VAT`,
    );

    expect(nearcut.price).toBe(formatGbp(0)+'/month');
    expect(nearcut.priceNote).toContain('customers pay');
    expect(timely.price).toBe('Custom pricing');
    expect(setora.price).toBe(`${formatGbp(requireVerifiedSetoraFact('canonicalMonthlyGbp').value)}/month per location`);
    expect(setora.priceNote).toContain('Unlimited staff');
    expect(kersivo.price).toBe(`${formatGbp(SAAS_MONTHLY_GBP)}/month per location`);
    expect(kersivo.priceNote).toBe('Additional barbers included');
  });

  it('renders the price lines above the explanatory bullets', () => {
    const glance = components['CostAtAGlance.astro'];
    for (const binding of ['{model.price}', '{model.priceNote}', '{model.secondaryPrice}']) {
      expect(glance).toContain(binding);
    }
    expect(glance.indexOf('{model.price}')).toBeLessThan(glance.indexOf('model.points.map'));
    for (const model of COST_AT_A_GLANCE_MODELS) {
      expect(model.points.length).toBeGreaterThan(0);
    }
  });
});

describe('booksy additional-user wording', () => {
  const answer = (question: string) =>
    BARBER_COST_CALCULATOR_FAQ_ITEMS.find((item) => item.question === question)!.answer;

  it('derives the per-user price from booksyFacts and does not equate barbers with users', () => {
    const perBarber = answer('Does Booksy charge per barber?');
    expect(perBarber).toBe(
      `Booksy lists ${BOOKSY_PER_ADDITIONAL_USER_LABEL}. For a barbershop, team growth can therefore increase the subscription cost depending on how staff users are configured.`,
    );
    expect(faqSource).toContain('${BOOKSY_PER_ADDITIONAL_USER_LABEL}');
    expect(faqSource).not.toMatch(/£\s?\d/);
  });

  it('avoids treating every barber as a Booksy user', () => {
    const lower = visibleCopy.toLowerCase();
    for (const phrase of [
      'a team with more barbers pays more',
      'charge per barber or per user',
      'charges for every bookable barber',
      'per barber on booksy',
    ]) {
      expect(lower).not.toContain(phrase);
    }
  });
});

describe('calculator client scope', () => {
  it('ships one contained shell script, one inline pre-paint script and no hydrated islands', () => {
    expect(pageSource).not.toMatch(/<script\b/);
    for (const [file, source] of Object.entries(components)) {
      expect(source).not.toMatch(/client:(load|idle|visible|only|media)/);
      if (file !== 'CostCalcPanel.astro' && file !== 'CostCalcHero.astro') expect(source).not.toMatch(/<script\b/);
    }
    const panelScripts = components['CostCalcPanel.astro'].match(/<script\b[^>]*>/g) ?? [];
    expect(panelScripts).toEqual(['<script>']);
    const heroScripts = components['CostCalcHero.astro'].match(/<script\b[^>]*>/g) ?? [];
    expect(heroScripts).toEqual(['<script is:inline set:html={CALCULATOR_PREPAINT_SCRIPT} />']);
  });

  it('keeps form controls inside the calculator panel and results', () => {
    for (const [file, source] of Object.entries(components)) {
      if (file === 'CostCalcPanel.astro' || file === 'CostResults.astro') continue;
      expect(source).not.toMatch(/<(input|select|textarea|form)\b/);
    }
    expect(heroSource).toContain('<CostCalcPanel />');
  });
});
