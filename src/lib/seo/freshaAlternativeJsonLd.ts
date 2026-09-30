import {
  FRESHA_ALTERNATIVE_DESCRIPTION,
  FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
  FRESHA_ALTERNATIVE_PAGE_PATH,
  FRESHA_ALTERNATIVE_TITLE,
} from '@/lib/seo/freshaAlternativeFaq';
import {
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildFreshaAlternativeWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${FRESHA_ALTERNATIVE_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: FRESHA_ALTERNATIVE_TITLE,
    description: FRESHA_ALTERNATIVE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: FRESHA_ALTERNATIVE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}
