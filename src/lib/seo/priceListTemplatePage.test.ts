import { describe, expect, it } from 'vitest';
import {
  PRICE_LIST_ANATOMY,
  PRICE_LIST_DESCRIPTION,
  PRICE_LIST_FAQ_ITEMS,
  PRICE_LIST_PAGE_PATH,
  PRICE_LIST_PLACEMENTS,
  PRICE_LIST_STEPS,
  PRICE_LIST_TITLE,
  buildPriceListJsonLd,
} from './priceListTemplatePage';

const byType = (type: string) => buildPriceListJsonLd().find((block) => block['@type'] === type) as Record<string, any>;

describe('/barbershop-price-list-template SEO', () => {
  it('keeps the title and description within search result lengths', () => {
    expect(PRICE_LIST_TITLE.length).toBeLessThanOrEqual(62);
    expect(PRICE_LIST_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(PRICE_LIST_TITLE).toMatch(/^Free Barber Price List Template/);
  });

  it('publishes WebPage, WebApplication, HowTo, BreadcrumbList and FAQPage', () => {
    const types = buildPriceListJsonLd().map((block) => block['@type']);
    expect(types).toEqual(['WebPage', 'WebApplication', 'HowTo', 'BreadcrumbList', 'FAQPage']);
  });

  it('marks the tool free and links the parts to the page', () => {
    const app = byType('WebApplication');
    expect(app.isAccessibleForFree).toBe(true);
    expect(app.offers).toMatchObject({ price: '0', priceCurrency: 'GBP' });
    const page = byType('WebPage');
    expect(page.url.endsWith(PRICE_LIST_PAGE_PATH)).toBe(true);
    expect(page.mainEntity['@id']).toBe(app['@id']);
  });

  it('HowTo steps match the tool steps and their anchors', () => {
    const steps = byType('HowTo').step as { name: string; url: string; position: number }[];
    expect(steps.map((step) => step.name)).toEqual(PRICE_LIST_STEPS.map((step) => step.name));
    steps.forEach((step, i) => {
      expect(step.position).toBe(i + 1);
      expect(step.url.endsWith(`#step-${PRICE_LIST_STEPS[i].id}`)).toBe(true);
    });
  });

  it('FAQPage mirrors the visible FAQ', () => {
    const faq = byType('FAQPage').mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(faq.map((q) => q.name)).toEqual(PRICE_LIST_FAQ_ITEMS.map((q) => q.question));
    expect(faq.map((q) => q.acceptedAnswer.text)).toEqual(PRICE_LIST_FAQ_ITEMS.map((q) => q.answer));
  });

  it('never puts a price figure in the guidance copy', () => {
    const copy = [...PRICE_LIST_ANATOMY.map((part) => part.text), ...PRICE_LIST_PLACEMENTS.map((place) => place.text)].join(' ');
    expect(copy).not.toMatch(/£\s?\d/);
  });

  it('the website placement links to Full KERSIVO pricing', () => {
    const website = PRICE_LIST_PLACEMENTS.find((place) => place.id === 'website');
    expect(website?.action).toMatchObject({ kind: 'link', href: '/pricing#plan' });
  });
});
