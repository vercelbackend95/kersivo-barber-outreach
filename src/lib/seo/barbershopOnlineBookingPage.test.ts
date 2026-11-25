import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { getKersivoOrganizationId, getKersivoWebsiteId } from './kersivoEntityJsonLd';
import { getKersivoSoftwareId } from './barberDemoJsonLd';
import {
  BARBERSHOP_ONLINE_BOOKING_DEMO_HREF,
  BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF,
  BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO,
  BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION,
  BARBERSHOP_ONLINE_BOOKING_PAGE_H1,
  BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE,
  BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
  BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE,
  BARBERSHOP_ONLINE_BOOKING_TOPICS,
  buildBarbershopOnlineBookingJsonLd,
} from './barbershopOnlineBookingPage';
import { ONLINE_BOOKING_FAQ_ITEMS, buildOnlineBookingFaqJsonLd } from './barbershopBookingFaq';
import * as content from './barbershopOnlineBookingContent';
import { getStaticPageLastModified } from './pageDates';
import { HERITAGE_DEMO_BOOK_HREF } from '@/lib/demo/heritage/links';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');
const page = read('pages/barbershop-online-booking/index.astro');
const componentDir = 'components/barbershop-online-booking';
const components: Record<string, string> = Object.fromEntries(
  readdirSync(join(srcDir, componentDir)).map((file) => [file, read(`${componentDir}/${file}`)]),
);
const hero = components['BobHero.astro'] ?? '';
const reach = components['BobReach.astro'] ?? '';
const tools = components['BobTools.astro'] ?? '';
const allMarkup = [page, ...Object.values(components)].join('\n');
const css = read('styles/components/barbershop-online-booking.css');
const experience = read('lib/barbershopOnlineBooking/experience.ts');
const bookingTimes = read('lib/barbershopOnlineBooking/bookingTimes.ts');

/** Every visible string in the guide's copy module and FAQ, flattened. */
const copyStrings = (() => {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(content);
  walk(ONLINE_BOOKING_FAQ_ITEMS);
  return out;
})();
const copy = copyStrings.join('\n');

describe('/barbershop-online-booking metadata and indexing', () => {
  it('keeps the route, a price-led UK title, a description under 160 characters and the canonical URL', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH).toBe('/barbershop-online-booking');
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE).toBe('Barbershop Online Booking UK: £39/mo, 0% Commission');
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE.length).toBeLessThanOrEqual(60);
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION).toContain('£39/month per location');
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION).toMatch(/0% KERSIVO commission\. Stripe fees apply\.$/);
    expect(resolveCanonicalUrl(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)).toBe('https://kersivo.co.uk/barbershop-online-booking');
    expect(page).toContain('canonicalPath={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
    expect(page).toContain('title={BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE}');
    expect(page).toContain('description={BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION}');
  });

  it('is indexable, followed and in the sitemap with the guide’s own content date', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(true);
    expect(page).toContain('noindex={!BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: false, robotsFollow: true })).toBeUndefined();
    const entry = buildMarketingSitemapEntries().find((item) => item.loc === 'https://kersivo.co.uk/barbershop-online-booking');
    expect(entry).toBeDefined();
    expect(getStaticPageLastModified(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)).toBe(BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO);
    expect(BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_ONLINE_BOOKING_PAGE_PATH)).toBe('marketing');
  });
});

describe('/barbershop-online-booking structure', () => {
  it('renders exactly one H1, built from the two approved title lines', () => {
    expect(allMarkup.match(/<h1\b/g)).toHaveLength(1);
    expect(hero).toContain('<h1 id="bob-hero-title" class="bob-hero__title">');
    expect(content.BOB_HERO.titleLines.join(' ')).toBe(BARBERSHOP_ONLINE_BOOKING_PAGE_H1);
  });

  it('orders hero, glance and steps, tools, reach, checklist, setup, plans, FAQ and close', () => {
    const order = [
      '<BobHero />',
      '<BobGuide />',
      '<BobTools />',
      '<BobReach />',
      'id={BOB_CHECKLIST.id}',
      'id={BOB_SETUP.id}',
      'id={plans.sectionId}',
      'id="faq"',
      'bob-section bob-close',
    ].map((marker) => page.indexOf(marker));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('labels every section by its heading and links each at-a-glance answer to a section on the page', () => {
    expect((allMarkup.match(/<section\b[^>]*aria-labelledby=/g) ?? []).length).toBeGreaterThanOrEqual(12);
    const sectionIds = new Set<string>([
      content.BOB_GLANCE.id,
      content.BOB_STEPS_SECTION.id,
      content.BOB_AVAILABILITY.id,
      content.BOB_PAYMENTS.id,
      content.BOB_CHANNELS_SECTION.id,
      content.BOB_AFTER.id,
      content.BOB_CHECKLIST.id,
      content.BOB_SETUP.id,
      'booking-options',
      'faq',
    ]);
    for (const row of content.BOB_GLANCE.rows) {
      expect(sectionIds.has(row.href.replace(/^#/, '')), row.href).toBe(true);
    }
  });

  it('keeps the global footer outside a single main landmark', () => {
    expect(page.match(/<main\b/g)).toHaveLength(1);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(page.indexOf('</main>'));
  });

  it('renders the FAQ as details with h3 questions and a visible updated date', () => {
    expect(page).toContain('ONLINE_BOOKING_FAQ_ITEMS.map');
    expect(page).toContain('<summary><h3>{item.question}</h3>');
    expect(page).toContain('<time datetime={BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO}>');
  });
});

describe('/barbershop-online-booking structured data', () => {
  const siteUrl = getPublicSiteUrl();
  const jsonLd = buildBarbershopOnlineBookingJsonLd();

  it('publishes the entity graph, the WebPage, the software and the FAQ in one array', () => {
    expect(page).toMatch(
      /jsonLd=\{\[\s*buildKersivoEntityJsonLd\(\),\s*buildBarbershopOnlineBookingJsonLd\(\),\s*buildKersivoSoftwareApplicationJsonLd\(\),\s*buildOnlineBookingFaqJsonLd\(\),\s*\]\}/,
    );
  });

  it('describes the guide as a dated en-GB WebPage about the KERSIVO software, with a two-level breadcrumb', () => {
    expect(jsonLd['@type']).toBe('WebPage');
    expect(jsonLd['@id']).toBe(`${siteUrl}/barbershop-online-booking#webpage`);
    expect(jsonLd.inLanguage).toBe('en-GB');
    expect(jsonLd.headline).toBe(BARBERSHOP_ONLINE_BOOKING_PAGE_H1);
    expect(jsonLd.dateModified).toBe(BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO);
    expect(jsonLd.isPartOf).toEqual({ '@id': getKersivoWebsiteId(siteUrl) });
    expect(jsonLd.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(jsonLd.about).toEqual([
      { '@id': getKersivoSoftwareId(siteUrl) },
      ...BARBERSHOP_ONLINE_BOOKING_TOPICS.map((name) => ({ '@type': 'Thing', name })),
    ]);
    expect(jsonLd.breadcrumb).toEqual({
      '@type': 'BreadcrumbList',
      '@id': `${siteUrl}/barbershop-online-booking#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Online Booking for Barbershops', item: `${siteUrl}/barbershop-online-booking` },
      ],
    });
    expect(JSON.stringify(jsonLd)).not.toMatch(/Review|AggregateRating|"Offer"/);
  });

  it('marks up exactly the rendered FAQ questions, each once', () => {
    const faq = buildOnlineBookingFaqJsonLd() as {
      '@type': string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity.map((q) => q.name)).toEqual(ONLINE_BOOKING_FAQ_ITEMS.map((item) => item.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(ONLINE_BOOKING_FAQ_ITEMS.map((item) => item.answer));
    expect(new Set(faq.mainEntity.map((q) => q.name)).size).toBe(ONLINE_BOOKING_FAQ_ITEMS.length);
    expect(ONLINE_BOOKING_FAQ_ITEMS.length).toBeGreaterThanOrEqual(12);
    expect(ONLINE_BOOKING_FAQ_ITEMS[0]?.question).toBe('What is barbershop online booking?');
  });
});

describe('/barbershop-online-booking copy and claims', () => {
  it('keeps every "0% KERSIVO commission" sentence next to the Stripe fees note', () => {
    for (const text of copyStrings.filter((line) => /0% KERSIVO commission/.test(line) && line.length > 40)) {
      expect(text, text).toMatch(/Stripe/);
    }
    expect(content.BOB_HERO.feesNote).toBe(STRIPE_FEES_NOTE);
    expect(hero).toContain('BOB_HERO.feesNote');
  });

  it('uses "a few days" for setup and never a fixed number of days or weeks', () => {
    expect(copy).toMatch(/a few days/);
    expect(copy).not.toMatch(/\b\d+\s*(?:(?:–|-|to)\s*\d+\s*)?(?:working\s+)?(?:days?|weeks?)\b/i);
  });

  it('describes Full SMS reminders only within a monthly allowance, without a number', () => {
    for (const text of copyStrings.filter((line) => /\bSMS\b/.test(line) && /Full/.test(line))) {
      expect(text, text).toMatch(/monthly allowance/);
    }
    expect(copy).not.toMatch(/\d+\s*SMS/i);
  });

  it('keeps Full at £39/month per location first and Starter at £0', () => {
    expect(content.BOB_HERO.facts[0]).toBe('Full KERSIVO £39/month per location');
    expect(copy).toContain('£0/month');
  });

  it('invents no reviews, ratings, customer logos or founder', () => {
    expect(`${copy}\n${allMarkup}`).not.toMatch(/testimonial|★|\d(?:\.\d)? out of 5|trusted by|founder|founded by|our team/i);
  });

  it('writes British English', () => {
    expect(copy).not.toMatch(/\b(?:color|favorite|center|organize|customize|canceled|canceling)\b/i);
  });
});

describe('/barbershop-online-booking calls to action and tracking', () => {
  it('uses the free preview as the primary CTA in hero, plans and close, with a compare fallback', () => {
    expect(hero).toContain('<FullPlanCta part="primary"');
    expect(page.match(/<FullPlanCta part="primary"/g)).toHaveLength(2);
    expect(BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF).toBe('#booking-options');
  });

  it('tracks every live-demo link with view_live_demo_click and a placement of its own', () => {
    expect(BARBERSHOP_ONLINE_BOOKING_DEMO_HREF).toBe(HERITAGE_DEMO_BOOK_HREF);
    expect(hero).toContain("const TRACK_DEMO = 'view_live_demo_click';");
    expect(reach).toContain("const TRACK_EVENT = 'view_live_demo_click';");
    expect(page).toContain('data-track="view_live_demo_click"');
    const placements = [...allMarkup.matchAll(/'(barbershop_online_booking_[a-z_]+)'/g)].map((m) => m[1]);
    expect(placements).toEqual(
      expect.arrayContaining([
        'barbershop_online_booking_hero',
        'barbershop_online_booking_hero_demo',
        'barbershop_online_booking_after',
        'barbershop_online_booking_chooser',
        'barbershop_online_booking_close',
      ]),
    );
    expect(new Set(placements).size).toBe(placements.length);
  });
});

describe('/barbershop-online-booking interaction and motion', () => {
  it('binds the page once and cleans up on ClientRouter swaps', () => {
    expect(page).toContain("root.dataset.bobBound === 'true'");
    expect(page).toContain("document.addEventListener('astro:before-swap', cleanup, { once: true });");
    expect(page).toContain("document.addEventListener('astro:page-load', boot);");
  });

  it('keeps the client bundle free of demo fixtures and Prisma runtime imports', () => {
    const imports = [...experience.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)';/gm)].map((m) => ({
      typeOnly: Boolean(m[1]),
      from: m[2],
    }));
    expect(imports.length).toBeGreaterThan(0);
    for (const entry of imports) {
      if (!entry.typeOnly) expect(['@/lib/booking/bookingPaymentPolicy', './bookingTimes', './liveDiaryEvents']).toContain(entry.from);
    }
    expect(bookingTimes).not.toMatch(/^import /m);
    expect(read('lib/barbershopOnlineBooking/liveDiaryEvents.ts')).not.toMatch(/^import /m);
    expect(read('lib/booking/bookingPaymentPolicy.ts')).not.toMatch(/^import (?!type )/m);
  });

  it('turns animation off under reduced motion and offers a pause for the looping hub', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(experience).toContain('reducedMotion()');
    expect(reach).toContain('data-bob-hub-pause');
    expect(reach).toContain('aria-pressed="false"');
  });

  it('offers every start time as a real button with its state, and announces the verdict', () => {
    expect(tools).toContain('data-bob-start={m}');
    expect(tools).toContain('aria-pressed=');
    expect(tools).toContain("aria-label={`${minuteLabel(m)}, ${offered.has(m) ? 'offered' : 'not offered'}`}");
    expect(tools).toContain('aria-live="polite"');
    expect(experience).toContain("type: 'focus'");
  });

  it('shows the real KERSIVO owner timeline, not a drawn diary', () => {
    expect(hero).toContain('<BobLiveTimelineIsland');
    expect(tools).toContain('<BobLiveTimelineIsland');
    expect(components['BobLiveTimeline.tsx']).toContain("import TodayTimeline");
    expect(hero).not.toContain('bob-diary');
  });
});
