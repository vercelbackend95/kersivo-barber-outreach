/**
 * Public Insights homepage composition (magazine layout).
 * Only published registry articles and real product URLs appear as links.
 */
import {
  GATE1_FEATURE_VERTICAL,
  GATE1_MASTHEAD,
  GATE1_OWNERS_DESK,
  GATE1_TOPICS,
} from '@/lib/insights/gate1Preview';
import { INSIGHTS_GOOGLE_REVIEWS } from '@/lib/seo/insights';

const reviews = INSIGHTS_GOOGLE_REVIEWS;

export const INSIGHTS_HOME_MASTHEAD = GATE1_MASTHEAD;

export const INSIGHTS_HOME_TOPICS = GATE1_TOPICS;

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

/** Latest Thinking — published articles only. */
export const INSIGHTS_HOME_LATEST = [
  {
    id: reviews.slug,
    category: reviews.category,
    format: 'Guide',
    title: reviews.headline,
    excerpt: reviews.lead,
    readMinutes: 12,
    imageSrc: reviews.heroImage,
    imageAlt: 'Barbers working in a barbershop in Aldershot, UK',
    href: reviews.path,
  },
] as const;
