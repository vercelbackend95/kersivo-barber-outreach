/**
 * Copy for /nearcut-alternative. Speaks to the shop owner. Every Nearcut figure comes from
 * nearcutFacts.ts; every KERSIVO commercial line follows claimsPolicy.ts. British English.
 */
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { requireIllustrativeNearcutFact } from '@/lib/seo/nearcutFacts';

const gbp = (n: number) => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
const FULL = gbp(SAAS_MONTHLY_GBP);
const DEPOSIT = gbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const BOOKING_CHARGE_EXAMPLE = gbp(requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').amountGbp);

/* ---------- Hero ---------- */

export const NEARCUT_HERO_KICKER = 'The Nearcut alternative for UK barbershops';
export const NEARCUT_HERO_TITLE_LINES = ['Your shop deserves', 'a real website'] as const;
export const NEARCUT_HERO_LEAD = `A booking page lists your times. A website sells your chair. Full KERSIVO gives your shop its own branded website on your own domain, with your photos, your barbers and booking built in, for ${FULL}/month per location.`;
export const NEARCUT_HERO_FACTS = [
  `${FULL}/month per location`,
  'Your own domain included',
  '0% KERSIVO commission · Stripe fees apply',
  'Typically ready in a few days',
] as const;
export const NEARCUT_HERO_SLIDER_LABEL = 'Compare a plain booking page with a KERSIVO website';

/* ---------- Short answer ---------- */

export const NEARCUT_QUICK_ANSWER_KICKER = 'The short version';
export const NEARCUT_QUICK_ANSWER_TITLE = 'Nearcut vs KERSIVO: the short answer';
export const NEARCUT_QUICK_ANSWER_LEAD = `Nearcut Free for You is free to the shop but adds a separate customer-paid booking charge. Nearcut Subscription removes that charge for a monthly price quoted for your shop. Full KERSIVO is ${FULL}/month per location with a branded website on your own domain, and no KERSIVO booking charge on your clients. Stripe processing fees still apply.`;
export const NEARCUT_QUICK_ANSWER_DETAIL = `Only need bookings? KERSIVO Starter is £0/month for up to four bookable barbers, with a ${DEPOSIT} deposit towards the service or full payment on every public booking.`;
export const NEARCUT_QUICK_ANSWER_FACTS = [
  { label: 'Full KERSIVO', value: `${FULL}/month`, note: 'per location · website and own domain' },
  { label: 'KERSIVO Starter', value: '£0/month', note: 'up to 4 barbers · hosted booking page' },
  { label: 'Nearcut Free for You', value: '£0/month', note: 'client-paid booking charge' },
  { label: 'Nearcut Subscription', value: 'Quote', note: 'priced on locations and barbers' },
] as const;

/* ---------- Website anatomy ---------- */

export type NearcutSitePartId = 'domain' | 'work' | 'team' | 'prices' | 'book' | 'shop';
export const NEARCUT_SITE_TITLE = 'A website that sells the chair before they book it';
export const NEARCUT_SITE_LEAD = 'Nearcut already gives you a personalised booking site. Here is what a full KERSIVO website adds around the booking, part by part. Pick one to see where it sits.';
export const NEARCUT_SITE_PARTS: readonly { id: NearcutSitePartId; title: string; body: string }[] = [
  { id: 'domain', title: 'Your name at your own address', body: 'yourshop.co.uk on your Instagram bio, your Google profile and the shop window. One standard domain per location is included.' },
  { id: 'work', title: 'Your work, up front', body: 'Fades, beards and the shop itself, so a new client knows what they are paying for before they choose a time.' },
  { id: 'team', title: 'Your barbers, by name', body: 'Every barber with a photo and their own services, so regulars book the person they trust.' },
  { id: 'prices', title: 'Prices nobody has to ask about', body: 'Services, durations and prices laid out clearly, one tap away from booking.' },
  { id: 'book', title: 'Booking that never leaves your site', body: `Service, barber, time, done. You choose: Pay at shop, a ${DEPOSIT} deposit or full payment.` },
  { id: 'shop', title: 'Products ready to collect', body: 'Sell pomades, oils and kits online for pickup in the shop. 0% KERSIVO commission; Stripe fees apply.' },
];
export const NEARCUT_SITE_NOTE = 'Designed around your shop: your name, logo, photos, barbers, services and style. It is not an unlimited bespoke build; reasonable small updates after launch are included.';

/* ---------- Outcomes ---------- */

export const NEARCUT_OUTCOMES_TITLE = 'What changes for your shop';
export const NEARCUT_OUTCOMES_LEAD = 'Less about software, more about the shop you run. This is what Full KERSIVO gives you from day one.';
export const NEARCUT_OUTCOMES = [
  { id: 'found', title: 'Clients find you, not a platform', body: 'Your link, your brand, your Google profile pointing home. Every booking starts on your own site.' },
  { id: 'price', title: 'Your clients pay your price', body: `No KERSIVO booking charge on top of the cut. A ${DEPOSIT} deposit counts towards the service, or they pay at the shop.` },
  { id: 'flat', title: 'One flat bill', body: `${FULL}/month per location, with no per-barber subscription charge, subject to fair use.` },
  { id: 'remind', title: 'Reminders that go out for you', body: 'Email reminders, plus SMS reminders within a monthly allowance.' },
  { id: 'setup', title: 'Done for you in a few days', body: 'We build it, you check a private preview, and it goes live only when you approve.' },
  { id: 'month', title: 'Know how the month went', body: 'Bookings, clients and retail sales in one dashboard with Reports.' },
] as const;

/* ---------- Costs ---------- */

export const NEARCUT_COSTS_TITLE = 'Nearcut pricing, and what your clients pay';
export const NEARCUT_COSTS_LEAD = 'Nearcut offers two ways to pay. Free for You has no monthly subscription for the shop, but your clients pay an extra booking charge. Subscription has a monthly quote for your shop and no client booking charge.';
export const NEARCUT_ESTIMATOR_TITLE = 'What your clients would pay on top';
export const NEARCUT_ESTIMATOR_NOTE = `Illustration only: Nearcut shows a ${BOOKING_CHARGE_EXAMPLE} booking charge on a £20 haircut on its UK pricing page. Your actual charge can differ; confirm it with Nearcut.`;

/* ---------- Fit, switching ---------- */

export const NEARCUT_FIT = {
  nearcut: {
    heading: 'Stay on Nearcut if…',
    points: [
      'You value Nearcut’s barber-specific workflow and account management',
      'Your clients are comfortable covering a small booking charge on Free for You',
      'You rely on Nearcut’s memberships, loyalty or other Business Boosters',
      'Nearcut already fits and switching would not bring a clear benefit',
    ],
  },
  kersivo: {
    heading: 'Move to KERSIVO if…',
    points: [
      'You want a proper branded website on your own domain, not just a booking page',
      `You want one flat ${FULL}/month per location, with no per-barber subscription charge`,
      'You want no KERSIVO booking charge added to your clients’ price',
      'You want retail pickup, reports and flexible payment rules in the same plan',
    ],
  },
} as const;
export const NEARCUT_FIT_CLOSING = 'Both are built for barbers. Compare what your clients pay, what the shop pays and how your shop looks online.';

export const NEARCUT_SWITCHING_REASSURANCE = 'Keep Nearcut live while your KERSIVO setup is prepared.';
export const NEARCUT_SWITCHING_STEPS = [
  { title: 'Keep your Nearcut bookings live', body: 'Carry on taking bookings in your existing system while your KERSIVO setup is prepared.' },
  { title: 'Check which data you can export', body: 'Ask Nearcut what client, service and booking data is available for export. We do not assume an unverified export format.' },
  { title: 'Review the compatible data', body: 'KERSIVO can help migrate usable compatible data, including supported CSV exports, after reviewing what is actually available.' },
  { title: 'We build your website', body: 'Barbers, services, prices and availability, with your branded website and your own domain.' },
  { title: 'Approve the preview', body: 'Check the private preview: content, photos, prices, team, hours and the booking flow.' },
  { title: 'Switch your booking links', body: 'Change your Instagram, Google and shop links only when the new site is approved and live.' },
] as const;
export const NEARCUT_SWITCHING_LIMITS = [
  'Nearcut export availability, formats and individual data fields must be confirmed with Nearcut; migration completeness cannot be guaranteed.',
  'Keep existing future bookings accessible until the cutover plan has been reviewed; do not assume a full automatic transfer.',
] as const;
