import { KERSIVO_CONTACT_EMAIL, getFooterSocialLinks } from './footerSocialLinks';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const KERSIVO_BRAND_SCHEMA_NAME = 'KERSIVO';

export const KERSIVO_ORGANIZATION_DESCRIPTION =
  'Booking and management software built specifically for independent UK barbershops.';

/** Stable @id for schema.org cross-references (brand site). */
export function getKersivoOrganizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function getKersivoWebsiteId(siteUrl: string): string {
  return `${siteUrl}/#website`;
}

/**
 * Verified company facts only. Address, telephone, founding date, employee count,
 * customer numbers, awards, ratings and founder details are deliberately omitted.
 */
export function buildKersivoOrganizationNode(siteUrl = getPublicSiteUrl()): Record<string, unknown> {
  const sameAs = getFooterSocialLinks().map((link) => link.href);
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': getKersivoOrganizationId(siteUrl),
    name: KERSIVO_BRAND_SCHEMA_NAME,
    url: `${siteUrl}/`,
    description: KERSIVO_ORGANIZATION_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/images/logo.jpg`,
    },
    email: KERSIVO_CONTACT_EMAIL,
    areaServed: { '@type': 'Country', name: 'United Kingdom', identifier: 'GB' },
  };
  if (sameAs.length > 0) {
    organization.sameAs = sameAs;
  }
  return organization;
}

/** Standalone Organization + WebSite block for marketing pages that do not use the homepage graph. */
export function buildKersivoEntityJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@graph': [buildKersivoOrganizationNode(siteUrl), buildKersivoWebsiteNode(siteUrl)],
  };
}

export function buildKersivoWebsiteNode(siteUrl = getPublicSiteUrl()): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': getKersivoWebsiteId(siteUrl),
    url: `${siteUrl}/`,
    name: KERSIVO_BRAND_SCHEMA_NAME,
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}
