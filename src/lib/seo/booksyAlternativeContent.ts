import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_UK_VAT_PERCENT,
  type BooksySourceId,
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
  formatBooksyRate,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import { formatGbp, formatPercent } from '@/lib/seo/freshaFacts';

/**
 * Visible copy for the /booksy-alternative content sections.
 * Every Booksy figure is interpolated from verified facts in booksyFacts.ts.
 */

const base = requireVerifiedBooksyFact('baseSubscription');
const additionalUser = requireVerifiedBooksyFact('additionalUser');
const boostFee = requireVerifiedBooksyFact('boostNewClientFee');
const mobilePayments = requireVerifiedBooksyFact('mobilePayments');
const tapToPay = requireVerifiedBooksyFact('tapToPay');

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const BASE_PRICE = formatGbp(base.amountGbp!);
const USER_PRICE = formatGbp(additionalUser.amountGbp!);
const BOOST_PERCENT = formatPercent(boostFee.percent!);
const BOOST_MINIMUM = formatGbp(boostFee.minimumGbp!);

export const BOOKSY_QUICK_ANSWER_KICKER = 'The short version';

export const BOOKSY_QUICK_ANSWER_TITLE = 'A Booksy alternative built around your own brand.';

export const BOOKSY_QUICK_ANSWER_LEAD = `KERSIVO is a Booksy alternative for independent UK barbershops that want their website, domain and booking journey under their own brand. It costs ${KERSIVO_PRICE} per month per location, with no setup fee and 0% KERSIVO commission on bookings and retail sales. Stripe processing fees still apply.`;

export const BOOKSY_QUICK_ANSWER_DETAIL = `Booksy combines booking software with its Marketplace and customer app. It lists ${BASE_PRICE} a month plus VAT, and ${USER_PRICE} a month plus VAT for each additional user. Standard Marketplace bookings are free when Boost is off; optional Boost adds a one-time fee for qualifying new clients it brings in.`;

export const BOOKSY_QUICK_ANSWER = `${BOOKSY_QUICK_ANSWER_LEAD} ${BOOKSY_QUICK_ANSWER_DETAIL}`;

export const BOOKSY_QUICK_ANSWER_FACTS: readonly { label: string; value: string }[] = [
  { label: 'KERSIVO', value: `${KERSIVO_PRICE}/month per location` },
  { label: 'KERSIVO commission', value: '0% on bookings and retail' },
  { label: 'Booksy', value: `${BASE_PRICE}/month + ${USER_PRICE} per extra user, plus VAT` },
];

export type BooksyContentTheme = {
  title: string;
  body: string;
};

export const BOOKSY_WHY_INTRO =
  'Booksy is a widely used booking app with its own Marketplace. When independent barbers compare it with an own-brand system, the same four structural questions tend to come up.';

export const BOOKSY_WHY_THEMES: readonly InsightCardItem[] = [
  {
    icon: 'seats',
    title: 'Pricing as the team grows',
    body: `Booksy lists ${BASE_PRICE} a month plus VAT, then ${USER_PRICE} a month plus VAT for each additional user, so the subscription rises as more barbers join. KERSIVO is ${KERSIVO_PRICE} a month per location, with unlimited barbers within that location, subject to reasonable fair use.`,
  },
  {
    icon: 'storefront',
    title: 'Where the booking journey lives',
    body: 'Booksy clients book through your Booksy Profile, direct links, social buttons, Reserve with Google or a website widget, alongside the Booksy for Customers app. Some owners prefer the whole journey to sit on their own website and domain. That is the model KERSIVO is built around.',
  },
  {
    icon: 'discovery',
    title: 'Marketplace discovery and optional Boost',
    body: `The Booksy Marketplace is a genuine discovery channel, and standard Marketplace bookings are free when Boost is off. With Boost on, Booksy charges a one-time ${BOOST_PERCENT} fee (minimum ${BOOST_MINIMUM}, plus VAT) on a new client’s first visit when Booksy found that client. KERSIVO has no consumer marketplace, so the useful question is how much of your new business comes from one.`,
  },
  {
    icon: 'stack',
    title: 'Own-brand website or platform ecosystem',
    body: 'Booksy gives every business a Booksy Profile inside its ecosystem, and a widget can add booking to a website you run separately. KERSIVO includes a branded barbershop website and one standard domain in the plan, so the website and booking journey arrive together.',
  },
];

export type BooksyCostItem = {
  kicker: string;
  figure: string;
  unit: string;
  notes: readonly string[];
  sourceIds: readonly BooksySourceId[];
};

export const BOOKSY_COSTS_INTRO = `Booksy’s costs come from a few places, not one headline number. The subscription is the fixed monthly cost; Boost and payment-processing fees depend on how each shop uses Booksy. Checked against Booksy’s official UK pricing, Boost and payments pages on ${BOOKSY_FACTS_CHECKED_DATE}. Booksy lists its UK prices plus VAT.`;

const FIVE_PERSON_TEAM = estimateBooksyMonthlySubscription(5);

export const BOOKSY_COST_ITEMS: readonly BooksyCostItem[] = [
  {
    kicker: 'Subscription',
    figure: BASE_PRICE,
    unit: 'per month + VAT',
    notes: [
      'Booksy says all features are included in the core subscription.',
      'Billed monthly with no commitment; Booksy lets you cancel anytime.',
    ],
    sourceIds: ['pricingUk'],
  },
  {
    kicker: 'Additional users',
    figure: USER_PRICE,
    unit: 'per additional user / month + VAT',
    notes: [
      'Charged for each extra team member on the account.',
      `A five-person team adds ${FIVE_PERSON_TEAM.additionalUsers} × ${USER_PRICE} = ${formatGbp(additionalUser.amountGbp! * FIVE_PERSON_TEAM.additionalUsers)} a month before VAT.`,
    ],
    sourceIds: ['pricingUk'],
  },
  {
    kicker: 'Marketplace bookings',
    figure: 'Free',
    unit: 'standard Marketplace bookings without Boost',
    notes: [
      'Booksy lists your business on its Marketplace at no extra cost.',
      'Clients who book through your Profile link, Instagram, Facebook, Google or QR codes carry no commission, even with Boost on.',
    ],
    sourceIds: ['pricingUk', 'marketplace', 'boost'],
  },
  {
    kicker: 'Optional Boost',
    figure: BOOST_PERCENT,
    unit: `one-time, minimum ${BOOST_MINIMUM} + VAT per new client`,
    notes: [
      'Charged once, on the first visit of a brand-new client Booksy brings in while Boost is on.',
      'Free to turn on, with no monthly fee. Later visits from that client carry 0% commission.',
    ],
    sourceIds: ['boost', 'pricingUk'],
  },
  {
    kicker: 'Payment processing',
    figure: formatBooksyRate(mobilePayments),
    unit: 'per Mobile Payments transaction + VAT',
    notes: [
      `Tap to Pay: ${formatBooksyRate(tapToPay)} + VAT per in-person transaction, with no card reader needed.`,
      'Deposits and cancellation fees under No-Show Protection run through Mobile Payments.',
    ],
    sourceIds: ['payments', 'tapToPay', 'noShowProtection'],
  },
];

export type BooksyWorkedExample = {
  label: string;
  plan: string;
  booksyExVat: string;
  booksyIncVat: string;
  kersivo: string;
};

export const BOOKSY_WORKED_EXAMPLE_TEAM_SIZES = [1, 3, 5] as const;

export const BOOKSY_WORKED_EXAMPLES: readonly BooksyWorkedExample[] =
  BOOKSY_WORKED_EXAMPLE_TEAM_SIZES.map((size) => {
    const estimate = estimateBooksyMonthlySubscription(size);
    return {
      label: size === 1 ? 'Solo barber' : `${size} users`,
      plan:
        estimate.additionalUsers === 0
          ? 'Base subscription'
          : `Base + ${estimate.additionalUsers} × ${USER_PRICE}`,
      booksyExVat: formatGbp(estimate.exVatGbp),
      booksyIncVat: formatGbp(estimate.incVatGbp),
      kersivo: KERSIVO_PRICE,
    };
  });

export const BOOKSY_WORKED_EXAMPLES_NOTE = `Subscription cost only — not a total cost of ownership. Potential additional costs depend on each shop: for Booksy, optional Boost fees and payment processing; for KERSIVO, Stripe payment-processing fees. Booksy figures including VAT use the UK standard rate of ${BOOKSY_UK_VAT_PERCENT}%. KERSIVO is not currently VAT registered, so no VAT is added.`;

export const KERSIVO_MODEL_POINTS: readonly string[] = [
  `${KERSIVO_PRICE}/month per physical location`,
  'No setup fee',
  'Unlimited barbers within one location, subject to reasonable fair use',
  '0% KERSIVO commission on bookings',
  '0% KERSIVO commission on retail sales',
  'Stripe payment-processing fees still apply',
];

const EXAMPLE_HIGHER_SERVICE_GBP = 25;
const EXAMPLE_LOWER_SERVICE_GBP = 15;

export const BOOKSY_BOOST_POINTS: readonly string[] = [
  'Boost is optional and free to turn on, with no monthly fee.',
  `With Boost on, Booksy charges a one-time ${BOOST_PERCENT} fee on the total cost of a brand-new client’s first visit, with a ${BOOST_MINIMUM} minimum, plus VAT.`,
  'It applies to new clients Booksy finds for you through the Booksy Marketplace (booksy.com) or Booksy for Customers app discovery.',
  'Clients who book through your Profile link, Instagram or Facebook buttons, Google Search, Google Maps or QR codes carry no commission.',
  'From the second visit onwards, that client carries 0% commission. Tips are not included in the fee.',
];

export const BOOKSY_BOOST_EXAMPLE = `For example, on a ${formatGbp(EXAMPLE_HIGHER_SERVICE_GBP)} first haircut the Boost fee would be ${formatGbp(estimateBooksyBoostFee(EXAMPLE_HIGHER_SERVICE_GBP))} plus VAT. On a ${formatGbp(EXAMPLE_LOWER_SERVICE_GBP)} service, the ${BOOST_MINIMUM} minimum applies.`;

export const BOOKSY_FIT_PATHS: readonly [ModelComparisonItem, ModelComparisonItem] = [
  {
    label: 'Booksy',
    descriptor: 'Marketplace + booking ecosystem',
    icon: 'network',
    summary: [
      { label: 'Pricing', value: `${BASE_PRICE}/month + ${USER_PRICE} per extra user, plus VAT` },
      { label: 'Discovery', value: 'Booksy Marketplace and app' },
    ],
    heading: 'Booksy may suit your shop if…',
    points: [
      'Marketplace and app discovery is an important source of new clients for you',
      'You value being part of a large booking ecosystem with its own customer app',
      'You are happy to combine direct booking links with Marketplace visibility',
      'You are comfortable with a base subscription plus a monthly charge per additional user',
      'You would use optional Boost and accept its one-time fee for new clients it brings in',
    ],
  },
  {
    label: 'KERSIVO',
    descriptor: 'Own-brand booking model',
    icon: 'direct',
    summary: [
      { label: 'Pricing', value: `${KERSIVO_PRICE}/month per location` },
      { label: 'Discovery', value: 'Your own website and channels' },
    ],
    heading: 'KERSIVO may suit your shop if…',
    points: [
      'You want your own branded website and domain at the centre of the booking journey',
      'Your clients already find you through Google, Instagram, referrals or walk-ins',
      `You prefer a flat ${KERSIVO_PRICE}/month per location, however many barbers take bookings`,
      'You want 0% KERSIVO commission on bookings and retail sales',
    ],
  },
];

export const BOOKSY_FIT_CLOSING =
  'Neither model is right for every barbershop. The real question is where you want new clients to come from, and where you want the booking journey to live.';

export const BOOKSY_SWITCHING_REASSURANCE = 'Keep Booksy live while your KERSIVO setup is prepared.';

export const BOOKSY_SWITCHING_STEPS: readonly BooksyContentTheme[] = [
  {
    title: 'Keep Booksy live',
    body: 'Your current bookings keep running on Booksy. Nothing changes for your clients while the new setup is prepared.',
  },
  {
    title: 'Export what Booksy makes available',
    body: 'Booksy’s UK Help Centre says you can request a copy of your client list, with contact details, from Booksy Support.',
  },
  {
    title: 'We review and map compatible data',
    body: 'We’ll help migrate the usable business data available from your current booking system, including supported CSV exports.',
  },
  {
    title: 'We prepare your setup and branded website',
    body: 'Services, barbers, opening hours and your branded barbershop website are prepared in KERSIVO.',
  },
  {
    title: 'You review a private preview',
    body: 'Check the website, booking journey and admin before anything goes public.',
  },
  {
    title: 'Switch when you approve',
    body: 'Only once you approve are your public booking links and domain routing switched to KERSIVO.',
  },
];

export const BOOKSY_SWITCHING_LIMITS: readonly string[] = [
  'Booksy’s Help Centre does not state the format or fields of the client list it provides, so what can be moved depends on what Booksy sends.',
  'Saved payment-card data is not included in the standard KERSIVO migration.',
];
