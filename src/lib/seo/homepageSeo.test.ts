import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RateCard1 } from '@/components/rateCard1';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';
import { buildBarberDemoJsonLd } from './barberDemoJsonLd';
import { BARBERSHOP_BOOKING_FAQ_ITEMS, buildBarbershopBookingFaqJsonLd } from './barbershopBookingFaq';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SAAS_MONTHLY_GBP } from './defaults';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  return source.slice(from, source.indexOf(end, from) + end.length);
};

const homepage = read('src/pages/index.astro');
const valueCards = read('src/components/landingValueCards.astro');
const demoPreview = read('src/components/landingDemoPreview.astro');
const switcher = read('src/components/landingSwitcherReassurance.astro');
const rateCard1Source = read('src/components/rateCard1.tsx');
const landingPricingMarkup = renderToStaticMarkup(createElement(RateCard1, { variant: 'landing' }));

const NEW_FAQ_QUESTIONS = [
  'What is barbershop software?',
  'What should a barber booking system include?',
  'Does KERSIVO charge more when I add more barbers?',
];

/** Local .astro/.tsx components reachable from the homepage and its layout. */
function homepageComponentFiles(): string[] {
  const seen = new Set<string>();
  const queue = [join(ROOT, 'src/pages/index.astro'), join(ROOT, 'src/layouts/LandingLayout.astro')];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, spec] of read(file.replace(ROOT, '')).matchAll(/from ['"]((?:@\/|\.{1,2}\/)[^'"]+)['"]/g)) {
      const base = spec.startsWith('@/') ? join(ROOT, 'src', spec.slice(2)) : resolve(dirname(file), spec);
      const found = [base, `${base}.astro`, `${base}.tsx`].find(
        (candidate) => /\.(astro|tsx)$/.test(candidate) && existsSync(candidate),
      );
      if (found) queue.push(found);
    }
  }
  return [...seen];
}

describe('homepage SEO phase 1: head', () => {
  it('keeps the approved title and uses the new meta description from the shared default', () => {
    expect(DEFAULT_TITLE).toBe('Barbershop Software & Barber Booking System UK | KERSIVO');
    expect(DEFAULT_DESCRIPTION).toBe(
      'Barbershop software for independent UK barbershops. Start KERSIVO Starter at £0/month or choose Full for your own website and domain. 0% KERSIVO commission.',
    );
    expect(DEFAULT_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(homepage).toContain('title={DEFAULT_TITLE}');
    expect(homepage).toContain('description={DEFAULT_DESCRIPTION}');
  });

  it('is canonical at the root, indexable and has no keywords meta', () => {
    expect(homepage).toContain('canonicalPath="/"');
    expect(resolveCanonicalUrl('/')).toBe('https://kersivo.co.uk/');
    expect(homepage).not.toMatch(/noindex/);
    expect(resolveRobotsContent({ noindex: undefined, robotsFollow: undefined })).toBeUndefined();
    for (const file of homepageComponentFiles()) {
      expect(read(file.replace(ROOT, '')), file).not.toMatch(/name=["']keywords["']/);
    }
  });

  it('emits Organization, WebSite, SoftwareApplication and FAQPage without reviews or ratings', () => {
    const graph = buildBarberDemoJsonLd()['@graph'] as Array<Record<string, unknown>>;
    const faq = buildBarbershopBookingFaqJsonLd();
    expect([...graph.map((node) => node['@type']), faq['@type']]).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
      'FAQPage',
    ]);
    expect(JSON.stringify([graph, faq])).not.toMatch(/"Review"|AggregateRating|aggregateRating|reviewCount|ratingValue/);
  });
});

describe('homepage SEO phase 1: headings', () => {
  it('has exactly one H1, in the hero, and no hidden duplicate', () => {
    const files = homepageComponentFiles();
    const withH1 = files
      .filter((file) => /<h1\b/.test(read(file.replace(ROOT, ''))))
      .map((file) => file.replace(ROOT, '').replaceAll('\\', '/'))
      .sort();
    expect(withH1).toEqual([
      '/src/components/booking/BookingFlow.tsx',
      '/src/components/homepage/HomepageHero.astro',
    ]);
    // The embedded homepage booking demo uses BookingFlow's preview branch, which renders an H2.
    expect(read('src/components/LandingBookingWidget.tsx')).toMatch(/<BookingFlow\s+previewMode\b/);
    expect(read('src/components/booking/BookingFlow.tsx')).toMatch(
      /\{previewMode \? \(\s*<h2 className="booking-flow__title">[\s\S]{0,200}?<\/h2>\s*\) : \(\s*<h1 className="booking-flow__title">/,
    );
    const hero = read('src/components/homepage/HomepageHero.astro');
    expect(hero.match(/<h1\b/g)).toHaveLength(1);
    expect(text(between(hero, '<h1', '</h1>'))).toBe('Barbershop software built around your brand.');
    expect(landingPricingMarkup).not.toMatch(/<h1\b/);
  });

  it('opens the content with the barbershop software H2', () => {
    expect(homepage).toMatch(/<HomepageHero \/>\s*<LandingValueCards \/>/);
    expect(valueCards).toContain('<p class="landing-value-cards__eyebrow">WHAT KERSIVO INCLUDES</p>');
    expect(text(between(valueCards, '<h2 id="landing-value-cards-title"', '</h2>'))).toBe(
      'Barbershop software for bookings, clients and daily management',
    );
    expect(text(between(valueCards, '<p class="landing-value-cards__lead">', '</p>'))).toBe(
      'Start with the core booking operation on KERSIVO Starter for £0/month. Move to Full when you want your own branded website and domain, wider client tools, Reports, Retail and more control over the customer experience.',
    );
    expect(valueCards).toContain("heading: 'Online booking for barbers, without the marketplace detour'");
    expect(valueCards).toMatch(/heading: 'Manage your barbershop from one clear(?: |\\u00a0)system'/);
    expect(valueCards).toContain("heading: 'Payments and reminders that protect your time'");
  });

  it('names the inside-the-system section as barbershop management software', () => {
    expect(demoPreview).toMatch(/heading: 'See KERSIVO barbershop management software in(?: |\\u00a0)action'/);
    expect(demoPreview).toContain("kicker: 'ONLINE BOOKING FOR BARBERS'");
    expect(demoPreview).not.toContain('CLIENT BOOKING EXPERIENCE');
  });

  it('renders the pricing H2 with the dynamic monthly price per location', () => {
    const layout = getRateCard1LandingLayout();
    expect(layout.eyebrow).toBe('BARBERSHOP SOFTWARE PRICING');
    expect(layout.lead).toBe(
      'Full KERSIVO is one flat monthly price per location for your branded website, booking system, payment control, client management, admin, retail and support. Extra barbers are included subject to fair use.',
    );
    expect(rateCard1Source).toMatch(
      /\{layout\.headingBeforePrice\}\s*\{SAAS_MONTHLY_GBP\}\s*\{layout\.headingAfterPrice\}/,
    );
    const h2 = landingPricingMarkup.match(/<h2 id="rate-card1-heading"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '';
    expect(text(h2).replace(/\s+/g, '')).toBe(
      `Barbershopsoftwarepricing:£${SAAS_MONTHLY_GBP}/monthperlocation`,
    );
    expect(landingPricingMarkup.replace(/<!-- -->/g, '')).toContain(
      `Barbershop software pricing: £${SAAS_MONTHLY_GBP}/month per location</h2>`,
    );
  });

  it('keeps the switcher eyebrow and uses the platform-switch H2', () => {
    expect(switcher).toContain('SWITCHING TO KERSIVO');
    expect(text(between(switcher, '<h2 id="landing-switcher-reassurance-title"', '</h2>'))).toBe(
      'Switch barber booking platforms without interrupting bookings',
    );
    expect(text(between(switcher, '<p class="landing-switcher-reassurance__lead">', '</p>'))).toBe(
      'Already using Booksy, Fresha or another booking platform? Keep taking bookings through your current system while we prepare your branded KERSIVO setup.',
    );
  });
});

describe('homepage SEO phase 1: internal links', () => {
  it('server-renders a followed, same-tab calculator link under the landing pricing', () => {
    const paragraph = landingPricingMarkup.match(/<p class="rate-card1__landing-calculator">([\s\S]*?)<\/p>/)?.[0] ?? '';
    expect(paragraph.replace(/<[^>]+>/g, '')).toBe(
      'Comparing platforms? See the real cost of Booksy, Fresha and KERSIVO with our Barber Software Cost Calculator.',
    );
    expect(paragraph).toContain('<a href="/barber-software-cost-calculator">Barber Software Cost Calculator</a>');
    expect(paragraph).not.toMatch(/nofollow|target=/);
    expect(homepage).toMatch(/<RateCard1 variant="landing" \/>/);
    expect(homepage).not.toMatch(/<RateCard1[^>]*client:/);
  });

  it('keeps the calculator link off the Booksy and Fresha pricing sections', () => {
    for (const path of [
      'src/components/booksyAlternative/BooksyPricing.astro',
      'src/components/freshaAlternative/FreshaPricing.astro',
    ]) {
      expect(read(path)).not.toMatch(/calculatorLink|barber-software-cost-calculator/);
    }
  });

  it('keeps the Booksy and Fresha comparison links in the body', () => {
    expect(homepage).toContain('<LandingSwitcherReassurance showBooksyCompareLink showFreshaCompareLink />');
    expect(switcher).toContain('href="/booksy-alternative"');
    expect(switcher).toContain('href="/fresha-alternative"');
    expect(switcher).toContain('Compare KERSIVO and Booksy');
    expect(switcher).toContain('Compare KERSIVO and Fresha');
  });
});

describe('homepage SEO phase 1: FAQ', () => {
  it('renders the three new questions in the visible FAQ and the FAQPage JSON-LD', () => {
    expect(homepage).toContain('faqs={BARBERSHOP_BOOKING_FAQ_ITEMS}');
    const visible = BARBERSHOP_BOOKING_FAQ_ITEMS.map((item) => item.question);
    const structured = (buildBarbershopBookingFaqJsonLd().mainEntity as Array<{ name: string }>).map(
      (entity) => entity.name,
    );
    for (const question of NEW_FAQ_QUESTIONS) {
      expect(visible).toContain(question);
      expect(structured).toContain(question);
    }
    expect(structured).toEqual(visible);
    expect(visible.length).toBe(new Set(visible).size);
  });

  it('qualifies the extra-barbers answer with fair use and the dynamic price, in both FAQ and JSON-LD', () => {
    const question = 'Does KERSIVO charge more when I add more barbers?';
    const expected = `Starter supports up to 4 active bookable barbers at £0/month. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location rather than per barber; additional barbers within that location are included subject to reasonable fair use.`;
    expect(BARBERSHOP_BOOKING_FAQ_ITEMS.find((item) => item.question === question)?.answer).toBe(expected);
    const entity = (
      buildBarbershopBookingFaqJsonLd().mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>
    ).find((e) => e.name === question);
    expect(entity?.acceptedAnswer.text).toBe(expected);
    expect(read('src/lib/seo/barbershopBookingFaq.ts')).toContain(
      'Starter supports up to 4 active bookable barbers at £0/month. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location',
    );
  });
});

describe('homepage SEO phase 1: images', () => {
  it('gives every homepage image an alt attribute', () => {
    const missing: string[] = [];
    for (const file of homepageComponentFiles()) {
      for (const [tag] of read(file.replace(ROOT, '')).matchAll(/<img\b[^>]*?\/?>/g)) {
        if (!/\salt(?:=|\s|\/?>)/.test(tag)) missing.push(`${file}: ${tag.slice(0, 80)}`);
      }
    }
    expect(missing).toEqual([]);
    expect(landingPricingMarkup.match(/<img\b(?![^>]*\salt=)[^>]*>/g) ?? []).toEqual([]);
  });
});
