import type { ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
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
 * Visible copy for /booksy-alternative. Written to the shop owner ("you").
 * Every Booksy figure is interpolated from verified facts in booksyFacts.ts;
 * every KERSIVO claim follows src/lib/pricing/claimsPolicy.ts.
 */

const base = requireVerifiedBooksyFact('baseSubscription');
const additionalUser = requireVerifiedBooksyFact('additionalUser');
const boostFee = requireVerifiedBooksyFact('boostNewClientFee');
const mobilePayments = requireVerifiedBooksyFact('mobilePayments');
const tapToPay = requireVerifiedBooksyFact('tapToPay');

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
export const BK_STARTER_MAX_BARBERS = 4;
const STARTER_DEPOSIT_PRICE = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const BASE_PRICE = formatGbp(base.amountGbp!);
const USER_PRICE = formatGbp(additionalUser.amountGbp!);
const BOOST_PERCENT = formatPercent(boostFee.percent!);
const BOOST_MINIMUM = formatGbp(boostFee.minimumGbp!);

/* ---------- Hero ---------- */

export const BK_HERO_EYEBROW = 'Booksy alternative for UK barbershops';

export const BK_HERO_LEAD = `With Full KERSIVO, clients book you on your own website and domain, every client lands in your own list, and one flat ${KERSIVO_PRICE} a month per location covers the whole team. We help move your Booksy clients across, and Booksy stays live until you approve the switch.`;

export const BK_HERO_FACTS: readonly string[] = [
  `Full KERSIVO ${KERSIVO_PRICE}/month per location`,
  'No per-barber fees',
  '0% KERSIVO commission · Stripe fees apply',
  'Typically ready in a few days',
];

export const BK_HERO_VIEWS = [
  { id: 'booksy', label: 'On Booksy' },
  { id: 'own', label: 'On your site' },
] as const;

/* ---------- Short answer ---------- */

export const BOOKSY_QUICK_ANSWER_KICKER = 'The short version';

export const BOOKSY_QUICK_ANSWER_TITLE = 'Yes, you can leave Booksy and keep your clients booking.';

export const BOOKSY_QUICK_ANSWER_LEAD = `KERSIVO is a Booksy alternative for independent UK barbershops that want clients to book them directly. Full KERSIVO is ${KERSIVO_PRICE}/month per location and gives you a branded website on your own domain, payment control and migration help, with no per-barber fees. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${BK_STARTER_MAX_BARBERS} barbers, with a hosted booking page. KERSIVO commission is 0%; Stripe processing fees still apply.`;

export const BOOKSY_QUICK_ANSWER_DETAIL = `Booksy lists ${BASE_PRICE} a month plus VAT, and ${USER_PRICE} a month plus VAT for each additional user. Standard Marketplace bookings are free when Boost is off; optional Boost adds a one-time fee for qualifying new clients it brings in.`;

export const BOOKSY_QUICK_ANSWER = `${BOOKSY_QUICK_ANSWER_LEAD} ${BOOKSY_QUICK_ANSWER_DETAIL}`;

export const BOOKSY_QUICK_ANSWER_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Full KERSIVO', value: `${KERSIVO_PRICE}/month per location` },
  { label: 'KERSIVO Starter', value: `${STARTER_PRICE}/month, up to ${BK_STARTER_MAX_BARBERS} barbers` },
  { label: 'KERSIVO commission', value: '0% · Stripe fees apply' },
  { label: 'Booksy', value: `${BASE_PRICE}/month + ${USER_PRICE} per extra user, plus VAT` },
];

/* ---------- Outcomes ---------- */

export type BkOutcome = {
  id: 'door' | 'bill' | 'commission' | 'clients' | 'noshow' | 'reminders';
  kicker: string;
  title: string;
  body: string;
};

export const BK_OUTCOMES_TITLE = 'What changes the day you switch';

export const BK_OUTCOMES_LEAD =
  'Booksy is a capable booking app with a big marketplace. KERSIVO is built for a different job: making your own shop the place clients book, pay and come back to.';

export const BK_OUTCOMES: readonly BkOutcome[] = [
  {
    id: 'door',
    kicker: 'Your name on the door',
    title: 'Clients book on yourshop.co.uk',
    body: 'With Full KERSIVO your booking journey lives on your own branded website and domain: your logo, your barbers, your prices. No app to download.',
  },
  {
    id: 'bill',
    kicker: 'One flat bill',
    title: 'Hire your next barber. Same price.',
    body: `Full KERSIVO is ${KERSIVO_PRICE} a month per location with no per-barber fees. On Booksy each additional user adds ${USER_PRICE} a month plus VAT.`,
  },
  {
    id: 'commission',
    kicker: 'Keep the takings',
    title: '0% KERSIVO commission',
    body: 'On booking payments on both plans, and on retail sales with Full. Stripe processing fees apply.',
  },
  {
    id: 'clients',
    kicker: 'Your client list',
    title: 'Every regular in your own dashboard',
    body: 'Contact details, visits and upcoming bookings on both plans; full history and internal notes with Advanced Clients on Full.',
  },
  {
    id: 'noshow',
    kicker: 'No-shows still pay',
    title: `A ${STARTER_DEPOSIT_PRICE} deposit, or paid in full`,
    body: 'Secure bookings at the moment they are made. Full KERSIVO also lets you choose Pay at shop when you trust the client.',
  },
  {
    id: 'reminders',
    kicker: 'Fewer empty chairs',
    title: 'Reminders go out automatically',
    body: 'Email confirmations and reminders on both plans, plus SMS reminders within a monthly allowance on Full.',
  },
];

/* ---------- Monthly bill (subscription) ---------- */

export type BooksyCostItem = {
  kicker: string;
  figure: string;
  unit: string;
  notes: readonly string[];
  sourceIds: readonly BooksySourceId[];
};

export const BOOKSY_COSTS_INTRO = `Booksy’s cost comes from a few places, not one headline number. The subscription grows with your team; Boost and card fees depend on how you use Booksy. Checked against Booksy’s official UK pricing, Boost and payments pages on ${BOOKSY_FACTS_CHECKED_DATE}. Booksy lists its UK prices plus VAT.`;

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
      kersivo: size <= BK_STARTER_MAX_BARBERS ? `${KERSIVO_PRICE} Full or ${STARTER_PRICE} Starter` : `${KERSIVO_PRICE} Full`,
    };
  });

export const BOOKSY_WORKED_EXAMPLES_NOTE = `Subscription cost only — not a total cost of ownership. Potential additional costs depend on each shop: for Booksy, optional Boost fees and payment processing; for KERSIVO, Stripe payment-processing fees. Booksy figures including VAT use the UK standard rate of ${BOOKSY_UK_VAT_PERCENT}%. KERSIVO is not currently VAT registered, so no VAT is added.`;

/* ---------- Commission and Boost ---------- */

export const BK_COMMISSION_TITLE = 'Commission: what a new client really costs you';

export const BK_COMMISSION_LEAD = `Booksy’s standard bookings carry no commission. The fee arrives when you switch on Boost and Booksy finds you a brand-new client: ${BOOST_PERCENT} of that first visit, at least ${BOOST_MINIMUM}, plus VAT. KERSIVO takes 0% commission on booking payments, whoever the client is.`;

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

export const BK_CARD_FEES: readonly { label: string; booksy: string; kersivo: string }[] = [
  { label: 'Online and in-app card payments', booksy: `${formatBooksyRate(mobilePayments)} + VAT (Mobile Payments)`, kersivo: 'Stripe processing fees apply' },
  { label: 'In-person card payments', booksy: `${formatBooksyRate(tapToPay)} + VAT (Tap to Pay)`, kersivo: 'Pay at shop on Full: clients pay you in person, your usual way' },
];

/* ---------- Side-by-side scoreboard ---------- */

export type BkScoreRow = { label: string; booksy: string; kersivo: string };

export const BK_SCOREBOARD_TITLE = 'Booksy vs KERSIVO, line by line';

export const BK_SCOREBOARD: readonly BkScoreRow[] = [
  {
    label: 'Monthly price',
    booksy: `${BASE_PRICE}/month + VAT`,
    kersivo: `${KERSIVO_PRICE}/month per location on Full · ${STARTER_PRICE} Starter for up to ${BK_STARTER_MAX_BARBERS} barbers`,
  },
  {
    label: 'Extra barbers',
    booksy: `${USER_PRICE}/month + VAT per additional user`,
    kersivo: 'No per-barber fees · unlimited barbers within one location on Full, subject to fair use',
  },
  {
    label: 'Commission on bookings',
    booksy: `None on standard bookings · optional Boost: ${BOOST_PERCENT} one-time (min ${BOOST_MINIMUM}) + VAT per new Boost client`,
    kersivo: '0% KERSIVO commission · Stripe fees apply',
  },
  {
    label: 'Card processing',
    booksy: `${formatBooksyRate(mobilePayments)} + VAT, or ${formatBooksyRate(tapToPay)} + VAT with Tap to Pay`,
    kersivo: 'Standard Stripe processing fees',
  },
  {
    label: 'Your own website and domain',
    booksy: 'A booking widget for a website you run separately',
    kersivo: 'Branded website and one standard domain included on Full',
  },
  {
    label: 'Where clients book',
    booksy: 'Booksy Profile, direct links, social buttons, Reserve with Google, the Booksy app and Marketplace',
    kersivo: 'Your own website on Full, or a hosted KERSIVO booking page on Starter',
  },
  {
    label: 'Customer app and marketplace',
    booksy: 'Booksy for Customers app and Marketplace discovery',
    kersivo: 'No app to download and no marketplace: clients book in the browser',
  },
  {
    label: 'Deposits and no-shows',
    booksy: 'Deposits and cancellation fees through Mobile Payments',
    kersivo: `${STARTER_DEPOSIT_PRICE} deposit or Pay in full; Full adds Pay at shop`,
  },
  {
    label: 'Reminders',
    booksy: 'Free appointment confirmations and reminders',
    kersivo: 'Email reminders on both plans; SMS reminders within a monthly allowance on Full',
  },
  {
    label: 'Retail',
    booksy: 'Add-ons, gift cards, memberships and packages',
    kersivo: 'Retail pickup shop on your own website with Full',
  },
];

/* ---------- Own domain + direct relationship ---------- */

export const BK_DOMAIN_TITLE = 'An address that’s yours, not a profile link';

export const BK_DOMAIN_LEAD =
  'On Full KERSIVO your booking page is your website: one address on your card, your Instagram bio, your Google profile and the shop window.';

export const BK_DOMAIN_POINTS: readonly string[] = [
  'Full KERSIVO includes one standard domain per location, with hosting and SSL.',
  'Already own a domain? You keep ownership; we provide the DNS records or help set them up.',
  'Need a new one? KERSIVO may register it on behalf of your business. Legal ownership stays with your business, and it can be transferred to you when the engagement ends.',
  'Your Booksy links keep working until you approve the switch.',
];

export const BK_RELATIONSHIP_TITLE = 'A direct line to every client';

export const BK_RELATIONSHIP_LEAD =
  'On Booksy, clients can find and book you through your Profile, your links or the Booksy app and Marketplace. With KERSIVO the whole loop runs through your own shop.';

export const BK_RELATIONSHIP_STEPS: readonly { title: string; body: string }[] = [
  { title: 'They book you', body: 'On your website or booking page, in the browser. Nothing to download.' },
  { title: 'They land in your list', body: 'Name, contact details and visit history in your KERSIVO dashboard.' },
  { title: 'They get reminded', body: 'Email confirmations and reminders, plus SMS within an allowance on Full.' },
  { title: 'They come back to you', body: 'Next time they book, it’s straight to your shop again.' },
];

/* ---------- Switching ---------- */

export const BOOKSY_SWITCHING_REASSURANCE = 'Keep Booksy live while your KERSIVO setup is prepared.';

export const BK_SWITCHING_LEAD =
  'Booksy keeps taking bookings while we build. Your setup is typically ready in a few days once we receive all required information, and nothing goes public until you approve it.';

export const BOOKSY_SWITCHING_STEPS: readonly { title: string; body: string }[] = [
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
    body: 'We help migrate the usable business data from your current booking system, including supported CSV exports. Migration help is included in Full KERSIVO.',
  },
  {
    title: 'We prepare your setup',
    body: 'Services, barbers and opening hours are prepared in KERSIVO, plus your branded barbershop website on Full KERSIVO.',
  },
  {
    title: 'You review a private preview',
    body: 'Check the website, booking journey and admin before anything goes public.',
  },
  {
    title: 'Switch when you approve',
    body: 'Only once you approve are your public booking links (and, on Full, your domain routing) switched to KERSIVO.',
  },
];

export const BK_MIGRATION_MOVES: readonly { title: string; body: string; status: 'moves' | 'built' | 'not' }[] = [
  { title: 'Your client list', body: 'Names and contact details from the copy Booksy Support sends you.', status: 'moves' },
  { title: 'Services and prices', body: 'Set up in KERSIVO to match your current menu.', status: 'built' },
  { title: 'Barbers and opening hours', body: 'Each barber’s working pattern, ready for bookings.', status: 'built' },
  { title: 'Website and domain', body: 'Your branded site on your own domain, with Full KERSIVO.', status: 'built' },
  { title: 'Saved payment cards', body: 'Not included in the standard KERSIVO migration.', status: 'not' },
];

export const BOOKSY_SWITCHING_LIMITS: readonly string[] = [
  'Booksy’s Help Centre does not state the format or fields of the client list it provides, so what can be moved depends on what Booksy sends.',
  'Saved payment-card data is not included in the standard KERSIVO migration.',
];

/* ---------- Fit ---------- */

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
      { label: 'Pricing', value: `${KERSIVO_PRICE}/month per location on Full, or ${STARTER_PRICE} Starter` },
      { label: 'Discovery', value: 'Your own website and channels' },
    ],
    heading: 'KERSIVO may suit your shop if…',
    points: [
      'You want a direct booking journey under your own brand, with your own website and domain on Full KERSIVO',
      'Your clients already find you through Google, Instagram, referrals or walk-ins',
      `You prefer a flat ${KERSIVO_PRICE}/month per location on Full, however many barbers take bookings, or ${STARTER_PRICE} for up to ${BK_STARTER_MAX_BARBERS} barbers on Starter`,
      `You want bookings secured by a ${STARTER_DEPOSIT_PRICE} deposit or full payment, with Full unlocking Pay at shop and wider payment control — all with 0% KERSIVO commission`,
    ],
  },
];

export const BOOKSY_FIT_CLOSING =
  'Neither model is right for every barbershop. The real question is where you want new clients to come from, and where you want the booking journey to live.';

export const BK_FAQ_HEADING = 'Questions owners ask before leaving Booksy';
export const BK_FAQ_SUBHEADING = 'Straight answers on Booksy pricing, Boost, commission, your own domain and moving your clients.';
