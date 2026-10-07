import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ABOUT_ENTITY_DEFINITION,
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_H1,
  ABOUT_PAGE_TITLE,
  buildAboutPageJsonLd,
} from './aboutPage';
import {
  PRICING_FAQ_ITEMS,
  PRICING_FEES_POINTS,
  PRICING_INCLUDED_GROUPS,
  PRICING_PAGE_DESCRIPTION,
  PRICING_PAGE_H1,
  PRICING_PAGE_TITLE,
  PRICING_QUICK_ANSWER,
  buildPricingFaqJsonLd,
  buildPricingWebPageJsonLd,
} from './pricingPage';
import {
  buildKersivoEntityJsonLd,
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from './kersivoEntityJsonLd';
import { buildBarberDemoJsonLd } from './barberDemoJsonLd';
import { BOOKSY_ALTERNATIVE_FAQ_ITEMS, buildBooksyAlternativeFaqJsonLd } from './booksyAlternativeFaq';
import { FRESHA_ALTERNATIVE_FAQ_ITEMS, buildFreshaAlternativeFaqJsonLd } from './freshaAlternativeFaq';
import { FEATURE261_MONETIZATION_ROW } from '@/lib/landing/feature261MonetizationRow';
import { SMS_MONTHLY_ALLOWANCE_TERMS } from '@/lib/pricing/claimsPolicy';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { MARKETING_NAV_DIRECT_LINKS, MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const SITE = 'https://kersivo.co.uk';
const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

type Node = Record<string, unknown>;
const graphOf = (block: Node) => block['@graph'] as Node[];

function pricingRenderedText(): string {
  return [
    PRICING_QUICK_ANSWER,
    ...PRICING_INCLUDED_GROUPS.flatMap((group) => [group.title, ...group.items]),
    ...PRICING_FEES_POINTS,
    ...PRICING_FAQ_ITEMS.flatMap((item) => [item.question, item.answer]),
  ].join('\n');
}

describe('global entity structured data', () => {
  it('uses stable Organization and WebSite ids', () => {
    expect(getKersivoOrganizationId(SITE)).toBe(ORG_ID);
    expect(getKersivoWebsiteId(SITE)).toBe(WEBSITE_ID);
  });

  it('emits exactly one Organization and one WebSite with only verified facts', () => {
    const graph = graphOf(buildKersivoEntityJsonLd());
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite']);

    const [organization, website] = graph;
    expect(organization).toMatchObject({
      '@id': ORG_ID,
      name: 'KERSIVO',
      url: `${SITE}/`,
      email: 'hello@kersivo.co.uk',
      description: 'Booking and management software built specifically for independent UK barbershops.',
    });
    expect(JSON.stringify(organization.areaServed)).toContain('GB');
    expect(website).toEqual({
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: `${SITE}/`,
      name: 'KERSIVO',
      publisher: { '@id': ORG_ID },
    });

    const serialized = JSON.stringify(graph);
    expect(serialized).not.toMatch(
      /"address"|"telephone"|foundingDate|numberOfEmployees|"award"|aggregateRating|"review"|"founder"/,
    );
  });

  it('shares the same Organization node between the homepage graph and the entity block', () => {
    const homepageOrg = graphOf(buildBarberDemoJsonLd()).find((node) => node['@type'] === 'Organization');
    const entityOrg = graphOf(buildKersivoEntityJsonLd()).find((node) => node['@type'] === 'Organization');
    expect(homepageOrg).toEqual(entityOrg);
  });

  it('emits the entity graph once per marketing page and never twice', () => {
    const homepage = read('src/pages/index.astro');
    expect(homepage).not.toContain('buildKersivoEntityJsonLd');
    for (const page of ['src/pages/about.astro', 'src/pages/pricing.astro']) {
      const source = read(page);
      expect(source.match(/buildKersivoEntityJsonLd\(\)/g), page).toHaveLength(1);
      expect(source).not.toContain('buildBarberDemoJsonLd');
    }
  });
});

describe('/about page', () => {
  const page = read('src/pages/about.astro');

  it('has the approved title, H1, description and opening entity definition', () => {
    expect(ABOUT_PAGE_TITLE).toBe('About KERSIVO | Booking Software for UK Barbershops');
    expect(ABOUT_PAGE_H1).toBe('About KERSIVO');
    expect(ABOUT_PAGE_DESCRIPTION.length).toBeGreaterThan(70);
    expect(ABOUT_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(170);
    expect(ABOUT_ENTITY_DEFINITION).toBe(
      'KERSIVO is booking and management software built specifically for independent UK barbershops. KERSIVO Starter (£0/month) gives a shop online bookings paid through its own Stripe account, client, team and service management, and email reminders. Full KERSIVO (£39/month per location) adds a branded website on the shop’s own domain, editable payment controls, SMS reminders, reports and retail pickup.',
    );
    expect(page).not.toContain('One plan.');
    expect(ABOUT_PAGE_DESCRIPTION).toContain('Starter is £0/month');
    expect(page).toContain('canonicalPath={ABOUT_PAGE_PATH}');
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(page.indexOf('{ABOUT_ENTITY_DEFINITION}')).toBeGreaterThan(page.indexOf('<h1'));
  });

  it('covers every required section and links to pricing, demo and contact', () => {
    for (const id of ['what-it-is', 'who-its-for', 'why', 'included', 'own-brand', 'pricing']) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(page).toContain('href="/pricing"');
    expect(page).toContain('href="/demo"');
    expect(page).toContain('<Contact16');
  });

  it('emits AboutPage schema that points at the Organization', () => {
    const schema = buildAboutPageJsonLd();
    expect(schema).toMatchObject({
      '@type': 'AboutPage',
      url: `${SITE}/about`,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      mainEntity: { '@id': ORG_ID },
    });
  });

  it('makes no founder, customer-count, launch-date or growth claims', () => {
    const content = read('src/lib/seo/aboutPage.ts') + page;
    expect(content).not.toMatch(/founded|founder|since 20\d\d|customers? (use|trust)|market share|testimonial|\d+\+? (shops|barbershops|customers)/i);
  });
});

describe('/pricing page', () => {
  const page = read('src/pages/pricing.astro');
  const text = pricingRenderedText();

  it('has the approved title, H1, description and quick answer', () => {
    expect(PRICING_PAGE_TITLE).toBe('KERSIVO Pricing | Starter £0 & Full £39/Month');
    expect(PRICING_PAGE_TITLE.length).toBeLessThanOrEqual(60);
    expect(PRICING_PAGE_H1).toBe('KERSIVO pricing for independent barbershops');
    expect(PRICING_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(170);
    expect(PRICING_QUICK_ANSWER).toContain('KERSIVO Starter is £0/month');
    expect(PRICING_QUICK_ANSWER).toContain('Full KERSIVO is £39/month per physical location');
    expect(PRICING_QUICK_ANSWER).toContain('0% commission on both plans');
    expect(PRICING_QUICK_ANSWER).toContain('Standard Stripe processing fees');
    expect(page).toContain('canonicalPath={PRICING_PAGE_PATH}');
    expect(page.match(/<h1\b/g)).toHaveLength(1);
  });

  it('renders every approved commercial fact for both plans', () => {
    for (const fact of [
      'KERSIVO Starter — £0/month',
      'Full KERSIVO — £39/month per location',
      'Up to 4 active bookable barbers',
      'Automated email confirmations and reminders',
      'Fixed public booking payments: £5 deposit or Pay in full',
      'Connected Stripe account required before public bookings go live',
      'Editable booking payment controls, including Pay at shop, £5 deposit or full payment',
      'No setup fee',
      'subject to reasonable fair use',
      'Your own standard domain included',
      'Your own branded barbershop website',
      'SMS appointment reminders are included, subject to the plan’s monthly SMS allowance.',
      'Retail pickup shop',
      'Hosting, SSL and platform updates',
      'Migration assistance',
      'Standard Stripe payment-processing fees',
      'not currently VAT registered',
      'Cancel anytime',
    ]) {
      expect(text, fact).toContain(fact);
    }
  });

  it('keeps Full-only features out of the Starter plan group', () => {
    const starter = PRICING_INCLUDED_GROUPS.find((group) => group.title.startsWith('KERSIVO Starter'));
    expect(starter).toBeDefined();
    const starterText = starter!.items.join(' ');
    expect(starterText).not.toMatch(/domain|branded .*website|SMS|Reports|Retail|Advanced Clients|Assistant|unlimited/i);
    expect(starterText).toContain('Up to 4');
  });

  it('no longer presents a single £39 plan as the only option', () => {
    expect(page).not.toMatch(/One plan for one barbershop location|ONE PLAN|One plan\. One barbershop location|Everything in the £/);
    expect(page).toContain('TWO PLANS');
    expect(page).toContain('href="/starter"');
    expect(page).toMatch(/href="\/admin"[\s\S]*?data-track="starter_signup_click"[\s\S]*?Start KERSIVO Starter/);
    expect(text).not.toMatch(/\b1%|application fee|platform fee|Free Booking/i);
  });

  it('never makes banned pricing claims', () => {
    expect(text).not.toMatch(
      /forever|unlimited sms|bespoke|no fees whatsoever|guarantee|complete migration|full revenue|revenue tracking|£\d+ per (month|year) sms|\d+ (sms|messages)/i,
    );
  });

  it('links to the demo, the checkout and the comparison pages without fake urgency', () => {
    expect(page).toContain('See KERSIVO in action');
    expect(page).toContain('href="/demo"');
    expect(page).toContain('<RateCard1Offer />');
    expect(page).toContain('href="/admin/launch"');
    expect(page).toContain('href="/booksy-alternative"');
    expect(page).toContain('href="/fresha-alternative"');
    expect(page).not.toMatch(/limited time|only \d+ (spots|places)|hurry|join \d+/i);
  });

  it('builds visible FAQ and FAQPage schema from the same data', () => {
    expect(page).toContain('faqs={PRICING_FAQ_ITEMS}');
    const faq = buildPricingFaqJsonLd();
    const entities = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(faq['@type']).toBe('FAQPage');
    expect(faq['@id']).toBe(`${SITE}/pricing#faq`);
    expect(entities.map((entity) => entity.name)).toEqual(PRICING_FAQ_ITEMS.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(
      PRICING_FAQ_ITEMS.map((item) => item.answer),
    );
  });

  it('emits WebPage schema published by the Organization', () => {
    expect(buildPricingWebPageJsonLd()).toMatchObject({
      '@type': 'WebPage',
      url: `${SITE}/pricing`,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
    });
  });
});

describe('claim consistency', () => {
  it('never says Unlimited SMS in marketing copy or Terms', () => {
    const sources = [
      'src/pages/terms.astro',
      'src/pages/index.astro',
      'src/pages/about.astro',
      'src/pages/pricing.astro',
      'src/lib/pricing/claimsPolicy.ts',
      'src/lib/pricing/rateCard1Copy.ts',
      'src/lib/seo/barbershopBookingFaq.ts',
      'src/lib/seo/aboutPage.ts',
      'src/lib/seo/pricingPage.ts',
      'src/lib/seo/booksyAlternativeContent.ts',
      'src/lib/seo/booksyAlternativeFaq.ts',
      'src/lib/seo/freshaAlternativeContent.ts',
      'src/lib/seo/freshaAlternativeFaq.ts',
    ];
    for (const source of sources) {
      expect(read(source), source).not.toMatch(/unlimited (automated )?sms/i);
    }
    expect(SMS_MONTHLY_ALLOWANCE_TERMS).toContain('subject to a monthly allowance');
    expect(SMS_MONTHLY_ALLOWANCE_TERMS).not.toMatch(/£\d|\d+ (messages|sms)/i);
  });

  it('does not call service-booking value revenue on the homepage reports row', () => {
    const copy = Object.values(FEATURE261_MONETIZATION_ROW).join(' ');
    expect(FEATURE261_MONETIZATION_ROW.kicker).toBe('FULL KERSIVO — REPORTS & PERFORMANCE');
    expect(FEATURE261_MONETIZATION_ROW.description).toBe(
      'Track booked and completed service value, deposits, booking trends and shop performance.',
    );
    expect(copy).not.toMatch(/revenue|total sales|confirmed income/i);
  });

  it('labels the homepage reports widget metric as completed value, not sales', () => {
    expect(read('src/components/LandingBookingsReportsWidget.tsx')).toContain('useServiceValueLabels');
    const studio = read('src/components/admin/BookingsReportsAnalyticsStudio.tsx');
    expect(studio).toMatch(/isBlacklineDemo \|\| useServiceValueLabels/);
  });
});

describe('barberdemo subdomain redirect', () => {
  it('permanently redirects only the barberdemo host to /demo', () => {
    type Redirect = {
      source: string;
      destination: string;
      statusCode?: number;
      permanent?: boolean;
      has?: Array<{ type: string; value: string }>;
    };
    const { redirects } = JSON.parse(read('vercel.json')) as { redirects: Redirect[] };
    const barberdemo = redirects.filter((rule) =>
      rule.has?.some((condition) => condition.type === 'host' && condition.value === 'barberdemo.kersivo.co.uk'),
    );
    expect(barberdemo.map((rule) => rule.source)).toEqual(['/', '/:path*']);
    for (const rule of barberdemo) {
      expect(rule.destination).toBe('https://kersivo.co.uk/demo');
      expect(rule.permanent).toBe(true);
      expect(rule).not.toHaveProperty('statusCode');
    }
    const unscopedToDemo = redirects.filter((rule) => rule.destination.endsWith('/demo') && !rule.has);
    expect(unscopedToDemo).toEqual([]);
  });
});

describe('internal links, routes and comparison FAQ schema', () => {
  it('links the homepage footer to /pricing and /about', () => {
    const homepage = read('src/pages/index.astro');
    expect(homepage).toContain("{ name: 'Pricing', href: '/pricing' }");
    expect(homepage).toContain("{ name: 'About', href: '/about' }");
  });

  it('points every global Pricing nav link at /pricing', () => {
    const pricingDirect = MARKETING_NAV_DIRECT_LINKS.find((link) => link.id === 'pricing');
    expect(pricingDirect).toEqual({ id: 'pricing', label: 'Pricing', href: '/pricing' });
    expect(MARKETING_NAV_ITEMS.filter((item) => item.label === 'Pricing' || item.href.includes('pricing'))).toEqual([]);
    expect(JSON.stringify([MARKETING_NAV_DIRECT_LINKS, MARKETING_NAV_ITEMS])).not.toContain('/#pricing');
  });

  it('links Pricing to /pricing and About to /about in every marketing footer', () => {
    for (const page of [
      'src/pages/index.astro',
      'src/pages/booksy-alternative/index.astro',
      'src/pages/fresha-alternative/index.astro',
      'src/pages/barber-software-cost-calculator/index.astro',
    ]) {
      const source = read(page);
      expect(source, page).toContain("{ name: 'Pricing', href: '/pricing' }");
      expect(source, page).toContain("{ name: 'About', href: '/about' }");
    }
    expect(read('src/pages/about.astro')).toContain("{ name: 'Pricing', href: '/pricing' }");
    expect(read('src/pages/pricing.astro')).toContain("{ name: 'About', href: '/about' }");
  });

  it('lets the assistant name the SMS allowance without its size', () => {
    const knowledge = read('src/lib/admin/ai/knowledge.ts');
    expect(knowledge).toContain('SMS_INCLUDED_WITH_ALLOWANCE_CLAIM');
    expect(knowledge).not.toContain('or any SMS allowance amount');
    expect(knowledge).not.toMatch(/£10\b/);
  });

  it('treats /about and /pricing as marketing routes', () => {
    expect(getRouteFamily('/about')).toBe('marketing');
    expect(getRouteFamily('/pricing')).toBe('marketing');
  });

  it('keeps Booksy and Fresha FAQPage schema mirroring their visible FAQs', () => {
    for (const [build, items] of [
      [buildBooksyAlternativeFaqJsonLd, BOOKSY_ALTERNATIVE_FAQ_ITEMS],
      [buildFreshaAlternativeFaqJsonLd, FRESHA_ALTERNATIVE_FAQ_ITEMS],
    ] as const) {
      const faq = build();
      const entities = faq.mainEntity as Array<{ name: string }>;
      expect(faq['@type']).toBe('FAQPage');
      expect(entities.map((entity) => entity.name)).toEqual(items.map((item) => item.question));
    }
  });
});
