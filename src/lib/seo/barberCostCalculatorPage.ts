import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { NEARCUT_FACTS_CHECKED_DATE, requireVerifiedNearcutFact, requireIllustrativeNearcutFact } from '@/lib/seo/nearcutFacts';
import {
  BOOKSY_ADDITIONAL_USER_LABEL,
  BOOKSY_BASE_PRICE_LABEL,
  BOOKSY_PER_ADDITIONAL_USER_LABEL,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_MOBILE_PAYMENTS_FIXED_GBP,
  BOOKSY_MOBILE_PAYMENTS_PERCENT,
  BOOKSY_PAYMENT_FACTS_CHECKED_DATE,
  BOOKSY_STANDARD_MARKETPLACE_BOOKINGS,
} from '@/lib/seo/booksyFacts';
import {
  STRIPE_FACTS_CHECKED_DATE,
  STRIPE_UK_STANDARD_CARD_FIXED_GBP,
  STRIPE_UK_STANDARD_CARD_PERCENT,
} from '@/lib/seo/stripeFacts';
import {
  FRESHA_BOOKABLE_TEAM_MEMBER_DEFINITION,
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_UK_VAT_PERCENT,
  formatGbp,
  formatPercent,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';

/**
 * Visible copy and SEO metadata for /barber-software-cost-calculator.
 * Competitor figures are drawn from verified Booksy, Fresha and Nearcut facts; Nearcut illustrative pricing is always labelled.
 */

export const BARBER_COST_CALCULATOR_PAGE_PATH = '/barber-software-cost-calculator';

export const BARBER_COST_CALCULATOR_TITLE = 'Booksy vs Fresha vs Nearcut Cost Calculator UK | KERSIVO';

export const BARBER_COST_CALCULATOR_DESCRIPTION =
  'Compare Booksy, Fresha, Nearcut and KERSIVO costs for UK barbershops. Model subscriptions, client booking charges, deposits, VAT and 3-year totals.';

export const BARBER_COST_CALCULATOR_BREADCRUMB_NAME = 'Barber Software Cost Calculator';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const BARBER_COST_CALCULATOR_LAST_UPDATED_ISO = '2026-10-08';
export const BARBER_COST_CALCULATOR_LAST_UPDATED_LABEL = '8 October 2026';

const independent = requireVerifiedFreshaFact('independentPlan');
const teamPlan = requireVerifiedFreshaFact('teamPlanPerMember');
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');
const onlinePayments = requireVerifiedFreshaFact('onlinePayments');
const inPersonPayments = requireVerifiedFreshaFact('inPersonPayments');
const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');

export const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
export const FRESHA_INDEPENDENT_PRICE = formatGbp(independent.amountGbp!);
export const FRESHA_TEAM_PRICE = formatGbp(teamPlan.amountGbp!);
export const FRESHA_MARKETPLACE_PERCENT = formatPercent(marketplaceFee.percent!);
export const FRESHA_MARKETPLACE_MINIMUM = formatGbp(marketplaceFee.minimumGbp!);
export const BOOKSY_BOOST_PERCENT = formatPercent(BOOKSY_BOOST_COMMISSION_PERCENT);
export const BOOKSY_BOOST_MINIMUM = formatGbp(BOOKSY_BOOST_MINIMUM_GBP);
const FRESHA_VAT = `${FRESHA_UK_VAT_PERCENT}% VAT`;
const feeLabel = (percent: number, fixedGbp: number) => `${formatPercent(percent)} + ${formatGbp(fixedGbp)}`;

/* ---------------------------------- Hero ---------------------------------- */

export const COST_CALC_HERO = {
  eyebrow: 'UK BARBER SOFTWARE COST CALCULATOR',
  title: 'Barber Booking Software Cost Calculator',
  lead: 'Compare Booksy, Fresha, Nearcut and KERSIVO using your own UK barbershop numbers. Nearcut customer booking charges are shown separately from shop costs.',
  supporting:
    'See how team size, marketplace fees, VAT, payments and optional features can change what your booking software really costs.',
  builtBy:
    'Built by KERSIVO. Competitor pricing is based on official UK sources and checked regularly.',
} as const;

export const COST_CALC_TRUST_SIGNALS: readonly string[] = [
  'Official UK pricing sources',
  'Sources shown',
  'No email required',
  'Pricing checked regularly',
];

/* ----------------------------- Cost at a glance ---------------------------- */

export type PricingModelSummary = {
  name: string;
  descriptor: string;
  /** Headline base price, from central facts. */
  price: string;
  /** What the headline price covers. */
  priceNote: string;
  /** Optional second price line, e.g. a team plan. */
  secondaryPrice?: string;
  points: readonly string[];
};

export const COST_AT_A_GLANCE_INTRO =
  'Booksy, Fresha, Nearcut and KERSIVO charge in different ways. Nearcut Free for You has no monthly shop subscription but adds a separate client booking charge. Compare who actually pays, not just the headline price.';

export const COST_AT_A_GLANCE_MODELS: readonly PricingModelSummary[] = [
  {
    name: 'Booksy',
    descriptor: 'Subscription plus users',
    price: BOOKSY_BASE_PRICE_LABEL,
    priceNote: `+ ${BOOKSY_PER_ADDITIONAL_USER_LABEL}`,
    points: [
      'A base monthly subscription',
      'An extra monthly charge for each additional user',
      'Optional Boost, which can charge a one-time fee for qualifying new clients',
      'Payment-processing fees when payments run through Booksy',
    ],
  },
  {
    name: 'Fresha',
    descriptor: 'Priced by team size',
    price: `${FRESHA_INDEPENDENT_PRICE}/month + VAT`,
    priceNote: 'Independent — 1 bookable team member',
    secondaryPrice: `Team: ${FRESHA_TEAM_PRICE} per bookable team member/month + VAT`,
    points: [
      'A subscription based on the number of bookable team members',
      'A one-time Marketplace fee for brand-new Marketplace clients',
      'Optional paid add-ons',
      'Payment-processing fees when payments run through Fresha',
    ],
  },
  {
    name: 'Nearcut',
    descriptor: 'Free for You or shop-quoted Subscription',
    price: `${formatGbp(requireVerifiedNearcutFact('freeForYouMonthlySubscription').amountGbp!)}/month`,
    priceNote: 'Free for You — customers pay a separate booking charge',
    secondaryPrice: 'Subscription: individual monthly quote + VAT',
    points: [
      'Free for You is free to the shop, but customers pay a booking charge',
      `Nearcut illustrates ${formatGbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').amountGbp)} on a £20 haircut; that is not a universal price`,
      'Subscription removes the customer booking charge; actual price varies by shop',
      'Online payment rates and optional Business Boosters depend on the plan',
    ],
  },
  {
    name: 'Full KERSIVO',
    descriptor: 'Flat per location',
    price: `${KERSIVO_PRICE}/month per location`,
    priceNote: 'Additional barbers included',
    points: [
      'A flat monthly cost per physical location',
      'Additional barbers within that location included',
      'No KERSIVO commission on bookings or retail sales',
      'Stripe payment-processing fees when payments are taken',
      `KERSIVO Starter is ${formatGbp(0)}/month for up to 4 bookable barbers`,
    ],
  },
];

/* ---------------------------------- Booksy --------------------------------- */

export const BOOKSY_COST_INTRO = `Booksy’s UK pricing starts with a base subscription, then adds a monthly charge for each extra user. Marketplace bookings are part of the standard model, and Booksy Boost is an optional paid acquisition feature. Checked against Booksy’s official UK pricing and Boost pages on ${BOOKSY_FACTS_CHECKED_DATE}.`;

export const BOOKSY_COST_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Base subscription', value: BOOKSY_BASE_PRICE_LABEL },
  { label: 'Additional users', value: BOOKSY_ADDITIONAL_USER_LABEL },
  { label: 'Standard Marketplace', value: BOOKSY_STANDARD_MARKETPLACE_BOOKINGS },
  {
    label: 'Booksy Boost (optional)',
    value: `${BOOKSY_BOOST_PERCENT} of a qualifying new client’s first visit, minimum ${BOOKSY_BOOST_MINIMUM}, charged once`,
  },
];

export const BOOKSY_COST_NOTES: readonly string[] = [
  'Booksy lists its UK subscription and additional-user prices plus VAT, so the amount a shop actually pays is higher than the headline figure.',
  'The Boost fee is a one-time acquisition fee for a new client Boost brings in, not a charge on that client’s later visits.',
  `Payment-processing fees apply separately when card payments are taken through Booksy. Online deposits use Booksy Mobile Payments at ${feeLabel(BOOKSY_MOBILE_PAYMENTS_PERCENT, BOOKSY_MOBILE_PAYMENTS_FIXED_GBP)} per transaction plus VAT.`,
];

/* ---------------------------------- Fresha --------------------------------- */

export const FRESHA_COST_INTRO = `Fresha prices its UK software by the number of bookable team members, then adds a one-time fee for brand-new clients who find you on the Fresha Marketplace. Bookings through your own direct links don’t carry that fee. Checked against Fresha’s UK pricing page and Help Centre on ${FRESHA_FACTS_CHECKED_DATE}. Fresha lists UK rates exclusive of ${FRESHA_VAT}.`;

export const FRESHA_COST_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Independent plan', value: `${FRESHA_INDEPENDENT_PRICE}/month for one bookable team member, plus VAT` },
  { label: 'Team plan', value: `${FRESHA_TEAM_PRICE} per bookable team member per month, plus VAT` },
  { label: 'Direct booking links', value: 'No new-client fee' },
  {
    label: 'Marketplace new clients',
    value: `${FRESHA_MARKETPLACE_PERCENT} of the first appointment, minimum ${FRESHA_MARKETPLACE_MINIMUM}, charged once`,
  },
  {
    label: 'Payments',
    value: `${formatPercent(onlinePayments.percent!)} + ${formatGbp(onlinePayments.amountGbp!)} online, ${formatPercent(inPersonPayments.percent!)} + ${formatGbp(inPersonPayments.amountGbp!)} in person, per transaction`,
  },
  {
    label: 'Optional add-ons',
    value: `Smart Website ${formatGbp(smartWebsite.amountGbp!)}/month, Client Loyalty ${formatGbp(clientLoyalty.amountGbp!)} per location/month`,
  },
];

export const FRESHA_COST_NOTES: readonly string[] = [
  `Fresha defines a bookable team member as ${FRESHA_BOOKABLE_TEAM_MEMBER_DEFINITION}. Custom Enterprise rates apply above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} team members.`,
  'Returning clients never trigger the Marketplace fee, and Fresha applies a maximum cap to the fee for higher-value services.',
  'Fresha Payments is optional, but Fresha’s deposits and no-show protection run through it.',
];

/* --------------------------------- Nearcut --------------------------------- */

export const NEARCUT_COST_INTRO = `Nearcut offers two UK payment models: Free for You at £0/month for the shop, where customers pay a separate booking charge, or Subscription with a shop-specific monthly quote plus VAT and no customer booking charge. Its UK pricing page shows an example £1.50 client charge on a £20 haircut, not a universal fee. Checked against official Nearcut sources on ${NEARCUT_FACTS_CHECKED_DATE}.`;

export const NEARCUT_COST_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Free for You subscription', value: `${formatGbp(requireVerifiedNearcutFact('freeForYouMonthlySubscription').amountGbp!)}/month for the shop` },
  { label: 'Free for You client booking fee', value: `Illustration: ${formatGbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').amountGbp)} extra on a ${formatGbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').exampleServicePriceGbp)} haircut; actual charge varies` },
  { label: 'Subscription', value: 'Monthly shop-specific quote + VAT; no separate client booking charge' },
  { label: 'Online deposits', value: 'Free for You advertises zero transaction fees; standard Help Centre rates differ and must be checked for your plan' },
  { label: 'Setup', value: `${formatGbp(requireVerifiedNearcutFact('setupFee').amountGbp!)} listed for the booking system and website` },
];
export const NEARCUT_COST_NOTES: readonly string[] = [
  'This calculator separates shop costs from charges that customers pay. The example £1.50 Nearcut client booking fee is never multiplied by your appointment count because it is not a verified universal rate.',
  'Free for You shop cost is shown before any add-ons. The shop-paid software amount can be £0 even though individual customers pay an extra fee.',
  'Select Nearcut Subscription under Advanced costs to enter your real monthly quote. Without it, the result is Custom pricing, not an invented estimate.',
  'Nearcut Subscription online processing and optional Business Boosters are not estimated without confirmed plan-specific terms.',
];

/* -------------------------------- Team size -------------------------------- */

export type TeamSizeProfile = {
  label: string;
  title: string;
  body: string;
};

export const TEAM_SIZE_INTRO =
  'Each platform reacts differently as a shop adds chairs. A pricing model that looks inexpensive for one barber can look very different for a full team, and the reverse can also be true.';

export const TEAM_SIZE_PROFILES: readonly TeamSizeProfile[] = [
  {
    label: 'Solo barber',
    title: 'One chair, one calendar',
    body: 'For a single barber, the entry plan matters most. Per-person pricing has only one person to charge for, so the gap between platforms often comes down to marketplace fees, add-ons and payments rather than team charges.',
  },
  {
    label: 'Small team',
    title: 'Two to four barbers',
    body: 'Once a few barbers take bookings, per-user and per-team-member charges start to add up. How much depends on whether a platform charges per additional user, per bookable team member or for the location as a whole.',
  },
  {
    label: 'Larger barbershop',
    title: 'Five barbers or more',
    body: 'In a bigger shop, the team-size part of the bill can become the largest fixed cost. Marketplace usage and payment volume also grow with the team, so the full picture depends on how the shop actually wins and takes bookings.',
  },
];

export const TEAM_SIZE_CLOSING =
  'No single platform is cheapest at every team size. The calculator lets you enter your own number of bookable barbers rather than relying on a typical shop.';

/* ---------------------------- Marketplace fees ----------------------------- */

export type MarketplacePoint = {
  title: string;
  body: string;
};

export const MARKETPLACE_INTRO =
  'Booksy and Fresha both run consumer marketplaces where clients can discover new barbershops. Each charges differently for clients who arrive that way, and both separate them from clients who book you directly.';

export const MARKETPLACE_POINTS: readonly MarketplacePoint[] = [
  {
    title: 'Standard Booksy Marketplace',
    body: `${BOOKSY_STANDARD_MARKETPLACE_BOOKINGS}. A shop can be visible on the Booksy Marketplace without paying a per-client acquisition fee.`,
  },
  {
    title: 'Optional Booksy Boost',
    body: `Boost is an opt-in promotion feature. When it brings a qualifying new client, Booksy charges a one-time fee of ${BOOKSY_BOOST_PERCENT} of the first visit, with a ${BOOKSY_BOOST_MINIMUM} minimum.`,
  },
  {
    title: 'Fresha Marketplace new-client fee',
    body: `Fresha charges a one-time fee of ${FRESHA_MARKETPLACE_PERCENT} of a brand-new client’s first appointment, minimum ${FRESHA_MARKETPLACE_MINIMUM}, when that client first discovers you on the Fresha Marketplace.`,
  },
  {
    title: 'A one-time acquisition fee',
    body: 'Both Boost and the Fresha new-client fee are charged once for winning a new client, not on every later visit. The cost per client depends on the value of that first appointment.',
  },
  {
    title: 'Direct vs marketplace-acquired bookings',
    body: 'Clients who already know you and book through your own links are not marketplace-acquired. Only genuinely new clients introduced by the marketplace should be counted against these fees.',
  },
];

export const MARKETPLACE_KERSIVO_NOTE =
  'KERSIVO does not run a consumer marketplace and does not provide marketplace client acquisition. It uses a direct, branded booking model: clients book through your own website and booking journey, found through your own channels such as Google, Instagram, referrals and walk-ins.';

/* ----------------------------------- VAT ----------------------------------- */

export const VAT_PARAGRAPHS: readonly string[] = [
  `Competitor prices are often listed before VAT. Booksy shows its UK prices plus VAT, and Fresha lists UK rates exclusive of ${FRESHA_VAT}. The amount that leaves your bank account is therefore higher than the headline price.`,
  'For a VAT-registered barbershop, the effective net cost can differ from that cash cost, depending on your own tax position and whether you can reclaim input VAT.',
  'KERSIVO is not currently VAT registered, so no VAT is added to the KERSIVO subscription.',
  'The calculator shows cash cost and estimated net cost separately, so you can see both views side by side.',
];

export const VAT_DISCLAIMER =
  'VAT treatment depends on your business circumstances. Check with your accountant for your own VAT position.';

/* --------------------------------- Payments -------------------------------- */

const DEPOSIT_BENCHMARK = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const FRESHA_ONLINE_PAYMENTS_FEE = feeLabel(onlinePayments.percent!, onlinePayments.amountGbp!);

export const PAYMENTS_INTRO = `Payment processing is a separate cost from the software subscription. The calculator can optionally compare one like-for-like flow: the same ${DEPOSIT_BENCHMARK} online booking deposit taken through each platform. It does not model the remaining appointment balance, in-person card payments or retail payments.`;

export const PAYMENTS_POINTS: readonly MarketplacePoint[] = [
  {
    title: 'Booksy Mobile Payments',
    body: `Booksy deposits run through Mobile Payments at ${feeLabel(BOOKSY_MOBILE_PAYMENTS_PERCENT, BOOKSY_MOBILE_PAYMENTS_FIXED_GBP)} per transaction plus VAT, checked on ${BOOKSY_PAYMENT_FACTS_CHECKED_DATE}.`,
  },
  {
    title: 'Fresha Online Payments',
    body: `Fresha applies its standard online payment rate of ${FRESHA_ONLINE_PAYMENTS_FEE} per transaction plus VAT to online deposits.`,
  },
  {
    title: 'KERSIVO via Stripe Checkout',
    body: `KERSIVO deposits are processed by Stripe Checkout, with no KERSIVO fee on top. The KERSIVO estimate assumes the connected barbershop pays Stripe’s standard UK card rate of ${feeLabel(STRIPE_UK_STANDARD_CARD_PERCENT, STRIPE_UK_STANDARD_CARD_FIXED_GBP)}, checked on ${STRIPE_FACTS_CHECKED_DATE}. Premium UK and international cards cost more.`,
  },
  {
    title: 'What is not modelled',
    body: 'Refund-related processing costs are excluded, and each modelled deposit is rounded to the nearest penny. Processing rates can change, so check each provider directly before deciding.',
  },
];

/* -------------------------------- Scenarios -------------------------------- */

export type CostScenario = {
  label: string;
  barbers: string;
  body: string;
};

export const SCENARIOS_INTRO =
  'Worked examples make the differences easier to see. These scenarios will be calculated from the same official pricing and the same methodology as the interactive calculator, rather than estimated by hand.';

export const COST_SCENARIOS: readonly CostScenario[] = [
  {
    label: 'Solo barber',
    barbers: '1 bookable barber',
    body: 'Entry plans compared side by side, with the effect of marketplace clients, add-ons and VAT on a one-chair business.',
  },
  {
    label: '3-barber shop',
    barbers: '3 bookable barbers',
    body: 'How per-user and per-team-member charges begin to separate the platforms in a small team.',
  },
  {
    label: '5-barber shop',
    barbers: '5 bookable barbers',
    body: 'Monthly and 3-year costs for an established shop, with and without marketplace-acquired clients.',
  },
  {
    label: '8-barber shop',
    barbers: '8 bookable barbers',
    body: 'The team-size effect at scale, alongside optional add-ons and payment processing.',
  },
];

export const SCENARIOS_NOTE =
  'Scenario figures will be generated by the calculation engine and published alongside the interactive calculator.';

/* ------------------------------- Methodology ------------------------------- */

export const METHODOLOGY_INTRO =
  'The calculator compares estimated costs using your own inputs and each platform’s published UK pricing. These are the factors it uses.';

export const METHODOLOGY_FACTORS: readonly string[] = [
  'Number of bookable barbers',
  'Appointments per month',
  'Average appointment value',
  'Marketplace-acquired new clients',
  'Optional Booksy Boost',
  'VAT status',
  'Optional add-ons',
  'Optional booking deposit processing',
];

export const METHODOLOGY_PRINCIPLES: readonly MarketplacePoint[] = [
  {
    title: 'Direct bookings stay direct',
    body: 'Clients who book through your own links are not counted as marketplace-acquired, so they never attract marketplace fees in the calculation.',
  },
  {
    title: 'No assumed marketplace parity',
    body: 'Marketplace fee comparisons do not assume every platform brings in the same number of new clients. You set marketplace usage yourself.',
  },
  {
    title: 'Official sources only',
    body: 'Competitor pricing comes from official UK pricing pages and help centres, with the date each source was checked shown below.',
  },
  {
    title: 'Estimates, not quotes',
    body: 'Pricing can change and every shop is different. Results are estimates to support a decision, not a quote from any provider.',
  },
];
