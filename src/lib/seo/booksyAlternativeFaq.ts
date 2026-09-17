import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import {
  BOOKSY_ADDITIONAL_USER_LABEL,
  BOOKSY_BASE_PRICE_LABEL,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_BOOST_COMMISSION_PERCENT,
} from '@/lib/seo/booksyFacts';

export type BooksyAlternativeFaqItem = {
  question: string;
  answer: string;
};

export const BOOKSY_ALTERNATIVE_PAGE_PATH = '/booksy-alternative';

export const BOOKSY_ALTERNATIVE_TITLE = 'Booksy Alternative for UK Barbers | KERSIVO';

export const BOOKSY_ALTERNATIVE_DESCRIPTION =
  'Looking for a Booksy alternative for your barbershop? Compare KERSIVO and Booksy across branding, pricing, bookings, marketplace discovery and client experience.';

export const BOOKSY_ALTERNATIVE_H1 =
  'A Booksy Alternative Built Around Your Barbershop';

export const BOOKSY_ALTERNATIVE_FAQ_ITEMS: BooksyAlternativeFaqItem[] = [
  {
    question: 'Is KERSIVO cheaper than Booksy?',
    answer: `KERSIVO costs £${SAAS_MONTHLY_GBP}/month for one barbershop location. Booksy currently lists its UK subscription at ${BOOKSY_BASE_PRICE_LABEL}, plus ${BOOKSY_ADDITIONAL_USER_LABEL} for each additional user. The total cost of either platform depends on how you use it, including payment processing and optional features.`,
  },
  {
    question: 'Does KERSIVO have a marketplace?',
    answer:
      'No. KERSIVO is designed around your own barbershop website, domain and booking journey rather than a consumer marketplace. If marketplace discovery is important to your growth strategy, Booksy may be a better fit.',
  },
  {
    question: 'Can I move my clients from Booksy to KERSIVO?',
    answer:
      'KERSIVO can help migrate usable business data available from your current booking system, including supported exports. The exact data that can be moved depends on what Booksy makes available and the quality and completeness of the export.',
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      'KERSIVO charges 0% commission on bookings and retail sales. Standard Stripe processing fees still apply where payments are processed.',
  },
  {
    question: 'Does Booksy charge commission on bookings?',
    answer: `Booksy states that standard Marketplace bookings are free when Boost is not enabled. Its optional Boost feature currently charges a one-time ${BOOKSY_BOOST_COMMISSION_PERCENT}% fee, with a £${BOOKSY_BOOST_MINIMUM_GBP} minimum, when Boost brings a new client for their first visit.`,
  },
  {
    question: 'Can I use my own domain with KERSIVO?',
    answer:
      'Yes. One standard domain is included with each KERSIVO location plan.',
  },
  {
    question: 'Does KERSIVO support deposits?',
    answer:
      'Yes. A barbershop can enable an optional £5 booking deposit. The deposit forms part of the final service price, and standard Stripe processing fees apply.',
  },
  {
    question: 'Do customers need to download an app to book with KERSIVO?',
    answer:
      'No. Customers can book through the barbershop’s web booking experience.',
  },
  {
    question: 'Can I keep Booksy running while KERSIVO is being prepared?',
    answer:
      'Yes. Your existing setup can remain live while KERSIVO is prepared where technically possible. You review the new setup before the switch is made.',
  },
];

export function buildBooksyAlternativeFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${BOOKSY_ALTERNATIVE_PAGE_PATH}#faq`,
    mainEntity: BOOKSY_ALTERNATIVE_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
