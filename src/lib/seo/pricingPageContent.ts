/**
 * /pricing page copy (owner-facing). Commercial facts come from offer.ts, claimsPolicy.ts,
 * pricingPlans.ts and pricingPage.ts. This file only arranges approved wording; do not add
 * new prices, numbers or outcome claims here.
 */
import { offer } from '@/content/offer';
import {
  FREE_PREVIEW_BILLING_CLAIM,
  KERSIVO_COMMISSION_WITH_STRIPE,
  NO_PAUSE_SHORT,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { PRICING_FULL_BEST_FOR, PRICING_STARTER_BEST_FOR } from '@/lib/pricing/pricingPlans';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { KERSIVO_LIVE_DEMO_HREF } from '@/lib/demo/heritage/links';

const PRICE = `£${SAAS_MONTHLY_GBP}`;

/* ---------- Hero ---------- */

export const PRICING_HERO_EYEBROW = 'Pricing for independent UK barbershops';

/** Visual lines under the SEO H1 text. */
export const PRICING_HERO_LINES = [`${PRICE} a month.`, 'Your whole shop.'] as const;

export const PRICING_HERO_LEAD = `Full KERSIVO gives your barbershop its own branded website, your own domain and online booking — one flat ${PRICE}/month per location, with every barber at that location included (fair use). No setup fee, no VAT added and 0% KERSIVO commission. Stripe fees apply.`;

export const PRICING_HERO_FACTS = [
  'No setup fee',
  'No VAT added',
  'Not charged per barber',
  'Cancel anytime',
] as const;

/** Illustrative feed in the hero card. A fictional shop; the label says so on the page. */
export const PRICING_HERO_FEED = [
  { kind: 'site', title: 'yourshop.co.uk', meta: 'Your site, your name, your domain' },
  { kind: 'booking', title: 'New booking · Skin fade', meta: `Sat 10:15 · £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit paid` },
  { kind: 'reminder', title: 'Reminder sent', meta: 'Email and SMS, sent for you' },
  { kind: 'retail', title: 'Pickup order · Beard oil', meta: 'Paid online, collected in the shop' },
  { kind: 'report', title: 'Weekly report ready', meta: 'Bookings, deposits and trends' },
] as const;

/* ---------- Fit chooser ---------- */

export type PricingFitQuestion = { id: string; label: string };

/** Each question is one of the approved "Best for" reasons for Full KERSIVO. */
export const PRICING_FIT_QUESTIONS: readonly PricingFitQuestion[] = [
  { id: 'website', label: PRICING_FULL_BEST_FOR[0] },
  { id: 'payments', label: PRICING_FULL_BEST_FOR[1] },
  { id: 'team', label: PRICING_FULL_BEST_FOR[2] },
  { id: 'tools', label: PRICING_FULL_BEST_FOR[3] },
];

export const PRICING_FIT_RESULT = {
  empty: {
    plan: 'Your answer',
    title: 'Tick what your shop needs',
    body: 'We’ll show the plan that fits. Most shops that want their own name on the booking choose Full KERSIVO.',
  },
  full: {
    plan: offer.plans.full,
    title: `${PRICE}/month per location fits your shop`,
    body: 'Your own website and domain, your own payment rules, every barber at the location and the wider shop tools — in one flat monthly price.',
  },
  starter: {
    plan: offer.plans.starter,
    title: 'Starter could be enough for now',
    body: `£0/month for online bookings with up to 4 barbers, if ${PRICING_STARTER_BEST_FOR[2].replace(/^you're/, 'you’re')}. You can move to Full KERSIVO later.`,
  },
} as const;

/* ---------- Outcomes ---------- */

export type PricingOutcome = { id: string; kicker: string; title: string; body: string };

/** Owner outcomes, each restating an approved Full KERSIVO inclusion. */
export const PRICING_OUTCOMES: readonly PricingOutcome[] = [
  {
    id: 'brand',
    kicker: 'Your website + own domain',
    title: 'Clients book you under your own name',
    body: 'A branded website designed around your shop, on your own domain. Clients book there — not on a listing next to the shop down the road.',
  },
  {
    id: 'team',
    kicker: 'Priced per location',
    title: 'Take on a barber without a bigger bill',
    body: `One ${PRICE} per location, not per barber. More than 4 bookable barbers at the same location, subject to reasonable fair use.`,
  },
  {
    id: 'payments',
    kicker: 'Payment controls',
    title: 'You decide how clients pay',
    body: `Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment — set it the way your shop works.`,
  },
  {
    id: 'reminders',
    kicker: 'Confirmations + reminders',
    title: 'Reminders go out without you',
    body: 'Email confirmations and reminders, plus SMS appointment reminders within a monthly allowance.',
  },
  {
    id: 'reports',
    kicker: 'Reports',
    title: 'See how the shop is really doing',
    body: 'Track booked and completed service value, deposits, booking trends and shop performance.',
  },
  {
    id: 'retail',
    kicker: 'Retail pickup',
    title: 'Sell products between cuts',
    body: 'Clients order products online and collect them in your shop. 0% KERSIVO commission on retail too.',
  },
];

/* ---------- Bill ---------- */

export type PricingBillLine = { label: string; value: string; note?: string };

export const PRICING_BILL_LINES: readonly PricingBillLine[] = [
  { label: 'Full KERSIVO, one location', value: `${PRICE}.00` },
  { label: 'Setup fee', value: '£0.00' },
  { label: 'Extra barbers at the same location', value: '£0.00', note: 'Fair use' },
  { label: 'VAT', value: '£0.00', note: 'Not VAT registered' },
  { label: 'KERSIVO commission on bookings and retail', value: '0%' },
];

export const PRICING_BILL_FOOTNOTE = `${STRIPE_FEES_NOTE} Stripe charges these for processing card payments; KERSIVO takes nothing from them.`;

export const PRICING_BILL_TERMS = [offer.billing.cycleShort, NO_PAUSE_SHORT, offer.billing.refund] as const;

/* ---------- Start ---------- */

export type PricingStep = { title: string; body: string };

export function getPricingSteps(freePreview: boolean): PricingStep[] {
  return [
    freePreview
      ? { title: 'See your free preview', body: FREE_PREVIEW_BILLING_CLAIM }
      : { title: 'Subscribe', body: `${PRICE} today, then monthly on the same day. Secure checkout through Stripe.` },
    {
      title: 'Tell us about your shop',
      body: 'Send your shop name, logo, photos, team, opening hours and anything we need to move your bookings over from your current system.',
    },
    {
      title: 'Approve and go live',
      body: 'You check a private preview before anything is published. Typically ready in a few days once we receive all required information.',
    },
  ];
}

/* ---------- Still comparing ---------- */

export const PRICING_COMPARE_LINKS = [
  {
    href: '/barber-software-cost-calculator',
    kicker: 'Cost calculator',
    title: 'Put your current bill next to £39',
    body: 'Enter your team and booking numbers and see what each system really costs your shop.',
  },
  {
    href: '/compare',
    kicker: 'Compare',
    title: 'Booking software for UK barbers, side by side',
    body: 'Pricing models, commission and own-website options across 11 systems.',
  },
  {
    href: KERSIVO_LIVE_DEMO_HREF,
    kicker: 'Live demo',
    title: 'See a shop running on KERSIVO',
    body: 'Click through a working barbershop site and booking flow.',
  },
] as const;

export const PRICING_ALTERNATIVE_LINKS = [
  { href: '/booksy-alternative', label: 'Booksy' },
  { href: '/fresha-alternative', label: 'Fresha' },
  { href: '/treatwell-alternative', label: 'Treatwell' },
  { href: '/nearcut-alternative', label: 'Nearcut' },
  { href: '/timely-alternative', label: 'Timely' },
  { href: '/square-appointments-alternative', label: 'Square Appointments' },
] as const;

export const PRICING_STICKY_NOTE = { plan: `${offer.plans.full} · per location`, price: PRICE, unit: '/month' } as const;

export { KERSIVO_COMMISSION_WITH_STRIPE };
