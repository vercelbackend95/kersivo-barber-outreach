import { DATA_EXPORT_RETENTION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  BOOKSY_FACTS_CHECKED_DATE,
  estimateBooksyMonthlySubscription,
  formatBooksyRate,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import {
  FRESHA_FACTS_CHECKED_DATE,
  estimateFreshaMonthlySubscription,
  formatGbp,
  formatPercent,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';

export const ALTERNATIVES_HUB_PAGE_PATH = '/compare';

export const ALTERNATIVES_HUB_TITLE = 'Best Barber Booking Software UK: 11 Systems Compared';

export const ALTERNATIVES_HUB_DESCRIPTION =
  'Compare 11 barber booking systems for UK barbershops, including Booksy, Fresha, Nearcut and KERSIVO: pricing, deposits, own websites and booking fees.';

export const ALTERNATIVES_HUB_H1_LEAD = 'Find the right';
export const ALTERNATIVES_HUB_H1_ACCENT = 'barber booking system';
export const ALTERNATIVES_HUB_H1 = `${ALTERNATIVES_HUB_H1_LEAD} ${ALTERNATIVES_HUB_H1_ACCENT}`;

/** Three-sentence direct answer shown under the H1. */
export const ALTERNATIVES_HUB_DIRECT_ANSWER =
  "There's no single best system for every UK barbershop. If marketplace discovery brings you most new clients, Booksy, Fresha or Treatwell may suit you. If you want clients to book on your own website and domain for one flat price per location, that's what Full KERSIVO is built for.";

/** Genuine content date for the hub; never derived from build time. */
export const ALTERNATIVES_HUB_LAST_UPDATED_ISO = '2026-10-28';
export const ALTERNATIVES_HUB_LAST_UPDATED_LABEL = '28 October 2026';

export type AlternativesHubFaqItem = { question: string; answer: string };

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

/** First sentence of the approved KERSIVO export claim (free CSV export and its fields). */
const DATA_EXPORT_SUMMARY = `${DATA_EXPORT_RETENTION_CLAIM.split('. ')[0].replace(/^You may/, 'With KERSIVO you may')}.`;

const EXAMPLE_TEAM_SIZE = 5;
const booksyBase = requireVerifiedBooksyFact('baseSubscription');
const booksyUser = requireVerifiedBooksyFact('additionalUser');
const booksyBoost = requireVerifiedBooksyFact('boostNewClientFee');
const booksyPayments = requireVerifiedBooksyFact('mobilePayments');
const booksyTeam = estimateBooksyMonthlySubscription(EXAMPLE_TEAM_SIZE);
const freshaIndependent = requireVerifiedFreshaFact('independentPlan');
const freshaMember = requireVerifiedFreshaFact('teamPlanPerMember');
const freshaMarketplace = requireVerifiedFreshaFact('marketplaceNewClientFee');
const freshaPayments = requireVerifiedFreshaFact('onlinePayments');
const freshaTeam = estimateFreshaMonthlySubscription(EXAMPLE_TEAM_SIZE);

/** Neutral Booksy-vs-Fresha answer; every figure comes from booksyFacts.ts and freshaFacts.ts. */
const BOOKSY_OR_FRESHA_ANSWER = [
  'Neither is better for every barbershop: it depends on your team size and where your new clients come from.',
  `On subscription alone, Booksy lists ${formatGbp(booksyBase.amountGbp!)}/month plus VAT, with ${formatGbp(booksyUser.amountGbp!)}/month plus VAT for each additional user, so a ${EXAMPLE_TEAM_SIZE}-person team pays ${formatGbp(booksyTeam.exVatGbp)} plus VAT.`,
  `Fresha lists ${formatGbp(freshaIndependent.amountGbp!)}/month plus VAT for one bookable team member, or ${formatGbp(freshaMember.amountGbp!)} per bookable team member per month plus VAT on its Team plan, which is ${formatGbp(freshaTeam.exVatGbp)} plus VAT for ${EXAMPLE_TEAM_SIZE}.`,
  `Both can charge a one-time fee for a new client they bring you: Fresha charges ${formatPercent(freshaMarketplace.percent!)} (minimum ${formatGbp(freshaMarketplace.minimumGbp!)}, plus VAT) on a brand-new Marketplace client, while Booksy charges ${formatPercent(booksyBoost.percent!)} (minimum ${formatGbp(booksyBoost.minimumGbp!)}, plus VAT) only when its optional Boost is switched on.`,
  `Online card payments cost ${formatBooksyRate(booksyPayments)} plus VAT with Booksy Mobile Payments and ${formatPercent(freshaPayments.percent!)} + ${formatGbp(freshaPayments.amountGbp!)} plus VAT with Fresha.`,
  `Booksy figures were checked on its UK pricing pages on ${BOOKSY_FACTS_CHECKED_DATE} and Fresha figures on ${FRESHA_FACTS_CHECKED_DATE}; check both providers for current terms.`,
].join(' ');

/** Visible FAQ and FAQPage JSON-LD both render from this list - never add schema-only items. */
export const ALTERNATIVES_HUB_FAQ_ITEMS: AlternativesHubFaqItem[] = [
  {
    question: 'What should UK barbers look for in booking software?',
    answer:
      'Start with total monthly cost for your team size, then check commissions on bookings, card-processing rates, deposits and no-show protection, whether bookings live on your own website and domain, how easily you can export client data, and what help you get when switching. A barbershop-specific workflow and SMS reminders also matter for day-to-day running.',
  },
  {
    question: 'Booksy or Fresha: which is better for a barbershop?',
    answer: BOOKSY_OR_FRESHA_ANSWER,
  },
  {
    question: 'Does 0% commission mean no payment-processing fees?',
    answer: `No. 0% commission means the platform takes no percentage of your bookings. Card payment-processing fees are separate and charged by the payment provider. KERSIVO takes 0% commission on Starter and Full KERSIVO. ${STRIPE_FEES_NOTE} Some marketplaces also charge a one-time commission when they bring you a new client.`,
  },
  {
    question: 'Can I use my own domain for online bookings?',
    answer: `With Full KERSIVO (${PRICE}/month per location) your branded barbershop website and one standard domain are included. Many other platforms offer a booking widget, profile page or paid website add-on instead; check each provider’s current terms for whether a custom domain is included.`,
  },
  {
    question: 'Which booking systems support larger barber teams?',
    answer:
      'Most established platforms support multiple staff, but pricing differs: some charge per team member or calendar, others per location. Full KERSIVO is priced per location and supports more than 4 bookable barbers subject to reasonable fair use; KERSIVO Starter supports up to 4 active bookable barbers.',
  },
  {
    question: 'What should I check before switching from Booksy or Fresha?',
    answer:
      'Check your notice period and any outstanding contract terms, export your client list and future appointments, note any deposits or prepaid packages in progress, and plan how you will tell regular clients about your new booking link. Keep your existing system live until your new booking page is ready.',
  },
  {
    question: 'Can I move my client data to another booking platform?',
    answer: `Most platforms document some form of client export, but formats and processes differ — some are self-serve CSV or Excel exports, others are requested through support. ${DATA_EXPORT_SUMMARY} Full KERSIVO includes migration assistance from your current booking system.`,
  },
];
