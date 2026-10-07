import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TITLE } from './defaults';
import {
  STARTER_FAQ_ITEMS,
  STARTER_PAGE_DESCRIPTION,
  STARTER_PAGE_H1,
  STARTER_PAGE_PATH,
  STARTER_PAGE_TITLE,
  buildStarterFaqJsonLd,
  buildStarterWebPageJsonLd,
} from './starterPage';

describe('KERSIVO Starter landing SEO', () => {
  it('uses a product-led canonical target instead of cloning the homepage keyword target', () => {
    expect(STARTER_PAGE_PATH).toBe('/starter');
    expect(STARTER_PAGE_TITLE).toContain('KERSIVO Starter');
    expect(STARTER_PAGE_TITLE).toContain('£0/Month');
    expect(STARTER_PAGE_H1).toBe('A free booking system for UK barbershops — £0/month.');
    expect(STARTER_PAGE_TITLE).not.toBe(DEFAULT_TITLE);
    expect(STARTER_PAGE_H1.toLowerCase()).not.toBe('barber booking system');
  });

  it('keeps £0 and 0% claims precise and separates Stripe processing fees', () => {
    expect(STARTER_PAGE_DESCRIPTION).toContain('£0/month');
    expect(STARTER_PAGE_DESCRIPTION).toContain('0% KERSIVO commission');

    const answers = STARTER_FAQ_ITEMS.map((item) => item.answer).join(' ');
    expect(answers).toContain('Standard Stripe processing fees');
    expect(answers).not.toMatch(/KERSIVO (?:application|platform) fee of [1-9]/i);
  });

  it('builds WebPage and FAQ schema from visible page copy', () => {
    const webpage = buildStarterWebPageJsonLd();
    const faq = buildStarterFaqJsonLd();

    expect(webpage).toMatchObject({
      '@type': 'WebPage',
      url: 'https://kersivo.co.uk/starter',
      name: STARTER_PAGE_TITLE,
      description: STARTER_PAGE_DESCRIPTION,
      inLanguage: 'en-GB',
    });
    expect(faq).toMatchObject({
      '@type': 'FAQPage',
    });
    expect((faq.mainEntity as unknown[]).length).toBe(STARTER_FAQ_ITEMS.length);
  });

  it('keeps the visible page product-led and avoids keyword-stuffing the weak free-search phrase', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(join(here, '../../pages/starter/index.astro'), 'utf8');

    expect(page).toContain('£0/month');
    expect(page).toContain('0% KERSIVO commission');
    expect(page).toContain('Start KERSIVO Starter');
    expect(page).toContain('Google booking setup');
    expect(page).toContain('QR Kit');
    const pageAndFaq = `${page} ${STARTER_FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`).join(' ')}`;
    expect(page.toLowerCase()).not.toContain('free barber booking system');
    expect(page).not.toContain('1%');
    expect(pageAndFaq).toContain('£5 deposit');
    expect(pageAndFaq).toContain('Pay in full');
    expect(pageAndFaq).toContain('connected Stripe');
    expect(pageAndFaq).not.toMatch(/Stripe is optional|no Stripe account needed|Pay at shop without connecting Stripe/i);
  });
});

describe('KERSIVO Starter landing page structure and claims', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (path: string) => readFileSync(join(here, '../..', path), 'utf8');
  const page = read('pages/starter/index.astro');
  const faqText = STARTER_FAQ_ITEMS.flatMap((item) => [item.question, item.answer]).join(' ');
  const allCopy = `${page} ${faqText} ${STARTER_PAGE_TITLE} ${STARTER_PAGE_DESCRIPTION}`;

  it('is canonical, indexable and has a sensible title/meta length', () => {
    expect(page).toContain('canonicalPath={STARTER_PAGE_PATH}');
    expect(page).not.toMatch(/noindex/);
    expect(STARTER_PAGE_TITLE.length).toBeLessThanOrEqual(60);
    expect(STARTER_PAGE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(STARTER_PAGE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(STARTER_PAGE_TITLE).not.toBe('Barbershop Software & Barber Booking System UK | KERSIVO');
  });

  it('renders exactly one H1 and the page sections as H2s', () => {
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect((page.match(/<h2\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('distinguishes the 0% KERSIVO fee from Stripe processing fees', () => {
    expect(page).toContain('Standard Stripe processing fees');
    expect(allCopy).not.toMatch(/0% (payment[- ])?processing|no processing fees|no stripe fees/i);
    expect(allCopy).not.toMatch(/\b1%|[1-9]\d*(?:\.\d+)?% KERSIVO (?:application|platform) fee/i);
  });

  it('uses the KERSIVO Starter name, not the old Free Booking naming', () => {
    expect(allCopy).not.toMatch(/Free Booking/);
    expect((allCopy.match(/free barber booking/gi) ?? []).length).toBe(0);
  });

  it('states the 4-barber limit and never offers unlimited barbers on Starter', () => {
    expect(page).toContain('Up to 4');
    expect(faqText).toContain('up to 4 active bookable barbers');
    expect(allCopy).not.toMatch(/unlimited barbers/i);
  });

  it('keeps Full-only features out of the Starter feature list and plan card', () => {
    const starterCard = page.slice(
      page.indexOf('starter-plan-card--active'),
      page.indexOf('FULL KERSIVO</p>'),
    );
    const features = page.slice(page.indexOf('const starterFeatures'), page.indexOf('const fullOnly'));
    for (const block of [starterCard, features]) {
      expect(block).not.toMatch(/own domain|branded website|SMS|Reports|Retail|Advanced Clients|live (KERSIVO )?Assistant/i);
    }
    const fullOnly = page.slice(page.indexOf('const fullOnly'), page.indexOf('---', page.indexOf('const fullOnly')));
    for (const item of ['domain', 'More than 4', 'Full booking history', 'Advanced Clients', 'Reports', 'Retail', 'SMS', 'Assistant']) {
      expect(fullOnly).toContain(item);
    }
  });

  it('builds FAQPage JSON-LD from the same items the page renders', () => {
    expect(page).toContain('faqs={STARTER_FAQ_ITEMS}');
    const faq = buildStarterFaqJsonLd() as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(STARTER_FAQ_ITEMS.map((item) => item.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(
      STARTER_FAQ_ITEMS.map((item) => item.answer),
    );
    for (const topic of ['£0', 'commission', 'Stripe', 'barbers', 'domain', 'QR Kit', 'Google', 'app', 'upgrade']) {
      expect(faqText, topic).toContain(topic);
    }
  });

  it('sends Starter CTAs to the existing /admin signup, never to Stripe or the Full checkout', () => {
    const starterCtas = [...page.matchAll(/<a[^>]*data-track="starter_signup_click"[^>]*>/g)].map((m) => m[0]);
    expect(starterCtas.length).toBeGreaterThanOrEqual(3);
    for (const cta of starterCtas) {
      expect(cta).toContain('href="/admin"');
      expect(cta).toMatch(/data-track-placement="starter_[a-z]+"/);
    }
    expect(page).not.toContain('/admin/launch');
    expect(page).not.toMatch(/checkout\.stripe\.com|buy\.stripe\.com/);
    expect(page).not.toContain('saas_subscribe_click');
  });

  it('keeps Google and QR Kit wording accurate', () => {
    expect(allCopy).toContain('Google controls');
    expect(allCopy).not.toMatch(/guarantee(s|d)? (a |the )?(Google )?Book button|Google partner|Reserve with Google/i);
    expect(allCopy).toContain('eligible verified UK');
    expect(allCopy).toMatch(/verified before (the kit goes to )?print|verifies the shop details before the kit goes to print/);
    expect(allCopy).not.toMatch(/tested materials|material testing (is )?complete|dispatched within|delivered within|free replacements/i);
  });

  it('makes no fake urgency, testimonial or adoption claims', () => {
    expect(allCopy).not.toMatch(/limited[- ]time|hurry|only \d+ (spots|places)|join \d+|\d+\+? (shops|barbershops|barbers) (use|trust)|testimonial/i);
  });

  it('is linked from the homepage and pricing page and links back to pricing', () => {
    expect(read('pages/index.astro')).toContain("{ name: 'Starter', href: '/starter' }");
    expect(read('pages/pricing.astro')).toContain('href="/starter"');
    expect(page).toContain('href="/pricing"');
  });
});
