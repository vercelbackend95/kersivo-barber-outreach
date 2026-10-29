import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHAIR_RENT_CALCULATOR_DESCRIPTION,
  CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO,
  CHAIR_RENT_CALCULATOR_OG_IMAGE,
  CHAIR_RENT_CALCULATOR_PAGE_PATH,
  CHAIR_RENT_CALCULATOR_TITLE,
  CHAIR_RENT_CTA,
  STATUS_SECTION,
} from './chairRentCalculatorPage';
import { CHAIR_RENT_FAQ_ITEMS } from './chairRentCalculatorFaq';
import { buildChairRentCalculatorJsonLd } from './chairRentCalculatorJsonLd';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_CONTENT_PATHS } from '@/lib/navigation/routeFamilies';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('/chair-rent-vs-commission-calculator SEO', () => {
  it('keeps the title and description within length limits', () => {
    expect(CHAIR_RENT_CALCULATOR_TITLE).toBe('Chair Rent vs Commission Calculator for UK Barbers');
    expect(CHAIR_RENT_CALCULATOR_TITLE.length).toBeLessThanOrEqual(60);
    expect(CHAIR_RENT_CALCULATOR_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  it('uses a canonical path without a trailing slash and a self-hosted 1200×630 OG image', () => {
    expect(CHAIR_RENT_CALCULATOR_PAGE_PATH).toBe('/chair-rent-vs-commission-calculator');
    const png = readFileSync(join(root, 'public', CHAIR_RENT_CALCULATOR_OG_IMAGE));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('builds the WebPage, WebApplication, BreadcrumbList and FAQPage graph', () => {
    const graph = buildChairRentCalculatorJsonLd();
    expect(graph.map((node) => node['@type'])).toEqual(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']);
    const [page, app, breadcrumb, faq] = graph as Array<Record<string, any>>;
    expect(page['@id']).toMatch(/\/chair-rent-vs-commission-calculator#webpage$/);
    expect(page.inLanguage).toBe('en-GB');
    expect(page.dateModified).toBe(CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO);
    expect(page.isPartOf['@id']).toMatch(/#website$/);
    expect(page.publisher['@id']).toMatch(/#organization$/);
    expect(app).toMatchObject({
      name: 'Chair Rent vs Commission Calculator',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    });
    expect(app.provider['@id']).toMatch(/#organization$/);
    expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual(['Home', 'Chair Rent vs Commission Calculator']);
    expect(faq.mainEntity).toHaveLength(CHAIR_RENT_FAQ_ITEMS.length);
    faq.mainEntity.forEach((question: any, index: number) => {
      expect(question.name).toBe(CHAIR_RENT_FAQ_ITEMS[index].question);
      expect(question.acceptedAnswer.text).toBe(CHAIR_RENT_FAQ_ITEMS[index].answer);
    });
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|review/i);
  });

  it('is in the sitemap with its visible date and uses the marketing layout family', () => {
    const entry = buildMarketingSitemapEntries().find((item) => item.loc.endsWith(CHAIR_RENT_CALCULATOR_PAGE_PATH));
    expect(entry?.lastmod).toBe(CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO);
    expect(MARKETING_CONTENT_PATHS).toContain(CHAIR_RENT_CALCULATOR_PAGE_PATH);
  });
});

describe('/chair-rent-vs-commission-calculator copy rules', () => {
  it('pairs 0% KERSIVO commission with "Stripe fees apply" and keeps Starter secondary', () => {
    expect(CHAIR_RENT_CTA.body).toContain('0% KERSIVO commission; Stripe fees apply.');
    expect(CHAIR_RENT_CTA.body).toContain('£39/month per location');
    expect(CHAIR_RENT_CTA.heading).toBe('Bookings for every chair in your shop');
  });

  it('makes no claim that renters can take payments into their own accounts', () => {
    expect(`${CHAIR_RENT_CTA.heading} ${CHAIR_RENT_CTA.body}`).not.toMatch(/renter|self-employed|own stripe/i);
  });

  it('links the official GOV.UK employment status check and states no legal conclusion', () => {
    expect(STATUS_SECTION.cestHref).toBe('https://www.gov.uk/guidance/check-employment-status-for-tax');
    expect(JSON.stringify(STATUS_SECTION)).not.toMatch(/\b(lawful|unlawful|illegal|legal)\b/i);
  });
});
