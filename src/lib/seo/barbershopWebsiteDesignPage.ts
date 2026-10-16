import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { BARBERSHOP_WEBSITES_PAGE_PATH } from '@/lib/seo/barbershopWebsitesPage';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH = '/barbershop-website-design';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE =
  'Barbershop Website Design UK: Branding & Layout | KERSIVO';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION =
  'Explore barbershop website design through a fictional CUTSTATE demo, with practical advice on branding, photography, mobile layouts and clear booking routes.';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 = 'Barbershop Website Design That Looks Like Your Shop';

/** Published design guide, with reciprocal pillar links and canonical WebPage schema. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = true;

export function buildBarbershopWebsiteDesignJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE,
    description: BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Barbershop websites', item: `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}` },
        { '@type': 'ListItem', position: 3, name: 'Website design', item: pageUrl },
      ],
    },
  };
}
