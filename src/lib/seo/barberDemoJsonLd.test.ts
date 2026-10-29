import { describe, expect, it } from 'vitest';
import {
  buildBarberDemoJsonLd,
  getKersivoOrganizationId,
  getKersivoHomepageId,
  getKersivoSoftwareId,
  getKersivoWebsiteId,
  KERSIVO_SOFTWARE_FEATURE_LIST,
} from './barberDemoJsonLd';
import { HOMEPAGE_FAQ_ITEMS, buildBarbershopBookingFaqJsonLd } from './barbershopBookingFaq';
import { getFooterSocialLinks } from './footerSocialLinks';
import { DEFAULT_TITLE, HOMEPAGE_DESCRIPTION, HOMEPAGE_LAST_UPDATED_ISO, SAAS_MONTHLY_GBP } from './defaults';

describe('buildBarberDemoJsonLd', () => {
  it('emits a single valid @graph with Organization, WebSite, WebPage, and SoftwareApplication', () => {
    const jsonLd = buildBarberDemoJsonLd();
    const serialized = JSON.stringify(jsonLd);
    expect(() => JSON.parse(serialized)).not.toThrow();

    expect(jsonLd['@context']).toBe('https://schema.org');
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(Array.isArray(graph)).toBe(true);
    expect(graph).toHaveLength(4);

    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'WebPage', 'SoftwareApplication']);
    expect(types.filter((t) => t === 'Organization')).toHaveLength(1);
    expect(types.filter((t) => t === 'WebSite')).toHaveLength(1);
    expect(types.filter((t) => t === 'WebPage')).toHaveLength(1);
    expect(types.filter((t) => t === 'SoftwareApplication')).toHaveLength(1);

    expect(serialized).not.toContain('LocalBusiness');
    expect(serialized).not.toContain('SearchAction');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).toContain('https://schema.org/InStock');
    expect(serialized).not.toContain('"@type":"Service"');
  });

  it('uses approved ids, names, descriptions, offer, features, and footer sameAs', () => {
    const jsonLd = buildBarberDemoJsonLd();
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    const siteUrl = 'https://kersivo.co.uk';

    const organization = graph.find((node) => node['@type'] === 'Organization')!;
    const website = graph.find((node) => node['@type'] === 'WebSite')!;
    const homepage = graph.find((node) => node['@type'] === 'WebPage')!;
    const software = graph.find((node) => node['@type'] === 'SoftwareApplication')!;

    expect(organization['@id']).toBe(getKersivoOrganizationId(siteUrl));
    expect(organization.name).toBe('KERSIVO');
    expect(organization.url).toBe(`${siteUrl}/`);
    expect(organization.description).toBe(
      'Booking and management software built specifically for independent UK barbershops.',
    );
    expect(organization.email).toBe('hello@kersivo.co.uk');
    expect(organization.areaServed).toEqual({
      '@type': 'Country',
      name: 'United Kingdom',
      identifier: 'GB',
    });
    for (const forbidden of [
      'address',
      'telephone',
      'foundingDate',
      'numberOfEmployees',
      'award',
      'aggregateRating',
      'review',
    ]) {
      expect(organization, forbidden).not.toHaveProperty(forbidden);
    }
    expect(organization.logo).toEqual({
      '@type': 'ImageObject',
      url: `${siteUrl}/images/brand/kersivo-mark.png`,
      width: 512,
      height: 512,
    });
    expect(JSON.stringify(organization.logo)).not.toContain('logo.jpg');
    expect(organization.sameAs).toEqual(getFooterSocialLinks().map((link) => link.href));
    expect(organization.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@kersivo.co.uk',
      areaServed: 'GB',
      availableLanguage: 'en-GB',
    });
    expect(organization.alternateName).toBe('Kersivo');
    expect(organization).not.toHaveProperty('legalName');
    expect(organization).not.toHaveProperty('founder');

    expect(website['@id']).toBe(getKersivoWebsiteId(siteUrl));
    expect(website.name).toBe('KERSIVO');
    expect(website.url).toBe(`${siteUrl}/`);
    expect(website.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(website).not.toHaveProperty('potentialAction');

    expect(homepage['@id']).toBe(getKersivoHomepageId(siteUrl));
    expect(homepage.url).toBe(`${siteUrl}/`);
    expect(homepage.name).toBe(DEFAULT_TITLE);
    expect(homepage.description).toBe(HOMEPAGE_DESCRIPTION);
    expect(homepage.dateModified).toBe(HOMEPAGE_LAST_UPDATED_ISO);
    expect(homepage.inLanguage).toBe('en-GB');
    expect(homepage.isPartOf).toEqual({ '@id': getKersivoWebsiteId(siteUrl) });
    expect(homepage.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(homepage.mainEntity).toEqual({ '@id': getKersivoSoftwareId(siteUrl) });
    expect(homepage.hasPart).toEqual({ '@id': `${siteUrl}/#faq` });

    expect(software['@id']).toBe(getKersivoSoftwareId(siteUrl));
    expect(software.name).toBe('KERSIVO');
    expect(software.url).toBe(`${siteUrl}/`);
    expect(software.applicationCategory).toBe('BusinessApplication');
    expect(software.operatingSystem).toBe('Web browser');
    expect(software.applicationSubCategory).toBe('Barbershop booking software and websites');
    expect(software.description).toContain('0% KERSIVO commission');
    expect(software.provider).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(software.featureList).toEqual([...KERSIVO_SOFTWARE_FEATURE_LIST]);
    expect(software.offers).toMatchObject([
      { name: 'Full KERSIVO', price: SAAS_MONTHLY_GBP.toFixed(2), priceCurrency: 'GBP' },
      { name: 'KERSIVO Starter', price: '0', priceCurrency: 'GBP' },
    ]);

    const serialized = JSON.stringify(jsonLd);
    expect(serialized).not.toContain('legalName');
    expect(serialized).not.toContain('founder');
    expect(serialized).not.toContain('"@type":"Person"');
    expect(serialized).not.toContain('Bartosz');
  });
});

describe('buildBarbershopBookingFaqJsonLd', () => {
  it('remains a valid standalone FAQPage', () => {
    const faq = buildBarbershopBookingFaqJsonLd();
    expect(faq['@type']).toBe('FAQPage');
    expect(faq['@id']).toBe('https://kersivo.co.uk/#faq');
    expect(Array.isArray(faq.mainEntity)).toBe(true);
    expect((faq.mainEntity as unknown[]).length).toBeGreaterThan(0);
    expect(() => JSON.parse(JSON.stringify(faq))).not.toThrow();
  });

  it('mirrors every visible FAQ item, including the barbershop software questions', () => {
    const faq = buildBarbershopBookingFaqJsonLd();
    const entities = faq.mainEntity as Array<{
      '@type': string;
      name: string;
      acceptedAnswer: { '@type': string; text: string };
    }>;
    expect(entities.map((entity) => entity.name)).toEqual(HOMEPAGE_FAQ_ITEMS.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(
      HOMEPAGE_FAQ_ITEMS.map((item) => item.answer),
    );
    expect(entities.map((entity) => entity.name)).toContain('How much does Full KERSIVO cost a shop?');
    expect(JSON.stringify(faq)).not.toMatch(/Review|AggregateRating|aggregateRating/);
  });
});
