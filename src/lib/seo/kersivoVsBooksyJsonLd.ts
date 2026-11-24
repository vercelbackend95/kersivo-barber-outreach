import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { buildBreadcrumbListJsonLd } from '@/lib/seo/breadcrumbs';
import {
  KVB_BREADCRUMB_NAME,
  KVB_DESCRIPTION,
  KVB_LAST_UPDATED_ISO,
  KVB_PAGE_PATH,
  KVB_PUBLISHED_ISO,
  KVB_TITLE,
} from '@/lib/seo/kersivoVsBooksyExperience';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildKersivoVsBooksyWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${KVB_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: KVB_TITLE,
    description: KVB_DESCRIPTION,
    inLanguage: 'en-GB',
    datePublished: KVB_PUBLISHED_ISO,
    dateModified: KVB_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: buildBreadcrumbListJsonLd(
      [
        { name: 'Compare', path: '/compare' },
        { name: KVB_BREADCRUMB_NAME, path: KVB_PAGE_PATH },
      ],
      { siteUrl, withContext: false },
    ),
  };
}
