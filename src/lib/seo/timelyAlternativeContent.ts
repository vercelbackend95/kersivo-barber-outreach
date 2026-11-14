import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  TIMELY_FACTS_CHECKED_DATE,
  requireVerifiedTimelyFact,
  weeklyToMonthlyGbp,
} from '@/lib/seo/timelyFacts';

/**
 * Visible copy for /timely-alternative. Every Timely figure is read from timelyFacts.ts.
 * The page talks to the barbershop owner directly; it is honest about where Timely is stronger.
 */

const amount = (key: Parameters<typeof requireVerifiedTimelyFact>[0]): number => {
  const fact = requireVerifiedTimelyFact(key);
  if (!('amountGbp' in fact)) throw new Error(`Timely fact ${key} has no GBP amount`);
  return fact.amountGbp;
};
const rate = (key: Parameters<typeof requireVerifiedTimelyFact>[0]) => {
  const fact = requireVerifiedTimelyFact(key);
  if (!('percent' in fact)) throw new Error(`Timely fact ${key} has no rate`);
  return fact;
};

export const gbp = (value: number): string =>
  Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
const pence = (value: number): string => `${Math.round(value * 100)}p`;

const RUN_WEEKLY = amount('runFromWeekly');
const BOOST_WEEKLY = amount('boostFromWeekly');
const THRIVE_WEEKLY = amount('thriveFromWeekly');
const TEAM_ADDON_WEEKLY = amount('advancedTeamAddOnWeekly');
const ONLINE = rate('ukOnlinePaymentProcessing');
const INTERNATIONAL = rate('ukInternationalOnlinePaymentProcessing');
const IN_PERSON = rate('ukInPersonPaymentProcessing');

const KERSIVO_PRICE = gbp(SAAS_MONTHLY_GBP);
const DEPOSIT = gbp(KERSIVO_BOOKING_DEPOSIT_GBP);
export const STARTER_MAX_BARBERS = 4;

export const feeLabel = (fee: { percent: number; fixedGbp: number }): string =>
  `${fee.percent}% + ${pence(fee.fixedGbp)}`;

/* ---------------------------------- Hero ---------------------------------- */

export const TIMELY_HERO_EYEBROW = 'Timely alternative for UK barbershops';
export const TIMELY_HERO_TITLE_LINES = ['The Timely alternative', 'that doesn’t bill you', 'for a busy week'] as const;
export const TIMELY_HERO_LEAD = `Timely now prices its UK plans by how many bookings you take each week, so a fuller diary means a bigger bill. Full KERSIVO is ${KERSIVO_PRICE}/month per location, flat: every booking, every barber, your own website and domain. Fill the chairs. The price stays put.`;
export const TIMELY_HERO_FACTS: readonly string[] = [
  `Full KERSIVO ${KERSIVO_PRICE}/month per location`,
  'Starter £0/month for up to 4 barbers',
  '0% KERSIVO commission (Stripe fees apply)',
  'No setup fee',
];

/** The hero diary: bookings that fill a barbershop week, one block per appointment. */
export const HERO_WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const HERO_DIARY: readonly { day: number; start: number; span: number; label: string }[] = [
  { day: 0, start: 1, span: 1, label: 'Skin fade' }, { day: 0, start: 4, span: 1, label: 'Beard trim' },
  { day: 1, start: 0, span: 1, label: 'Scissor cut' }, { day: 1, start: 2, span: 2, label: 'Cut + beard' }, { day: 1, start: 5, span: 1, label: 'Kids cut' },
  { day: 2, start: 1, span: 1, label: 'Taper' }, { day: 2, start: 3, span: 1, label: 'Line-up' }, { day: 2, start: 4, span: 2, label: 'Hot towel shave' },
  { day: 3, start: 0, span: 2, label: 'Cut + beard' }, { day: 3, start: 2, span: 1, label: 'Skin fade' }, { day: 3, start: 3, span: 1, label: 'Crop' }, { day: 3, start: 5, span: 1, label: 'Beard trim' },
  { day: 4, start: 0, span: 1, label: 'Skin fade' }, { day: 4, start: 1, span: 1, label: 'Taper' }, { day: 4, start: 2, span: 1, label: 'Scissor cut' }, { day: 4, start: 3, span: 2, label: 'Cut + beard' }, { day: 4, start: 5, span: 1, label: 'Line-up' },
  { day: 5, start: 0, span: 1, label: 'Skin fade' }, { day: 5, start: 1, span: 1, label: 'Kids cut' }, { day: 5, start: 2, span: 1, label: 'Skin fade' }, { day: 5, start: 3, span: 1, label: 'Taper' }, { day: 5, start: 4, span: 1, label: 'Crop' }, { day: 5, start: 5, span: 1, label: 'Skin fade' },
];

/* --------------------------------- Verdict -------------------------------- */

export const TIMELY_VERDICT_TITLE = 'Should you leave Timely for KERSIVO?';
export const TIMELY_VERDICT_LEAD = `Timely is good software, built for salons, beauty and wellness. KERSIVO is built for one kind of business: the independent UK barbershop. If your week is cuts, fades and beard work, booked by regulars who find you on Instagram and Google, KERSIVO gives you a flat ${KERSIVO_PRICE}/month per location, your own website on your own domain, and deposits that stop no-shows, with 0% KERSIVO commission (Stripe fees apply).`;

export const TIMELY_VERDICT_FIT: readonly { label: string; tone: 'kersivo' | 'timely'; points: readonly string[] }[] = [
  {
    label: 'Move to KERSIVO if',
    tone: 'kersivo',
    points: [
      'You want one flat monthly price that doesn’t climb when the diary fills up',
      'You want a barbershop website on your own domain, set up for you (Full KERSIVO)',
      `You want every public booking backed by a ${DEPOSIT} deposit or full payment`,
      'You’d rather pay monthly than see a bill every week',
    ],
  },
  {
    label: 'Stay on Timely if',
    tone: 'timely',
    points: [
      'You rely on its waitlist, Reserve with Google, packages or loyalty rewards',
      'You run beauty or colour services that need consultation forms',
      'You manage retail stock levels and supplier orders',
      'You take card payments on a Timely terminal and want it all in one place',
    ],
  },
];

/* ------------------------------ Timely's model ----------------------------- */

export type TimelyTierId = 'run' | 'boost' | 'thrive';

export const TIMELY_TIERS: readonly {
  id: TimelyTierId;
  name: string;
  weeklyGbp: number;
  monthlyGbp: number;
  unlocks: readonly string[];
  tag?: string;
}[] = [
  {
    id: 'run',
    name: 'Run',
    weeklyGbp: RUN_WEEKLY,
    monthlyGbp: weeklyToMonthlyGbp(RUN_WEEKLY),
    unlocks: ['Online booking and calendar', 'Online deposits', 'Mini-website', 'SMS reminders (1 per booking)'],
  },
  {
    id: 'boost',
    name: 'Boost',
    weeklyGbp: BOOST_WEEKLY,
    monthlyGbp: weeklyToMonthlyGbp(BOOST_WEEKLY),
    unlocks: ['Booking colours to match your brand', 'Cancellation fees', 'Waitlist', 'Reserve with Google'],
    tag: 'Timely’s most popular',
  },
  {
    id: 'thrive',
    name: 'Thrive',
    weeklyGbp: THRIVE_WEEKLY,
    monthlyGbp: weeklyToMonthlyGbp(THRIVE_WEEKLY),
    unlocks: ['Rebooking reminders', 'Stock app connected', 'Accounting integrations', 'Priority support'],
  },
];

export const TIMELY_MODEL_TITLE = 'How Timely charges a UK barbershop in 2026';
export const TIMELY_MODEL_LEAD = `Timely has moved to three plans billed every week. Each plan has a “starting from” price, unlimited team members, and a bill that adjusts with the number of bookings you take. Features are split across the plans, so the price you pay depends on what you need and how busy you are. Checked on Timely’s Great Britain pricing page on ${TIMELY_FACTS_CHECKED_DATE}.`;

export const TIMELY_MODEL_EXTRAS: readonly { label: string; value: string; note: string }[] = [
  { label: 'Advanced team management', value: `+${gbp(TEAM_ADDON_WEEKLY)}/week`, note: 'Staff targets, tiered prices by experience, team performance' },
  { label: 'Online payments', value: feeLabel(ONLINE), note: `Per deposit or cancellation fee. International cards ${feeLabel(INTERNATIONAL)}` },
  { label: 'In-salon payments', value: feeLabel(IN_PERSON), note: 'Tap to Pay or a Timely terminal, plus the terminal cost' },
  { label: 'Extra SMS', value: '8p / 5p / 4p', note: 'Per SMS above the included amount on Run / Boost / Thrive' },
];

export const TIMELY_MODEL_KERSIVO = {
  title: 'KERSIVO: one plan, one floor',
  price: KERSIVO_PRICE,
  unit: 'per location / month, flat',
  points: [
    'Every booking, every barber in the location (fair use)',
    'Website, your own domain, deposits, reports and retail pickup in the one plan',
    'SMS reminders within a monthly allowance',
    '0% KERSIVO commission. Stripe fees apply',
  ],
};

/* ------------------------------ Bill builder ------------------------------ */

export type BuilderFeature = {
  id: string;
  label: string;
  /** The lowest Timely plan that includes it, or the paid team add-on. */
  timely: TimelyTierId | 'addon';
  timelyNote: string;
  kersivo: 'starter' | 'full' | 'none';
  kersivoNote: string;
};

export const BUILDER_FEATURES: readonly BuilderFeature[] = [
  { id: 'online-booking', label: '24/7 online booking', timely: 'run', timelyNote: 'Run', kersivo: 'starter', kersivoNote: 'Starter and Full' },
  { id: 'deposits', label: 'Deposits to stop no-shows', timely: 'run', timelyNote: `Run, plus ${feeLabel(ONLINE)} per online payment`, kersivo: 'starter', kersivoNote: `${DEPOSIT} deposit or full payment on Starter; Full adds Pay at shop` },
  { id: 'website', label: 'Website on your own domain', timely: 'run', timelyNote: 'Mini-website on Run; own domain not stated', kersivo: 'full', kersivoNote: 'Full: barbershop website and your own domain, set up for you' },
  { id: 'brand', label: 'Booking in your brand', timely: 'boost', timelyNote: 'Custom booking colours need Boost', kersivo: 'full', kersivoNote: 'Full: your logo and look from website to booking' },
  { id: 'sms', label: 'SMS reminders', timely: 'run', timelyNote: 'Run: 1 SMS per booking, then 8p each', kersivo: 'full', kersivoNote: 'Full, within a monthly allowance' },
  { id: 'reports', label: 'Booking and sales reports', timely: 'run', timelyNote: 'Run', kersivo: 'full', kersivoNote: 'Full: booking and product sales reports' },
  { id: 'retail', label: 'Sell products to clients', timely: 'thrive', timelyNote: 'Stock app connected on Thrive', kersivo: 'full', kersivoNote: 'Full: online retail pickup shop (no stock control)' },
  { id: 'cancellation-fees', label: 'Cancellation fees', timely: 'boost', timelyNote: 'Boost', kersivo: 'none', kersivoNote: 'Not offered. KERSIVO takes a deposit or full payment up front instead' },
  { id: 'waitlist', label: 'Waitlist', timely: 'boost', timelyNote: 'Boost', kersivo: 'none', kersivoNote: 'Not offered' },
  { id: 'rebooking', label: 'Automatic rebooking reminders', timely: 'thrive', timelyNote: 'Thrive', kersivo: 'none', kersivoNote: 'Not offered' },
  { id: 'team-targets', label: 'Staff targets and tiered prices', timely: 'addon', timelyNote: `Add-on, +${gbp(TEAM_ADDON_WEEKLY)}/week`, kersivo: 'none', kersivoNote: 'Not offered' },
];

export const BUILDER_DEFAULT_FEATURES = ['online-booking', 'deposits', 'website', 'brand', 'sms'] as const;

export const BUILDER_CONFIG = {
  tiers: TIMELY_TIERS.map(({ id, name, weeklyGbp }) => ({ id, name, weeklyGbp })),
  teamAddOnWeeklyGbp: TEAM_ADDON_WEEKLY,
  kersivoFullGbp: SAAS_MONTHLY_GBP,
  starterMaxBarbers: STARTER_MAX_BARBERS,
  features: BUILDER_FEATURES.map(({ id, label, timely, kersivo }) => ({ id, label, timely, kersivo })),
  defaults: { barbers: 3, bookingsPerWeek: 70, actualWeeklyGbp: 0 },
} as const;

export const BUILDER_NOTE = `Timely’s figures are the published “starting from” weekly prices on its Great Britain pricing page, converted to a monthly average (× 52 ÷ 12). Timely’s bill rises with booking volume and it doesn’t publish by how much, so enter your own weekly invoice for a like-for-like comparison. Payment processing (TimelyPay or Stripe) is left out on both sides. KERSIVO is not VAT registered, so no VAT is added.`;

/* ------------------------------- A week on KERSIVO ------------------------ */

export const TIMELY_WEEK_TITLE = 'Your week, run on KERSIVO';
export const TIMELY_WEEK_LEAD = 'Same chairs, same regulars, same Saturday rush. Here is what changes for you, day by day.';

export const TIMELY_WEEK: readonly { day: string; time: string; title: string; body: string }[] = [
  {
    day: 'Monday', time: '07:12',
    title: 'Bookings land on your name',
    body: 'A regular taps the link in your Instagram bio and books on your own website, on your own domain. No other shop’s name on the way in.',
  },
  {
    day: 'Tuesday', time: '18:40',
    title: 'No-shows stop costing you',
    body: `Every public booking comes with a ${DEPOSIT} deposit or full payment through your own Stripe account. On Full you choose, including Pay at shop for the regulars you trust.`,
  },
  {
    day: 'Wednesday', time: '10:05',
    title: 'Reminders go out without you',
    body: 'Email confirmations and reminders on both plans, and SMS reminders within a monthly allowance on Full.',
  },
  {
    day: 'Friday', time: '16:30',
    title: 'The rush doesn’t raise the bill',
    body: `Back-to-back fades till close. On KERSIVO that week costs the same as a quiet one: ${KERSIVO_PRICE}/month per location, flat.`,
  },
  {
    day: 'Saturday', time: '09:00',
    title: 'A new barber starts, nothing changes',
    body: 'Add them to the team and their chair is bookable. Full KERSIVO covers every barber in the location, subject to fair use.',
  },
  {
    day: 'Sunday', time: '20:15',
    title: 'You see the whole week',
    body: 'Booking and product sales reports on Full show what the week earned, and clients can buy products online to collect in the shop.',
  },
];

/* ------------------------------ Head to head ------------------------------ */

export const TIMELY_TABLE_TITLE = 'Timely vs KERSIVO, line by line';

export const TIMELY_TABLE_ROWS: readonly { label: string; timely: string; kersivo: string }[] = [
  { label: 'Built for', timely: 'Salons, beauty and wellness', kersivo: 'Independent UK barbershops' },
  { label: 'How the price works', timely: 'Weekly bill that adjusts with your bookings', kersivo: `Flat monthly price per location` },
  { label: 'Starting price', timely: `Run from ${gbp(RUN_WEEKLY)}/week, Boost from ${gbp(BOOST_WEEKLY)}/week, Thrive from ${gbp(THRIVE_WEEKLY)}/week`, kersivo: `Starter £0/month · Full ${KERSIVO_PRICE}/month` },
  { label: 'Team size', timely: 'Unlimited team members', kersivo: `Starter up to ${STARTER_MAX_BARBERS} barbers · Full unlimited per location (fair use)` },
  { label: 'Features by plan', timely: 'Split across Run, Boost, Thrive and paid add-ons', kersivo: 'Everything in one Full plan' },
  { label: 'Website', timely: 'Branded mini-website; own domain not stated', kersivo: 'Full: barbershop website and your own domain included' },
  { label: 'Deposits', timely: `Online deposits on every plan, ${feeLabel(ONLINE)} per payment`, kersivo: `${DEPOSIT} deposit or full payment; Full adds Pay at shop` },
  { label: 'Commission', timely: 'No new-client fees', kersivo: '0% KERSIVO commission. Stripe fees apply' },
  { label: 'Where payments go', timely: 'TimelyPay', kersivo: 'Your own connected Stripe account' },
  { label: 'Card terminal', timely: `Tap to Pay or Timely terminal, ${feeLabel(IN_PERSON)}`, kersivo: 'Not offered; Pay at shop on Full' },
  { label: 'Setup', timely: '14-day free trial, set up yourself, data transfer help', kersivo: 'No setup fee. We set it up, typically ready in a few days once we have what we need' },
  { label: 'Billing and leaving', timely: 'Billed weekly; 14 days’ notice to cancel', kersivo: 'Billed monthly; cancel any time, active to the end of the paid month' },
];

/* -------------------------------- Switching ------------------------------- */

export const TIMELY_SWITCH_TITLE = 'Moving from Timely without a gap in the diary';
export const TIMELY_SWITCH_LEAD = 'Your Timely bookings keep running the whole time. You only switch once you’ve seen the new setup working.';

export const TIMELY_SWITCH_STEPS: readonly { title: string; body: string }[] = [
  { title: 'Keep Timely live', body: 'Nothing changes for your clients while we prepare your KERSIVO setup.' },
  { title: 'Ask Timely for your export', body: 'Request it through Timely support. Timely says it can take up to 48 hours and covers clients, appointments, services, client notes, products and product purchases.' },
  { title: 'We map what moves across', body: 'We review your files and help migrate the compatible data, then set up your barbers, services and hours, plus your website on Full.' },
  { title: 'You check a private preview', body: 'Make a test booking, look at the deposit flow and the admin before anything goes public.' },
  { title: 'Switch, then give notice', body: 'Point your Instagram, Google and website links at KERSIVO. Timely asks for 14 days’ notice to cancel, so time it once you’re live.' },
];

export const TIMELY_SWITCH_LIMITS: readonly string[] = [
  'Only what Timely includes in its export can move, and not every field or future appointment may transfer.',
  'Timely’s export list doesn’t include saved client cards, so clients add a card again the next time they pay online.',
];

export const TIMELY_SOURCES_NOTE = `This comparison is published by KERSIVO and uses Timely’s own Great Britain pricing page and Help Centre, checked on ${TIMELY_FACTS_CHECKED_DATE}. Timely’s prices are “starting from” figures that adjust with booking volume; check your own invoice and current terms before deciding.`;
