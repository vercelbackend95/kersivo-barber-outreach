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
import {
  getNavbar17CtaHref,
  getNavbar17CtaLabel,
  getNavbar17Items,
  navbar17ShowsCart,
  NAVBAR_SUBSCRIBE_CTA_LABEL,
} from '@/lib/nav/navbar17Items';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';

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
const rateCard1Source = readRepoFile('../../components/rateCard1.tsx');
const navbarItemsSource = readRepoFile('../nav/navbar17Items.ts');
const navbar17Source = readRepoFile('../../components/navbar17.astro');
const finalCtaSource = readRepoFile('../../components/booksyAlternative/BooksyFinalCta.astro');
const approachesSource = readRepoFile('../../components/booksyAlternative/BooksyApproaches.astro');
const fitSource = readRepoFile('../../components/booksyAlternative/BooksyFit.astro');
const decisionSource = readRepoFile('../../components/booksyAlternative/BooksyDecision.astro');
const journeySource = readRepoFile('../../components/booksyAlternative/BooksyJourney.astro');
const proofSource = readRepoFile('../../components/booksyAlternative/BooksyProof.astro');
const landingDemoPreviewSource = readRepoFile('../../components/landingDemoPreview.astro');
const factsSource = readRepoFile('booksyFacts.ts');

const bannedPhrases = [
  'Booksy owns your clients',
  'Booksy takes your clients',
  'Booksy controls your clients',
  '£39 forever',
  'Unlimited SMS',
  'complete migration guaranteed',
  'guaranteed more bookings',
  'guaranteed no-show reduction',
  'powerful booking and management platform',
  'You prefer a mature platform',
  'KERSIVO is objectively better',
] as const;

describe('booksy-alternative page SEO and claim safety', () => {
  it('wires LandingLayout with exact title, description, canonical and booksyAlternative navbar', () => {
    expect(pageSource).toContain('LandingLayout');
    expect(pageSource).toContain('title={BOOKSY_ALTERNATIVE_TITLE}');
    expect(pageSource).toContain('description={BOOKSY_ALTERNATIVE_DESCRIPTION}');
    expect(pageSource).toContain('canonicalPath={BOOKSY_ALTERNATIVE_PAGE_PATH}');
    expect(pageSource).toContain('navbarVariant="booksyAlternative"');
    expect(pageSource).not.toContain('navbarVariant="shop"');
    expect(pageSource).not.toContain('showCart={false}');
    expect(pageSource).not.toContain('noindex');
    expect(BOOKSY_ALTERNATIVE_TITLE).toBe('Booksy Alternative for UK Barbers | KERSIVO');
    expect(BOOKSY_ALTERNATIVE_DESCRIPTION).toBe(
      'Looking for a Booksy alternative for your barbershop? Compare KERSIVO and Booksy across branding, pricing, bookings, marketplace discovery and client experience.',
    );
    expect(BOOKSY_ALTERNATIVE_PAGE_PATH).toBe('/booksy-alternative');

    const booksyNav = getNavbar17Items('booksyAlternative');
    expect(booksyNav.map((item) => item.link)).toEqual(['#pricing', '#faq', '#contact']);
    expect(booksyNav.some((item) => item.link === '/#pricing')).toBe(false);
    expect(booksyNav.some((item) => item.link === '/#faq')).toBe(false);
    expect(booksyNav.some((item) => item.link === '/#contact')).toBe(false);
    expect(booksyNav.find((item) => item.name === 'Contact')?.link).toBe('#contact');
    expect(navbar17ShowsCart('booksyAlternative')).toBe(false);
    expect(getNavbar17CtaHref('booksyAlternative')).toBe('/admin/launch');
    expect(getNavbar17CtaLabel('booksyAlternative')).toBe(NAVBAR_SUBSCRIBE_CTA_LABEL);
    expect(navbar17ShowsCart('shop')).toBe(true);
    expect(getNavbar17Items('shop').map((item) => item.link)).toEqual([
      '/#pricing',
      '/#faq',
      '/#contact',
    ]);
    expect(navbarItemsSource).toContain("'booksyAlternative'");
  });

  it('has exactly one H1 with the approved text', () => {
    expect(heroSource).toContain('BOOKSY_ALTERNATIVE_H1');
    expect(BOOKSY_ALTERNATIVE_H1).toBe('A Booksy Alternative Built Around Your Barbershop');
    expect(heroSource.match(/<h1\b/g)?.length).toBe(1);
    expect(pageSource).not.toMatch(/<h1\b/);
  });

  it('reuses Contact16 after Final CTA with local contact anchors', () => {
    expect(pageSource.match(/<Contact16\b/g)?.length).toBe(1);
    expect(pageSource).toContain('import Contact16 from');
    expect(pageSource.indexOf('<BooksyFinalCta')).toBeLessThan(pageSource.indexOf('<Contact16'));
    expect(pageSource.indexOf('<Contact16')).toBeLessThan(
      pageSource.indexOf('booksy-alt-disclaimer'),
    );
    expect(pageSource.indexOf('<Contact16')).toBeLessThan(pageSource.indexOf('<Footer50'));
    expect(pageSource).toContain('title="Still comparing KERSIVO and Booksy?"');
    expect(pageSource).toContain(
      'description="Tell us what you use today and what you want to change. We’ll reply with a clear, practical answer for your barbershop."',
    );
    expect(pageSource).toContain('note="We’ll reply by email — no sales call required."');
    expect(pageSource).toContain('submitLabel="Send my question"');
    expect(pageSource).toContain('eyebrow="CONTACT KERSIVO"');
    expect(pageSource).toContain('supportLinkLabel="Ask KERSIVO a question"');
    expect(pageSource).toContain('supportLinkHref="#contact"');
    expect(pageSource).toContain("{ name: 'Contact', href: '#contact' }");
    expect(pageSource).not.toMatch(/id=["']contact["']/);
    for (const moduleSource of [
      heroSource,
      compareSource,
      pricingSource,
      finalCtaSource,
      approachesSource,
      fitSource,
      decisionSource,
      journeySource,
      proofSource,
    ]) {
      expect(moduleSource).not.toContain('data-contact-form');
      expect(moduleSource).not.toContain('/api/contact');
    }
    expect(homepageSource).toContain('<Contact16');
    expect(homepageSource).toContain('title="Have a question before you subscribe?"');
    expect(homepageSource).toContain(
      'description="Tell us what you use today and what you want to improve. We’ll reply with a clear, practical answer for your barbershop."',
    );
  });

  it('links to homepage, demo and real pricing destination', () => {
    expect(pageSource).toContain('href: \'/\'');
    expect(pageSource).toContain('supportLinkHref="#contact"');
    expect(pageSource).toContain("{ name: 'Start subscription', href: '/admin/launch' }");
    expect(heroSource).toContain('href="/demo"');
    expect(heroSource).toContain('href="#comparison"');
    expect(finalCtaSource).toContain('href="/demo"');
    expect(finalCtaSource).toMatch(
      /href="#pricing"\s+class="btn btn--secondary[^"]*"\s+data-track="view_pricing_click"/,
    );
    expect(finalCtaSource).toContain('View the £{SAAS_MONTHLY_GBP} Plan');
    expect(finalCtaSource).not.toContain('href="/admin/launch"');
    expect(finalCtaSource).not.toContain('saas_subscribe_click');
    expect(rateCard1Source).toContain('href="/admin/launch"');
    expect(rateCard1Source).toContain('data-track="saas_subscribe_click"');
    expect(getNavbar17CtaHref('booksyAlternative')).toBe('/admin/launch');
    expect(navbar17Source).toContain("const isBooksyAlternative = variant === 'booksyAlternative'");
    expect(navbar17Source).toMatch(
      /isBooksyAlternative\s*\n\s*\? '\/'\s*\n\s*: '\/#home'/,
    );
    expect(navbar17Source).toContain("? '/'");
    expect(compareSource).toContain('id="comparison"');
    expect(pageSource).toContain('<Faq4');
    expect(pricingSource.match(/id="pricing"/g)?.length).toBe(1);
  });

  it('pricing section reuses the shared landing offer card', () => {
    expect(pricingSource).toContain('SIMPLE PRICING');
    expect(pricingSource).toContain('One plan. One barbershop location.');
    expect(pricingSource).toContain('id="pricing"');
    expect(pricingSource).toContain('RateCard1Offer');
    expect(pricingSource).toContain('rate-card1--landing');
    expect(pricingSource).toContain('booksy-alt-pricing__offer-host');
    expect(pricingSource).toContain('getRateCard1LandingLayout');
    expect(pricingSource).toContain('rate-card1__landing-conditions');
    expect(pricingSource).toContain('{layout.conditionsLine1}');
    expect(pricingSource).toContain('{layout.conditionsLine2}');
    expect(pricingSource).not.toContain('View the Plan');
    expect(pricingSource).not.toContain('booksy-alt-pricing__price');
    expect(pricingSource).not.toContain('View the £');
    expect(pricingSource).not.toContain(`£{SAAS_MONTHLY_GBP}/month. One barbershop location.`);
    expect(pricingSource).toContain('How that compares with Booksy');
    expect(pricingSource.match(/id="pricing"/g)?.length).toBe(1);
    expect(rateCard1Source).toContain('function RateCard1Offer');
    expect(rateCard1Source).toContain('export { RateCard1, RateCard1Offer }');
    expect(rateCard1Source).toContain('<RateCard1Offer />');
    expect(rateCard1Source).toContain('getRateCard1LandingLayout');
    expect(rateCard1Source).toContain('£{SAAS_MONTHLY_GBP}');
    expect(rateCard1Source).toContain('/ month');
    const landingLayout = getRateCard1LandingLayout();
    expect(landingLayout.ctaLabel).toBeTruthy();
    expect(landingLayout.conditionsLine1).toBe('Standard Stripe payment-processing fees apply.');
    expect(landingLayout.conditionsLine2).toContain('Billed today, then monthly');
    expect(homepageSource).toContain('<RateCard1 variant="landing" />');
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
      approachesSource,
      fitSource,
      decisionSource,
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

  it('product proof reuses live widgets without reports or the old screenshot grid', () => {
    expect(pageSource).toContain('<BooksyProof />');
    expect(pageSource).toContain('initFeature261StaggerReveal');
    expect(pageSource).toContain('initProductRails');
    expect(proofSource).toContain('LandingDemoPreview');
    expect(proofSource).toContain('BUILT AROUND YOUR BRAND');
    expect(proofSource).toContain('See the KERSIVO experience in action');
    expect(proofSource).toContain('ADMIN SYSTEM');
    expect(proofSource).toContain('CLIENT BOOKING EXPERIENCE');
    expect(proofSource).toContain('RETAIL PICKUP SHOP');
    expect(proofSource).toContain('Explore the admin system');
    expect(proofSource).toContain('Try the booking experience');
    expect(proofSource).toContain('Explore the retail shop');
    expect(proofSource).toContain("ctaHref: '/demo/shop'");
    expect(proofSource).not.toContain("ctaHref: '/shop'");
    expect(proofSource).toContain('showReports={false}');
    expect(proofSource).toContain('showMoreIncluded={false}');
    expect(proofSource).toContain("media: 'widget'");
    expect(proofSource).toContain("media: 'booking'");
    expect(proofSource).toContain("media: 'carousel'");
    expect(proofSource).not.toContain('YOUR WEBSITE');
    expect(proofSource).not.toContain('YOUR BOOKINGS');
    expect(proofSource).not.toContain('YOUR DASHBOARD');
    expect(proofSource).not.toContain('YOUR RETAIL');
    expect(proofSource).not.toContain('/images/screenshots/');
    expect(proofSource).not.toContain('Explore the Live Demo');
    expect(proofSource).not.toContain('Feature261MonetizationRow');
    expect(proofSource).not.toContain('REPORTS');
    expect(landingDemoPreviewSource).toContain("kicker: 'INSIDE THE SYSTEM'");
    expect(landingDemoPreviewSource).toContain('showReports = true');
    expect(landingDemoPreviewSource).toContain('Feature261MonetizationRow');
    expect(homepageSource).toContain('<LandingDemoPreview');
  });

  it('rebalances approaches, comparison and decision copy toward KERSIVO value', () => {
    expect(approachesSource).toContain('Your brand. Your website. Your bookings.');
    expect(approachesSource).toContain('Bookings inside the Booksy ecosystem');
    expect(approachesSource).not.toContain('powerful');
    expect(fitSource).toContain('MARKETPLACE OR YOUR OWN BRAND?');
    expect(fitSource).toContain('Where do you want the booking journey to live?');
    expect(fitSource).toContain(
      'Two booking models. One key difference: where your customer experience lives.',
    );
    expect(fitSource).toContain('booksy-alt-brand-journey__panel');
    expect(fitSource).toContain('booksy-alt-brand-journey__label');
    expect(fitSource).toMatch(/>\s*BOOKSY\s*</);
    expect(fitSource).toMatch(/>\s*KERSIVO\s*</);
    expect(fitSource).toContain('Booksy includes marketplace discovery as part of its ecosystem.');
    expect(fitSource).toContain(
      'Your clients find your barbershop. KERSIVO helps keep the booking journey there too.',
    );
    expect(fitSource).not.toContain('booksy-alt-brand-journey__body');
    expect(fitSource).not.toContain('WHEN BOOKSY MAKES SENSE');
    expect(decisionSource).toContain('So, which approach fits your barbershop?');
    expect(decisionSource).not.toContain('mature platform');
    expect(decisionSource).toContain('0% KERSIVO commission on bookings and retail sales');

    const additionalUsers = BOOKSY_COMPARE_ROWS.find((row) => row.title === 'Additional users');
    expect(additionalUsers?.kersivo).toBe('Included within one barbershop location');
    expect(additionalUsers?.kersivo).not.toContain('subject to fair use');

    const marketplace = BOOKSY_COMPARE_ROWS.find((row) => row.title === 'Marketplace discovery');
    expect(marketplace?.kersivo).toContain('Direct branded booking journey');
    expect(marketplace?.kersivo).not.toBe('No consumer marketplace');

    const acquisition = BOOKSY_COMPARE_ROWS.find(
      (row) => row.title === 'Optional marketplace acquisition',
    );
    expect(acquisition?.kersivo).toBe('Direct bookings with 0% KERSIVO commission');
    expect(acquisition?.kersivo).not.toBe('Not applicable');

    const reminders = BOOKSY_COMPARE_ROWS.find((row) => row.title === 'Appointment reminders');
    expect(reminders?.kersivo).toBe('Automated email and SMS appointment reminders included');

    expect(BOOKSY_ALTERNATIVE_FAQ_ITEMS).toHaveLength(8);
    expect(BOOKSY_ALTERNATIVE_FAQ_ITEMS.some((item) => item.question === 'Does KERSIVO charge commission?')).toBe(
      true,
    );
    expect(
      BOOKSY_ALTERNATIVE_FAQ_ITEMS.some(
        (item) => item.question === 'Does KERSIVO charge more for additional barbers?',
      ),
    ).toBe(true);
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
