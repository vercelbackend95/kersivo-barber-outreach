import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOOKSY_ALTERNATIVE_DESCRIPTION,
  BOOKSY_ALTERNATIVE_FAQ_ITEMS,
  BOOKSY_ALTERNATIVE_H1,
  BOOKSY_ALTERNATIVE_PAGE_PATH,
  BOOKSY_ALTERNATIVE_TITLE,
  buildBooksyAlternativeFaqJsonLd,
} from './booksyAlternativeFaq';
import { buildBooksyAlternativeWebPageJsonLd } from './booksyAlternativeJsonLd';
import {
  BOOKSY_BASE_PRICE_LABEL,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_COMPARE_ROWS,
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_SOURCE_BOOST,
  BOOKSY_SOURCE_PRICING,
} from './booksyFacts';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SAAS_MONTHLY_GBP } from './defaults';
import { resolveCanonicalUrl } from './meta';
import { buildMarketingSitemapEntries } from './marketingSitemap';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const pageSource = readRepoFile('../../pages/booksy-alternative/index.astro');
const homepageSource = readRepoFile('../../pages/index.astro');
const switcherSource = readRepoFile('../../components/landingSwitcherReassurance.astro');
const heroSource = readRepoFile('../../components/booksyAlternative/BooksyHero.astro');
const compareSource = readRepoFile('../../components/booksyAlternative/BooksyCompare.astro');
const pricingSource = readRepoFile('../../components/booksyAlternative/BooksyPricing.astro');
const finalCtaSource = readRepoFile('../../components/booksyAlternative/BooksyFinalCta.astro');
const journeySource = readRepoFile('../../components/booksyAlternative/BooksyJourney.astro');
const factsSource = readRepoFile('booksyFacts.ts');

const bannedPhrases = [
  'Booksy owns your clients',
  'Booksy takes your clients',
  'Booksy controls your clients',
  '£39 forever',
  'Unlimited SMS',
  'complete migration guaranteed',
  'guaranteed more bookings',
] as const;

describe('booksy-alternative page SEO and claim safety', () => {
  it('wires LandingLayout with exact title, description, canonical and shop navbar', () => {
    expect(pageSource).toContain('LandingLayout');
    expect(pageSource).toContain('title={BOOKSY_ALTERNATIVE_TITLE}');
    expect(pageSource).toContain('description={BOOKSY_ALTERNATIVE_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={BOOKSY_ALTERNATIVE_PAGE_PATH}');
    expect(pageSource).toContain('navbarVariant="shop"');
    expect(pageSource).not.toContain('noindex');
    expect(BOOKSY_ALTERNATIVE_TITLE).toBe('Booksy Alternative for UK Barbers | KERSIVO');
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION).toBe(
      'Looking for a Booksy alternative for your barbershop? Compare KERSIVO and Booksy across branding, pricing, bookings, marketplace discovery and client experience.',
    );
    expect(BOOKSY_ALTERNATIVE_PAGE_PATH).toBe('/booksy-alternative');
  });

  it('has exactly one H1 with the approved text', () => {
    expect(heroSource).toContain('BOOKSY_ALTERNATIVE_H1');
    expect(BOOKSY_ALTERNATIVE_H1).toBe('A Booksy Alternative Built Around Your Barbershop');
    expect(heroSource.match(/<h1\b/g)?.length).toBe(1);
    expect(pageSource).not.toMatch(/<h1\b/);
  });

  it('links to homepage, demo and real pricing destination', () => {
    expect(pageSource).toContain('href: \'/\'');
    expect(heroSource).toContain('href="/demo"');
    expect(finalCtaSource).toContain('href="/demo"');
    expect(finalCtaSource).toContain('href="/admin/launch"');
    expect(pricingSource).toContain('href="/admin/launch"');
  });

  it('comparison includes factual values and official Booksy source links', () => {
    expect(compareSource).toContain('BOOKSY_COMPARE_ROWS');
    expect(compareSource).toContain('BOOKSY_SOURCE_PRICING');
    expect(compareSource).toContain('BOOKSY_SOURCE_BOOST');
    expect(compareSource).toContain('Booksy Pricing');
    expect(compareSource).toContain('Booksy Boost');
    expect(compareSource).toContain('rel="noopener noreferrer"');
    expect(compareSource).toContain('BOOKSY_FACTS_CHECKED_DATE');
    expect(BOOKSY_FACTS_CHECKED_DATE).toBe('17 September 2026');
    expect(BOOKSY_COMPARE_ROWS.some((row) => row.kersivo.includes(`£${SAAS_MONTHLY_GBP}/month`))).toBe(
      true,
    );
    expect(BOOKSY_COMPARE_ROWS.some((row) => row.booksy.includes(BOOKSY_BASE_PRICE_LABEL))).toBe(true);
    expect(
      BOOKSY_COMPARE_ROWS.some((row) =>
        row.booksy.includes(`${BOOKSY_BOOST_COMMISSION_PERCENT}%`),
      ),
    ).toBe(true);
    expect(
      BOOKSY_COMPARE_ROWS.some((row) => row.booksy.includes(`£${BOOKSY_BOOST_MINIMUM_GBP}`)),
    ).toBe(true);
    expect(factsSource).toContain(BOOKSY_SOURCE_PRICING);
    expect(factsSource).toContain(BOOKSY_SOURCE_BOOST);
    expect(factsSource).not.toContain('40%');
    expect(factsSource).not.toMatch(/£10/);
    expect(compareSource).not.toContain('/en-gb/features"');
  });

  it('does not contain prohibited claim phrases across page modules', () => {
    const corpus = [
      pageSource,
      heroSource,
      compareSource,
      pricingSource,
      journeySource,
      finalCtaSource,
      factsSource,
      ...BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
    ].join('\n');

    for (const phrase of bannedPhrases) {
      expect(corpus.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    expect(corpus.toLowerCase()).not.toContain('no fees whatsoever');
    expect(corpus.toLowerCase()).not.toMatch(/(?<![a-z])no fees(?![a-z-])/i);
  });

  it('FAQPage JSON-LD matches visible FAQ items and uses slash-free page-scoped @id', () => {
    const faqLd = buildBooksyAlternativeFaqJsonLd();
    expect(faqLd['@type']).toBe('FAQPage');
    expect(String(faqLd['@id'])).toBe('https://kersivo.co.uk/booksy-alternative#faq');
    expect(String(faqLd['@id'])).not.toContain('/#faq');

    const entities = faqLd.mainEntity as Array<{
      name: string;
      acceptedAnswer: { text: string };
    }>;
    expect(entities).toHaveLength(BOOKSY_ALTERNATIVE_FAQ_ITEMS.length);
    for (let i = 0; i < BOOKSY_ALTERNATIVE_FAQ_ITEMS.length; i += 1) {
      expect(entities[i].name).toBe(BOOKSY_ALTERNATIVE_FAQ_ITEMS[i].question);
      expect(entities[i].acceptedAnswer.text).toBe(BOOKSY_ALTERNATIVE_FAQ_ITEMS[i].answer);
    }
  });

  it('WebPage JSON-LD url matches canonical and sitemap without trailing slash', () => {
    const webPage = buildBooksyAlternativeWebPageJsonLd();
    const canonical = resolveCanonicalUrl(BOOKSY_ALTERNATIVE_PAGE_PATH);
    const sitemapLoc = buildMarketingSitemapEntries().find((entry) =>
      entry.loc.endsWith('/booksy-alternative'),
    )?.loc;
    const serialized = JSON.stringify(webPage);

    expect(webPage['@type']).toBe('WebPage');
    expect(webPage['@id']).toBe('https://kersivo.co.uk/booksy-alternative#webpage');
    expect(webPage.url).toBe('https://kersivo.co.uk/booksy-alternative');
    expect(webPage.url).toBe(canonical);
    expect(webPage.url).toBe(sitemapLoc);
    expect(String(webPage.url)).not.toMatch(/booksy-alternative\/$/);
    expect(webPage.name).toBe(BOOKSY_ALTERNATIVE_TITLE);
    expect(webPage.description).toBe(BOOKSY_ALTERNATIVE_DESCRIPTION);
    expect(serialized).not.toContain('SoftwareApplication');
    expect(serialized).not.toContain('LocalBusiness');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('"@type":"Review"');
  });

  it('sitemap includes /booksy-alternative among five marketing URLs', () => {
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toHaveLength(5);
    expect(locs).toContain('https://kersivo.co.uk/booksy-alternative');
  });

  it('homepage keeps default SEO/H1 and links to booksy-alternative via switcher prop', () => {
    expect(homepageSource).toContain('title={DEFAULT_TITLE}');
    expect(homepageSource).toContain('description={DEFAULT_DESCRIPTION}');
    expect(homepageSource).toContain('canonicalPath="/"');
    expect(homepageSource).toContain('<LandingSwitcherReassurance showBooksyCompareLink />');
    expect(switcherSource).toContain('showBooksyCompareLink');
    expect(switcherSource).toContain('href="/booksy-alternative"');
    expect(switcherSource).toContain('Compare KERSIVO and Booksy');
    expect(DEFAULT_TITLE).toBe('Barbershop Booking System UK | KERSIVO');
    expect(DEFAULT_DESCRIPTION).toContain('0% KERSIVO commission');
  });

  it('page mounts Faq4 with page-specific FAQ data', () => {
    expect(pageSource).toContain('Faq4');
    expect(pageSource).toContain('faqs={BOOKSY_ALTERNATIVE_FAQ_ITEMS}');
    expect(pageSource).toContain('buildBooksyAlternativeWebPageJsonLd()');
    expect(pageSource).toContain('buildBooksyAlternativeFaqJsonLd()');
  });

  it('journey copy avoids ownership claims while preserving positioning', () => {
    expect(journeySource).toContain('isn’t about who owns the client list');
    expect(journeySource).toContain('where the booking experience lives');
    expect(journeySource).not.toContain('Booksy owns your clients');
  });
});
