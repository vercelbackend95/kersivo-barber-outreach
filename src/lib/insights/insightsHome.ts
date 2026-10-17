/**
 * Public Insights homepage composition (magazine layout).
 * Only published registry articles and real product URLs appear as links.
 */
import { GATE1_FEATURE_VERTICAL, GATE1_MASTHEAD, GATE1_OWNERS_DESK } from '@/lib/insights/gate1Preview';
import { getInsightsTopicStripItems } from '@/lib/insights/categories';
import {
  getInsightsArticleCategoryLabel,
  INSIGHTS_GOOGLE_REVIEWS,
  INSIGHTS_DECEMBER_HOURS,
  INSIGHTS_HAIRCUT_PRICING,
  INSIGHTS_PUBLISHED_ARTICLES,
} from '@/lib/seo/insights';

const reviews = INSIGHTS_GOOGLE_REVIEWS;

export const INSIGHTS_HOME_MASTHEAD = {
  ...GATE1_MASTHEAD,
  lead: 'Practical insights for independent UK barbershop owners — bookings, clients, costs, branding and stronger day-to-day decisions.',
} as const;

/** Canonical six-category topic strip — not design-preview fixtures. */
export const INSIGHTS_HOME_TOPICS = getInsightsTopicStripItems();

export const INSIGHTS_HOME_OWNERS_DESK = GATE1_OWNERS_DESK;

/** Featured mosaic — dominant = published Google Reviews article only. */
export const INSIGHTS_HOME_FEATURE_DOMINANT = {
  label: 'FEATURE',
  titleLines: [
    'Google Reviews for',
    'Barbershops: Two Rulebooks,',
    'One Habit',
  ] as const,
  deck: reviews.lead,
  cta: 'Read the article',
  href: reviews.path,
  imageSrc: reviews.heroImage,
  imageAlt: 'Barbers working in a barbershop in Aldershot, UK',
} as const;

export const INSIGHTS_HOME_FEATURE_VERTICAL = GATE1_FEATURE_VERTICAL;

/** Right stack uses live tools — not unpublished article fiction. */
export const INSIGHTS_HOME_FEATURE_STACK = [
  {
    id: 'cost-calculator',
    category: 'Tool',
    title: 'Know what your software really costs',
    imageSrc: '/demo/gallery/interior-detail.webp',
    imageAlt: '',
    href: '/barber-software-cost-calculator',
  },
  {
    id: 'compare-systems',
    category: 'Tool',
    title: 'Compare booking systems on your terms',
    imageSrc: '/demo/gallery/hairline.webp',
    imageAlt: '',
    href: '/compare',
  },
] as const;

const LATEST_IMAGE_ALT: Record<string, string> = {
  [INSIGHTS_DECEMBER_HOURS.slug]: 'Empty vintage barbershop with chairs, mirrors and brick walls',
  [INSIGHTS_HAIRCUT_PRICING.slug]: 'Vintage barber chairs and mirrors in an old-fashioned barbershop',
  [INSIGHTS_GOOGLE_REVIEWS.slug]: 'Barbers working in a barbershop in Aldershot, UK',
  'get-more-barbershop-clients-locally-uk':
    'Empty barbershop with vintage leather barber chairs and mirrors',
  'barbershop-card-payment-fees-uk':
    'Original KERSIVO Insights editorial illustration of a 20p fixed card processing fee',
  'barbershop-gift-vouchers-uk': 'Original KERSIVO editorial artwork of a fictional gift voucher',
};

const LATEST_READ_MINUTES: Record<string, number> = {
  [INSIGHTS_DECEMBER_HOURS.slug]: 9,
  [INSIGHTS_HAIRCUT_PRICING.slug]: 10,
  [INSIGHTS_GOOGLE_REVIEWS.slug]: 12,
  'get-more-barbershop-clients-locally-uk': 10,
  'barbershop-card-payment-fees-uk': 9,
  'barbershop-gift-vouchers-uk': 10,
};

/** Latest Thinking — derived only from the published Insights registry. */
export const INSIGHTS_HOME_LATEST = INSIGHTS_PUBLISHED_ARTICLES.map((article) => ({
  id: article.slug,
  category: getInsightsArticleCategoryLabel(article),
  format: 'Guide' as const,
  title: article.headline,
  excerpt: article.lead,
  readMinutes: LATEST_READ_MINUTES[article.slug] ?? 10,
  imageSrc: article.heroImage,
  imageAlt: LATEST_IMAGE_ALT[article.slug] ?? '',
  href: article.path,
}));
