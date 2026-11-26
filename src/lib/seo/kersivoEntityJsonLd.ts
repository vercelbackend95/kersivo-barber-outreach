import { KERSIVO_CONTACT_EMAIL, getFooterSocialLinks } from './footerSocialLinks';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const KERSIVO_BRAND_SCHEMA_NAME = 'KERSIVO';

/**
 * The one-sentence entity description. Reuse it word for word everywhere KERSIVO is described:
 * Organization JSON-LD (every marketing page, including the homepage graph), /about, /llms.txt,
 * the "In short" answers and off-site profiles (see docs/seo/ai-visibility-playbook.md).
 * Consistent wording is what lets search engines and AI assistants recognise one entity.
 */
export const KERSIVO_ENTITY_DESCRIPTION =
  'KERSIVO is booking and management software built specifically for independent UK barbershops.';

export const KERSIVO_ORGANIZATION_DESCRIPTION = KERSIVO_ENTITY_DESCRIPTION;

/** Category used on directories and review sites. */
export const KERSIVO_ENTITY_CATEGORY = 'Salon and barbershop booking software';

/** Short bio for social profiles (Instagram allows 150 characters). */
export const KERSIVO_SOCIAL_BIO =
  'Booking software and branded websites for independent UK barbershops. 0% KERSIVO commission (Stripe fees apply).';

/**
 * Off-site profiles (review sites, directories) that should join the footer socials in
 * Organization.sameAs once they are live and show the entity description. Add the public profile URL only.
 */
export const KERSIVO_OFF_SITE_PROFILES: readonly string[] = [
  // Gartner Digital Markets: Capterra product page and the GetApp listing (added 26 Nov 2026).
  'https://www.capterra.com/p/10290243/KERSIVO/',
  'https://www.getapp.com/all-software/a/kersivo/',
  // G2 seller (company) profile (added 26 Nov 2026).
  'https://www.g2.com/sellers/kersivo',
];

/**
 * Organization.knowsAbout: the subjects KERSIVO's product pages, comparisons, free tools and Insights cover.
 * Topics only, no claims. Keep in step with what the site actually publishes.
 */
export const KERSIVO_KNOWS_ABOUT: readonly string[] = [
  'Barbershop booking software',
  'Online booking for barbershops',
  'Booking deposits and no-show protection',
  'Barbershop websites',
  'Card payment fees for barbershops',
  'Booking platform fees in the UK',
  'Running an independent barbershop in the UK',
];

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
  const sameAs = [...getFooterSocialLinks().map((link) => link.href), ...KERSIVO_OFF_SITE_PROFILES];
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': getKersivoOrganizationId(siteUrl),
    name: KERSIVO_BRAND_SCHEMA_NAME,
    alternateName: 'Kersivo',
    url: `${siteUrl}/`,
    /** The /about AboutPage, whose mainEntity is this node (audit P2-2: the about link lives here, not on author.url). */
    mainEntityOfPage: { '@id': `${siteUrl}/about#webpage` },
    description: KERSIVO_ORGANIZATION_DESCRIPTION,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: KERSIVO_CONTACT_EMAIL,
      areaServed: 'GB',
      availableLanguage: 'en-GB',
    },
    // Square 512px K mark, written to public/ by scripts/generate-favicons.mjs on every build.
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/images/brand/kersivo-mark.png`,
      width: 512,
      height: 512,
    },
    email: KERSIVO_CONTACT_EMAIL,
    areaServed: { '@type': 'Country', name: 'United Kingdom', identifier: 'GB' },
    knowsAbout: [...KERSIVO_KNOWS_ABOUT],
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
