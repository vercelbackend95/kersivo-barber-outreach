/**
 * Public KERSIVO Insights editorial registry.
 * Only owner-approved, actually published articles may be added here.
 * Notion remains authoritative for source copy; this file holds website metadata.
 */
import {
  getInsightsCategory,
  getInsightsCategoryName,
  getIndexableInsightsCategorySitemapEntries,
  type InsightsCategoryId,
} from '@/lib/insights/categories';
import { buildAbsoluteUrl } from './meta';

export const INSIGHTS_INDEX_PATH = '/insights';
export const INSIGHTS_INDEX_TITLE = 'Barbershop Business Insights & Guides UK | KERSIVO';
export const INSIGHTS_INDEX_DESCRIPTION =
  'Practical insights for independent UK barbershop owners: bookings, clients, business costs, branding and running a stronger shop.';

export const INSIGHTS_GOOGLE_REVIEWS = {
  slug: 'google-reviews-barbershop-uk-rules',
  path: '/insights/google-reviews-barbershop-uk-rules',
  headline: 'Google Reviews for Barbershops: Two Rulebooks, One Habit',
  seoTitle: "Google Reviews for Barbershops: What's Allowed in the UK",
  description:
    "How UK barbershops can get more Google reviews without breaking the DMCC Act or Google's stricter rules on incentives, review gating and staff targets.",
  categoryId: 'brand-marketing' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8171bef0d462be52901f',
  lead:
    "What UK consumer law and Google's review policies actually mean for a barbershop asking clients for feedback.",
  heroImage:
    'https://images.unsplash.com/photo-1768678218016-6bed23a35116?auto=format&fit=crop&fm=jpg&q=75&w=1600',
  ogImage: '/images/insights/og/google-reviews-barbershop-uk-rules-1200x630.jpg',
  ogImageAlt: 'Barbers working in a barbershop in Aldershot, UK',
} as const;

export const INSIGHTS_LOCAL_CLIENTS = {
  slug: 'get-more-barbershop-clients-locally-uk',
  path: '/insights/get-more-barbershop-clients-locally-uk',
  headline: 'How to Get More Barbershop Clients Locally: Price the Channel Before You Pick It',
  seoTitle: 'How to Get More Barbershop Clients Locally (UK Guide)',
  description:
    'Judge every marketing channel by what a returning client costs. Referrals, lapsed clients, Google and leaflets, with the UK rules on texts and flyers.',
  categoryId: 'clients-growth' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8163947eef1b68eb6b58',
  lead: 'Compare the real cost of a second-visit client across referrals, Google, local partnerships and promotional channels.',
  heroImage:
    'https://images.unsplash.com/photo-1781455793310-8427c96454c7?auto=format&fit=crop&fm=jpg&q=75&w=1600',
  ogImage: '/images/insights/og/get-more-barbershop-clients-locally-uk-1200x630.jpg',
  ogImageAlt: 'Empty barbershop with vintage leather barber chairs and mirrors',
} as const;

export const INSIGHTS_CARD_FEES = {
  slug: 'barbershop-card-payment-fees-uk',
  path: '/insights/barbershop-card-payment-fees-uk',
  headline: "The 20p You Don't Notice: How Card Fees Really Work for a Barbershop",
  seoTitle: 'Barbershop Card Fees: What You Really Pay per Payment',
  description:
    "Card fees cost a barbershop more than the headline rate suggests. How fixed fees, card mix and split payments add up, and why you can't surcharge.",
  categoryId: 'tools-payments' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda8170b7f1d8101223b50e',
  lead: 'Understand fixed fees, split payments and your blended processing rate before accepting a headline percentage.',
  heroImage: '/images/insights/card-fees/card-fees-hero.svg',
  ogImage: '/images/insights/og/barbershop-card-payment-fees-uk-1200x630.png',
  ogImageAlt: 'Original KERSIVO Insights illustration of a 20p fixed card-processing fee',
} as const;

export const INSIGHTS_GIFT_VOUCHERS = {
  slug: 'barbershop-gift-vouchers-uk',
  path: '/insights/barbershop-gift-vouchers-uk',
  headline: 'Barbershop Gift Vouchers: Cash in December, a Haircut You Owe in March',
  seoTitle: 'Barbershop Gift Vouchers: Expiry Rules, VAT and Real Value',
  description:
    'Gift vouchers bring cash in December but you still owe the haircut. UK expiry rules, VAT on single-purpose vouchers, and how to tell if they make money.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda817c8479e203928f3cba',
  lead: 'Cash in today is not always earned revenue. Understand the true cost of gift vouchers, UK expiry terms and VAT rules.',
  heroImage: '/images/insights/gift-vouchers/voucher-hero.svg',
  ogImage: '/images/insights/og/barbershop-gift-vouchers-uk-1200x630.png',
  ogImageAlt: 'Original KERSIVO editorial artwork of a fictional gift voucher',
} as const;

export const INSIGHTS_DECEMBER_HOURS = {
  slug: 'barbershop-christmas-opening-hours-planning',
  path: '/insights/barbershop-christmas-opening-hours-planning',
  headline: "The Extra Hour Test: Planning a Barbershop's December Without Fooling Yourself",
  seoTitle: 'Barbershop Christmas Opening Hours: Do Late Nights Pay?',
  description: 'Should your barbershop open late in December? A simple extra-hour test, 2026 bank holiday dates, staff rules, and how to fill January before it arrives.',
  categoryId: 'bookings-operations' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda81e9ae9eeadf5007f087',
  lead: 'Use break-even maths to decide whether longer December opening hours actually add revenue — and plan for January before it comes.',
  heroImage: 'https://images.unsplash.com/photo-1672257493626-038f96997ade?auto=format&fit=crop&q=78&w=2400',
  ogImage: 'https://images.unsplash.com/photo-1672257493626-038f96997ade?auto=format&fit=crop&q=78&w=1200&h=630',
  ogImageAlt: 'Empty vintage barbershop with chairs, mirrors and brick walls',
} as const;

export const INSIGHTS_HAIRCUT_PRICING = {
  slug: 'how-to-price-haircut-uk-barber',
  path: '/insights/how-to-price-haircut-uk-barber',
  headline: 'How to Price a Haircut in the UK: A Floor, a Ceiling and the Price List In Between',
  seoTitle: "How to Price a Haircut in the UK: A Barber's Method",
  description: 'Set haircut prices from your real cost per minute and the local range, test a price rise with break-even maths, and show prices the way UK law expects.',
  categoryId: 'business-profit' as const satisfies InsightsCategoryId,
  publishedDate: '2026-10-17',
  verifiedDate: '2026-10-16',
  notionUrl: 'https://app.notion.com/p/3fb7dbe5bbda817688dee88a79cd9d00',
  lead: 'Find the cost-recovery floor, compare your local market, then test the numbers before you raise haircut prices.',
  heroImage: 'https://images.unsplash.com/photo-1769034260387-39fa07f0c0fa?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
  ogImage: 'https://images.unsplash.com/photo-1769034260387-39fa07f0c0fa?auto=format&fit=crop&fm=jpg&q=78&w=1200&h=630',
  ogImageAlt: 'Vintage barber chairs and mirrors in a classic barbershop',
} as const;

/**
 * Single source of publication for owner-approved Insights articles.
 * Sitemap, hub cards and indexability must derive from this list only.
 * Order matches Latest Thinking / CollectionPage ItemList (newest-first editorial order).
 */
export const INSIGHTS_PUBLISHED_ARTICLES = [
  INSIGHTS_DECEMBER_HOURS,
  INSIGHTS_HAIRCUT_PRICING,
  INSIGHTS_GIFT_VOUCHERS,
  INSIGHTS_CARD_FEES,
  INSIGHTS_LOCAL_CLIENTS,
  INSIGHTS_GOOGLE_REVIEWS,
] as const;

export type InsightsPublishedArticle = (typeof INSIGHTS_PUBLISHED_ARTICLES)[number] & {
  /** Set only when an editorial revision meaningfully changes published copy. */
  modifiedDate?: string;
};

export function getInsightsArticleCategoryId(article: { categoryId: InsightsCategoryId }): InsightsCategoryId {
  return article.categoryId;
}

export function getInsightsArticleCategoryLabel(article: { categoryId: InsightsCategoryId }): string {
  return getInsightsCategoryName(article.categoryId);
}

export function isInsightsArticlePublished(slug: string): boolean {
  return INSIGHTS_PUBLISHED_ARTICLES.some((article) => article.slug === slug);
}

export function getInsightsPublishedArticle(slug: string): InsightsPublishedArticle | undefined {
  return INSIGHTS_PUBLISHED_ARTICLES.find((article) => article.slug === slug);
}

export function getPublishedArticlesByCategory(
  categoryId: InsightsCategoryId,
): InsightsPublishedArticle[] {
  return INSIGHTS_PUBLISHED_ARTICLES.filter((article) => article.categoryId === categoryId);
}

export function formatInsightsDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function absoluteAssetUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return buildAbsoluteUrl(src.startsWith('/') ? src : `/${src}`);
}

/** Newest editorial publishedDate among live articles — used for hub sitemap lastmod. */
export function getInsightsIndexLastmod(): string {
  return INSIGHTS_PUBLISHED_ARTICLES.reduce(
    (newest, article) => (article.publishedDate > newest ? article.publishedDate : newest),
    INSIGHTS_PUBLISHED_ARTICLES[0].publishedDate,
  );
}

export function buildInsightsSitemapEntries(): Array<{ path: string; lastmod?: string }> {
  return [
    { path: INSIGHTS_INDEX_PATH, lastmod: getInsightsIndexLastmod() },
    ...INSIGHTS_PUBLISHED_ARTICLES.map((article) => {
      const modified =
        'modifiedDate' in article && typeof article.modifiedDate === 'string'
          ? article.modifiedDate
          : undefined;
      return {
        path: article.path,
        lastmod: modified && modified.length > 0 ? modified : article.publishedDate,
      };
    }),
    ...getIndexableInsightsCategorySitemapEntries(),
  ];
}

export function buildInsightsBreadcrumbs(options?: {
  path?: string;
  headline?: string;
  categoryId?: InsightsCategoryId;
}) {
  const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'KERSIVO', item: buildAbsoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Insights', item: buildAbsoluteUrl(INSIGHTS_INDEX_PATH) },
  ];
  if (options?.categoryId) {
    const category = getInsightsCategory(options.categoryId);
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: category.name,
      item: buildAbsoluteUrl(category.path),
    });
  }
  if (options?.path && options.headline) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: options.headline,
      item: buildAbsoluteUrl(options.path),
    });
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
        numberOfItems: INSIGHTS_PUBLISHED_ARTICLES.length,
        itemListElement: INSIGHTS_PUBLISHED_ARTICLES.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: article.headline,
          url: buildAbsoluteUrl(article.path),
        })),
      },
    },
    buildInsightsBreadcrumbs(),
  ];
}

export function buildInsightsCategoryJsonLd(options: {
  categoryId: InsightsCategoryId;
  articles: readonly InsightsPublishedArticle[];
  indexable: boolean;
}) {
  const category = getInsightsCategory(options.categoryId);
  const url = buildAbsoluteUrl(category.path);
  const page: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url + '#webpage',
    url,
    name: category.seoTitle,
    description: category.seoDescription,
    inLanguage: 'en-GB',
    isPartOf: { '@id': buildAbsoluteUrl('/') + '#website' },
  };
  if (options.indexable && options.articles.length > 0) {
    page.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: options.articles.length,
      itemListElement: options.articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: article.headline,
        url: buildAbsoluteUrl(article.path),
      })),
    };
  }
  return [page, buildInsightsBreadcrumbs({ categoryId: options.categoryId })];
}

export function buildInsightsArticleJsonLd(article: {
  path: string;
  headline: string;
  description: string;
  publishedDate: string;
  verifiedDate: string;
  modifiedDate?: string;
  heroImage: string;
  ogImage?: string;
  categoryId: InsightsCategoryId;
}) {
  const url = buildAbsoluteUrl(article.path);
  const imageUrl = absoluteAssetUrl(article.ogImage ?? article.heroImage);
  const categoryName = getInsightsCategoryName(article.categoryId);
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': url + '#article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.headline,
    description: article.description,
    image: [imageUrl],
    datePublished: article.publishedDate,
    inLanguage: 'en-GB',
    author: { '@type': 'Organization', name: 'KERSIVO', url: buildAbsoluteUrl('/') },
    publisher: {
      '@type': 'Organization',
      name: 'KERSIVO',
      url: buildAbsoluteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: buildAbsoluteUrl('/images/logo-kersivo.png'),
      },
    },
    articleSection: categoryName,
    isAccessibleForFree: true,
  };
  if (article.modifiedDate && article.modifiedDate !== article.publishedDate) {
    payload.dateModified = article.modifiedDate;
  }
  return [
    payload,
    buildInsightsBreadcrumbs({
      path: article.path,
      headline: article.headline,
      categoryId: article.categoryId,
    }),
  ];
}
