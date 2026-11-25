/**
 * Copy for /barbershop-reports, the interactive explainer for KERSIVO Admin & Reports
 * (the owner dashboard and Reports in Full KERSIVO).
 *
 * Every product statement describes what the dashboard really does today:
 * - sections and controls: src/lib/admin/ai/adminSections.ts
 * - metric definitions and what to do about them: src/lib/admin/ai/adminResultsPlaybook.ts
 * - plan split: src/lib/pricing/starterFullPlanCards.ts
 * - commercial wording: src/content/offer.ts and src/lib/pricing/claimsPolicy.ts
 * Public surfaces never label service value as money taken: it is booking value at the shop's prices.
 * No invented statistics: the figures in the live studio come from the fictional Heritage Grooming demo shop.
 */
import { offer } from '@/content/offer';
import { FAIR_USE_INTRO } from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { formatGbp } from '@/lib/seo/freshaFacts';

export const KAR_PAGE_PATH = '/barbershop-reports';
/** Date the page content last changed (sitemap lastmod and JSON-LD dateModified). */
export const KAR_LAST_UPDATED_ISO = '2026-11-25';
export const KAR_PUBLISHED_ISO = '2026-11-25';
export const KAR_TITLE = 'Barbershop Reports & Owner Dashboard UK | KERSIVO';
export const KAR_DESCRIPTION = `See bookings, utilisation, no-shows and each barber’s numbers in one owner dashboard. Included in Full KERSIVO, ${formatGbp(SAAS_MONTHLY_GBP)}/month per location.`;
export const KAR_BREADCRUMB_NAME = 'Admin & reports';
/** Opens the fictional demo shop's dashboard straight on Reports. */
export const KAR_DEMO_REPORTS_HREF = '/demo/heritage-grooming/admin?section=bookings_reports';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

/* ---------- Hero ---------- */

export const KAR_HERO = {
  eyebrow: 'KERSIVO Admin & Reports',
  titleLines: ['Admin and reports', 'for barbershop owners.'],
  lead: 'Run today’s chairs, know every regular and see how this week compares with the last, in one dashboard that comes with your website and booking.',
  facts: [`Full KERSIVO · ${PRICE}/month per location`, 'No per-barber fees', 'Every number compared with the last period'],
  primary: offer.cta.primary,
  secondary: 'Open the demo dashboard',
} as const;

/* ---------- In short (direct answer for search and AI assistants) ---------- */

export const KAR_ANSWER_TITLE = 'What KERSIVO Admin & Reports is';
export const KAR_ANSWER = `KERSIVO Admin & Reports is the owner dashboard in Full KERSIVO, booking software built for independent UK barbershops. One browser dashboard runs the day’s bookings, your barbers and their hours, your client records, services, retail products and orders. Reports turns those bookings into the numbers an owner checks each week: bookings, utilisation, cancellations, no-shows, average booking value, your peak day and hour, your most popular service and your busiest barber, each compared with the previous period of the same length.`;

export type KarFact = { term: string; value: string };

export const KAR_FACTS: readonly KarFact[] = [
  { term: 'Date ranges', value: '1 day, 1 week, 1 month, 1 year or your own dates' },
  { term: 'Compared with', value: 'The previous period of the same length' },
  { term: 'Per barber', value: 'Up to 5 barbers side by side on one chart' },
  { term: 'Plan', value: `Full KERSIVO, ${PRICE}/month per location` },
];

/* ---------- Moment 1: the dashboard, as a scroll-driven film ---------- */

export type KarChapter = {
  id: 'bookings' | 'team' | 'reports' | 'clients' | 'sales';
  index: string;
  /** Sidebar label in the real dashboard. */
  section: string;
  title: string;
  body: string;
  /** Two short labels pinned to the screen while the chapter plays. */
  callouts: readonly [string, string];
};

export const KAR_CHAPTERS_TITLE = 'A working day in the dashboard';
export const KAR_CHAPTERS_LEAD = 'Five screens an owner opens most, in the order they sit in the sidebar. Scroll, and the dashboard walks through them.';

export const KAR_CHAPTERS: readonly KarChapter[] = [
  {
    id: 'bookings',
    index: '01',
    section: 'Bookings',
    title: 'Open the day',
    body: 'A timeline per barber shows today’s gaps at a glance. Filter to who is still to come, mark an arrival or a no-show, reschedule, or change a service before the cut starts.',
    callouts: ['Next client highlighted', 'Gaps you can still fill'],
  },
  {
    id: 'team',
    index: '02',
    section: 'Team',
    title: 'Set up the chairs',
    body: 'Each barber has their own working hours, services and online bookings switch. See who is on shift today, and invite a manager or a barber to the dashboard.',
    callouts: ['Who is on shift today', 'Working days per barber'],
  },
  {
    id: 'reports',
    index: '03',
    section: 'Reports',
    title: 'Read the week',
    body: 'Pick a day, a week, a month or a year, and every number sits beside the one from the period before it: bookings, utilisation, average booking value and cancellations, with your peak hour, most popular service and a barber leaderboard.',
    callouts: ['Compared with the previous period', 'Busiest barber first'],
  },
  {
    id: 'clients',
    index: '04',
    section: 'Clients',
    title: 'Know who is in the chair',
    body: 'Every client keeps a record: visits, no-shows, total spent, favourite service, tags and notes with photos. A reliability score built from completed visits against no-shows tells you who to ask for a deposit.',
    callouts: ['Reliability from real visits', 'Spend and favourite service'],
  },
  {
    id: 'sales',
    index: '05',
    section: 'Sales',
    title: 'Check the shelf',
    body: 'Products sold on your website and collected in the shop: orders, average order value and your top product, by value or by units, over 7, 30 or 90 days or your own dates.',
    callouts: ['Top product this week', 'Units sold per product'],
  },
];

/** Shown under the film: the Reports chapter plays the demo shop’s real Reports figures. */
export const KAR_FILM_NOTE = `${offer.demo.fictional} Booking value is counted at the shop’s service prices; it is not a payout figure.`;

/* ---------- Moment 2: the statement ---------- */

export const KAR_STATEMENT =
  'Mark a booking in the diary once, and the report, the client’s record and the barber’s numbers all move with it.';

/* ---------- What is different ---------- */

export type KarDifference = {
  id: 'compare' | 'sample' | 'utilisation' | 'barbers';
  kicker: string;
  title: string;
  body: string;
};

export const KAR_DIFFERENCES_TITLE = 'Built to answer the next question';

export const KAR_DIFFERENCES: readonly KarDifference[] = [
  {
    id: 'compare',
    kicker: 'No spreadsheet',
    title: 'Every number against the last period',
    body: 'Choose a week and you see the week before beside it, in points for rates and in pounds for value.',
  },
  {
    id: 'sample',
    kicker: 'Honest about quiet days',
    title: 'Small samples are flagged',
    body: 'With fewer than about 10 bookings in a range, Reports says so, so one slow Monday never looks like a trend.',
  },
  {
    id: 'utilisation',
    kicker: 'From your real rota',
    title: 'Utilisation from working hours',
    body: 'Booked minutes against the minutes your barbers were available, after breaks and holidays are taken out.',
  },
  {
    id: 'barbers',
    kicker: 'Fair to every chair',
    title: 'Up to five barbers on one chart',
    body: 'Lay barbers over the shop total, see who carries Saturday, and open any barber’s profile from the leaderboard.',
  },
];

/* ---------- Metric glossary (helpful reference; also DefinedTermSet JSON-LD) ---------- */

export type KarMetric = {
  id: string;
  name: string;
  /** How KERSIVO works it out. */
  definition: string;
  /** What an owner can do when it moves the wrong way. */
  action: string;
};

export const KAR_METRICS_TITLE = 'Eight numbers, and what to do about each';
export const KAR_METRICS_LEAD = 'What each figure in Reports measures, and the first thing to check in the dashboard when it moves the wrong way.';

export const KAR_METRICS: readonly KarMetric[] = [
  {
    id: 'bookings',
    name: 'Bookings',
    definition: 'Every booking that starts inside the range, whatever happened to it.',
    action: 'Down on the last period? Look at the peak day and hour first, then check your hours still match them.',
  },
  {
    id: 'utilisation',
    name: 'Utilisation',
    definition: 'Booked chair minutes divided by the minutes your barbers were available.',
    action: 'Low: trim hours on quiet mornings, remove barbers who are not taking bookings and fill gaps from the Bookings timeline.',
  },
  {
    id: 'cancelled',
    name: 'Cancelled rate',
    definition: 'Share of bookings cancelled, split into client cancellations, shop cancellations and no-shows.',
    action: 'Client cancellations: deposits and reminders. Shop cancellations: book time off before clients can take the slot.',
  },
  {
    id: 'no-show',
    name: 'No-show rate',
    definition: 'Share of bookings where the client never arrived, including bookings left unmarked.',
    action: 'Mark no-shows the same day, tag the client and ask for a deposit on peak slots.',
  },
  {
    id: 'value',
    name: 'Average booking value',
    definition: 'Value of completed bookings at your service prices, divided by how many there were.',
    action: 'Low: review service prices and durations, feature the services you want booked and offer a product after the cut.',
  },
  {
    id: 'peak',
    name: 'Peak day and hour',
    definition: 'The weekday and the hour with the most bookings in the range, in UK time.',
    action: 'Put your strongest barbers on those hours, and nudge online bookings towards quieter slots.',
  },
  {
    id: 'service',
    name: 'Most popular service',
    definition: 'The service booked most often in the range.',
    action: 'Make sure enough barbers offer it and its duration is realistic, so the next slot stays bookable.',
  },
  {
    id: 'barber',
    name: 'Busiest barber',
    definition: 'The barber with the most bookings in the range, with a leaderboard for the rest of the team.',
    action: 'Balance the load through hours and services, or copy that barber’s service mix across the team.',
  },
];

/* ---------- Starter vs Full ---------- */

export type KarPlanRow = { label: string; starter: string; full: string };

export const KAR_PLANS_TITLE = 'Starter runs the diary. Full adds the owner’s view.';
export const KAR_PLANS_LEAD = 'KERSIVO Starter is a real £0 booking plan. Reports and the wider owner tools come with Full KERSIVO.';

export const KAR_PLAN_ROWS: readonly KarPlanRow[] = [
  { label: 'Price', starter: '£0/month', full: `${PRICE}/month per location` },
  { label: 'Bookings, team, services', starter: 'Included', full: 'Included' },
  { label: 'Bookable barbers', starter: 'Up to 4', full: 'No per-barber limit or fee' },
  { label: 'Booking history', starter: 'Rolling 90 days', full: 'Full history' },
  { label: 'Clients', starter: 'Clients Core', full: 'Advanced clients: reliability, tags, notes' },
  { label: 'Reports', starter: 'Not included', full: 'Included' },
  { label: 'Products, orders and sales', starter: 'Not included', full: 'Included' },
  { label: 'KERSIVO Assistant', starter: 'Not included', full: 'Included' },
];

/* ---------- FAQ (visible on the page and mirrored word for word in FAQPage JSON-LD) ---------- */

export type KarFaq = { question: string; answer: string };

export const KAR_FAQ_TITLE = 'Questions owners ask about reports';

export const KAR_FAQS: readonly KarFaq[] = [
  {
    question: 'What reports does KERSIVO include?',
    answer:
      'Full KERSIVO includes booking reports and product sales reports. Booking reports show bookings, cancelled rate with a client, shop and no-show breakdown, utilisation, average booking value, no-show rate, peak day and hour, most popular service and busiest barber, over 1 day, 1 week, 1 month, 1 year or custom dates. Sales shows retail orders, average order value and your top product, by value or units.',
  },
  {
    question: 'How does KERSIVO work out utilisation?',
    answer:
      'Utilisation is booked chair minutes divided by available minutes. Available minutes come from each barber’s working hours, with breaks and holidays taken out, so the figure reflects the rota you actually ran.',
  },
  {
    question: 'Can I see how each barber is doing?',
    answer:
      'Yes. Reports names your busiest barber and lists the team in a leaderboard you can open into each barber’s profile. You can also lay up to 5 barbers over the shop total on the chart.',
  },
  {
    question: 'Are reports included in KERSIVO Starter?',
    answer:
      'No. KERSIVO Starter (£0/month, up to 4 barbers) covers bookings, team, services, a rolling 90-day booking history and Clients Core. Reports, advanced client records, retail sales and the KERSIVO Assistant are part of Full KERSIVO.',
  },
  {
    question: 'Is the booking value in Reports the money I have been paid?',
    answer:
      'No. Reports values bookings at your service prices so you can compare periods. Card payments, deposits and payouts are handled in your own Stripe account, which is the place to check money received. Stripe fees apply to online payments.',
  },
  {
    question: 'Which time zone do reports use?',
    answer: 'UK time (Europe/London). Days, weeks and peak hours follow the clock in your shop, including the change to and from British Summer Time.',
  },
  {
    question: 'Can my barbers use the dashboard too?',
    answer: FAIR_USE_INTRO,
  },
  {
    question: 'What does the KERSIVO Assistant do?',
    answer:
      'The Assistant answers questions about using the dashboard and running your shop, such as what to do about a rising no-show rate. It gives guidance only: it does not change bookings, clients, products or orders.',
  },
  {
    question: 'Can I try the dashboard before I pay?',
    answer:
      'Yes. The demo dashboard for Heritage Grooming, a fictional demonstration shop, runs on sample data, so you can open Reports, Clients and Sales without creating real appointments, orders or payments.',
  },
];

/* ---------- Close ---------- */

export const KAR_CLOSE_TITLE = 'See your own shop in it';
export const KAR_CLOSE_LEAD =
  'We build a free preview of your branded website with the booking and dashboard behind it. Nothing goes public until you approve it.';
export const KAR_CLOSE_STARTER = 'Or start with KERSIVO Starter, £0/month';
export const KAR_CLOSE_NOTE = `${offer.fees.commission}. ${offer.fees.stripe} ${offer.fees.setup}. ${offer.fees.vat}`;
