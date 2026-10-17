/**
 * Controlled Insights linking — related reading and commercial next steps.
 * Only published Insights URLs and verified marketing destinations appear here.
 */
import {
  INSIGHTS_CARD_FEES,
  INSIGHTS_GIFT_VOUCHERS,
  INSIGHTS_GOOGLE_REVIEWS,
  INSIGHTS_LOCAL_CLIENTS,
  type InsightsPublishedArticle,
} from '@/lib/seo/insights';

export type InsightsRelatedLink = {
  href: string;
  label: string;
  kind: 'article' | 'tool' | 'guide';
};

/** Soft commercial next step — one per article, never a product claim. */
export type InsightsCommercialNext = {
  href: string;
  label: string;
  note: string;
};

const RELATED: Record<string, InsightsRelatedLink[]> = {
  [INSIGHTS_GOOGLE_REVIEWS.slug]: [
    {
      href: INSIGHTS_LOCAL_CLIENTS.path,
      label: 'How to get more barbershop clients locally',
      kind: 'article',
    },
    {
      href: '/barbershop-websites',
      label: 'What a barbershop website should do',
      kind: 'guide',
    },
  ],
  [INSIGHTS_LOCAL_CLIENTS.slug]: [
    {
      href: INSIGHTS_GOOGLE_REVIEWS.path,
      label: 'Google Reviews rules for UK barbershops',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'Online booking for barbershops',
      kind: 'guide',
    },
    {
      href: '/barbershop-website-design',
      label: 'Barbershop website design that earns trust',
      kind: 'guide',
    },
  ],
  [INSIGHTS_CARD_FEES.slug]: [
    {
      href: '/barber-software-cost-calculator',
      label: 'Barber software cost calculator',
      kind: 'tool',
    },
    {
      href: INSIGHTS_GIFT_VOUCHERS.path,
      label: 'Gift vouchers: cash now, haircut later',
      kind: 'article',
    },
  ],
  [INSIGHTS_GIFT_VOUCHERS.slug]: [
    {
      href: INSIGHTS_CARD_FEES.path,
      label: 'How card fees really work for a barbershop',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'Online booking for barbershops',
      kind: 'guide',
    },
  ],
};

const COMMERCIAL: Record<string, InsightsCommercialNext> = {
  [INSIGHTS_GOOGLE_REVIEWS.slug]: {
    href: '/barbershop-websites',
    label: 'See how KERSIVO websites present a shop',
    note: 'Editorial next step — not a claim that reviews increase bookings.',
  },
  [INSIGHTS_LOCAL_CLIENTS.slug]: {
    href: '/barbershop-online-booking',
    label: 'Read how online booking fits a high-street shop',
    note: 'Useful when the article’s findability gap is “they found you, then couldn’t book”.',
  },
  [INSIGHTS_CARD_FEES.slug]: {
    href: '/barber-software-cost-calculator',
    label: 'Compare software subscription costs separately from card fees',
    note: 'KERSIVO platform pricing is not Stripe processing. Card fees are charged by the payment provider.',
  },
  [INSIGHTS_GIFT_VOUCHERS.slug]: {
    href: '/pricing',
    label: 'See current KERSIVO plans',
    note: 'KERSIVO does not sell gift vouchers as a product feature in this article — this is a general business guide.',
  },
};

export function getInsightsRelatedLinks(slug: string): InsightsRelatedLink[] {
  return RELATED[slug] ?? [];
}

export function getInsightsCommercialNext(slug: string): InsightsCommercialNext | undefined {
  return COMMERCIAL[slug];
}

export function getInsightsRelatedArticles(
  slug: string,
  published: readonly InsightsPublishedArticle[],
): InsightsPublishedArticle[] {
  const links = getInsightsRelatedLinks(slug).filter((link) => link.kind === 'article');
  return links
    .map((link) => published.find((article) => article.path === link.href))
    .filter((article): article is InsightsPublishedArticle => Boolean(article));
}
