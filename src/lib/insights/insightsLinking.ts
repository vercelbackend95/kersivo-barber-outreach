/**
 * Controlled Insights linking — related reading and commercial next steps.
 * Only published Insights URLs and verified marketing destinations appear here.
 */
import {
  INSIGHTS_CARD_FEES,
  INSIGHTS_OWNER_EARNINGS,
  INSIGHTS_UNFAIR_DISMISSAL,
  INSIGHTS_APPRENTICE_BARBER,
  INSIGHTS_BUSINESS_RATES,
  INSIGHTS_LOYALTY_SCHEMES,
  INSIGHTS_BUSY_DIARY,
  INSIGHTS_WALK_INS,
  INSIGHTS_BOOKING_LINK,
  INSIGHTS_WEBSITE_NEED,
  INSIGHTS_COMMISSION_PAY,
  INSIGHTS_SECOND_VISIT,
  INSIGHTS_BARBERS_HANDS,
  INSIGHTS_DECEMBER_HOURS,
  INSIGHTS_HAIRCUT_PRICING,
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
  [INSIGHTS_OWNER_EARNINGS.slug]: [
    {
      href: INSIGHTS_BUSY_DIARY.path,
      label: 'Why a full barbershop diary can still mean low profit',
      kind: 'article',
    },
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'Price haircuts with your real operating costs',
      kind: 'article',
    },
    {
      href: '/barber-software-cost-calculator',
      label: 'Compare the costs of booking software',
      kind: 'tool',
    },
  ],
  [INSIGHTS_UNFAIR_DISMISSAL.slug]: [
    {
      href: INSIGHTS_APPRENTICE_BARBER.path,
      label: 'The cost of employing an apprentice barber in England',
      kind: 'article',
    },
    {
      href: INSIGHTS_COMMISSION_PAY.path,
      label: 'Commission pay and minimum wage for barbers',
      kind: 'article',
    },
    {
      href: '/barbershop-websites',
      label: 'Explore a branded website for your barbershop',
      kind: 'guide',
    },
  ],
  [INSIGHTS_APPRENTICE_BARBER.slug]: [
    {
      href: INSIGHTS_COMMISSION_PAY.path,
      label: 'Commission pay and minimum wage in a barbershop',
      kind: 'article',
    },
    {
      href: INSIGHTS_BUSY_DIARY.path,
      label: 'Why a busy diary may not mean more shop profit',
      kind: 'article',
    },
    {
      href: '/barbershop-websites',
      label: 'Explore a branded website for your shop',
      kind: 'guide',
    },
  ],
  [INSIGHTS_BUSINESS_RATES.slug]: [
    {
      href: INSIGHTS_BUSY_DIARY.path,
      label: 'What full appointment diaries hide about shop profits',
      kind: 'article',
    },
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'How to price a haircut from real costs',
      kind: 'article',
    },
    {
      href: '/barbershop-websites',
      label: 'Explore independent barbershop websites',
      kind: 'guide',
    },
  ],
  [INSIGHTS_LOYALTY_SCHEMES.slug]: [
    {
      href: INSIGHTS_SECOND_VISIT.path,
      label: 'Why the second visit is the real test of retention',
      kind: 'article',
    },
    {
      href: INSIGHTS_LOCAL_CLIENTS.path,
      label: 'How to find clients locally without overpaying',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'Build a clearer online booking journey for your shop',
      kind: 'guide',
    },
  ],
  [INSIGHTS_BUSY_DIARY.slug]: [
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'Price each haircut from your real cost floor',
      kind: 'article',
    },
    {
      href: INSIGHTS_WALK_INS.path,
      label: 'Walk-ins or appointments: what your queue is telling you',
      kind: 'article',
    },
    {
      href: '/barber-software-cost-calculator',
      label: 'Compare your booking software overhead',
      kind: 'tool',
    },
  ],
  [INSIGHTS_WALK_INS.slug]: [
    {
      href: INSIGHTS_BOOKING_LINK.path,
      label: 'Where does your Google booking button send people?',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'How online booking works for barbershops',
      kind: 'guide',
    },
    {
      href: INSIGHTS_SECOND_VISIT.path,
      label: 'Why the second visit matters to a barbershop',
      kind: 'article',
    },
  ],
  [INSIGHTS_BOOKING_LINK.slug]: [
    {
      href: INSIGHTS_WEBSITE_NEED.path,
      label: 'Does your barbershop actually need a website?',
      kind: 'article',
    },
    {
      href: INSIGHTS_GOOGLE_REVIEWS.path,
      label: 'Google Reviews for barbershops: what UK rules allow',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'Explore online booking for independent barbershops',
      kind: 'guide',
    },
  ],
  [INSIGHTS_WEBSITE_NEED.slug]: [
    {
      href: INSIGHTS_GOOGLE_REVIEWS.path,
      label: 'What UK barbershops should know about Google Reviews',
      kind: 'article',
    },
    {
      href: INSIGHTS_LOCAL_CLIENTS.path,
      label: 'A practical guide to winning more local barbershop clients',
      kind: 'article',
    },
    {
      href: '/barbershop-websites',
      label: 'Explore what a barbershop website should include',
      kind: 'guide',
    },
  ],
  [INSIGHTS_COMMISSION_PAY.slug]: [
    {
      href: INSIGHTS_BARBERS_HANDS.path,
      label: "Barbers' hands: protecting the people behind every haircut",
      kind: 'article',
    },
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'Find the real cost floor behind your haircut prices',
      kind: 'article',
    },
  ],
  [INSIGHTS_SECOND_VISIT.slug]: [
    {
      href: INSIGHTS_LOCAL_CLIENTS.path,
      label: 'The real cost of finding new local barbershop clients',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'How barbershop online booking works',
      kind: 'guide',
    },
  ],
  [INSIGHTS_BARBERS_HANDS.slug]: [
    {
      href: INSIGHTS_COMMISSION_PAY.path,
      label: 'Commission pay and the minimum wage for employed barbers',
      kind: 'article',
    },
    {
      href: INSIGHTS_DECEMBER_HOURS.path,
      label: "Working longer hours? Run the extra-hour test before changing shifts",
      kind: 'article',
    },
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'Understand the business costs behind each haircut',
      kind: 'article',
    },
  ],
  [INSIGHTS_DECEMBER_HOURS.slug]: [
    {
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'How to price a haircut using your real costs',
      kind: 'article',
    },
    {
      href: '/barbershop-online-booking',
      label: 'Online booking for barbershops',
      kind: 'guide',
    },
  ],
  [INSIGHTS_HAIRCUT_PRICING.slug]: [
    {
      href: INSIGHTS_DECEMBER_HOURS.path,
      label: 'When does an extra hour of opening pay?',
      kind: 'article',
    },
    {
      href: INSIGHTS_GIFT_VOUCHERS.path,
      label: 'Gift vouchers: cash today, a haircut later',
      kind: 'article',
    },
    {
      href: '/barber-software-cost-calculator',
      label: 'Calculate your booking software overhead',
      kind: 'tool',
    },
  ],
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
      href: INSIGHTS_SECOND_VISIT.path,
      label: 'Why the second haircut matters more than the first',
      kind: 'article',
    },
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
      href: INSIGHTS_HAIRCUT_PRICING.path,
      label: 'How to price a haircut using your cost floor',
      kind: 'article',
    },
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
  [INSIGHTS_SECOND_VISIT.slug]: {
    href: '/barbershop-online-booking',
    label: 'Explore barbershop online booking',
    note: 'A booking system can help record appointments and client history; retention outcomes depend on the shop and clients.',
  },
  [INSIGHTS_DECEMBER_HOURS.slug]: {
    href: '/barbershop-online-booking',
    label: 'Explore how online booking works for barbershops',
    note: 'Read about the booking journey when planning seasonal opening hours; this does not claim that longer opening is more profitable.',
  },
  [INSIGHTS_HAIRCUT_PRICING.slug]: {
    href: '/barber-software-cost-calculator',
    label: 'Check one component of your shop overhead: booking software',
    note: 'Software cost is only one input in haircut pricing. Use your own full shop costs when making pricing decisions.',
  },
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
