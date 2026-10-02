import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  BOOKSY_FACTS_CHECKED_DATE,
  estimateBooksyMonthlySubscription,
  formatBooksyRate,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import { formatGbp, formatPercent } from '@/lib/seo/freshaFacts';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export type BooksyAlternativeFaqItem = {
  question: string;
  answer: string;
};

export const BOOKSY_ALTERNATIVE_PAGE_PATH = '/booksy-alternative';

export const BOOKSY_ALTERNATIVE_TITLE = 'Booksy Alternative for UK Barbers | KERSIVO';

export const BOOKSY_ALTERNATIVE_DESCRIPTION =
  'Looking for a Booksy alternative in the UK? Compare KERSIVO and Booksy pricing, Boost fees, branding, bookings and switching for independent barbershops.';

/** Visual line breaks of the hero H1; joined with spaces they form the exact H1 text. */
export const BOOKSY_ALTERNATIVE_H1_LINES = [
  'A Booksy Alternative',
  'Built Around Your',
  'Barbershop',
] as const;

export const BOOKSY_ALTERNATIVE_H1 = BOOKSY_ALTERNATIVE_H1_LINES.join(' ');

/** Visible "Last updated" date on the page; also used for sitemap lastmod and WebPage dateModified. */
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-02';
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL = '2 October 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const base = requireVerifiedBooksyFact('baseSubscription');
const additionalUser = requireVerifiedBooksyFact('additionalUser');
const boostFee = requireVerifiedBooksyFact('boostNewClientFee');
const mobilePayments = requireVerifiedBooksyFact('mobilePayments');
const tapToPay = requireVerifiedBooksyFact('tapToPay');
const BOOST_PERCENT = formatPercent(boostFee.percent!);
const BOOST_MINIMUM = formatGbp(boostFee.minimumGbp!);
const solo = estimateBooksyMonthlySubscription(1);
const fiveUsers = estimateBooksyMonthlySubscription(5);

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const BOOKSY_ALTERNATIVE_FAQ_ITEMS: BooksyAlternativeFaqItem[] = [
  {
    question: 'What is a good Booksy alternative for UK barbers?',
    answer:
      'It depends on how your shop wins clients. KERSIVO may be a good Booksy alternative for independent UK barbershops that want their own brand, their own domain and a direct booking journey: it combines a branded barbershop website with online booking, optional deposits, client management and retail pickup. If Booksy Marketplace discovery is central to how you grow, Booksy’s model may suit you better.',
  },
  {
    question: 'How much does Booksy cost in the UK?',
    answer: `Booksy lists its UK subscription at ${formatGbp(base.amountGbp!)}/month plus VAT, with ${formatGbp(additionalUser.amountGbp!)}/month plus VAT for each additional user. Standard Marketplace bookings are free when Boost is not enabled. Optional Boost charges a one-time ${BOOST_PERCENT} fee (minimum ${BOOST_MINIMUM}, plus VAT) on a qualifying new client’s first visit. Card payments cost ${formatBooksyRate(mobilePayments)} plus VAT through Mobile Payments, or ${formatBooksyRate(tapToPay)} plus VAT with Tap to Pay. Checked against Booksy’s UK pricing page on ${BOOKSY_FACTS_CHECKED_DATE}.`,
  },
  {
    question: 'How does Booksy Boost work?',
    answer: `Boost is an optional Booksy marketing feature that gives your profile more visibility on the Booksy Marketplace and in the Booksy for Customers app. It is free to turn on with no monthly fee. When Boost brings you a brand-new client, Booksy charges a one-time ${BOOST_PERCENT} of that first visit, with a ${BOOST_MINIMUM} minimum, plus VAT. Later visits from that client carry no commission, and clients who book through your own Profile link, social buttons, Google or QR codes are not charged a Boost fee.`,
  },
  {
    question: 'Is KERSIVO cheaper than Booksy?',
    answer: `On subscription alone, KERSIVO is ${KERSIVO_PRICE}/month per location. Booksy is ${formatGbp(solo.exVatGbp)}/month plus VAT for one user and ${formatGbp(fiveUsers.exVatGbp)}/month plus VAT for five users. The full cost also depends on whether you use Booksy Boost and how you take card payments — payment-processing fees apply on either platform, and KERSIVO uses Stripe. KERSIVO charges 0% commission on bookings and retail sales.`,
  },
  {
    question: 'Does KERSIVO charge per barber?',
    answer: `No. KERSIVO is ${KERSIVO_PRICE}/month per physical location, with unlimited barbers within that location, subject to reasonable fair use.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      'KERSIVO takes 0% commission on bookings and retail sales. The platform is built around a simple monthly subscription for one barbershop location. Standard Stripe processing fees still apply where payments are processed.',
  },
  {
    question: 'Can I move my clients from Booksy to KERSIVO?',
    answer:
      'Yes, where the data is available. Booksy’s UK Help Centre says you can request a copy of your client list, with contact details, from Booksy Support. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. What can be moved depends on what Booksy provides and how complete it is.',
  },
  {
    question: 'Can I keep Booksy running while KERSIVO is set up?',
    answer:
      'Yes. Keep Booksy live while your KERSIVO setup is prepared. You review a private preview first, and your public booking links and domain routing are only switched once you approve.',
  },
  {
    question: 'Do clients need to download an app to book?',
    answer:
      'No. KERSIVO clients book through your own branded website and booking journey without downloading a customer app.',
  },
  {
    question: 'Does KERSIVO have a marketplace like Booksy?',
    answer:
      'No. KERSIVO does not run a consumer marketplace. It is built around your own website, domain and booking journey, which suits shops whose clients already find them through Google, Instagram, referrals or walk-ins. If you rely on the Booksy Marketplace for new clients, that is worth weighing up.',
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
