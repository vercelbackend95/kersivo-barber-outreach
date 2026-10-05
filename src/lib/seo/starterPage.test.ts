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
    expect(STARTER_PAGE_H1).toBe('Start taking bookings with KERSIVO Starter.');
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
    expect(page.toLowerCase()).not.toContain('free barber booking system');
    expect(page).not.toContain('1%');
  });
});
