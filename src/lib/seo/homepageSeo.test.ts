import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RateCard1 } from '@/components/rateCard1';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';
import { buildBarberDemoJsonLd } from './barberDemoJsonLd';
import { HOMEPAGE_FAQ_ITEMS, buildBarbershopBookingFaqJsonLd } from './barbershopBookingFaq';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, HOMEPAGE_DESCRIPTION, SAAS_MONTHLY_GBP } from './defaults';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  return source.slice(from, source.indexOf(end, from) + end.length);
};

const homepage = read('src/pages/index.astro');
const difference = read('src/components/landingDifference.astro');
const demoPreview = read('src/components/landingDemoPreview.astro');
const switcher = read('src/components/landingSwitcherReassurance.astro');
const rateCard1Source = read('src/components/rateCard1.tsx');
const landingPricingMarkup = renderToStaticMarkup(createElement(RateCard1, { variant: 'landing' }));

const NEW_FAQ_QUESTIONS = [
  'How much does Full KERSIVO cost a shop?',
  'When do I pay, and how long until my website is live?',
  'Can I cancel?',
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
      'UK barbershop software with your own branded website, domain and online bookings. Full KERSIVO is £39/month per location, with 0% KERSIVO commission.',
    );
    expect(DEFAULT_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(homepage).toContain('title={DEFAULT_TITLE}');
    expect(homepage).toContain('description={getHomepageDescription(freePreview)}');
    expect(HOMEPAGE_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(HOMEPAGE_DESCRIPTION.length).toBeLessThanOrEqual(165);
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
      'WebPage',
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
    expect(withH1).toEqual(['/src/components/homepage/HomepageHero.astro']);
    const hero = read('src/components/homepage/HomepageHero.astro');
    expect(hero.match(/<h1\b/g)).toHaveLength(1);
    expect(text(between(hero, '<h1', '</h1>'))).toBe(
      'Your own barbershop website and booking system. Not a marketplace listing.',
    );
    expect(landingPricingMarkup).not.toMatch(/<h1\b/);
  });

  it('opens the content with the barbershop software H2', () => {
    expect(homepage).toMatch(/<HomepageHero \/>\s*<LandingDifference \/>\s*<LandingDemoPreview /);
    expect(text(between(difference, '<h2 id="landing-difference-title"', '</h2>'))).toBe(
      'Clients book your shop, not a marketplace',
    );
    expect(difference).toContain("linkHref: '/barbershop-online-booking'");
  });

  it('names the inside-the-system section as barbershop management software', () => {
    expect(demoPreview).toMatch(/heading: 'See KERSIVO barbershop management software in(?: |\\u00a0)action'/);
    expect(demoPreview).toContain("kicker: 'ONLINE BOOKING FOR BARBERS'");
    expect(demoPreview).not.toContain('CLIENT BOOKING EXPERIENCE');
  });

  it('renders the pricing H2 with the dynamic monthly price per location', () => {
    const layout = getRateCard1LandingLayout();
    expect(layout.eyebrow).toBe('BARBERSHOP SOFTWARE PRICING');
    expect(layout.heading).toBe('One price per shop. Every barber included.');
    expect(layout.lead).toContain(`£${SAAS_MONTHLY_GBP}/month per physical location`);
    expect(layout.lead).toContain('no VAT added');
    expect(rateCard1Source).toMatch(
      /\{layout\.headingBeforePrice\}\s*\{SAAS_MONTHLY_GBP\}\s*\{layout\.headingAfterPrice\}/,
    );
    const h2 = landingPricingMarkup.match(/<h2 id="rate-card1-heading"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '';
    expect(text(h2)).toBe('One price per shop. Every barber included.');
    expect(landingPricingMarkup).toContain(`£${SAAS_MONTHLY_GBP}`);
  });

  it('keeps the switcher eyebrow and uses the platform-switch H2', () => {
    expect(switcher).toContain('SWITCHING TO KERSIVO');
    expect(text(between(switcher, '<h2 id="landing-switcher-reassurance-title"', '</h2>'))).toBe(
      'Switch barber booking platforms without interrupting bookings',
    );
    const switcherLeadSource = between(switcher, '<p class="landing-switcher-reassurance__lead">', '</p>');
    const switcherLead = text(
      switcherLeadSource
        .replace(/\{showBooksyCompareLink \? <a href="\/booksy-alternative">Booksy<\/a> : 'Booksy'\}/g, 'Booksy')
        .replace(/\{showFreshaCompareLink \? <a href="\/fresha-alternative">Fresha<\/a> : 'Fresha'\}/g, 'Fresha')
        .replace(/<\/?a\b[^>]*>/g, ''),
    );
    expect(switcherLead).toContain(
      'Already using Booksy, Fresha, Treatwell, Setora or another booking platform? Keep taking bookings through your current system while we prepare your branded KERSIVO setup.',
    );
    expect(switcherLeadSource).toContain('href="/booksy-alternative"');
    expect(switcherLeadSource).toContain('href="/fresha-alternative"');
    expect(switcherLeadSource).toContain('href="/treatwell-alternative"');
    expect(switcherLead).toContain('Before you switch, compare UK barber booking systems side by side');
    expect(switcher).toContain('href="/compare"');
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
    expect(homepage).toMatch(/<RateCard1 variant="landing" freePreview=\{freePreview\} \/>/);
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

  it('keeps a single compare hub link in the switching link row', () => {
    expect(homepage).toContain('<LandingSwitcherReassurance showBooksyCompareLink showFreshaCompareLink />');
    const nav = switcher.split('<nav class="landing-switcher-reassurance__compare-links"')[1]?.split('</nav>')[0] ?? '';
    expect(nav).toContain('<a href="/compare">Compare all booking systems</a>');
    expect(nav.match(/<a /g)).toHaveLength(1);
    expect(nav).not.toContain('/booksy-alternative');
    expect(nav).not.toContain('/fresha-alternative');
  });
});

describe('homepage visual style parity with /starter', () => {
  it('keeps the homepage hero on the flat black product background', () => {
    const hero = read('src/styles/components/homepage-hero.css');
    expect(hero).toContain('background: #030303;');
    expect(homepage).not.toContain('LandingValueCards');
  });

  it('matches the /starter glance card surface, shadow and rounded edges while keeping price card layout', () => {
    const starter = read('src/styles/components/ks-glass-card.css');
    const pricing = read('src/styles/rateCard1.css');
    const final = read('src/styles/components/landingFinalCta.css');
    const reference = 'background: linear-gradient(180deg, #0d0d0e 0%, #080809 100%);';
    const shadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.05)';
    expect(starter).toContain('background: linear-gradient(180deg, #0d0d0e 0%, #080809 100%);');
    expect(pricing).toContain(reference);
    expect(final).toContain(reference);
    expect(pricing).toContain(shadow);
    expect(final).toContain(shadow);
    expect(pricing).toContain('max-width: 72.5rem;');
    expect(pricing).toContain('border-radius: 1.25rem;');
    expect(final).toContain('.landing-final-cta__panel::before');
    expect(pricing).toContain('.rate-card1--landing .rate-card1__offer::before');
  });
});

describe('homepage lower-funnel conversion controls', () => {
  it('does not put a demo-email form between pricing and onboarding', () => {
    expect(homepage).not.toMatch(/LandingDemoCapture/);
    expect(homepage).toMatch(
      /<RateCard1 variant="landing" freePreview=\{freePreview\} \/>\s*<HomepagePricingNotes \/>\s*<LandingPostPurchaseSteps \/>/,
    );
    expect(homepage).toContain('<Contact16');
    expect(homepage).toContain('submitLabel="Send my question"');
    expect(homepage).toMatch(/<Contact16[\s\S]*?\/>\s*<LandingFinalCta \/>\s*<Footer50/);
  });

  it('keeps transparent commercial conditions without the unrequested VAT-status claim', () => {
    const layout = getRateCard1LandingLayout();
    expect(layout.conditionsLine1).toContain('Stripe');
    expect(layout.conditionsLine2).toContain(
      `we'll refund your initial £${SAAS_MONTHLY_GBP} subscription payment`,
    );
    expect(landingPricingMarkup).toMatch(/not currently VAT registered/);
    expect(landingPricingMarkup).toContain('href="/admin/launch"');
  });

  it('preserves a single primary CTA and contextual comparison links for switchers', () => {
    expect((switcher.match(/class="btn btn--primary/g) ?? [])).toHaveLength(1);
    expect(switcher).toContain('landing-switcher-reassurance__compare-links');
    const nav = switcher.split('<nav class="landing-switcher-reassurance__compare-links"')[1]?.split('</nav>')[0] ?? '';
    expect(nav).toContain('href="/compare"');
    expect(nav.match(/<a /g)).toHaveLength(1);
  });
});

describe('homepage SEO phase 1: FAQ', () => {
  it('renders the three new questions in the visible FAQ and the FAQPage JSON-LD', () => {
    expect(homepage).toContain('faqs={faqItems}');
    expect(homepage).toContain('const faqItems = getHomepageFaqItems(freePreview);');
    const visible = HOMEPAGE_FAQ_ITEMS.map((item) => item.question);
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

  it('keeps the homepage FAQ answers and JSON-LD on the same Full KERSIVO questions', () => {
    const question = 'How much does Full KERSIVO cost a shop?';
    const entity = (
      buildBarbershopBookingFaqJsonLd().mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>
    ).find((e) => e.name === question);
    expect(entity?.acceptedAnswer.text).toContain(`£${SAAS_MONTHLY_GBP} a month per physical location`);
    expect(entity?.acceptedAnswer.text).toBe(
      HOMEPAGE_FAQ_ITEMS.find((item) => item.question === question)?.answer,
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
