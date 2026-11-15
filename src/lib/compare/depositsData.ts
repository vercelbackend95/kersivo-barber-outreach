/**
 * "Deposits and no-show protection, platform by platform" on /compare (#deposits).
 * Only features an official source in the facts modules supports; processing rates come
 * from the verified facts, and anything unpublished says so.
 */
import { KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import { BOOKSY_FACTS_CHECKED_DATE, getBooksySource, requireVerifiedBooksyFact } from '@/lib/seo/booksyFacts';
import { KERSIVO_BOOKING_DEPOSIT_GBP } from '@/lib/seo/defaults';
import { FRESHA_FACTS_CHECKED_DATE, getFreshaSource, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';
import { PHOREST_FACTS_CHECKED_DATE, getPhorestSource } from '@/lib/seo/phorestFacts';
import { SQUARE_FACTS_CHECKED_DATE, SQUARE_SOURCES } from '@/lib/seo/squareFacts';
import { STRIPE_UK_STANDARD_CARD_FIXED_GBP, STRIPE_UK_STANDARD_CARD_PERCENT } from '@/lib/seo/stripeFacts';
import { TIMELY_FACTS_CHECKED_DATE, getTimelySource, requireVerifiedTimelyFact } from '@/lib/seo/timelyFacts';

export type DepositRow = {
  id: 'kersivo' | 'booksy' | 'fresha' | 'square' | 'timely' | 'phorest';
  name: string;
  deposits: string;
  processing: string;
  source: { label: string; url: string; checked: string } | null;
  isFirstParty: boolean;
};

function rate(percent: number, fixedGbp: number): string {
  return `${percent}% + ${Math.round(fixedGbp * 100)}p`;
}

const booksyMobile = requireVerifiedBooksyFact('mobilePayments');
const freshaOnline = requireVerifiedFreshaFact('onlinePayments');
const timelyOnline = requireVerifiedTimelyFact('ukOnlinePaymentProcessing') as { percent: number; fixedGbp: number };
const squareDeposits = SQUARE_SOURCES.find((source) => source.url.includes('deposits-on-square-appointments'))!;

export const DEPOSIT_ROWS: readonly DepositRow[] = [
  {
    id: 'kersivo',
    name: 'KERSIVO',
    deposits: `Starter: every public booking takes a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment online. Full: you choose Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment.`,
    processing: `Stripe ${rate(STRIPE_UK_STANDARD_CARD_PERCENT, STRIPE_UK_STANDARD_CARD_FIXED_GBP)} on a standard UK card. ${KERSIVO_COMMISSION_WITH_STRIPE}`,
    source: null,
    isFirstParty: true,
  },
  {
    id: 'booksy',
    name: 'Booksy',
    deposits: 'Deposits and cancellation fees with a card on file, through No-Show Protection.',
    processing: `Mobile Payments ${rate(booksyMobile.percent!, booksyMobile.amountGbp!)} + VAT.`,
    source: { label: 'Booksy No-Show Protection', url: getBooksySource('noShowProtection').url, checked: BOOKSY_FACTS_CHECKED_DATE },
    isFirstParty: false,
  },
  {
    id: 'fresha',
    name: 'Fresha',
    deposits: 'Deposits, card capture, and late-cancellation or no-show policies with Fresha Payments.',
    processing: `Online payments ${rate(freshaOnline.percent!, freshaOnline.amountGbp!)} + VAT.`,
    source: { label: 'Fresha payment policies', url: getFreshaSource('paymentPolicies').url, checked: FRESHA_FACTS_CHECKED_DATE ?? '' },
    isFirstParty: false,
  },
  {
    id: 'square',
    name: 'Square Appointments',
    deposits: 'Fixed or percentage deposits on Free, Plus and Premium; cancellation and no-show rules on Plus and Premium.',
    processing: 'The rate for appointment deposits is not confirmed on Square’s UK pages.',
    source: { label: squareDeposits.label, url: squareDeposits.url, checked: SQUARE_FACTS_CHECKED_DATE },
    isFirstParty: false,
  },
  {
    id: 'timely',
    name: 'Timely',
    deposits: 'Deposits and cancellation fees taken online with TimelyPay.',
    processing: `TimelyPay ${rate(timelyOnline.percent, timelyOnline.fixedGbp)} on a domestic UK card online.`,
    source: { label: 'TimelyPay fees', url: getTimelySource('ukPayments').url, checked: TIMELY_FACTS_CHECKED_DATE },
    isFirstParty: false,
  },
  {
    id: 'phorest',
    name: 'Phorest',
    deposits: 'Custom deposit amounts and booking rules for website and social bookings.',
    processing: 'PhorestPay rates depend on your quote; none published.',
    source: { label: getPhorestSource('booking').label, url: getPhorestSource('booking').url, checked: PHOREST_FACTS_CHECKED_DATE },
    isFirstParty: false,
  },
];

export const DEPOSITS_NOTE =
  'What each platform says it supports on its official UK pages, with the date it was checked. Plans differ: check that the plan you would buy includes deposits. Every platform charges card processing on the deposit itself.';
