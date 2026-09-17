import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import {
  BOOKSY_ADDITIONAL_USER_LABEL,
  BOOKSY_BASE_PRICE_LABEL,
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
    question: 'Does KERSIVO charge commission?',
    answer: `No. KERSIVO charges 0% commission on bookings and retail sales. Your KERSIVO subscription is £${SAAS_MONTHLY_GBP}/month per barbershop location, so the KERSIVO platform fee does not increase just because you take more bookings or sell more products. Standard Stripe processing fees still apply where payments are processed.`,
  },
  {
    question: 'Does KERSIVO charge more for additional barbers?',
    answer:
      'There is no additional KERSIVO charge per barber within one barbershop location. The plan includes barber and dashboard-user access for that location, subject to reasonable fair use.',
  },
  {
    question: 'Is KERSIVO cheaper than Booksy?',
    answer: `KERSIVO costs £${SAAS_MONTHLY_GBP}/month per barbershop location and charges 0% KERSIVO commission on bookings and retail sales. Booksy currently lists its UK subscription at ${BOOKSY_BASE_PRICE_LABEL}, plus ${BOOKSY_ADDITIONAL_USER_LABEL} for each additional user. Optional Booksy features such as Boost can also introduce additional acquisition fees. The total cost depends on how each platform is used, and standard payment processing fees may still apply.`,
  },
  {
    question: 'Does KERSIVO have a marketplace?',
    answer:
      'No. KERSIVO is built around your own barbershop website, domain and booking journey rather than a consumer marketplace. If your clients already discover your business through Google, Instagram, referrals or your reputation, KERSIVO lets the booking experience stay centred on your brand.',
  },
  {
    question: `What is included in the £${SAAS_MONTHLY_GBP} KERSIVO plan?`,
    answer: `The £${SAAS_MONTHLY_GBP} monthly plan includes a branded barbershop website, one standard domain, online bookings, optional booking deposits, client management, barber and service management, automated appointment reminders, retail pickup, hosting, SSL, platform updates and migration assistance. KERSIVO charges 0% commission on bookings and retail sales. Standard Stripe processing fees apply where payments are processed.`,
  },
  {
    question: 'Can I move my clients from Booksy to KERSIVO?',
    answer:
      'KERSIVO can help migrate usable business data available from your current booking system, including supported exports. The exact data that can be moved depends on what Booksy makes available and the quality and completeness of the export.',
  },
  {
    question: 'Do customers need an app to book with KERSIVO?',
    answer:
      'No. Customers can book directly through the barbershop’s web booking experience on its own website.',
  },
  {
    question: 'Can I keep Booksy running while KERSIVO is being prepared?',
    answer:
      'Yes. Your existing booking setup can remain live while KERSIVO is prepared where technically possible. You review the new setup before the switch is made.',
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
