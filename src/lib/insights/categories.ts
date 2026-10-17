/**
 * Canonical KERSIVO Insights editorial taxonomy (six categories).
 * Display labels, paths and SEO copy derive from this file only.
 * Articles store categoryId — never a duplicated free-text category label.
 */

export const INSIGHTS_CATEGORY_IDS = [
  'business-profit',
  'clients-growth',
  'brand-marketing',
  'bookings-operations',
  'tools-payments',
  'industry-people',
] as const;

export type InsightsCategoryId = (typeof INSIGHTS_CATEGORY_IDS)[number];

export type InsightsCategoryIcon =
  | 'chart'
  | 'users'
  | 'megaphone'
  | 'calendar'
  | 'laptop'
  | 'culture';

export type InsightsCategory = {
  id: InsightsCategoryId;
  name: string;
  descriptor: string;
  path: `/insights/category/${InsightsCategoryId}`;
  icon: InsightsCategoryIcon;
  /** Short archive intro for owners — distinct per category. */
  intro: string;
  seoTitle: string;
  seoDescription: string;
  /**
   * Owner-approved indexability. All six category archives are intentionally
   * indexable, including archives with no published articles yet. Google
   * independently decides whether an indexable URL is worth indexing.
   */
  indexable: boolean;
  order: number;
};

export const INSIGHTS_CATEGORIES: readonly InsightsCategory[] = [
  {
    id: 'business-profit',
    name: 'Business & Profit',
    descriptor: 'Pricing · Revenue · Margins',
    path: '/insights/category/business-profit',
    icon: 'chart',
    intro:
      'Money decisions that decide whether the shop stays healthy: pricing, revenue, margins, VAT and the commercial trade-offs behind everyday offers.',
    seoTitle: 'Business & Profit for UK Barbershops | KERSIVO Insights',
    seoDescription:
      'Guides for UK barbershop owners on pricing, revenue, margins, VAT and the commercial decisions that shape a profitable shop.',
    indexable: true,
    order: 1,
  },
  {
    id: 'clients-growth',
    name: 'Clients & Growth',
    descriptor: 'Acquisition · Retention · Loyalty',
    path: '/insights/category/clients-growth',
    icon: 'users',
    intro:
      'How independent shops attract the next client, earn a second visit and build loyalty without chasing every new channel at once.',
    seoTitle: 'Clients & Growth for UK Barbershops | KERSIVO Insights',
    seoDescription:
      'Practical guidance for UK barbershop owners on client acquisition, retention, referrals and lifetime value.',
    indexable: true,
    order: 2,
  },
  {
    id: 'brand-marketing',
    name: 'Brand & Marketing',
    descriptor: 'Reputation · Google · Social',
    path: '/insights/category/brand-marketing',
    icon: 'megaphone',
    intro:
      'Reputation, local visibility and brand presence — from Google Reviews and Business Profile discipline to storytelling that fits an independent shop.',
    seoTitle: 'Brand & Marketing for UK Barbershops | KERSIVO Insights',
    seoDescription:
      'UK barbershop guidance on reputation, Google Reviews, local visibility, brand identity and marketing that stays credible.',
    indexable: true,
    order: 3,
  },
  {
    id: 'bookings-operations',
    name: 'Bookings & Operations',
    descriptor: 'Scheduling · No-shows · Teams',
    path: '/insights/category/bookings-operations',
    icon: 'calendar',
    intro:
      'The diary, the team and the policies that keep a busy floor running: appointments, no-shows, deposits and day-to-day shop operations.',
    seoTitle: 'Bookings & Operations for UK Barbershops | KERSIVO Insights',
    seoDescription:
      'Operational guides for UK barbershop owners on scheduling, no-shows, deposits, team availability and shop processes.',
    indexable: true,
    order: 4,
  },
  {
    id: 'tools-payments',
    name: 'Tools & Payments',
    descriptor: 'Software · Websites · Payments',
    path: '/insights/category/tools-payments',
    icon: 'laptop',
    intro:
      'The systems behind the chair: booking software, websites, payment processing and the real cost of digital tools — without confusing them with shop profit strategy.',
    seoTitle: 'Tools & Payments for UK Barbershops | KERSIVO Insights',
    seoDescription:
      'Guides for UK barbershop owners on booking software, websites, card fees and payment technology costs.',
    indexable: true,
    order: 5,
  },
  {
    id: 'industry-people',
    name: 'Industry & People',
    descriptor: 'Barbers · Trends · Culture',
    path: '/insights/category/industry-people',
    icon: 'culture',
    intro:
      'People, craft and culture across the UK barber industry — stories, careers and developments that sit outside pure shop operations.',
    seoTitle: 'Industry & People | KERSIVO Insights',
    seoDescription:
      'Perspectives on UK barber culture, careers, industry trends and the people behind independent shops.',
    indexable: true,
    order: 6,
  },
] as const;

const BY_ID = Object.fromEntries(INSIGHTS_CATEGORIES.map((category) => [category.id, category])) as Record<
  InsightsCategoryId,
  InsightsCategory
>;

export function isInsightsCategoryId(value: string): value is InsightsCategoryId {
  return (INSIGHTS_CATEGORY_IDS as readonly string[]).includes(value);
}

export function getInsightsCategory(id: InsightsCategoryId): InsightsCategory {
  return BY_ID[id];
}

export function requireInsightsCategoryId(value: string): InsightsCategoryId {
  if (!isInsightsCategoryId(value)) {
    throw new Error(`Unknown Insights categoryId: ${value}`);
  }
  return value;
}

export function getInsightsCategoryName(id: InsightsCategoryId): string {
  return getInsightsCategory(id).name;
}

/** Topic strip modules — order matches INSIGHTS_CATEGORIES. */
export function getInsightsTopicStripItems() {
  return INSIGHTS_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    descriptor: category.descriptor,
    icon: category.icon,
    href: category.path,
  }));
}

/** Category URLs approved for the marketing sitemap (explicit indexable gate). */
export function getIndexableInsightsCategorySitemapEntries(): Array<{ path: string; lastmod?: string }> {
  return INSIGHTS_CATEGORIES.filter((category) => category.indexable).map((category) => ({
    path: category.path,
  }));
}
