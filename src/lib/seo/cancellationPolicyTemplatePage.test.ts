import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_POLICY_CTA,
  CANCELLATION_POLICY_DESCRIPTION,
  CANCELLATION_POLICY_FAQ_ITEMS,
  CANCELLATION_POLICY_LAST_UPDATED_ISO,
  CANCELLATION_POLICY_OG_IMAGE_PATH,
  CANCELLATION_POLICY_PAGE_PATH,
  CANCELLATION_POLICY_TITLE,
  buildCancellationPolicyJsonLd,
} from './cancellationPolicyTemplatePage';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { FOOTER_COLUMNS } from '@/lib/nav/footerNavigation';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('/barbershop-cancellation-policy-template metadata', () => {
  it('uses the agreed title and description within length limits', () => {
    expect(CANCELLATION_POLICY_TITLE).toBe('Barbershop Cancellation Policy Template UK (Free Tool)');
    expect(CANCELLATION_POLICY_TITLE.length).toBeLessThanOrEqual(60);
    expect(CANCELLATION_POLICY_DESCRIPTION.length).toBeLessThanOrEqual(155);
    expect(CANCELLATION_POLICY_PAGE_PATH).toBe('/barbershop-cancellation-policy-template');
  });

  it('ships a self-hosted 1200×630 OG image', () => {
    const file = resolve(root, 'public', CANCELLATION_POLICY_OG_IMAGE_PATH.slice(1));
    expect(existsSync(file)).toBe(true);
  });
});

describe('JSON-LD', () => {
  const graph = buildCancellationPolicyJsonLd();
  const byType = (type: string) => graph.find((node) => node['@type'] === type) as Record<string, any>;

  it('emits WebPage, WebApplication, BreadcrumbList and FAQPage and never ratings', () => {
    expect(graph.map((node) => node['@type'])).toEqual(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']);
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|review/i);
  });

  it('links the page into the site @id graph', () => {
    const page = byType('WebPage');
    expect(page['@id']).toBe(`${page.url}#webpage`);
    expect(page.isPartOf['@id']).toMatch(/\/#website$/);
    expect(page.publisher['@id']).toMatch(/\/#organization$/);
    expect(page.inLanguage).toBe('en-GB');
    expect(page.dateModified).toBe(CANCELLATION_POLICY_LAST_UPDATED_ISO);
  });

  it('describes a free web application', () => {
    const app = byType('WebApplication');
    expect(app).toMatchObject({
      name: 'Barbershop Cancellation Policy Template',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      inLanguage: 'en-GB',
    });
    expect(app.provider['@id']).toMatch(/\/#organization$/);
  });

  it('has a two-step breadcrumb', () => {
    const items = byType('BreadcrumbList').itemListElement;
    expect(items.map((item: any) => item.name)).toEqual(['Home', 'Cancellation Policy Template']);
  });

  it('FAQPage answers match the visible FAQ exactly', () => {
    const faq = byType('FAQPage').mainEntity;
    expect(faq).toHaveLength(CANCELLATION_POLICY_FAQ_ITEMS.length);
    faq.forEach((q: any, i: number) => {
      expect(q.name).toBe(CANCELLATION_POLICY_FAQ_ITEMS[i].question);
      expect(q.acceptedAnswer.text).toBe(CANCELLATION_POLICY_FAQ_ITEMS[i].answer);
    });
  });
});

describe('claims', () => {
  it('keeps "0% commission" next to a Stripe fees note', () => {
    for (const text of [CANCELLATION_POLICY_CTA.body, CANCELLATION_POLICY_FAQ_ITEMS.at(-1)!.answer]) {
      expect(text).toMatch(/0% commission/);
      expect(text).toMatch(/Stripe processing fees apply/);
    }
  });

  it('presents Starter as the CTA and Full KERSIVO at £39/month per location', () => {
    expect(CANCELLATION_POLICY_CTA.primary.href).toBe('/starter');
    expect(CANCELLATION_POLICY_CTA.fullLink.label).toContain('£39/month per location');
  });
});

describe('internal links to the tool', () => {
  it('appears in the sitemap with a real lastmod, the Resources nav and the footer', () => {
    expect(MARKETING_SITEMAP_ENTRIES).toContainEqual({
      path: CANCELLATION_POLICY_PAGE_PATH,
      lastmod: CANCELLATION_POLICY_LAST_UPDATED_ISO,
    });
    const nav = MARKETING_NAV_ITEMS.find((item) => item.href === CANCELLATION_POLICY_PAGE_PATH);
    expect(nav).toMatchObject({ group: 'resources', section: 'tools', label: 'Cancellation Policy Template' });
    expect(FOOTER_COLUMNS.flatMap((column) => column.links).map((link) => link.href)).toContain(
      CANCELLATION_POLICY_PAGE_PATH,
    );
    expect(getRouteFamily(CANCELLATION_POLICY_PAGE_PATH)).toBe('marketing');
  });

  it('is linked from Starter, online booking and the no-show deposits article', () => {
    for (const file of [
      'src/pages/starter/index.astro',
      'src/components/barbershop-online-booking/OnlineBookingAfterBooking.astro',
      'editorial-staging/insights/barbershop-no-show-cost-when-deposit-makes-sense-display.md',
    ]) {
      expect(read(file)).toContain(CANCELLATION_POLICY_PAGE_PATH);
    }
  });
});
