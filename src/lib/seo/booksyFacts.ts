/**
 * Static Booksy UK competitor facts for /booksy-alternative and the cost calculator.
 * Single source of truth for Booksy facts — components must not hardcode Booksy claims.
 *
 * Never scrape at runtime. Checked against official Booksy UK (en-gb) pages and the
 * Booksy UK Help Centre only. Do NOT use Boost figures from the generic Features page,
 * which has carried older forty-percent / ten-pound copy; Boost terms come from the
 * dedicated Boost page and the Pricing page.
 */

import { formatGbp, formatPercent } from '@/lib/seo/freshaFacts';

/** Human-readable date the facts below were checked against official Booksy sources. */
export const BOOKSY_FACTS_CHECKED_DATE = '2 October 2026';
export const BOOKSY_FACTS_CHECKED_ISO = '2026-10-02';

export type BooksySourceId =
  | 'pricingUk'
  | 'boost'
  | 'marketplace'
  | 'onlineBooking'
  | 'payments'
  | 'tapToPay'
  | 'noShowProtection'
  | 'websiteWidget'
  | 'clientList'
  | 'customerApp';

export type BooksyFactSource = {
  id: BooksySourceId;
  label: string;
  /** What this source supports on the page, shown next to the link. */
  supports: string;
  url: string;
};

/** Official Booksy sources backing published facts. */
export const BOOKSY_SOURCES: readonly BooksyFactSource[] = [
  {
    id: 'pricingUk',
    label: 'Booksy pricing (UK)',
    supports: 'base subscription, additional users, VAT, free Marketplace bookings and payment rates',
    url: 'https://biz.booksy.com/en-gb/pricing',
  },
  {
    id: 'boost',
    label: 'Booksy Boost (UK)',
    supports: 'the optional Boost one-time new-client fee, its minimum and commission-free channels',
    url: 'https://biz.booksy.com/en-gb/features/boost',
  },
  {
    id: 'marketplace',
    label: 'Booksy Marketplace (UK)',
    supports: 'Marketplace listing, Reserve with Google, Instagram and Facebook booking',
    url: 'https://biz.booksy.com/en-gb/features/marketplace',
  },
  {
    id: 'onlineBooking',
    label: 'Booksy Online Booking (UK)',
    supports: 'Booksy Profile, self-booking, rescheduling, waitlists and add-ons',
    url: 'https://biz.booksy.com/en-gb/features/online-booking',
  },
  {
    id: 'payments',
    label: 'Booksy Payments (UK)',
    supports: 'Mobile Payments, checkout, deposits and reporting',
    url: 'https://biz.booksy.com/en-gb/features/payments',
  },
  {
    id: 'tapToPay',
    label: 'Booksy Tap to Pay (UK)',
    supports: 'the Tap to Pay in-person processing rate',
    url: 'https://biz.booksy.com/en-gb/features/tap-to-pay',
  },
  {
    id: 'noShowProtection',
    label: 'Booksy No-Show Protection (UK)',
    supports: 'deposits and cancellation fees taken through Mobile Payments',
    url: 'https://biz.booksy.com/en-gb/features/no-show-protection',
  },
  {
    id: 'websiteWidget',
    label: 'Booksy Help Centre: Add a booking widget to your website',
    supports: 'the website booking widget',
    url: 'https://support.booksy.com/hc/en-gb/articles/23480739244434-How-to-add-a-booking-widget-to-my-website-WordPress-Joomla-and-other-CMS-Platforms',
  },
  {
    id: 'clientList',
    label: 'Booksy Help Centre: Obtain a copy of your client list',
    supports: 'requesting a client list from Booksy Support',
    url: 'https://support.booksy.com/hc/en-gb/articles/16539806017938-How-do-I-obtain-a-copy-of-my-Client-List-from-Booksy',
  },
  {
    id: 'customerApp',
    label: 'Booksy Help Centre: Do clients need the Booksy app?',
    supports: 'booking without the Booksy for Customers app',
    url: 'https://support.booksy.com/hc/en-gb/articles/16486697667346-Do-my-clients-need-to-have-Booksy-for-Customers-downloaded-on-their-mobile-device-to-book-with-me',
  },
];

export function getBooksySource(id: BooksySourceId): BooksyFactSource {
  const source = BOOKSY_SOURCES.find((entry) => entry.id === id);
  if (!source) throw new Error(`Unknown Booksy source: ${id}`);
  return source;
}

/**
 * Booksy lists UK prices "plus VAT" without stating the rate; VAT-inclusive
 * estimates use the UK standard rate.
 */
export const BOOKSY_UK_VAT_PERCENT = 20;

export type BooksyUnresolvedFact = {
  status: 'unresolved';
  note: string;
};

export type BooksyVerifiedFact = {
  status: 'verified';
  /** Fixed GBP amount (subscription, per-transaction fixed fee). */
  amountGbp?: number;
  /** Percentage rate, e.g. 30 for 30%. */
  percent?: number;
  /** Minimum GBP charge applied alongside `percent`. */
  minimumGbp?: number;
  vat: 'inclusive' | 'exclusive' | 'not-applicable';
  /** What the value is charged per. */
  per: string;
  sourceId: BooksySourceId;
  checkedIso: string;
};

export type BooksyFact = BooksyUnresolvedFact | BooksyVerifiedFact;

const CHECKED = BOOKSY_FACTS_CHECKED_ISO;

/** Booksy UK commercial terms. Only `verified` entries may be rendered. */
export const BOOKSY_UK_COMMERCIAL_FACTS = {
  baseSubscription: {
    status: 'verified',
    amountGbp: 40,
    vat: 'exclusive',
    per: 'month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  additionalUser: {
    status: 'verified',
    amountGbp: 5,
    vat: 'exclusive',
    per: 'additional user per month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  standardMarketplaceBooking: {
    status: 'verified',
    amountGbp: 0,
    vat: 'not-applicable',
    per: 'Marketplace booking when Boost is not enabled',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  boostMonthlyFee: {
    status: 'verified',
    amountGbp: 0,
    vat: 'not-applicable',
    per: 'month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  boostNewClientFee: {
    status: 'verified',
    percent: 30,
    minimumGbp: 5,
    vat: 'exclusive',
    per: 'first visit of a new client found through Boost (one-time)',
    sourceId: 'boost',
    checkedIso: CHECKED,
  },
  mobilePayments: {
    status: 'verified',
    percent: 1.29,
    amountGbp: 0.2,
    vat: 'exclusive',
    per: 'transaction',
    sourceId: 'payments',
    checkedIso: CHECKED,
  },
  tapToPay: {
    status: 'verified',
    percent: 0.99,
    amountGbp: 0.2,
    vat: 'exclusive',
    per: 'transaction',
    sourceId: 'tapToPay',
    checkedIso: CHECKED,
  },
  clientListExportFormat: {
    status: 'unresolved',
    note: 'The UK Help Centre says a client list is requested from Booksy Support; the file format and fields are not stated.',
  },
} as const satisfies Record<string, BooksyFact>;

export type BooksyCommercialFactKey = keyof typeof BOOKSY_UK_COMMERCIAL_FACTS;

export function isVerifiedBooksyFact(fact: BooksyFact): fact is BooksyVerifiedFact {
  return fact.status === 'verified';
}

/** Throws at build time if a component tries to render an unresolved Booksy value. */
export function requireVerifiedBooksyFact(key: BooksyCommercialFactKey): BooksyVerifiedFact {
  const fact: BooksyFact = BOOKSY_UK_COMMERCIAL_FACTS[key];
  if (!isVerifiedBooksyFact(fact)) {
    throw new Error(`Booksy fact "${key}" is unresolved and must not be rendered.`);
  }
  return fact;
}

function roundPence(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addBooksyUkVat(amountGbp: number): number {
  return roundPence(amountGbp * (1 + BOOKSY_UK_VAT_PERCENT / 100));
}

export type BooksySubscriptionEstimate = {
  users: number;
  additionalUsers: number;
  exVatGbp: number;
  incVatGbp: number;
};

/** Monthly Booksy subscription only (no Boost, payment processing or SMS overage). */
export function estimateBooksyMonthlySubscription(users: number): BooksySubscriptionEstimate {
  if (!Number.isInteger(users) || users < 1) {
    throw new Error('users must be a positive integer');
  }
  const base = requireVerifiedBooksyFact('baseSubscription');
  const additional = requireVerifiedBooksyFact('additionalUser');
  const additionalUsers = users - 1;
  const exVatGbp = roundPence(base.amountGbp! + additional.amountGbp! * additionalUsers);
  return { users, additionalUsers, exVatGbp, incVatGbp: addBooksyUkVat(exVatGbp) };
}

/** One-time Boost fee (ex VAT) on a qualifying new client's first visit. */
export function estimateBooksyBoostFee(firstVisitGbp: number): number {
  const fee = requireVerifiedBooksyFact('boostNewClientFee');
  return roundPence(Math.max((firstVisitGbp * fee.percent!) / 100, fee.minimumGbp!));
}

const baseSubscription = requireVerifiedBooksyFact('baseSubscription');
const additionalUser = requireVerifiedBooksyFact('additionalUser');
const boostFee = requireVerifiedBooksyFact('boostNewClientFee');
const mobilePayments = requireVerifiedBooksyFact('mobilePayments');
const tapToPay = requireVerifiedBooksyFact('tapToPay');

export function formatBooksyRate(fact: BooksyVerifiedFact): string {
  return `${formatPercent(fact.percent!)} + ${formatGbp(fact.amountGbp!)}`;
}

/* Legacy exports consumed by the barber software cost calculator. */

export const BOOKSY_SOURCE_PRICING = getBooksySource('pricingUk').url;
export const BOOKSY_SOURCE_BOOST = getBooksySource('boost').url;

/** Booksy UK base subscription (GBP, ex VAT) as publicly listed. */
export const BOOKSY_BASE_PRICE_GBP = baseSubscription.amountGbp!;

/** Booksy additional user (GBP per user per month, ex VAT) as publicly listed. */
export const BOOKSY_ADDITIONAL_USER_GBP = additionalUser.amountGbp!;

/** Booksy lists its subscription, additional users and Boost fees exclusive of VAT. */
export const BOOKSY_PRICES_VAT = 'exclusive' as const;

/** Booksy UK base subscription as publicly listed. */
export const BOOKSY_BASE_PRICE_LABEL = `£${BOOKSY_BASE_PRICE_GBP}/month + VAT`;

/** Booksy additional users as publicly listed. */
export const BOOKSY_ADDITIONAL_USER_LABEL = `£${BOOKSY_ADDITIONAL_USER_GBP}/month each + VAT`;

/** Booksy additional users, phrased per user. */
export const BOOKSY_PER_ADDITIONAL_USER_LABEL = `£${BOOKSY_ADDITIONAL_USER_GBP}/month + VAT per additional user`;

/** Standard Marketplace bookings when Boost is not enabled. */
export const BOOKSY_STANDARD_MARKETPLACE_BOOKINGS =
  'Standard Marketplace bookings are free when Boost is not enabled';

/** Optional Boost: one-time first-visit fee. */
export const BOOKSY_BOOST_COMMISSION_PERCENT = boostFee.percent!;
export const BOOKSY_BOOST_MINIMUM_GBP = boostFee.minimumGbp!;

/** Payment facts were re-checked together with the subscription facts. */
export const BOOKSY_PAYMENT_FACTS_CHECKED_DATE = BOOKSY_FACTS_CHECKED_DATE;
export const BOOKSY_PAYMENT_FACTS_CHECKED_ISO = BOOKSY_FACTS_CHECKED_ISO;
export const BOOKSY_SOURCE_NO_SHOW_PROTECTION = getBooksySource('noShowProtection').url;
export const BOOKSY_SOURCE_PAYMENTS = getBooksySource('payments').url;
export const BOOKSY_MOBILE_PAYMENTS_PERCENT = mobilePayments.percent!;
export const BOOKSY_MOBILE_PAYMENTS_FIXED_GBP = mobilePayments.amountGbp!;
/** Booksy lists Mobile Payments fees exclusive of VAT. */
export const BOOKSY_MOBILE_PAYMENTS_VAT = 'exclusive' as const;

export const BOOKSY_TRADEMARK_DISCLAIMER = `Booksy is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Booksy. Booksy pricing and feature information was checked against publicly available UK Booksy sources on ${BOOKSY_FACTS_CHECKED_DATE} and may change.`;

export const BOOKSY_COMPARISON_FOOTNOTE = `Booksy feature descriptions are based on Booksy’s public UK website and Help Centre, checked on ${BOOKSY_FACTS_CHECKED_DATE}. Features and pricing can change, so check Booksy directly for the latest details.`;

export type BooksyCompareSectionId =
  | 'bookings'
  | 'payments'
  | 'brand'
  | 'retail'
  | 'clients'
  | 'reports';

export type BooksyCompareSection = {
  id: BooksyCompareSectionId;
  title: string;
  subtitle: string;
  booksyLead: string;
  booksyPoints: readonly string[];
  /** Official sources backing the Booksy lead and points in this section. */
  booksySourceIds: readonly BooksySourceId[];
  kersivoLead: string;
  kersivoPoints: readonly string[];
};

export const BOOKSY_COMPARE_SECTIONS: readonly BooksyCompareSection[] = [
  {
    id: 'bookings',
    title: 'Bookings',
    subtitle: 'Compare the client booking journey and day-to-day scheduling.',
    booksyLead:
      'Online self-booking through your Booksy Profile, direct links, social buttons, Google and the Booksy Marketplace.',
    booksyPoints: [
      'Booksy Profile and a direct booking link to share with clients',
      'Instagram and Facebook booking buttons, plus Reserve with Google',
      'A booking widget that can be added to an existing website',
      'Client rescheduling within your notice period, and automated waitlists',
    ],
    booksySourceIds: ['onlineBooking', 'marketplace', 'websiteWidget'],
    kersivoLead: 'A branded booking journey built around your own barbershop.',
    kersivoPoints: [
      'Hosted booking page on Starter; branded booking website on your own domain with Full',
      'Services, barbers and availability inside your own flow',
      'Deposits and payment steps built into the booking journey',
      'Bookings managed from one owner dashboard',
    ],
  },
  {
    id: 'payments',
    title: 'Payments & Deposits',
    subtitle: 'How each platform protects bookings and handles payment steps.',
    booksyLead: 'Mobile Payments, Tap to Pay and No-Show Protection inside Booksy.',
    booksyPoints: [
      'Deposits and cancellation fees with a card on file through Mobile Payments',
      `Mobile Payments at ${formatBooksyRate(mobilePayments)} + VAT per transaction`,
      `Tap to Pay at ${formatBooksyRate(tapToPay)} + VAT per transaction, with no card reader`,
      'Integrated checkout with tips, discounts and gift card balances',
    ],
    booksySourceIds: ['noShowProtection', 'payments', 'tapToPay'],
    kersivoLead: 'Payment protection inside your own branded booking journey.',
    kersivoPoints: [
      'Optional booking deposits for online appointments',
      'Deposit status visible in the KERSIVO admin',
      'Client payment steps stay connected to your booking flow',
      '0% KERSIVO commission on booking payments, on Starter and Full',
    ],
  },
  {
    id: 'brand',
    title: 'Brand & Domain',
    subtitle: 'Where the client journey lives and whose brand stays in front.',
    booksyLead: 'Booksy combines your Booksy Profile and direct links with its Marketplace.',
    booksyPoints: [
      'Booksy Profile with your services, prices, portfolio and reviews',
      'Direct booking links, QR codes and a website widget',
      'Free Marketplace listing on booksy.com and in the Booksy for Customers app',
      'Marketplace visibility can be turned off while still using Booksy for bookings',
    ],
    booksySourceIds: ['onlineBooking', 'boost', 'marketplace', 'websiteWidget'],
    kersivoLead: 'Your booking journey stays under your own shop identity.',
    kersivoPoints: [
      'Full KERSIVO: your own branded website on your own domain',
      'Starter: a hosted KERSIVO booking page with your services and team',
      'Your logo, services and shop identity throughout the journey',
      'No marketplace dependency required to take bookings',
      'A direct client relationship built around your business',
    ],
  },
  {
    id: 'retail',
    title: 'Retail & Upsells',
    subtitle: 'How extras and prepaid sales fit into the customer journey.',
    booksyLead: 'Add-ons, gift cards, memberships and packages inside Booksy.',
    booksyPoints: [
      'Add-on services clients can pick when they book',
      'Online gift cards, with Mobile Payments processing fees',
      'Memberships and packages included in the subscription',
      'Checkout run from the Booksy calendar',
    ],
    booksySourceIds: ['onlineBooking', 'pricingUk', 'payments'],
    kersivoLead: 'Retail pickup built into your own barbershop website with Full KERSIVO.',
    kersivoPoints: [
      'Retail is included in Full KERSIVO, not Starter',
      'Products sold from your own branded website',
      'Pickup orders managed from the KERSIVO admin',
      'Product recommendations can appear after a booking',
      '0% KERSIVO commission on Full retail sales',
    ],
  },
  {
    id: 'clients',
    title: 'Clients & Communication',
    subtitle: 'CRM, reminders and the relationship after the appointment.',
    booksyLead: 'Client management and marketing inside the Booksy platform.',
    booksyPoints: [
      'Client cards with contact details, booking history, notes and photos',
      'Free appointment confirmations and reminders',
      'Email and text message marketing included in the subscription',
      'Automatic “book again” reminders after a client’s first visit',
    ],
    booksySourceIds: ['marketplace', 'pricingUk', 'boost'],
    kersivoLead: 'Client records connected directly to your own booking operation.',
    kersivoPoints: [
      'Clients Core on Starter: contact details, recent visits and upcoming bookings',
      'Advanced Clients on Full: full history, internal notes and operational context',
      'Email reminders on both plans; SMS reminders on Full, subject to allowance',
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Admin',
    subtitle: 'The owner view behind bookings, clients, team and performance.',
    booksyLead: 'Stats, reporting and team access across Booksy.',
    booksyPoints: [
      'Detailed stats and reports included in the subscription',
      'Real-time visual reports on the Booksy dashboard',
      `Each additional team member adds ${formatGbp(additionalUser.amountGbp!)}/month + VAT`,
      'Waitlists, custom forms and reporting at no extra charge',
    ],
    booksySourceIds: ['pricingUk', 'payments'],
    kersivoLead: 'A focused owner dashboard built specifically for independent barbershops.',
    kersivoPoints: [
      'Bookings, team, clients and services on both plans',
      'Reports, products and orders with Full KERSIVO',
      'Daily operational view from one dashboard',
      'Built around the workflow of an independent barbershop',
    ],
  },
];
