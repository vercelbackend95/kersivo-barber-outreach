import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
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

/** Search title: the query first, then the two things a Booksy user is weighing (own site, flat price). */
export const BOOKSY_ALTERNATIVE_TITLE = `Booksy Alternative UK for Barbers: Own Site, £${SAAS_MONTHLY_GBP}/Month`;

export const BOOKSY_ALTERNATIVE_DESCRIPTION = `Leaving Booksy? Your own site and domain, £${SAAS_MONTHLY_GBP}/month per location, no per-barber fees, help moving clients, 0% KERSIVO commission (Stripe fees apply).`;

/** Visual line breaks of the hero H1; joined with spaces they form the exact H1 text. */
export const BOOKSY_ALTERNATIVE_H1_LINES = [
  'The Booksy alternative',
  'with your name',
  'on the door',
] as const;

export const BOOKSY_ALTERNATIVE_H1 = BOOKSY_ALTERNATIVE_H1_LINES.join(' ');

/** Visible "Last updated" date on the page; also used for sitemap lastmod and WebPage dateModified. */
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_ISO = '2026-11-14';
export const BOOKSY_ALTERNATIVE_LAST_UPDATED_LABEL = '14 November 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
const STARTER_MAX_BARBERS = 4;
const STARTER_DEPOSIT_PRICE = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
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
      `It depends on how your shop wins clients. KERSIVO may be a good Booksy alternative for independent UK barbershops that want clients to book them directly. Full KERSIVO is ${KERSIVO_PRICE}/month per location and gives you a branded website on your own domain, editable payment controls, Advanced Clients, Reports, Retail pickup, SMS reminders within a monthly allowance and the KERSIVO Assistant, an AI helper for guidance on using KERSIVO and running your shop. KERSIVO Starter (${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers) is a hosted booking page where public bookings use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full. If Booksy Marketplace discovery is central to how you grow, Booksy’s model may suit you better.`,
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
    answer: `On subscription alone, Full KERSIVO is ${KERSIVO_PRICE}/month per location and KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers. Booksy is ${formatGbp(solo.exVatGbp)}/month plus VAT for one user and ${formatGbp(fiveUsers.exVatGbp)}/month plus VAT for five users. The full cost also depends on whether you use Booksy Boost and how you take card payments — payment-processing fees apply on either platform, and KERSIVO uses Stripe. KERSIVO charges 0% commission on booking payments, and on retail sales with Full.`,
  },
  {
    question: 'Does KERSIVO charge per barber?',
    answer: `No. Full KERSIVO is ${KERSIVO_PRICE}/month per physical location, with unlimited barbers within that location, subject to reasonable fair use. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers at one location.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      `No. KERSIVO takes 0% commission on booking payments on both Full KERSIVO (${KERSIVO_PRICE}/month per location) and KERSIVO Starter (${STARTER_PRICE}/month), and 0% on Full retail sales. Standard Stripe processing fees still apply. Starter public bookings require a connected Stripe account and use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full.`,
  },
  {
    question: 'Can I move my clients from Booksy to KERSIVO?',
    answer:
      'Yes, where the data is available. Booksy’s UK Help Centre says you can request a copy of your client list, with contact details, from Booksy Support. Migration help is included in Full KERSIVO: we review what Booksy sends, including supported CSV exports, and map the usable details into your KERSIVO client list. What can be moved depends on what Booksy provides and how complete it is. Saved payment-card data is not part of the standard migration.',
  },
  {
    question: 'Can I keep Booksy running while KERSIVO is set up?',
    answer:
      'Yes. Keep Booksy live while your KERSIVO setup is prepared. You review a private preview first, and your public booking links (and, on Full, your domain routing) are only switched once you approve.',
  },
  {
    question: 'How long does it take to switch from Booksy?',
    answer:
      'Your KERSIVO setup is typically ready in a few days once we receive all required information. Timing depends on how complete your details are, the quality of the client list Booksy provides and domain access. Booksy keeps taking bookings until you approve the switch.',
  },
  {
    question: 'Can I use my own domain instead of a Booksy link?',
    answer:
      'Yes, on Full KERSIVO, which includes one standard domain per location. If you already own a domain, you keep ownership and we help with the DNS records. If you need a new one, KERSIVO may register it on behalf of your business; legal ownership stays with your business and the domain can be transferred to you when the engagement ends. KERSIVO Starter uses a hosted KERSIVO booking page instead.',
  },
  {
    question: 'Can clients book Booksy without the app?',
    answer: `Yes. Booksy’s UK Help Centre covers booking without the Booksy for Customers app, and Booksy lists booking through your Booksy Profile and direct booking link, Instagram and Facebook buttons, Reserve with Google and a widget on your own website. The customer app and Marketplace are still part of how Booksy presents your business. Checked against Booksy’s UK pages on ${BOOKSY_FACTS_CHECKED_DATE}.`,
  },
  {
    question: 'Do clients need to download an app to book with KERSIVO?',
    answer:
      'No. KERSIVO has no customer app: clients book in the browser, on your own branded website with Full KERSIVO or a hosted KERSIVO booking page on Starter, so there is nothing to download. The trade-off is that there is no KERSIVO app or marketplace where new clients can discover your shop.',
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
