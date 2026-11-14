/**
 * Copy for /treatwell-alternative ("your shop, not a listing").
 * Every Treatwell figure is read from treatwellFacts.ts; every KERSIVO figure from defaults /
 * claimsPolicy. Speaks to the shop owner; never assumes the reader already uses Treatwell.
 */
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  TREATWELL_FACTS_CHECKED_DATE,
  estimateTreatwellPublishedBookingFees,
  requireVerifiedTreatwellFact,
} from '@/lib/seo/treatwellFacts';

const pct = (n: number) => `${n}%`;
const gbp = (n: number) => (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`);

export const TW_NEW_CLIENT_PERCENT = requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent!;
export const TW_REPEAT_PERCENT = requireVerifiedTreatwellFact('repeatBookingMarketplaceCommission').percent!;
export const TW_PREPAY_PERCENT = requireVerifiedTreatwellFact('onlinePrepaymentProcessing').percent!;
const tapToPay = requireVerifiedTreatwellFact('tapToPayProcessing');
const terminal = requireVerifiedTreatwellFact('cardMachineOneOff');

const NEW_CLIENT = pct(TW_NEW_CLIENT_PERCENT);
const REPEAT = pct(TW_REPEAT_PERCENT);
const PREPAY = pct(TW_PREPAY_PERCENT);
const FULL = gbp(SAAS_MONTHLY_GBP);
const DEPOSIT = gbp(KERSIVO_BOOKING_DEPOSIT_GBP);

/* ---------- Hero ---------- */

export const TW_HERO_EYEBROW = 'Treatwell alternative · UK barbershops';
export const TW_HERO_TITLE_LINES = ['A Treatwell alternative', 'where your shop', 'is the brand'] as const;
export const TW_HERO_LEAD = `On a marketplace your shop is one listing among many, and a qualifying new client can cost ${NEW_CLIENT} + VAT of their first visit. With Full KERSIVO, clients book on your own website, under your name, for a flat ${FULL}/month per location.`;
export const TW_HERO_FACTS = [
  `${FULL}/month per location, flat`,
  '0% KERSIVO commission · Stripe fees apply',
  'Your own website and domain',
  'No setup fee',
] as const;

/** The hero phone: the same shop, shown two ways. */
export const TW_HERO_VIEWS = [
  { id: 'listing', label: 'On a marketplace' },
  { id: 'own', label: 'On your own site' },
] as const;

/* ---------- Short answer + "where are you starting from?" ---------- */

export const TW_ANSWER_TITLE = 'Treatwell vs KERSIVO: the short answer';
export const TW_ANSWER_LEAD = `Treatwell is salon software with a consumer marketplace that can send you new clients, at ${NEW_CLIENT} + VAT on eligible first marketplace bookings. KERSIVO is booking software for independent UK barbershops with no marketplace: your clients book you directly, on your own site, with 0% KERSIVO commission. Standard Stripe fees apply to card payments.`;
export const TW_ANSWER_FACTS = [
  { label: 'Full KERSIVO', value: `${FULL}/month per location` },
  { label: 'KERSIVO Starter', value: '£0/month · up to 4 barbers' },
  { label: 'Treatwell, eligible new marketplace client', value: `${NEW_CLIENT} + VAT commission` },
  { label: 'Treatwell, repeat and direct bookings', value: `${REPEAT} marketplace commission` },
] as const;

export type TwStartingPoint = {
  id: string;
  label: string;
  title: string;
  points: readonly string[];
  link: { label: string; href: string };
};

export const TW_STARTING_POINTS: readonly TwStartingPoint[] = [
  {
    id: 'on-treatwell',
    label: 'I’m on Treatwell now',
    title: 'Look at where your bookings really come from.',
    points: [
      `If most clients already book through your own links, Treatwell charges ${REPEAT} marketplace commission on those. The bigger questions are your monthly software quote and whose name the client sees.`,
      `If the marketplace still fills your chair with new faces, that discovery has value. Weigh it against ${NEW_CLIENT} + VAT on each eligible first visit.`,
      'Check your signed agreement before running two booking systems in public.',
    ],
    link: { label: 'See how switching works', href: '#switching' },
  },
  {
    id: 'first-system',
    label: 'I’m choosing my first booking system',
    title: 'You don’t need a marketplace to take online bookings.',
    points: [
      `Full KERSIVO gives you a branded website on your own domain with booking built in, for ${FULL}/month per location.`,
      `Only need a booking page for up to 4 barbers? KERSIVO Starter is £0/month, with a ${DEPOSIT} deposit or full payment at booking.`,
      'Put the link on Google, Instagram and a QR code at the till, and clients book you directly.',
    ],
    link: { label: 'See Full KERSIVO pricing', href: '/pricing#plan' },
  },
  {
    id: 'other-app',
    label: 'I use another booking app',
    title: 'Same question, different logo.',
    points: [
      'Whatever you use today, ask three things: who owns the client relationship, how the bill grows with your team, and whether clients book under your name.',
      'We compare KERSIVO with Fresha, Booksy, Square Appointments and others, using each provider’s published UK pricing.',
    ],
    link: { label: 'Compare all alternatives', href: '/compare' },
  },
  {
    id: 'phone-dm',
    label: 'I take bookings by phone and DM',
    title: 'Online booking without handing clients to a marketplace.',
    points: [
      'Clients pick a barber, a service and a time themselves, day or night, without waiting for you to reply between cuts.',
      `Every online booking can carry a ${DEPOSIT} deposit or full payment, so a held chair has money behind it.`,
      'Your booking page carries your shop’s name, not a list of shops nearby.',
    ],
    link: { label: 'Try the live demo', href: '/demo' },
  },
];

/* ---------- Outcomes ---------- */

export const TW_OUTCOMES_TITLE = 'What changes when the booking is yours';
export const TW_OUTCOMES_LEAD =
  'This is the part that matters to you as the owner: the name on the page, the clients you keep and a bill you can plan around.';

/* ---------- 365-day rule ---------- */

export const TW_RULE_TITLE = 'The 365-day rule, in one slider';
export const TW_RULE_LEAD = `On Treatwell, whether a booking counts as “new” decides whether it carries ${NEW_CLIENT} + VAT. Under the September 2026 Partner Terms, a client who hasn’t had a successful appointment in the previous 365 days can be treated as new again, among other conditions.`;
export const TW_RULE_NOTE = `Illustration of Treatwell’s published UK rate and terms, checked ${TREATWELL_FACTS_CHECKED_DATE}. Real eligibility depends on booking source, client history and your signed agreement. Fees are subject to VAT.`;

/* ---------- Costs ---------- */

export const TW_COSTS_TITLE = 'What new marketplace clients cost';
export const TW_COSTS_LEAD =
  'Move the sliders to match a normal month. This shows Treatwell’s published new-client commission only; its monthly software fee is quote-based and not included.';
export const TW_COSTS_HONEST =
  'Those clients came to you through Treatwell’s marketplace. KERSIVO has no marketplace, so the real question is whether your chair needs one to stay full.';

export type TwFeeLine = { item: string; treatwell: string; kersivo: string };

export const TW_FEE_LINES: readonly TwFeeLine[] = [
  {
    item: 'Software subscription',
    treatwell: 'Quote-based; no universal monthly price published',
    kersivo: `${FULL}/month per location (Full) or £0/month (Starter)`,
  },
  {
    item: 'Eligible new marketplace client',
    treatwell: `${NEW_CLIENT} + VAT of the booking`,
    kersivo: 'No marketplace · 0% KERSIVO commission',
  },
  {
    item: 'Repeat and direct bookings',
    treatwell: `${REPEAT} marketplace commission`,
    kersivo: '0% KERSIVO commission',
  },
  {
    item: 'Online prepayments',
    treatwell: `${PREPAY} + VAT processing`,
    kersivo: 'Standard Stripe processing fees',
  },
  {
    item: 'In-shop card payments',
    treatwell: `${pct(tapToPay.percent!)} + ${gbp(tapToPay.fixedGbp!)} + VAT; terminal ${gbp(terminal.amountGbp!)} + VAT one-off`,
    kersivo: 'Pay at shop option on Full; KERSIVO is not a card terminal',
  },
  {
    item: 'Setup',
    treatwell: 'Depends on your agreement',
    kersivo: 'No setup fee',
  },
];

/* Published commission example: every figure comes from estimateTreatwellPublishedBookingFees. */
export const TREATWELL_COMMISSION_EXAMPLE_SERVICE_GBP = 25;
export const TW_ESTIMATOR_DEFAULTS = { newClients: 10, firstVisitGbp: 25 } as const;
export const TW_ESTIMATOR_LIMITS = {
  newClients: { min: 0, max: 40, step: 1 },
  firstVisitGbp: { min: 10, max: 60, step: 1 },
} as const;

/** Per-booking commission ex VAT at the example price, for the static (no-JS) reading. */
export const TW_EXAMPLE_COMMISSION_EX_VAT = estimateTreatwellPublishedBookingFees({
  servicePriceGbp: TREATWELL_COMMISSION_EXAMPLE_SERVICE_GBP,
  eligibility: 'eligible-new-marketplace',
  onlinePrepaid: 'no',
}).commissionExVatGbp!;

/* ---------- Comparison, fit, switching ---------- */

export const TW_COMPARE_TITLE = 'Feature by feature, side by side';
export const TW_COMPARE_LEAD =
  'Pick a topic. Treatwell is a wider salon platform; KERSIVO is built around one thing: barbershop bookings under your own name.';

export const TW_FIT = {
  treatwell: {
    heading: 'Treatwell may suit you better if…',
    points: [
      'You rely on a marketplace to bring in new clients each month',
      'You want salon-style POS, marketing and review tools in one system',
      'Your first appointments are profitable even after acquisition commission',
    ],
  },
  kersivo: {
    heading: 'KERSIVO is built for you if…',
    points: [
      'Clients mostly find you through Google, Instagram, walk-ins or word of mouth',
      `You want your own branded website and domain on a flat ${FULL}/month per location`,
      `You want a ${DEPOSIT} deposit or full payment behind online bookings`,
      'You’d rather your regulars never meet a list of shops nearby',
    ],
  },
} as const;

export const TW_FIT_CLOSING =
  'Marketplace reach can be worth paying for. Choose on where your clients come from and what you pay in total, not on commission headlines alone.';

export const TW_SWITCHING_TITLE = 'Moving over without losing a booking';
export const TW_SWITCHING_LEAD =
  'Keep taking bookings the way you do today while we prepare KERSIVO in the background. It’s typically ready in a few days once we receive all required information.';

export const TREATWELL_SWITCHING_STEPS = [
  { title: 'Keep your bookings running', body: 'Carry on with your current system while KERSIVO is prepared privately. Check your Treatwell contract for any restrictions on parallel booking software.' },
  { title: 'Ask for your data export', body: 'Ask Treatwell which customer, service and appointment fields your account can export.' },
  { title: 'We review what’s usable', body: 'KERSIVO helps assess compatible exports, including supported CSV files. Migration help is included.' },
  { title: 'Set up your shop', body: 'Barbers, services, prices and opening hours. Full includes your branded website and your own domain.' },
  { title: 'Check future bookings', body: 'Cross-check upcoming appointments and client records before you announce the change.' },
  { title: 'Switch your public links', body: 'Update Google, Instagram and your QR code once you’ve approved the new journey and checked your Treatwell obligations.' },
] as const;

export const TREATWELL_SWITCHING_LIMITS = [
  'Treatwell export availability and data fields must be verified; a complete automatic migration is not guaranteed.',
  'Treatwell’s terms restrict using another booking provider at the same time. Consult your signed agreement before enabling two public booking systems.',
] as const;

export const TW_FAQ_HEADING = 'Treatwell alternative questions, answered';
export const TW_FAQ_SUBHEADING =
  'Straight answers on Treatwell commission, the 365-day rule, pricing, switching and who each platform suits.';
