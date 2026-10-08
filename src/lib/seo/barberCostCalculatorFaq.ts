import { SQUARE_UK_PLANS } from '@/lib/seo/squareFacts';
import {
  BOOKSY_ADDITIONAL_USER_LABEL,
  BOOKSY_BASE_PRICE_LABEL,
  BOOKSY_PER_ADDITIONAL_USER_LABEL,
  BOOKSY_STANDARD_MARKETPLACE_BOOKINGS,
} from '@/lib/seo/booksyFacts';
import {
  BARBER_COST_CALCULATOR_PAGE_PATH,
  BOOKSY_BOOST_MINIMUM,
  BOOKSY_BOOST_PERCENT,
  FRESHA_INDEPENDENT_PRICE,
  FRESHA_MARKETPLACE_MINIMUM,
  FRESHA_MARKETPLACE_PERCENT,
  FRESHA_TEAM_PRICE,
} from '@/lib/seo/barberCostCalculatorPage';
import { FRESHA_UK_VAT_PERCENT, formatGbp } from '@/lib/seo/freshaFacts';
import { KERSIVO_BOOKING_DEPOSIT_GBP } from '@/lib/seo/defaults';
import { requireVerifiedTreatwellFact } from '@/lib/seo/treatwellFacts';
import { requireIllustrativeNearcutFact, requireVerifiedNearcutFact } from '@/lib/seo/nearcutFacts';
import { SETORA_FACTS_CHECKED_DATE, requireVerifiedSetoraFact } from '@/lib/seo/setoraFacts';
import { TIMELY_UK_DOMESTIC_ONLINE_PERCENT, TIMELY_UK_DOMESTIC_ONLINE_FIXED_GBP } from '@/lib/seo/timelyFacts';
import { requireVerifiedVagaroFact, estimateVagaroDisplayedSubscriptionGbp } from '@/lib/seo/vagaroFacts';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export type BarberCostCalculatorFaqItem = {
  question: string;
  answer: string;
};

const FRESHA_VAT = `${FRESHA_UK_VAT_PERCENT}% VAT`;
const DEPENDS_ON =
  'It depends on your team size, how many new clients come through each marketplace, which add-ons you use and how you take payments.';

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const BARBER_COST_CALCULATOR_FAQ_ITEMS: BarberCostCalculatorFaqItem[] = [
  {
    question: 'How much is Booksy a month?',
    answer: `Booksy’s UK base subscription is listed at ${BOOKSY_BASE_PRICE_LABEL}. Additional users are listed at ${BOOKSY_ADDITIONAL_USER_LABEL}, so the monthly cost can rise as staff users are added.`,
  },
  {
    question: 'How much does Booksy cost in the UK?',
    answer: `The subscription is ${BOOKSY_BASE_PRICE_LABEL}, with additional users at ${BOOKSY_ADDITIONAL_USER_LABEL}. On top of that, optional Boost can charge a one-time fee of ${BOOKSY_BOOST_PERCENT} of a qualifying new client’s first visit (minimum ${BOOKSY_BOOST_MINIMUM}), and payment-processing fees apply when you take card payments through Booksy.`,
  },
  {
    question: 'Does Booksy charge per barber?',
    answer: `Booksy lists ${BOOKSY_PER_ADDITIONAL_USER_LABEL}. For a barbershop, team growth can therefore increase the subscription cost depending on how staff users are configured.`,
  },
  {
    question: 'Does Booksy take commission?',
    answer: `${BOOKSY_STANDARD_MARKETPLACE_BOOKINGS}. If you turn on optional Boost, Booksy charges a one-time acquisition fee of ${BOOKSY_BOOST_PERCENT} of a qualifying new client’s first visit, minimum ${BOOKSY_BOOST_MINIMUM}. Payment-processing fees are separate.`,
  },
  {
    question: 'How much is Fresha a month?',
    answer: `Fresha’s UK Independent plan is ${FRESHA_INDEPENDENT_PRICE} a month for one bookable team member. Its Team plan is ${FRESHA_TEAM_PRICE} per bookable team member per month. Both are listed exclusive of ${FRESHA_VAT}.`,
  },
  {
    question: 'How much does Fresha cost?',
    answer: `The subscription is ${FRESHA_INDEPENDENT_PRICE} a month on the Independent plan or ${FRESHA_TEAM_PRICE} per bookable team member on the Team plan, plus VAT. Fresha also charges a one-time fee for brand-new Marketplace clients, payment-processing fees when you use Fresha Payments, and separate prices for optional add-ons.`,
  },
  {
    question: 'Is Fresha free for businesses?',
    answer: `No. Fresha’s UK pricing page lists paid subscription plans, starting at ${FRESHA_INDEPENDENT_PRICE} a month plus VAT for one bookable team member. Bookings through your own Fresha booking links don’t carry a new-client fee.`,
  },
  {
    question: 'What are Fresha fees?',
    answer: `Beyond the subscription, Fresha charges a one-time Marketplace fee of ${FRESHA_MARKETPLACE_PERCENT} of a brand-new client’s first appointment (minimum ${FRESHA_MARKETPLACE_MINIMUM}), payment-processing fees on transactions through Fresha Payments, and monthly prices for optional add-ons such as its Smart Website.`,
  },
  {
    question: 'Does Fresha charge per barber?',
    answer: `Yes, on the Team plan. Fresha charges ${FRESHA_TEAM_PRICE} per bookable team member per month, plus VAT. A bookable team member is someone with a calendar column that can take bookings.`,
  },
  {
    question: 'What is the Fresha Marketplace fee?',
    answer: `It is a one-time fee of ${FRESHA_MARKETPLACE_PERCENT} of the first appointment value, minimum ${FRESHA_MARKETPLACE_MINIMUM}, for a brand-new client who first discovers your business on the Fresha Marketplace. Returning clients don’t trigger it, and Fresha applies a maximum cap for higher-value services.`,
  },
  {
    question: 'Is Nearcut free for barbershops?',
    answer: `Nearcut Free for You is listed at ${formatGbp(requireVerifiedNearcutFact('freeForYouMonthlySubscription').amountGbp!)}/month for the shop, but customers pay a separate online booking charge. Nearcut shows ${formatGbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').amountGbp)} on a ${formatGbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').exampleServicePriceGbp)} haircut as an example, not as a universal fee.`,
  },
  {
    question: 'How much does Nearcut Subscription cost in the UK?',
    answer: 'Nearcut Subscription has a quote-based monthly price depending on your shop and removes the client booking charge. The calculator lets you enter a real quote excluding VAT; unknown subscription fees or unconfirmed online payment processing are shown as Custom pricing.',
  },
  {
    question: 'How much commission does Treatwell charge in the UK?',
    answer: `Treatwell publicly lists ${requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent}% + VAT on eligible new-client marketplace bookings. It lists 0% marketplace commission for qualifying repeat and direct bookings. The 365-day successful-appointment history rule and your partner contract affect eligibility.`,
  },
  {
    question: 'Can this calculator estimate Treatwell monthly costs?',
    answer: `Yes, conditionally. Enter eligible new marketplace bookings and your actual Treatwell subscription quote excluding VAT, then confirm its VAT treatment. It also models ${requireVerifiedTreatwellFact('onlinePrepaymentProcessing').percent}% + VAT on selected ${formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP)} online deposits. If the subscription price is unknown, it shows calculated booking charges but leaves the total at Custom pricing rather than guessing that a monthly subscription is free.`,
  },
  {
    question:'How much is Vagaro per month for UK barbers?',
    answer:`Vagaro currently displays ${formatGbp(requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp').value)} per month for one calendar, alongside a crossed-out reference rate. Extra calendars cost ${formatGbp(requireVerifiedVagaroFact('additionalCalendarMonthlyGbp').value)} each per month up to seven calendars, capped at ${formatGbp(requireVerifiedVagaroFact('sevenOrMoreCalendarsDisplayedMonthlyGbp').value)}. The displayed offer is not guaranteed long-term.`,
  },
  {
    question:'Does Vagaro charge commission on every booking?',
    answer:`No. Vagaro's published UK new-client fee is ${requireVerifiedVagaroFact('marketplaceNewClientFirstBookingPercent').value}% of a qualifying first visit under specific channels and conditions. Direct and returning bookings are not automatically subject to the Marketplace new-client charge. Optional promoted existing-client programmes have other fees.`,
  },
  {
    question:'Does the Vagaro estimate include VAT and online deposits?',
    answer:`Vagaro's subscription VAT basis has not been verified for every UK shop. The calculator allows an explicit VAT assumption. Its optional online deposit estimate uses published UK keyed-in/online rates of ${requireVerifiedVagaroFact('standardOnlineProcessingPercent').value}% plus ${formatGbp(requireVerifiedVagaroFact('standardOnlineProcessingFixedGbp').value)} per transaction. Actual merchant terms may differ.`,
  },
  {
    question: 'What does Timely cost per month in the UK?',
    answer: 'Timely uses Build, Elevate and Innovate subscriptions based on staff. Current UK GBP monthly prices need a shop-specific invoice or quote. Enter your true monthly invoice INCLUDING any VAT in Advanced costs. The calculator will show Custom pricing instead of making up a fee.',
  },
  {
    question: 'How much does TimelyPay charge for online deposits?',
    answer: `Timely publishes a standard UK domestic online card processing rate of ${TIMELY_UK_DOMESTIC_ONLINE_PERCENT}% plus ${Math.round(TIMELY_UK_DOMESTIC_ONLINE_FIXED_GBP * 100)}p per payment. Individual terms and other card types differ. The calculator models the standard domestic card rate on £5 deposits only.`,
  },
  {
    question: 'How much does Setora cost for a UK barbershop?',
    answer: `Setora’s published standard price is ${formatGbp(requireVerifiedSetoraFact('canonicalMonthlyGbp').value)}/month per location, with unlimited staff and no Setora booking commission. Its 14-day trial and NHBF promotional offer are separate from the standard monthly rate. SMS credits and Stripe processing are extra. Checked ${SETORA_FACTS_CHECKED_DATE}.`,
  },
  {
    question: 'Does Setora charge VAT or payment processing fees?',
    answer: `Setora’s barbershop page currently states that no VAT is added to its ${formatGbp(requireVerifiedSetoraFact('canonicalMonthlyGbp').value)} subscription, while main pricing notes VAT where applicable. It says Stripe processing is charged at Stripe rates without markup. The calculator models standard UK cards as an illustrative benchmark, not a guaranteed merchant rate; optional SMS credits are excluded.`,
  },
  {
    question: 'How much does Phorest cost per month in the UK?',
    answer: 'Phorest offers Starter, Grow, Ultimate and Elite plans but does not publish one standard UK monthly price. You need a personalised quote. The calculator accepts a real monthly subscription quote before VAT and asks you to confirm the VAT treatment before calculating a Phorest subscription estimate.',
  },
  {
    question: 'Can the calculator estimate PhorestPay fees?',
    answer: 'Not without your actual PhorestPay merchant rates. The calculator will not copy Stripe, Booksy or Fresha card fees onto Phorest. If deposit processing is enabled and deposits are modelled, the Phorest total remains Custom pricing until those fees can be verified. SMS, setup and optional add-ons are excluded.',
  },
  {
    question: 'How much does Square Appointments cost in the UK?',
    answer: `Square Appointments lists Free (£${SQUARE_UK_PLANS[0].monthlyGbp}/month for one location), Plus (£${SQUARE_UK_PLANS[1].monthlyGbp}/month per location) and Premium (£${SQUARE_UK_PLANS[2].monthlyGbp}/month per location). Published headline prices are displayed by the calculator; VAT treatment for Plus/Premium is not confirmed, so it will not guess their final cash totals.`,
  },
  {
    question: 'Does Square Appointments charge fees on deposits?',
    answer: 'Square supports deposits, but online Square payments, manually entered payments and saved cards can have different processing rates. The calculator marks Square Appointments deposit fees as unverified rather than treating the published Square Online rate as universal. Confirm the payment flow and rate with Square.',
  },
  {
    question: 'Is Booksy or Fresha cheaper for a barbershop?',
    answer: `There is no single answer. ${DEPENDS_ON} Booksy adds a charge per additional user, Fresha charges per bookable team member, and their marketplace fees work differently. Comparing both with your own numbers is the most reliable way to decide.`,
  },
  {
    question: 'Which booking system costs less for a larger barber team?',
    answer: `${DEPENDS_ON} Pricing based on bookable team members or additional users can grow with the team, while a flat per-location price such as KERSIVO’s stays the same as you add barbers. Marketplace fees and payment processing can still outweigh the subscription difference, so a larger team should compare the full cost rather than the headline price.`,
  },
];

export function buildBarberCostCalculatorFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${BARBER_COST_CALCULATOR_PAGE_PATH}#faq`,
    mainEntity: BARBER_COST_CALCULATOR_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
