/**
 * Public KERSIVO Insights editorial registry.
 * Only owner-approved, actually published articles may be added here.
 * Notion remains authoritative for source copy; this file holds website metadata.
 */
import { buildAbsoluteUrl } from './meta';

export const INSIGHTS_INDEX_PATH = '/insights';
export const INSIGHTS_INDEX_TITLE = 'KERSIVO Insights | The Business Behind the Chair';
export const INSIGHTS_INDEX_DESCRIPTION =
  'Independent thinking for UK barbers and barbershop owners: reputation, client relationships, bookings and running a stronger business.';

export const INSIGHTS_GOOGLE_REVIEWS = {
  slug: 'google-reviews-barbershop-uk-rules',
  path: '/insights/google-reviews-barbershop-uk-rules',
  headline: 'Google Reviews for Barbershops: Two Rulebooks, One Habit',
  seoTitle: "Google Reviews for Barbershops: What's Allowed in the UK",
  description:
    "How UK barbershops can get more Google reviews without breaking the DMCC Act or Google's stricter rules on incentives, review gating and staff targets.",
  category: 'Brand & Marketing',
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8171bef0d462be52901f',
  lead:
    "What UK consumer law and Google's review policies actually mean for a barbershop asking clients for feedback.",
  heroImage:
    'https://images.unsplash.com/photo-1768678218016-6bed23a35116?auto=format&fit=crop&fm=jpg&ixid=NHwxMjA3fDA%3D&ixlib=rb-4.1.0&q=60&w=3000',
} as const;

export function buildInsightsBreadcrumbs(article?: { path: string; headline: string }) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'KERSIVO', item: buildAbsoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Insights', item: buildAbsoluteUrl(INSIGHTS_INDEX_PATH) },
  ];
  if (article) {
    items.push({ '@type': 'ListItem', position: 3, name: article.headline, item: buildAbsoluteUrl(article.path) });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

export function buildInsightsIndexJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': buildAbsoluteUrl(INSIGHTS_INDEX_PATH) + '#webpage',
      url: buildAbsoluteUrl(INSIGHTS_INDEX_PATH),
      name: INSIGHTS_INDEX_TITLE,
      description: INSIGHTS_INDEX_DESCRIPTION,
      inLanguage: 'en-GB',
      isPartOf: { '@id': buildAbsoluteUrl('/') + '#website' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: 1,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: INSIGHTS_GOOGLE_REVIEWS.headline,
            url: buildAbsoluteUrl(INSIGHTS_GOOGLE_REVIEWS.path),
          },
        ],
      },
    },
    buildInsightsBreadcrumbs(),
  ];
}

export function buildInsightsArticleJsonLd(article: {
  path: string;
  headline: string;
  description: string;
  publishedDate: string;
  verifiedDate: string;
  heroImage: string;
}) {
  const url = buildAbsoluteUrl(article.path);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': url + '#article',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      headline: article.headline,
      description: article.description,
      image: [article.heroImage],
      datePublished: article.publishedDate,
      dateModified: article.publishedDate,
      inLanguage: 'en-GB',
      author: { '@type': 'Organization', name: 'KERSIVO', url: buildAbsoluteUrl('/') },
      publisher: { '@type': 'Organization', name: 'KERSIVO', url: buildAbsoluteUrl('/') },
      articleSection: 'Brand & Marketing',
      isAccessibleForFree: true,
    },
    buildInsightsBreadcrumbs(article),
  ];
}
