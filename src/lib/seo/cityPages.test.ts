import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_CITY_PAGES,
  buildCityBreadcrumbJsonLd,
  buildCityFaqJsonLd,
  buildCityPageDescription,
  buildCityPageTitle,
  buildCityWebPageJsonLd,
  getCityFaqs,
  getCityPage,
  getCityPagePath,
  getCityPageSources,
  toCitySlug,
} from './cityPages';
import { LONDON_CITY_PAGE as LONDON } from './cityPages/london';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { getStaticPageLastModified } from './pageDates';
import { calculateCityScenario, clampCityInput, describeNewClientFees } from '@/lib/cityPages/marketplaceMath';

const read = (path: string) => readFileSync(path, 'utf8');
const PAGE = read('src/pages/barbershop-websites/[city].astro');
const COMPONENTS = ['CwHero', 'CwCalculator', 'CwRoute', 'CwMarket', 'CwCosts', 'CwFaq', 'CwClose'];
const component = (name: string) => read(`src/components/cityWebsite/${name}.astro`);

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

describe('city page registry', () => {
  it('publishes London at /barbershop-websites/london', () => {
    expect(PUBLISHED_CITY_PAGES.map((city) => city.slug)).toContain('london');
    expect(getCityPagePath(LONDON)).toBe('/barbershop-websites/london');
    expect(getCityPage('london')).toBe(LONDON);
    expect(getCityPage('LONDON')).toBe(LONDON);
    expect(getCityPage('leeds')).toBeUndefined();
    expect(getCityPage(undefined)).toBeUndefined();
  });

  it.each(PUBLISHED_CITY_PAGES.map((city) => [city.name, city] as const))('%s: slug is the kebab-case city name', (_name, city) => {
    expect(city.slug).toBe(toCitySlug(city.name));
  });

  it('builds kebab-case slugs for multi-word names', () => {
    expect(toCitySlug('Newcastle upon Tyne')).toBe('newcastle-upon-tyne');
    expect(toCitySlug("King's Lynn")).toBe('kings-lynn');
    expect(toCitySlug('St Albans')).toBe('st-albans');
  });

  it('404s unknown cities and renders only registry cities', () => {
    expect(PAGE).toContain('getCityPage(Astro.params.city)');
    expect(PAGE).toContain("new Response(null, { status: 404, statusText: 'Not Found' })");
  });
});

describe('city page metadata', () => {
  it('uses the full title when it fits in 60 characters', () => {
    expect(buildCityPageTitle('London')).toBe('Barbershop Website Design London | £39/mo | KERSIVO');
    for (const city of PUBLISHED_CITY_PAGES) expect(buildCityPageTitle(city.name).length).toBeLessThanOrEqual(60);
  });

  it('falls back to the shorter title for long city names', () => {
    expect(buildCityPageTitle('Newcastle upon Tyne')).toBe('Barbershop Websites Newcastle upon Tyne | £39/mo | KERSIVO');
  });

  it('keeps the meta description between 145 and 158 characters', () => {
    expect(buildCityPageDescription('London')).toBe(
      'Custom barbershop website design for London shops. Own domain, online booking, deposits and a retail pickup shop for £39/month flat — 0% KERSIVO commission.',
    );
    for (const city of PUBLISHED_CITY_PAGES) {
      const length = buildCityPageDescription(city.name).length;
      expect(length).toBeGreaterThanOrEqual(145);
      expect(length).toBeLessThanOrEqual(158);
    }
  });

  it('sets the canonical path and indexes the page', () => {
    expect(PAGE).toContain('canonicalPath={getCityPagePath(city)}');
    expect(PAGE).not.toMatch(/noindex=\{true\}/);
  });
});

describe('city page JSON-LD', () => {
  it('renders the shared SoftwareApplication, WebPage, BreadcrumbList and FAQPage blocks', () => {
    for (const builder of [
      'buildKersivoSoftwareApplicationJsonLd()',
      'buildCityWebPageJsonLd(city)',
      'buildCityBreadcrumbJsonLd(city)',
      'buildCityFaqJsonLd(city)',
    ]) {
      expect(PAGE).toContain(builder);
    }
  });

  it('builds Home > Barbershop Websites > London', () => {
    const crumbs = buildCityBreadcrumbJsonLd(LONDON);
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs['@id']).toBe('https://kersivo.co.uk/barbershop-websites/london#breadcrumb');
    expect((crumbs.itemListElement as Array<Record<string, unknown>>).map((item) => [item.position, item.name, item.item])).toEqual([
      [1, 'Home', 'https://kersivo.co.uk/'],
      [2, 'Barbershop Websites', 'https://kersivo.co.uk/barbershop-websites'],
      [3, 'London', 'https://kersivo.co.uk/barbershop-websites/london'],
    ]);
  });

  it('builds FAQPage word for word from the rendered FAQ', () => {
    const faq = buildCityFaqJsonLd(LONDON);
    const items = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    const rendered = getCityFaqs(LONDON);
    expect(items).toHaveLength(rendered.length);
    items.forEach((item, index) => {
      expect(item.name).toBe(rendered[index].question);
      expect(item.acceptedAnswer.text).toBe(rendered[index].answer.join(' '));
    });
    expect(component('CwFaq')).toContain('getCityFaqs(city)');
  });

  it('has 4 or 5 London questions covering switching, deposits, Google and costs', () => {
    const questions = getCityFaqs(LONDON).map((faq) => faq.question);
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.length).toBeLessThanOrEqual(5);
    expect(questions.join(' ')).toMatch(/Booksy or Fresha/);
    expect(questions.join(' ')).toMatch(/deposits/);
    expect(questions.join(' ')).toMatch(/Google Maps/);
    expect(questions.join(' ')).toMatch(/business rates/);
    for (const question of questions) expect(question).toContain('London');
  });

  it('publishes no ratings or reviews', () => {
    const all = JSON.stringify([buildCityWebPageJsonLd(LONDON), buildCityFaqJsonLd(LONDON), buildCityBreadcrumbJsonLd(LONDON)]);
    expect(all).not.toMatch(/aggregateRating|AggregateRating|"review"|ratingValue/);
  });
});

describe('city research sources', () => {
  it.each(PUBLISHED_CITY_PAGES.map((city) => [city.name, city] as const))('%s: every figure points at a listed source', (_name, city) => {
    const ids = new Set(city.sources.map((source) => source.id));
    for (const band of [...city.prices, ...city.chairRent]) expect(ids.has(band.sourceId)).toBe(true);
    for (const cost of city.costs) for (const id of cost.sourceIds) expect(ids.has(id)).toBe(true);
    expect(ids.has(city.calculator.priceSourceId)).toBe(true);
  });

  it.each(PUBLISHED_CITY_PAGES.map((city) => [city.name, city] as const))('%s: sources are https and checked within 90 days of the research date', (_name, city) => {
    for (const source of getCityPageSources(city)) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(daysBetween(source.checkedIso, city.checkedIso)).toBeLessThanOrEqual(90);
    }
  });

  it('lists the sources on the page', () => {
    expect(component('CwFaq')).toContain('getCityPageSources(city)');
  });
});

describe('city calculator', () => {
  it('prices one new London client at the typical skin fade from the verified fact files', () => {
    const r = calculateCityScenario({ ...LONDON.calculator, paymentMode: 'deposit' });
    const byId = Object.fromEntries(r.competitors.map((c) => [c.id, c]));
    expect(LONDON.calculator.price).toBe(26.5);
    expect(byId.booksy.feePerNewClient).toBe(7.95);
    expect(byId.fresha.feePerNewClient).toBe(5.3);
    expect(byId.treatwell.feePerNewClient).toBe(9.28);
    expect(byId.booksy.feesToMatchKersivo).toBe(5);
    expect(byId.fresha.feesToMatchKersivo).toBe(8);
    expect(byId.treatwell.feesToMatchKersivo).toBe(5);
    expect(byId.treatwell.subscription).toBeNull();
    expect(r.kersivoMonthly).toBe(39);
  });

  it('adds published subscriptions for the team size', () => {
    const r = calculateCityScenario({ ...LONDON.calculator, barbers: 3, paymentMode: 'deposit' });
    const byId = Object.fromEntries(r.competitors.map((c) => [c.id, c]));
    expect(byId.booksy.subscription).toBe(50);
    expect(byId.fresha.subscription).toBe(29.85);
  });

  it('keeps the £5 deposit (capped at the price) or the full price from no-shows', () => {
    const deposit = calculateCityScenario({ ...LONDON.calculator, noShowsPerWeek: 3, paymentMode: 'deposit' });
    expect(deposit.noShow.keptPerNoShow).toBe(5);
    expect(deposit.noShow.toCoverKersivo).toBe(8);
    expect(deposit.noShow.keptPerMonth).toBe(65);
    const full = calculateCityScenario({ ...LONDON.calculator, noShowsPerWeek: 3, paymentMode: 'full' });
    expect(full.noShow.keptPerNoShow).toBe(26.5);
    expect(full.noShow.keptPerMonth).toBe(full.noShow.lostPerMonth);
    expect(full.noShow.toCoverKersivo).toBe(2);
  });

  it('clamps inputs to the slider ranges', () => {
    expect(clampCityInput('price', 500)).toBe(80);
    expect(clampCityInput('price', Number.NaN)).toBe(10);
    expect(clampCityInput('barbers', 0)).toBe(1);
    expect(clampCityInput('price', 26.4)).toBe(26.5);
  });

  it('describes the fee rules from the verified facts', () => {
    expect(describeNewClientFees()).toBe('Booksy Boost 30% (min £5), Fresha Marketplace 20% (min £4), Treatwell 35%');
  });

  it('keeps the browser graph free of server code', () => {
    for (const file of ['src/lib/cityPages/marketplaceMath.ts', 'src/lib/cityPages/initCityPage.ts']) {
      const source = read(file);
      expect(source).not.toMatch(/prisma|@\/lib\/db|stripe['"]|node:/);
    }
    expect(PAGE).toContain("import { initCityPage } from '@/lib/cityPages/initCityPage';");
  });
});

describe('city page copy and links', () => {
  const all = COMPONENTS.map(component).join('\n');

  it('leads with Full KERSIVO and keeps Starter secondary', () => {
    const hero = component('CwHero');
    expect(hero).toContain('<FullPlanCta part="primary"');
    expect(hero.indexOf('FullPlanCta part="primary"')).toBeLessThan(hero.indexOf('href="/starter"'));
    expect(hero).toContain('Or start on Starter — £0/month');
  });

  it('links back into the websites cluster and to the free preview', () => {
    const close = component('CwClose');
    expect(close).toContain('href="/barbershop-websites"');
    expect(close).toContain('href="/barbershop-website-design"');
    expect(close).toContain('href="/free-preview"');
    expect(component('CwHero')).toContain('getCityBreadcrumbs(city)');
  });

  it('is linked from the /barbershop-websites local guides band', () => {
    expect(read('src/pages/barbershop-websites/index.astro')).toContain('<BwLocalGuides />');
    expect(read('src/components/barbershopWebsite/BwLocalGuides.astro')).toContain('href={getCityPagePath(city)}');
  });

  it('puts "Stripe fees apply" next to every 0% KERSIVO commission claim', () => {
    const texts = [
      ...COMPONENTS.map(component),
      ...getCityFaqs(LONDON).map((faq) => faq.answer.join(' ')),
      ...LONDON.costs.map((cost) => cost.body.join(' ')),
    ];
    for (const text of texts) {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (!/0% KERSIVO commission/.test(line)) return;
        const near = lines.slice(Math.max(0, index - 3), index + 4).join(' ');
        expect(near, line).toMatch(/Stripe fees apply|STRIPE_FEES_NOTE|Standard Stripe payment-processing fees apply|Stripe fees/);
      });
    }
  });

  it('never states a fixed setup time or an SMS number', () => {
    const copy = [all, JSON.stringify(LONDON)].join('\n');
    expect(copy).not.toMatch(/\b\d+\s*(?:–|-|to)?\s*\d*\s*(?:working )?days? (?:to|until) (?:go )?live/i);
    expect(copy).not.toMatch(/1–2 weeks|\d+ SMS/i);
    expect(copy).toContain('Typically ready in a few days once we receive all required information');
  });

  it('labels the walkthrough shop as fictional', () => {
    expect(component('CwRoute')).toContain('is a fictional {j.district} shop');
  });
});

describe('city pages in the sitemap', () => {
  it('lists every published city with its research date as lastmod', () => {
    for (const city of PUBLISHED_CITY_PAGES) {
      const path = getCityPagePath(city);
      expect(MARKETING_SITEMAP_ENTRIES.find((entry) => entry.path === path)?.lastmod).toBe(city.checkedIso);
      expect(getStaticPageLastModified(path)).toBe(city.checkedIso);
    }
  });
});
