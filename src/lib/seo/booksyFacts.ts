/**
 * Static Booksy UK competitor facts for the /booksy-alternative page.
 * Checked against official Pricing + Boost pages only — never scrape at runtime.
 * Do NOT use stale Boost figures from the general Features page (forty percent / ten pounds).
 */

export const BOOKSY_FACTS_CHECKED_DATE = '17 September 2026';
export const BOOKSY_FACTS_CHECKED_ISO = '2026-09-17';

export const BOOKSY_SOURCE_PRICING = 'https://biz.booksy.com/en-gb/pricing';
export const BOOKSY_SOURCE_BOOST = 'https://biz.booksy.com/en-gb/features/boost';

/** Booksy UK base subscription (GBP, ex VAT) as publicly listed. */
export const BOOKSY_BASE_PRICE_GBP = 40;

/** Booksy additional user (GBP per user per month, ex VAT) as publicly listed. */
export const BOOKSY_ADDITIONAL_USER_GBP = 5;

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
export const BOOKSY_BOOST_COMMISSION_PERCENT = 30;
export const BOOKSY_BOOST_MINIMUM_GBP = 5;

/**
 * Booksy Mobile Payments (card payments taken online, including No-Show Protection deposits).
 * Checked separately from the subscription facts; Tap to Pay and terminal rates are not modelled.
 */
export const BOOKSY_PAYMENT_FACTS_CHECKED_DATE = '1 October 2026';
export const BOOKSY_PAYMENT_FACTS_CHECKED_ISO = '2026-10-01';
export const BOOKSY_SOURCE_NO_SHOW_PROTECTION = 'https://biz.booksy.com/en-gb/features/no-show-protection';
export const BOOKSY_SOURCE_PAYMENTS = 'https://biz.booksy.com/en-gb/features/payments';
export const BOOKSY_MOBILE_PAYMENTS_PERCENT = 1.29;
export const BOOKSY_MOBILE_PAYMENTS_FIXED_GBP = 0.2;
/** Booksy lists Mobile Payments fees exclusive of VAT. */
export const BOOKSY_MOBILE_PAYMENTS_VAT = 'exclusive' as const;

export const BOOKSY_BOOST_SUMMARY =
  'Optional Boost can charge a one-time acquisition fee when it brings a qualifying new client — currently 30% of the first visit, minimum £5';

export const BOOKSY_TRADEMARK_DISCLAIMER = `Booksy is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Booksy. Booksy pricing and feature information was checked against publicly available UK Booksy sources on ${BOOKSY_FACTS_CHECKED_DATE} and may change.`;

export type BooksyCompareRow = {
  title: string;
  kersivo: string;
  booksy: string;
};

export const BOOKSY_COMPARE_ROWS: readonly BooksyCompareRow[] = [
  {
    title: 'Core approach',
    kersivo: 'Branded barbershop website + booking and management platform',
    booksy: 'Booking and business platform + Marketplace ecosystem',
  },
  {
    title: 'Base price',
    kersivo: '£39/month per location',
    booksy: BOOKSY_BASE_PRICE_LABEL,
  },
  {
    title: 'Additional users',
    kersivo: 'Included within one barbershop location',
    booksy: BOOKSY_ADDITIONAL_USER_LABEL,
  },
  {
    title: 'Branded website / booking presence',
    kersivo: 'A professional branded barbershop website is included',
    booksy:
      'Booksy Profile and booking tools; a Booksy booking widget can also be added to an existing website',
  },
  {
    title: 'Domain',
    kersivo: 'One standard domain included',
    booksy: 'Can integrate Booksy booking tools with an existing website',
  },
  {
    title: 'Marketplace discovery',
    kersivo: 'Direct branded booking journey — no marketplace required',
    booksy: 'Booksy Marketplace and customer app discovery',
  },
  {
    title: 'Booking / marketplace commission',
    kersivo: '0% KERSIVO commission on bookings and retail sales',
    booksy: 'Standard Marketplace bookings are free when Boost is not enabled',
  },
  {
    title: 'Optional marketplace acquisition',
    kersivo: 'Direct bookings with 0% KERSIVO commission',
    booksy: BOOKSY_BOOST_SUMMARY,
  },
  {
    title: 'Deposits',
    kersivo: 'Optional £5 booking deposits with no-show protection',
    booksy: 'Deposits and no-show protection tools available',
  },
  {
    title: 'Client management',
    kersivo: 'Yes',
    booksy: 'Yes',
  },
  {
    title: 'Appointment reminders',
    kersivo: 'Automated email and SMS appointment reminders included',
    booksy: 'Automatic appointment reminders included',
  },
  {
    title: 'Booking experience',
    kersivo: 'Centred on the barbershop website, domain and brand',
    booksy:
      'Booksy Profile, direct booking links, website widget, Marketplace and customer app',
  },
] as const;
