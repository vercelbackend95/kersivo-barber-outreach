import { describe, expect, it } from 'vitest';
import {
  buildBarberDemoJsonLd,
  getKersivoOrganizationId,
  getKersivoSoftwareId,
  getKersivoWebsiteId,
  KERSIVO_SOFTWARE_FEATURE_LIST,
} from './barberDemoJsonLd';
import { buildBarbershopBookingFaqJsonLd } from './barbershopBookingFaq';
import { getFooterSocialLinks } from './footerSocialLinks';
import { SAAS_MONTHLY_GBP } from './defaults';

describe('buildBarberDemoJsonLd', () => {
  it('emits a single valid @graph with Organization, WebSite, and SoftwareApplication', () => {
    const jsonLd = buildBarberDemoJsonLd();
    const serialized = JSON.stringify(jsonLd);
    expect(() => JSON.parse(serialized)).not.toThrow();

    expect(jsonLd['@context']).toBe('https://schema.org');
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(Array.isArray(graph)).toBe(true);
    expect(graph).toHaveLength(3);

    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    expect(types.filter((t) => t === 'Organization')).toHaveLength(1);
    expect(types.filter((t) => t === 'WebSite')).toHaveLength(1);
    expect(types.filter((t) => t === 'SoftwareApplication')).toHaveLength(1);

    expect(serialized).not.toContain('LocalBusiness');
    expect(serialized).not.toContain('SearchAction');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('InStock');
    expect(serialized).not.toContain('"@type":"Service"');
  });

  it('uses approved ids, names, descriptions, offer, features, and footer sameAs', () => {
    const jsonLd = buildBarberDemoJsonLd();
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    const siteUrl = 'https://kersivo.co.uk';

    const organization = graph.find((node) => node['@type'] === 'Organization')!;
    const website = graph.find((node) => node['@type'] === 'WebSite')!;
    const software = graph.find((node) => node['@type'] === 'SoftwareApplication')!;

    expect(organization['@id']).toBe(getKersivoOrganizationId(siteUrl));
    expect(organization.name).toBe('KERSIVO');
    expect(organization.url).toBe(`${siteUrl}/`);
    expect(organization.description).toBe(
      'Booking and management software for independent UK barbershops.',
    );
    expect(organization.logo).toEqual({
      '@type': 'ImageObject',
      url: `${siteUrl}/images/logo.jpg`,
    });
    expect(JSON.stringify(organization.logo)).not.toContain('logo_nobg');
    expect(organization.sameAs).toEqual(getFooterSocialLinks().map((link) => link.href));
    expect(organization).not.toHaveProperty('contactPoint');
    expect(organization).not.toHaveProperty('legalName');
    expect(organization).not.toHaveProperty('founder');

    expect(website['@id']).toBe(getKersivoWebsiteId(siteUrl));
    expect(website.name).toBe('KERSIVO');
    expect(website.url).toBe(`${siteUrl}/`);
    expect(website.publisher).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(website).not.toHaveProperty('potentialAction');

    expect(software['@id']).toBe(getKersivoSoftwareId(siteUrl));
    expect(software.name).toBe('KERSIVO');
    expect(software.url).toBe(`${siteUrl}/`);
    expect(software.applicationCategory).toBe('BusinessApplication');
    expect(software.operatingSystem).toBe('Web');
    expect(software.description).toBe(
      'Booking and management software built specifically for independent UK barbershops.',
    );
    expect(software.provider).toEqual({ '@id': getKersivoOrganizationId(siteUrl) });
    expect(software.featureList).toEqual([...KERSIVO_SOFTWARE_FEATURE_LIST]);
    expect(software.offers).toEqual({
      '@type': 'Offer',
      price: String(SAAS_MONTHLY_GBP),
      priceCurrency: 'GBP',
      url: `${siteUrl}/`,
    });
    expect(software.offers).toMatchObject({ price: '39', priceCurrency: 'GBP' });

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
});
