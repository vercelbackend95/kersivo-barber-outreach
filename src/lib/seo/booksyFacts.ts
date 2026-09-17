/**
 * Static Booksy UK competitor facts for the /booksy-alternative page.
 * Checked against official Pricing + Boost pages only — never scrape at runtime.
 * Do NOT use stale Boost figures from the general Features page (forty percent / ten pounds).
 */

export const BOOKSY_FACTS_CHECKED_DATE = '17 September 2026';
export const BOOKSY_FACTS_CHECKED_ISO = '2026-09-17';

export const BOOKSY_SOURCE_PRICING = 'https://biz.booksy.com/en-gb/pricing';
export const BOOKSY_SOURCE_BOOST = 'https://biz.booksy.com/en-gb/features/boost';

/** Booksy UK base subscription as publicly listed. */
export const BOOKSY_BASE_PRICE_LABEL = '£40/month + VAT';

/** Booksy additional users as publicly listed. */
export const BOOKSY_ADDITIONAL_USER_LABEL = '£5/month each + VAT';

/** Standard Marketplace bookings when Boost is not enabled. */
export const BOOKSY_STANDARD_MARKETPLACE_BOOKINGS =
  'Standard Marketplace bookings are free when Boost is not enabled';

/** Optional Boost: one-time first-visit fee. */
export const BOOKSY_BOOST_COMMISSION_PERCENT = 30;
export const BOOKSY_BOOST_MINIMUM_GBP = 5;

export const BOOKSY_BOOST_SUMMARY =
  'Optional Boost currently charges a one-time 30% fee on a new Boost client\'s first visit, minimum £5';

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
    kersivo: 'Included within one location, subject to fair use',
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
    kersivo: 'No consumer marketplace',
    booksy: 'Yes — Booksy Marketplace and customer app discovery',
  },
  {
    title: 'Booking / marketplace commission',
    kersivo: '0% KERSIVO commission on bookings and retail sales',
    booksy: 'Standard Marketplace bookings are free when Boost is not enabled',
  },
  {
    title: 'Optional marketplace acquisition',
    kersivo: 'Not applicable',
    booksy: BOOKSY_BOOST_SUMMARY,
  },
  {
    title: 'Deposits',
    kersivo: 'Yes — optional £5 booking deposit',
    booksy: 'Yes — deposits / no-show protection tools available',
  },
  {
    title: 'Client management',
    kersivo: 'Yes',
    booksy: 'Yes',
  },
  {
    title: 'Appointment reminders',
    kersivo: 'Email and SMS appointment reminders included',
    booksy: 'Automatic appointment confirmations and reminders included',
  },
  {
    title: 'Booking experience',
    kersivo: 'Centred on the barbershop website, domain and brand',
    booksy:
      'Booksy Profile, direct booking links, website widget, Marketplace and customer app',
  },
] as const;
