import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_CITY_PAGES,
  buildCityBreadcrumbJsonLd,
  buildCityFaqJsonLd,
  buildCityPageH1,
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
import { BOURNEMOUTH_CITY_PAGE as BOURNEMOUTH } from './cityPages/bournemouth';
import { BIRMINGHAM_CITY_PAGE as BIRMINGHAM } from './cityPages/birmingham';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { getStaticPageLastModified } from './pageDates';
import { calculateCityScenario, clampCityInput, describeNewClientFees } from '@/lib/cityPages/marketplaceMath';

const read = (path: string) => readFileSync(path, 'utf8');
const PAGE = read('src/pages/barbershop-websites/[city].astro');
const COMPONENTS = ['CwHero', 'CwCalculator', 'CwRoute', 'CwMarket', 'CwCosts', 'CwFaq', 'CwClose', 'CwCityNav'];
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

  it('keeps the meta description between 145 and 160 characters', () => {
    expect(buildCityPageDescription('London')).toBe(
      'Custom barbershop website design for London shops. Own domain, online booking, deposits and a retail pickup shop for £39/month flat — 0% KERSIVO commission.',
    );
    for (const city of PUBLISHED_CITY_PAGES) {
      const length = buildCityPageDescription(city.name).length;
      expect(length).toBeGreaterThanOrEqual(145);
      expect(length).toBeLessThanOrEqual(160);
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

  it('closes on the free preview with Starter as the secondary button', () => {
    const close = component('CwClose');
    expect(close).toContain('Ready to put your {city.name} shop on your own domain?');
    expect(close).toContain('See a free working preview built around your barbershop before you pay a penny&nbsp;— or start free on Starter.');
    expect(close.indexOf('<FullPlanCta part="primary"')).toBeLessThan(close.indexOf('href="/starter"'));
    expect(close).toContain('Or start on Starter — £0/month');
    expect(close).toContain('<li>£{SAAS_MONTHLY_GBP}/month per location, not per barber</li>');
    expect(close).toContain('<li>No setup fee</li>');
    expect(close).toContain('<li>0% KERSIVO commission, Stripe fees apply</li>');
    expect(close).toContain('<CwCityNav city={city} />');
  });

  it('links back into the websites cluster and lists other published cities', () => {
    const nav = component('CwCityNav');
    expect(nav).toContain('href="/barbershop-websites"');
    expect(nav).toContain('All UK Barbershop Website Guides');
    expect(nav).toContain('href="/barbershop-website-design"');
    expect(nav).toContain('href="/compare"');
    expect(nav).toContain('PUBLISHED_CITY_PAGES.filter((other) => other.slug !== city.slug)');
    expect(nav).toContain('Other UK Cities');
    expect(component('CwHero')).toContain('getCityBreadcrumbs(city)');
  });

  it('is linked from the /barbershop-websites local guides band', () => {
    expect(read('src/pages/barbershop-websites/index.astro')).toContain('<BwLocalGuides />');
    expect(read('src/components/barbershopWebsite/BwLocalGuides.astro')).toContain('href={getCityPagePath(city)}');
  });

  it('puts "Stripe fees apply" next to every 0% KERSIVO commission claim', () => {
    const texts = [
      ...COMPONENTS.map(component),
      ...PUBLISHED_CITY_PAGES.flatMap((city) => [
        city.heroLead,
        ...getCityFaqs(city).map((faq) => faq.answer.join(' ')),
        ...city.costs.map((cost) => cost.body.join(' ')),
      ]),
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
    const copy = [all, ...PUBLISHED_CITY_PAGES.map((city) => JSON.stringify(city))].join('\n');
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

describe('Bournemouth city page', () => {
  it('is published at /barbershop-websites/bournemouth with its own research date', () => {
    expect(getCityPage('bournemouth')).toBe(BOURNEMOUTH);
    expect(getCityPagePath(BOURNEMOUTH)).toBe('/barbershop-websites/bournemouth');
    expect(BOURNEMOUTH.nation).toBe('England');
    expect(BOURNEMOUTH.checkedIso).toBe('2026-11-24');
  });

  it('uses the full title and the shorter description that fits 160 characters', () => {
    expect(buildCityPageTitle('Bournemouth')).toBe('Barbershop Website Design Bournemouth | £39/mo | KERSIVO');
    expect(buildCityPageDescription('Bournemouth')).toBe(
      'Custom barbershop website design for Bournemouth shops. Own domain, online booking, deposits and a retail pickup shop for £39/month — 0% KERSIVO commission.',
    );
    expect(buildCityPageDescription('London')).toContain('£39/month flat');
  });

  it('builds Home > Barbershop Websites > Bournemouth', () => {
    const crumbs = buildCityBreadcrumbJsonLd(BOURNEMOUTH);
    expect((crumbs.itemListElement as Array<Record<string, unknown>>).map((item) => [item.name, item.item])).toEqual([
      ['Home', 'https://kersivo.co.uk/'],
      ['Barbershop Websites', 'https://kersivo.co.uk/barbershop-websites'],
      ['Bournemouth', 'https://kersivo.co.uk/barbershop-websites/bournemouth'],
    ]);
  });

  it('has five Bournemouth questions: switching, deposits, Google Maps, rates and price', () => {
    const faqs = getCityFaqs(BOURNEMOUTH);
    expect(faqs).toHaveLength(5);
    const questions = faqs.map((faq) => faq.question);
    for (const question of questions) expect(question).toContain('Bournemouth');
    const joined = questions.join(' ');
    for (const topic of [/Booksy or Fresha/, /deposits/, /Google Maps/, /business rates/, /KERSIVO/]) expect(joined).toMatch(topic);
    const items = buildCityFaqJsonLd(BOURNEMOUTH).mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(items).toHaveLength(5);
    items.forEach((item, index) => {
      expect(item.name).toBe(faqs[index].question);
      expect(item.acceptedAnswer.text).toBe(faqs[index].answer.join(' '));
    });
  });

  it('prices one new client at the £20 Bournemouth middle skin fade', () => {
    expect(BOURNEMOUTH.calculator.price).toBe(20);
    const r = calculateCityScenario({ ...BOURNEMOUTH.calculator, paymentMode: 'deposit' });
    const byId = Object.fromEntries(r.competitors.map((c) => [c.id, c]));
    expect(byId.booksy.feePerNewClient).toBe(6);
    expect(byId.fresha.feePerNewClient).toBe(4);
    expect(byId.treatwell.feePerNewClient).toBe(7);
    expect(byId.booksy.feesToMatchKersivo).toBe(7);
    expect(byId.fresha.feesToMatchKersivo).toBe(10);
    expect(byId.treatwell.feesToMatchKersivo).toBe(6);
  });

  it('works out the Stripe fee examples from the verified Stripe facts', () => {
    const cards = BOURNEMOUTH.costs.find((cost) => cost.id === 'cards')!;
    expect(cards.figure).toBe('28p');
    const body = cards.body.join(' ');
    expect(body).toContain('1.5% + 20p');
    expect(body).toContain('50p on a £20 fade');
    expect(body).toContain(STRIPE_FEES_NOTE);
  });

  it('cites BCP Council and the HM Treasury qualifying-use guidance for business rates', () => {
    const rates = BOURNEMOUTH.costs.find((cost) => cost.id === 'rates')!;
    expect(rates.sourceIds).toEqual(expect.arrayContaining(['bcpRates2026', 'hmtRhlGuidance']));
    expect(rates.body.join(' ')).toMatch(/BCP Council/);
    expect(rates.body.join(' ')).toMatch(/38\.2p/);
  });

  it('sets the walkthrough in Winton and names real Bournemouth districts', () => {
    expect(BOURNEMOUTH.journey.district).toBe('Winton');
    const places = BOURNEMOUTH.areas.flatMap((area) => area.places);
    for (const place of ['Boscombe', 'Southbourne', 'Winton', 'Charminster', 'Westbourne']) expect(places).toContain(place);
  });
});

describe('Birmingham city page', () => {
  it('is published at /barbershop-websites/birmingham with its own research date', () => {
    expect(getCityPage('birmingham')).toBe(BIRMINGHAM);
    expect(getCityPagePath(BIRMINGHAM)).toBe('/barbershop-websites/birmingham');
    expect(BIRMINGHAM.nation).toBe('England');
    expect(BIRMINGHAM.checkedIso).toBe('2026-11-24');
  });

  it('uses the exact title and the full 160-character description', () => {
    expect(buildCityPageTitle('Birmingham')).toBe('Barbershop Website Design Birmingham | £39/mo | KERSIVO');
    expect(buildCityPageTitle('Birmingham')).toHaveLength(55);
    const description = buildCityPageDescription('Birmingham');
    expect(description).toBe(
      'Custom barbershop website design for Birmingham shops. Own domain, online booking, deposits and a retail pickup shop for £39/month flat — 0% KERSIVO commission.',
    );
    expect(description).toHaveLength(160);
  });

  it('builds Home > Barbershop Websites > Birmingham', () => {
    const crumbs = buildCityBreadcrumbJsonLd(BIRMINGHAM);
    expect((crumbs.itemListElement as Array<Record<string, unknown>>).map((item) => [item.name, item.item])).toEqual([
      ['Home', 'https://kersivo.co.uk/'],
      ['Barbershop Websites', 'https://kersivo.co.uk/barbershop-websites'],
      ['Birmingham', 'https://kersivo.co.uk/barbershop-websites/birmingham'],
    ]);
  });

  it('has five Birmingham questions: switching, deposits, Google Maps, rates and price', () => {
    const faqs = getCityFaqs(BIRMINGHAM);
    expect(faqs).toHaveLength(5);
    const questions = faqs.map((faq) => faq.question);
    for (const question of questions) expect(question).toContain('Birmingham');
    const joined = questions.join(' ');
    for (const topic of [/Booksy or Fresha/, /deposits/, /Google Maps/, /business rates/, /Making Tax Digital/, /KERSIVO/]) expect(joined).toMatch(topic);
    const items = buildCityFaqJsonLd(BIRMINGHAM).mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(items).toHaveLength(5);
    items.forEach((item, index) => {
      expect(item.name).toBe(faqs[index].question);
      expect(item.acceptedAnswer.text).toBe(faqs[index].answer.join(' '));
    });
  });

  it('prices one new client at the £25 Birmingham middle skin fade', () => {
    expect(BIRMINGHAM.calculator.price).toBe(25);
    const r = calculateCityScenario({ ...BIRMINGHAM.calculator, paymentMode: 'deposit' });
    const byId = Object.fromEntries(r.competitors.map((c) => [c.id, c]));
    expect(byId.booksy.feePerNewClient).toBe(7.5);
    expect(byId.fresha.feePerNewClient).toBe(5);
    expect(byId.treatwell.feePerNewClient).toBe(8.75);
    expect(byId.booksy.feesToMatchKersivo).toBe(6);
    expect(byId.fresha.feesToMatchKersivo).toBe(8);
    expect(byId.treatwell.feesToMatchKersivo).toBe(5);
  });

  it('works out the Stripe fee examples from the verified Stripe facts', () => {
    const cards = BIRMINGHAM.costs.find((cost) => cost.id === 'cards')!;
    expect(cards.figure).toBe('28p');
    const body = cards.body.join(' ');
    expect(body).toContain('1.5% + 20p');
    expect(body).toContain('£25 fade paid in full about 58p');
    expect(body).toContain(STRIPE_FEES_NOTE);
  });

  it('cites Birmingham City Council for the 2026/27 multipliers and small business relief', () => {
    const rates = BIRMINGHAM.costs.find((cost) => cost.id === 'rates')!;
    expect(rates.sourceIds).toEqual(expect.arrayContaining(['bccMultipliers', 'bccSmallBusiness', 'hmtRhlGuidance']));
    const body = rates.body.join(' ');
    expect(body).toMatch(/Birmingham City Council/);
    expect(body).toMatch(/38\.2p/);
    expect(body).toMatch(/£12,000/);
    expect(body).toMatch(/£14,999/);
    const mtd = BIRMINGHAM.costs.find((cost) => cost.id === 'mtd')!.body.join(' ');
    expect(mtd).toMatch(/6 April 2027/);
    expect(mtd).toMatch(/£30,000/);
  });

  it('sets the walkthrough in Moseley and names the requested districts', () => {
    expect(BIRMINGHAM.journey.district).toBe('Moseley');
    expect(BIRMINGHAM.journey.service).toBe('Skin fade + beard trim');
    expect(BIRMINGHAM.journey.product).toBe('Beard oil');
    expect(BIRMINGHAM.areas.map((area) => area.name)).toEqual([
      'City Centre, Jewellery Quarter and Digbeth',
      'Moseley, Kings Heath and Harborne',
      'Sutton Coldfield, Erdington and the outer suburbs',
    ]);
    for (const place of ['Digbeth', 'Moseley Village', 'Harborne High Street', 'Sutton Coldfield', 'Erdington']) {
      expect(BIRMINGHAM.areas.flatMap((area) => area.places)).toContain(place);
    }
  });

  it('works the target queries into the H1 and copy', () => {
    expect(buildCityPageH1(BIRMINGHAM)).toBe('Barbershop website design for Birmingham shops');
    expect(BIRMINGHAM.targetQueries).toContain('barbershop website design Birmingham');
  });
});

describe('city pages are written separately, not name-swapped', () => {
  const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim());
  /** Approved policy wording every city may share; everything else must be the city's own. */
  const SHARED = new Set([
    ...splitSentences(STRIPE_FEES_NOTE),
    'We can help move eligible information exported from your current provider.',
    'Some history may not transfer.',
  ]);
  const sentences = (city: typeof LONDON) =>
    [
      city.heroLead,
      city.hubSummary,
      ...city.marketIntro,
      ...city.areas.flatMap((area) => [area.pattern, ...area.setup]),
      ...city.costs.flatMap((cost) => cost.body),
      ...city.faqs.flatMap((faq) => [faq.question, ...faq.answer]),
    ]
      .flatMap(splitSentences)
      .filter((sentence) => sentence.length > 25 && !SHARED.has(sentence));

  it('shares no sentence of city copy between any two published cities', () => {
    const cities = PUBLISHED_CITY_PAGES;
    for (let a = 0; a < cities.length; a += 1) {
      const own = new Set(sentences(cities[a]));
      for (let b = a + 1; b < cities.length; b += 1) {
        const shared = sentences(cities[b]).filter((sentence) => own.has(sentence));
        expect(shared, `${cities[a].name} / ${cities[b].name}`).toEqual([]);
      }
    }
  });

  it('gives every city its own calculator default, walkthrough district and price source', () => {
    const keys = PUBLISHED_CITY_PAGES.map((city) => `${city.calculator.price}|${city.journey.district}|${city.calculator.priceSourceId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
