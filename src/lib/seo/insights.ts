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

export const INSIGHTS_LOCAL_CLIENTS = {
  slug: 'get-more-barbershop-clients-locally-uk',
  path: '/insights/get-more-barbershop-clients-locally-uk',
  headline: 'How to Get More Barbershop Clients Locally: Price the Channel Before You Pick It',
  seoTitle: 'How to Get More Barbershop Clients Locally (UK Guide)',
  description: 'Judge every marketing channel by what a returning client costs. Referrals, lapsed clients, Google and leaflets, with the UK rules on texts and flyers.',
  category: 'Bookings & Clients',
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8163947eef1b68eb6b58',
  lead: 'Compare the real cost of a second-visit client across referrals, Google, local partnerships and promotional channels.',
  heroImage: 'https://images.unsplash.com/photo-1781455793310-8427c96454c7?auto=format&fit=crop&fm=jpg&q=75&w=2400',
} as const;

export const INSIGHTS_CARD_FEES = {
  slug: 'barbershop-card-payment-fees-uk',
  path: '/insights/barbershop-card-payment-fees-uk',
  headline: "The 20p You Don't Notice: How Card Fees Really Work for a Barbershop",
  seoTitle: 'Barbershop Card Fees: What You Really Pay per Payment',
  description: "Card fees cost a barbershop more than the headline rate suggests. How fixed fees, card mix and split payments add up, and why you can't surcharge.",
  category: 'Software & Costs',
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8170b7f1d8101223b50e',
  lead: 'Understand fixed fees, split payments and your blended processing rate before accepting a headline percentage.',
  heroImage: '/images/insights/card-fees/card-fees-hero.svg',
} as const;

export const INSIGHTS_GIFT_VOUCHERS = {
  slug: 'barbershop-gift-vouchers-uk',
  path: '/insights/barbershop-gift-vouchers-uk',
  headline: 'Barbershop Gift Vouchers: Cash in December, a Haircut You Owe in March',
  seoTitle: 'Barbershop Gift Vouchers: Expiry Rules, VAT and Real Value',
  description: 'Gift vouchers bring cash in December but you still owe the haircut. UK expiry rules, VAT on single-purpose vouchers, and how to tell if they make money.',
  category: 'Business & Revenue',
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda817c8479e203928f3cba',
  lead: 'Cash in today is not always earned revenue. Understand the true cost of gift vouchers, UK expiry terms and VAT rules.',
  heroImage: '/images/insights/gift-vouchers/voucher-hero.svg',
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
        numberOfItems: 4,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: INSIGHTS_GIFT_VOUCHERS.headline,
            url: buildAbsoluteUrl(INSIGHTS_GIFT_VOUCHERS.path),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: INSIGHTS_CARD_FEES.headline,
            url: buildAbsoluteUrl(INSIGHTS_CARD_FEES.path),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: INSIGHTS_LOCAL_CLIENTS.headline,
            url: buildAbsoluteUrl(INSIGHTS_LOCAL_CLIENTS.path),
          },
          {
            '@type': 'ListItem',
            position: 4,
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
  category?: string;
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
      articleSection: article.category ?? 'Brand & Marketing',
      isAccessibleForFree: true,
    },
    buildInsightsBreadcrumbs(article),
  ];
}
