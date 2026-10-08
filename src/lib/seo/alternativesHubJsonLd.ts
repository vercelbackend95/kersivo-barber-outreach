import { HUB_PLATFORMS } from '@/lib/compare/alternativesHubData';
import {
  ALTERNATIVES_HUB_DESCRIPTION,
  ALTERNATIVES_HUB_FAQ_ITEMS,
  ALTERNATIVES_HUB_LAST_UPDATED_ISO,
  ALTERNATIVES_HUB_PAGE_PATH,
  ALTERNATIVES_HUB_TITLE,
} from '@/lib/seo/alternativesHubSeo';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${ALTERNATIVES_HUB_PAGE_PATH}`;
}

export function buildAlternativesHubCollectionPageJsonLd(siteUrl = getPublicSiteUrl()): Record<string, unknown> {
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    name: ALTERNATIVES_HUB_TITLE,
    description: ALTERNATIVES_HUB_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: ALTERNATIVES_HUB_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    mainEntity: { '@id': `${url}#comparisons` },
  };
}

/** Mirrors the visible Home / Compare breadcrumb in the hub hero. */
export function buildAlternativesHubBreadcrumbJsonLd(siteUrl = getPublicSiteUrl()): Record<string, unknown> {
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Compare booking systems', item: url },
    ],
  };
}

/** The comparison destinations rendered as cards, in default (server-rendered) order. */
export function buildAlternativesHubItemListJsonLd(siteUrl = getPublicSiteUrl()): Record<string, unknown> {
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${url}#comparisons`,
    name: 'Barber booking software comparisons',
    numberOfItems: HUB_PLATFORMS.length,
    itemListElement: HUB_PLATFORMS.map((platform, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: platform.isFirstParty ? `${platform.name} pricing` : `${platform.name} alternative for UK barbershops`,
      url: `${siteUrl}${platform.href}`,
    })),
  };
}

export function buildAlternativesHubFaqJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ALTERNATIVES_HUB_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
