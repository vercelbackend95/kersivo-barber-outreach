import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BARBER_COST_CALCULATOR_DESCRIPTION,
  BARBER_COST_CALCULATOR_LAST_UPDATED_ISO,
  BARBER_COST_CALCULATOR_PAGE_PATH,
  BARBER_COST_CALCULATOR_TITLE,
  COST_CALC_HERO,
  COST_SCENARIOS,
  VAT_DISCLAIMER,
} from './barberCostCalculatorPage';
import { BARBER_COST_CALCULATOR_FAQ_ITEMS } from './barberCostCalculatorFaq';
import { buildBarberCostCalculatorJsonLd } from './barberCostCalculatorJsonLd';
import { COST_CALCULATOR_SOURCES } from './barberCostCalculatorSources';
import { BOOKSY_SOURCE_BOOST, BOOKSY_SOURCE_PRICING } from './booksyFacts';
import { FRESHA_UK_COMMERCIAL_FACTS, isVerifiedCommercialFact } from './freshaFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
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
    expect(BARBER_COST_CALCULATOR_TITLE).toBe('Booksy vs Fresha Cost Calculator UK (2026) | KERSIVO');
    expect(BARBER_COST_CALCULATOR_DESCRIPTION).toBe(
      'Compare the real cost of Booksy, Fresha and KERSIVO for your UK barbershop. Calculate staff fees, marketplace charges, VAT, payments and 3-year costs.',
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
      'Compare the real cost of Booksy, Fresha and KERSIVO using your own barbershop numbers.',
    );
    for (const [file, source] of Object.entries(components)) {
      if (file !== 'CostCalcHero.astro') expect(source).not.toMatch(/<h1\b/);
    }
    expect(pageSource).not.toMatch(/<h1\b/);
  });

  it('includes every key SEO H2', () => {
    const corpus = componentSources.join('\n');
    for (const heading of [
      'Booksy vs Fresha vs KERSIVO: cost at a glance',
      'How much does Booksy cost in the UK?',
      'How much does Fresha cost in the UK?',
      'How team size changes your booking software cost',
      'Booksy Boost and Fresha Marketplace fees explained',
      'How VAT changes the real cost',
      'Payment processing costs',
      'Cost examples for different UK barbershops',
      'How the calculator works',
      'Pricing sources and methodology',
    ]) {
      expect(corpus).toMatch(new RegExp(`<h2[^>]*>${heading.replace(/[?]/g, '\\?')}</h2>`));
    }
  });

  it('renders sections in the agreed order', () => {
    const order = [
      '<CostCalcHero',
      '<CostAtAGlance',
      '<CostBooksy',
      '<CostFresha',
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

  it('links to both comparison pages with natural anchor text', () => {
    expect(components['CostFresha.astro']).toContain(
      '<a href="/fresha-alternative">See the full KERSIVO vs Fresha comparison</a>',
    );
    expect(components['CostBooksy.astro']).toContain(
      '<a href="/booksy-alternative">See the full KERSIVO vs Booksy comparison</a>',
    );
  });

  it('lists the page once in the sitemap with the visible last-updated date', () => {
    const matches = buildMarketingSitemapEntries().filter(
      (entry) => entry.loc === 'https://kersivo.co.uk/barber-software-cost-calculator',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].lastmod).toBe(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO);
    expect(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO).toBe('2026-10-01');
    expect(heroSource).toContain('datetime={BARBER_COST_CALCULATOR_LAST_UPDATED_ISO}');
  });
});

describe('barber software cost calculator structured data', () => {
  const blocks = buildBarberCostCalculatorJsonLd();
  const types = blocks.map((block) => block['@type']);

  it('emits WebPage, BreadcrumbList and FAQPage only', () => {
    expect(types).toEqual(['WebPage', 'BreadcrumbList', 'FAQPage']);
    const webPage = blocks[0];
    expect(webPage.url).toBe('https://kersivo.co.uk/barber-software-cost-calculator');
    expect(webPage.name).toBe(BARBER_COST_CALCULATOR_TITLE);
    expect(webPage.description).toBe(BARBER_COST_CALCULATOR_DESCRIPTION);
    expect(webPage.dateModified).toBe(BARBER_COST_CALCULATOR_LAST_UPDATED_ISO);
  });

  it('builds a two-level breadcrumb ending at the canonical URL', () => {
    const items = blocks[1].itemListElement as Array<{ position: number; item: string }>;
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[0].item).toBe('https://kersivo.co.uk/');
    expect(items[1].item).toBe('https://kersivo.co.uk/barber-software-cost-calculator');
  });

  it('keeps FAQ JSON-LD identical to the visible FAQ', () => {
    expect(pageSource).toContain('faqs={BARBER_COST_CALCULATOR_FAQ_ITEMS}');
    const entities = blocks[2].mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities).toHaveLength(BARBER_COST_CALCULATOR_FAQ_ITEMS.length);
    BARBER_COST_CALCULATOR_FAQ_ITEMS.forEach((item, index) => {
      expect(entities[index].name).toBe(item.question);
      expect(entities[index].acceptedAnswer.text).toBe(item.answer);
    });
  });

  it('does not claim a WebApplication, ratings or reviews', () => {
    const serialized = JSON.stringify(blocks);
    for (const banned of [
      'WebApplication',
      'SoftwareApplication',
      'AggregateRating',
      'aggregateRating',
      'reviewCount',
      '"Review"',
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });
});

describe('barber software cost calculator content safety', () => {
  it('answers all twelve search-intent FAQ questions', () => {
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

  it('lists official sources with checked dates and no Stripe source', () => {
    const urls = COST_CALCULATOR_SOURCES.map((source) => source.url);
    expect(urls).toContain(BOOKSY_SOURCE_PRICING);
    expect(urls).toContain(BOOKSY_SOURCE_BOOST);
    expect(urls).toContain('https://www.fresha.com/en-GB/pricing');
    expect(urls).toContain('/#pricing');
    expect(urls.some((url) => url.includes('stripe'))).toBe(false);
    for (const source of COST_CALCULATOR_SOURCES.filter((entry) => entry.provider !== 'KERSIVO')) {
      expect(source.checkedIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const sourcesComponent = components['CostSources.astro'];
    expect(sourcesComponent).toContain('rel="noopener noreferrer"');
    expect(sourcesComponent).toContain('BOOKSY_TRADEMARK_DISCLAIMER');
    expect(sourcesComponent).toContain('FRESHA_TRADEMARK_DISCLAIMER');
  });
});

describe('phase 1 static scope', () => {
  it('ships no client JavaScript or hydrated islands', () => {
    for (const source of [pageSource, ...componentSources]) {
      expect(source).not.toMatch(/<script\b/);
      expect(source).not.toMatch(/client:(load|idle|visible|only|media)/);
    }
  });

  it('reserves the calculator surface without fake controls or results', () => {
    const surface = heroSource.slice(heroSource.indexOf('<aside'), heroSource.indexOf('</aside>'));
    expect(surface).toContain('{COST_CALC_SURFACE.label}');
    expect(surface).toContain('{COST_CALC_SURFACE.note}');
    expect(surface).not.toMatch(/<(input|button|select|textarea|form|output|canvas|svg)\b/);
    expect(surface).not.toMatch(/range|slider|disabled/i);
    for (const source of componentSources) {
      expect(source).not.toMatch(/<(input|select|textarea|form)\b/);
    }
  });
});
