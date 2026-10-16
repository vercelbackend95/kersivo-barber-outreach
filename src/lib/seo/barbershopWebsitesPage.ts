import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBERSHOP_WEBSITES_PAGE_PATH = '/barbershop-websites';

export const BARBERSHOP_WEBSITES_PAGE_TITLE =
  'Barbershop Websites UK | Design & Booking | KERSIVO';

export const BARBERSHOP_WEBSITES_PAGE_DESCRIPTION =
  'Professional barbershop websites on your own domain, with online booking and business tools. Full KERSIVO costs £39/month with no setup fee.';

export const BARBERSHOP_WEBSITES_PAGE_H1 = 'Barbershop Websites with Online Booking';

/** The pillar stays noindex and out of the sitemap until the entire cluster passes release QA. */
export const BARBERSHOP_WEBSITES_PAGE_INDEXABLE = false;

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
    breadcrumb: {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Barbershop websites', item: pageUrl },
      ],
    },
  };
}
