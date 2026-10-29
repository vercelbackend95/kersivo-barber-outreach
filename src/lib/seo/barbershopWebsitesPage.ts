import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBreadcrumbListJsonLd, BARBERSHOP_WEBSITES_BREADCRUMBS } from '@/lib/seo/breadcrumbs';

export const BARBERSHOP_WEBSITES_PAGE_PATH = '/barbershop-websites';

export const BARBERSHOP_WEBSITES_PAGE_TITLE =
  'Barbershop Website with Online Booking UK | KERSIVO';

export const BARBERSHOP_WEBSITES_PAGE_DESCRIPTION =
  `Your branded barbershop website on your own domain, with online booking built in. Set up for you for £${SAAS_MONTHLY_GBP}/month per location. No setup fee, no VAT added.`;

export const BARBERSHOP_WEBSITES_PAGE_H1 = 'Barbershop Websites with Online Booking';

/** Published as the canonical pillar of the UK barbershop websites cluster. */
export const BARBERSHOP_WEBSITES_PAGE_INDEXABLE = true;

/** Links the sales pillar into KERSIVO's existing WebSite/Organization schema entities. */
export function buildBarbershopWebsitesJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_WEBSITES_PAGE_TITLE,
    description: BARBERSHOP_WEBSITES_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: buildBreadcrumbListJsonLd(BARBERSHOP_WEBSITES_BREADCRUMBS, { siteUrl, withContext: false }),
  };
}
