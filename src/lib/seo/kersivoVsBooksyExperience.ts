/**
 * Copy for /kersivo-vs-booksy, the interactive "new model" explainer.
 * Every Booksy figure is interpolated from verified facts in booksyFacts.ts (via the approved
 * /booksy-alternative copy); every KERSIVO claim follows src/lib/pricing/claimsPolicy.ts.
 * Indexable and in the sitemap. Search intents are split so the two Booksy pages never compete:
 * - /kersivo-vs-booksy: "Booksy vs your own website" (marketplace profile against an own-brand site);
 * - /booksy-alternative: "Booksy alternative" / "leaving Booksy" (the money page).
 * Keep titles, H1-level eyebrows and ledger headings distinct from /booksy-alternative.
 */
import { offer } from '@/content/offer';
import { BK_STARTER_MAX_BARBERS, BK_SCOREBOARD } from '@/lib/seo/booksyAlternativeContent';
import { BOOKSY_FACTS_CHECKED_DATE, requireVerifiedBooksyFact } from '@/lib/seo/booksyFacts';
import { formatGbp, formatPercent } from '@/lib/seo/freshaFacts';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const KVB_PAGE_PATH = '/kersivo-vs-booksy';
/** Date the page content last changed (sitemap lastmod and JSON-LD dateModified). */
export const KVB_LAST_UPDATED_ISO = '2026-11-25';
export const KVB_PUBLISHED_ISO = '2026-11-24';
export const KVB_TITLE = 'Booksy vs Your Own Booking Website for UK Barbers | KERSIVO';
export const KVB_DESCRIPTION = `A Booksy profile or your own booking website? Your own site and domain, ${formatGbp(SAAS_MONTHLY_GBP)}/month per location, 0% KERSIVO commission (Stripe fees apply).`;
/** Breadcrumb trail (JSON-LD), matching /booksy-vs-fresha: Home › Compare › this page. */
export const KVB_BREADCRUMB_NAME = 'Booksy vs your own website';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);
const DEPOSIT = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const base = requireVerifiedBooksyFact('baseSubscription');
const extraUser = requireVerifiedBooksyFact('additionalUser');
const boost = requireVerifiedBooksyFact('boostNewClientFee');
const BOOKSY_BASE = formatGbp(base.amountGbp!);
const BOOKSY_USER = formatGbp(extraUser.amountGbp!);
const BOOST_PERCENT = formatPercent(boost.percent!);
const BOOST_MIN = formatGbp(boost.minimumGbp!);

/* ---------- Hero ---------- */

export const KVB_HERO = {
  eyebrow: 'Booksy vs your own website',
  titleLines: ['Booksy lists your shop.', 'KERSIVO builds it.'],
  lead: `Booksy puts your profile inside its own app and marketplace. KERSIVO gives your barbershop its own branded website and booking on your own domain, for one flat ${PRICE} a month per location, however many barbers you have.`,
  facts: [
    `${PRICE}/month per location`,
    'No per-barber fees',
    `${offer.fees.commission} · Stripe fees apply`,
  ],
  primary: offer.cta.primary,
  secondary: 'Walk through the difference',
} as const;

/* ---------- Chapters (pinned moment) ---------- */

export type KvbChapter = {
  id: 'land' | 'brand' | 'return';
  index: string;
  title: string;
  booksy: string;
  kersivo: string;
  /** Short labels on the two phone mock-ups for this chapter. */
  marketChip: string;
  ownChip: string;
};

export const KVB_CHAPTERS_TITLE = 'Two models, one booking';
export const KVB_CHAPTERS_LEAD =
  'Booksy is a capable booking app with a big marketplace. KERSIVO is built for a different job: making your own shop the place clients book, pay and come back to.';

export const KVB_CHAPTERS: readonly KvbChapter[] = [
  {
    id: 'land',
    index: '01',
    title: 'Where clients land',
    booksy: 'Your Booksy Profile, reached through your links, Google, social buttons, the Booksy app and its Marketplace.',
    kersivo: 'yourshop.co.uk: your own branded website on Full KERSIVO, in the browser, with nothing to download.',
    marketChip: 'Found in the marketplace',
    ownChip: 'Your domain',
  },
  {
    id: 'brand',
    index: '02',
    title: 'Whose name they see',
    booksy: 'Your services, prices and portfolio, presented inside the Booksy Profile and app.',
    kersivo: 'Your logo, your barbers and your prices throughout the journey, from first tap to confirmation.',
    marketChip: 'Inside the app’s layout',
    ownChip: 'Your brand, start to finish',
  },
  {
    id: 'return',
    index: '03',
    title: 'Where the next booking starts',
    booksy: 'Clients can come back through your Profile, your links or the Booksy app and Marketplace.',
    kersivo: 'They land in your own client list, get reminded by your shop and book straight back with you.',
    marketChip: 'Back via the app or a link',
    ownChip: 'Added to your client list',
  },
];

/* ---------- The bill ---------- */

export const KVB_BILL_TITLE = 'Hire your next barber. Same price.';
export const KVB_BILL_LEAD = `Booksy lists ${BOOKSY_BASE} a month plus VAT, and ${BOOKSY_USER} plus VAT for each additional user. Full KERSIVO stays at ${PRICE} a month per location. Move the slider and watch the gap.`;
export const KVB_BILL_BOOST_LABEL = `Add optional Boost (${BOOST_PERCENT} one-time, min ${BOOST_MIN} + VAT per new Boost client)`;
export const KVB_BILL_NOTE = `Subscription and optional Boost only, not a total cost of ownership. Card processing is left out on both sides: Booksy Mobile Payments, and Stripe processing fees on KERSIVO. Booksy figures including VAT use the UK standard rate of 20%. ${offer.fees.vat}`;
export const KVB_BILL_STARTER = `Up to ${BK_STARTER_MAX_BARBERS} barbers? KERSIVO Starter is £0/month with a hosted booking page.`;

/* ---------- Statement (word-highlight moment) ---------- */

export const KVB_STATEMENT =
  'Your clients book your shop, on your own domain, pay through your own booking journey and land in your own client list.';

/* ---------- What's new ---------- */

export type KvbFeature = {
  id: 'domain' | 'deposit' | 'retail' | 'dashboard';
  kicker: string;
  title: string;
  body: string;
};

export const KVB_FEATURES_TITLE = 'What you get that a profile can’t give you';

export const KVB_FEATURES: readonly KvbFeature[] = [
  {
    id: 'domain',
    kicker: 'Your name on the door',
    title: 'Clients book on yourshop.co.uk',
    body: 'Full KERSIVO includes a branded website and one standard domain per location, with hosting and SSL.',
  },
  {
    id: 'deposit',
    kicker: 'No-shows still pay',
    title: `A ${DEPOSIT} deposit, or paid in full`,
    body: 'Bookings are secured the moment they are made. Full KERSIVO also lets you choose Pay at shop.',
  },
  {
    id: 'retail',
    kicker: 'Sell from your site',
    title: 'Retail pickup, built in',
    body: 'Products sold on your own website and collected in the shop, with 0% KERSIVO commission on Full. Stripe fees apply.',
  },
  {
    id: 'dashboard',
    kicker: 'One owner view',
    title: 'Every regular in your dashboard',
    body: 'Bookings, team, clients and services in one place, plus reports, products and orders on Full.',
  },
];

/* ---------- Ledger ---------- */

export const KVB_LEDGER_TITLE = 'A Booksy profile against your own site';
export const KVB_LEDGER_ROWS = BK_SCOREBOARD.filter((row) =>
  ['Monthly price', 'Extra barbers', 'Commission on bookings', 'Your own website and domain', 'Where clients book', 'Customer app and marketplace', 'Deposits and no-shows', 'Retail'].includes(row.label),
);

export const KVB_FAIR_TITLE = 'When Booksy may suit you better';
export const KVB_FAIR_BODY =
  'If Marketplace and app discovery is an important source of new clients for you, Booksy’s ecosystem is built for that. KERSIVO suits shops whose clients already find them through Google, Instagram, referrals or walk-ins, and who want the booking journey under their own name.';

/* ---------- Close ---------- */

export const KVB_CLOSE_TITLE = 'See your own shop first';
export const KVB_CLOSE_LEAD =
  'We build a free preview of your branded website. Booksy keeps taking bookings while your setup is prepared, and nothing goes public until you approve it.';
export const KVB_CLOSE_STARTER = 'Or start with KERSIVO Starter, £0/month';
export const KVB_CLOSE_FULL_COMPARISON = 'Read the full Booksy alternative guide';

export const KVB_SOURCES_NOTE = `Booksy figures were checked against Booksy’s official UK pricing, Boost and payments pages on ${BOOKSY_FACTS_CHECKED_DATE} and may change.`;
