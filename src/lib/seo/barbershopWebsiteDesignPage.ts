import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH = '/barbershop-website-design';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE =
  'Barbershop Website Design UK: Branding & Layout | KERSIVO';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION =
  'Learn what makes a barbershop website look professional, from branding and photography to mobile design. See how Full KERSIVO brings it together.';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 = 'Barbershop Website Design That Looks Like Your Shop';

/**
 * The supporting page is only partially built. Keep it out of the index and the
 * marketing sitemap until every section has been approved.
 */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = false;

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
  };
}
