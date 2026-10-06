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

export const BOOKSY_ALTERNATIVE_TITLE = 'Booksy Alternative for UK Barbershops | KERSIVO';

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
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-06';
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL = '6 October 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
const STARTER_MAX_BARBERS = 4;
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
      `It depends on how your shop wins clients. KERSIVO may be a good Booksy alternative for independent UK barbershops that want a more direct booking relationship: KERSIVO Starter (${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers) gives you a hosted booking page where public bookings use a £5 deposit or Pay in full, plus Clients Core and email reminders. Full KERSIVO adds your branded website and domain, editable payment controls, Advanced Clients, Reports, Retail pickup, SMS and the live Assistant. If Booksy Marketplace discovery is central to how you grow, Booksy’s model may suit you better.`,
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
    answer: `On subscription alone, KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers and Full KERSIVO is ${KERSIVO_PRICE}/month per location. Booksy is ${formatGbp(solo.exVatGbp)}/month plus VAT for one user and ${formatGbp(fiveUsers.exVatGbp)}/month plus VAT for five users. The full cost also depends on whether you use Booksy Boost and how you take card payments — payment-processing fees apply on either platform, and KERSIVO uses Stripe. KERSIVO charges 0% commission on booking payments, and on retail sales with Full.`,
  },
  {
    question: 'Does KERSIVO charge per barber?',
    answer: `No. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers at one location. Full KERSIVO is ${KERSIVO_PRICE}/month per physical location, with unlimited barbers within that location, subject to reasonable fair use.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      `No. KERSIVO takes 0% commission on booking payments on both KERSIVO Starter (${STARTER_PRICE}/month) and Full KERSIVO (${KERSIVO_PRICE}/month per location), and 0% on Full retail sales. Starter public bookings require a connected Stripe account and use a £5 deposit or Pay in full; standard Stripe processing fees still apply.`,
  },
  {
    question: 'Can I move my clients from Booksy to KERSIVO?',
    answer:
      'Yes, where the data is available. Booksy’s UK Help Centre says you can request a copy of your client list, with contact details, from Booksy Support. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. What can be moved depends on what Booksy provides and how complete it is.',
  },
  {
    question: 'Can I keep Booksy running while KERSIVO is set up?',
    answer:
      'Yes. Keep Booksy live while your KERSIVO setup is prepared. You review a private preview first, and your public booking links (and, on Full, your domain routing) are only switched once you approve.',
  },
  {
    question: 'Do clients need to download an app to book?',
    answer:
      'No. KERSIVO clients book in the browser without downloading a customer app: through a hosted KERSIVO booking page on Starter, or your own branded website on Full KERSIVO.',
  },
  {
    question: 'Does KERSIVO have a marketplace like Booksy?',
    answer:
      'No. KERSIVO does not run a consumer marketplace. It is built around your own booking journey (and, on Full KERSIVO, your own website and domain), which suits shops whose clients already find them through Google, Instagram, referrals or walk-ins. If you rely on the Booksy Marketplace for new clients, that is worth weighing up.',
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
