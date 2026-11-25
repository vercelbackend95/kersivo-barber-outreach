/**
 * Copy for /barbershop-online-booking (the 2026-11 redesign).
 *
 * Every commercial fact comes from the shared sources (offer, claimsPolicy, defaults, the booking
 * payment policy) so this guide cannot drift from /pricing, /starter or the live booking flow.
 * British English throughout. No invented figures, reviews or customers.
 */
import { BOOKING_DEPOSIT_CAP_PENCE } from '@/lib/booking/bookingPaymentPolicy';
import { KERSIVO_COMMISSION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const deposit = `£${KERSIVO_BOOKING_DEPOSIT_GBP}`;
const fullPrice = `£${SAAS_MONTHLY_GBP}`;

if (BOOKING_DEPOSIT_CAP_PENCE !== KERSIVO_BOOKING_DEPOSIT_GBP * 100) {
  throw new Error('Online booking copy: the deposit in defaults and the booking payment policy disagree.');
}

/* ---------- 01 Hero ---------- */

export const BOB_HERO = {
  eyebrow: 'Online booking for UK barbershops',
  /** The H1, split in two lines; the second carries the red accent. */
  titleLines: ['Barbershop online booking,', 'explained in one booking.'] as const,
  /** Direct answer, written to be quoted on its own (search snippets and AI answers). */
  lead:
    'Online booking lets your clients choose a service, a barber and a free time on their phone, pay a deposit if you ask for one and get a confirmation email. The appointment goes straight into your shop diary. No phone call, no DMs, no app to download.',
  facts: [`Full KERSIVO ${fullPrice}/month per location`, '0% KERSIVO commission', 'No app for your clients'] as const,
  feesNote: STRIPE_FEES_NOTE,
  demoLabel: 'Open the live demo',
  compareLabel: 'Compare Starter and Full',
  tryHint: 'Make a booking on the phone. Watch where it lands.',
} as const;

/* ---------- 02 At a glance ---------- */

export const BOB_GLANCE = {
  id: 'at-a-glance',
  eyebrow: 'At a glance',
  title: 'Online booking with KERSIVO, in eight answers',
  lead:
    'The short version, for owners comparing systems. Every answer links to the part of this guide that explains it.',
  rows: [
    {
      term: 'What it costs',
      value: `${fullPrice}/month`,
      detail: `Full KERSIVO, per physical location, with your own website and domain. KERSIVO Starter is £0/month for up to 4 barbers. No setup fee.`,
      href: '#booking-options',
    },
    {
      term: 'Commission',
      value: '0%',
      detail: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
      href: '#payments',
    },
    {
      term: 'Client app',
      value: 'None',
      detail: 'Clients book in the browser on a phone, tablet or computer. No download and no account to create.',
      href: '#how-it-works',
    },
    {
      term: 'Payment at booking',
      value: 'Your rule',
      detail: `On Full you choose Pay at shop, a ${deposit} deposit or payment in full. Starter takes a ${deposit} deposit or the full price online.`,
      href: '#payments',
    },
    {
      term: 'Available times',
      value: 'From your diary',
      detail: 'Times come from each barber’s working hours, the service length and the appointments already booked.',
      href: '#availability',
    },
    {
      term: 'Where clients book',
      value: 'One link',
      detail: 'The same booking page from your website, Google Business Profile, social bio or a QR code in the shop.',
      href: '#where-bookings-start',
    },
    {
      term: 'After booking',
      value: 'Email + SMS',
      detail: 'Email confirmations and reminders on both plans. Full adds SMS reminders within a monthly allowance.',
      href: '#after-booking',
    },
    {
      term: 'Time to go live',
      value: 'A few days',
      detail:
        'Starter is self-serve. Full is typically ready in a few days once we receive all required information, and nothing goes live until you approve it.',
      href: '#setup',
    },
  ],
} as const;

/* ---------- 03 How it works ---------- */

export type BobStep = {
  id: string;
  number: string;
  title: string;
  client: string;
  shop: string;
};

export const BOB_STEPS_SECTION = {
  id: 'how-it-works',
  eyebrow: 'How it works',
  title: 'How online booking works, step by step',
  lead: 'Five steps for the client, about a minute on a phone. Under each one: what your shop decides behind it.',
} as const;

export const BOB_STEPS: readonly BobStep[] = [
  {
    id: 'service',
    number: '01',
    title: 'The client chooses a service',
    client: 'Your menu shows each service with its price and how long it takes, so the client knows the cost before they book.',
    shop: 'You set the services, prices and durations. The duration decides how much diary time the booking holds.',
  },
  {
    id: 'barber',
    number: '02',
    title: 'They pick a barber',
    client: 'Clients choose the barber they want, by name and photo.',
    shop: 'A barber who is off that day, or doesn’t offer the service, can’t be picked. Starter covers up to 4 active barbers; Full covers your whole team at the same price per location, subject to fair use.',
  },
  {
    id: 'time',
    number: '03',
    title: 'They pick a free time',
    client: 'The client sees only start times that are actually free for that barber and that service length.',
    shop: 'Times come from working hours, breaks, time off and existing appointments. Nothing is offered twice.',
  },
  {
    id: 'pay',
    number: '04',
    title: 'They add details and pay, if you ask',
    client: `Name and email are required, phone is optional. If your rule asks for it, they pay a ${deposit} deposit or the full price by card.`,
    shop: `On Full you choose Pay at shop, a ${deposit} deposit or full payment. Online payments go to your own Stripe account.`,
  },
  {
    id: 'confirmed',
    number: '05',
    title: 'The booking is confirmed',
    client: 'They get a confirmation email with links to request a change or cancellation.',
    shop: 'The appointment appears as Booked in your diary and that time stops being offered to anyone else.',
  },
];

/* ---------- 04 Availability ---------- */

export const BOB_AVAILABILITY = {
  id: 'availability',
  eyebrow: 'Available times',
  title: 'Why some times are offered and others aren’t',
  lead:
    'Tap any start time on one barber’s demo day and watch their KERSIVO timeline. A time is offered only when the whole service fits before the next booking and before closing.',
  rules: [
    { title: 'Working hours', body: 'Each barber’s own hours, breaks and time off set the outer edges of the day.' },
    { title: 'Service length', body: 'A 45-minute skin fade needs 45 free minutes. A 20-minute beard trim fits in smaller gaps.' },
    { title: 'Existing appointments', body: 'A start time is skipped if the cut would run into the next booking, even when the chair is free at that moment.' },
  ],
  note: 'Heritage Grooming is a fictional KERSIVO demonstration shop. Tapping a time creates no booking.',
} as const;

/* ---------- 05 Payments ---------- */

export const BOB_PAYMENTS = {
  id: 'payments',
  eyebrow: 'Deposits and payments',
  title: 'What a client pays when they book',
  lead: `Pick a plan, a payment rule and a price. The split is worked out with the same rules the live booking flow uses.`,
  fullRules: [
    { id: 'NONE', label: 'Pay at shop' },
    { id: 'DEPOSIT', label: `${deposit} deposit` },
    { id: 'FULL', label: 'Pay in full' },
  ] as const,
  starterChoices: [
    { id: 'DEPOSIT', label: `Pay ${deposit} deposit` },
    { id: 'FULL', label: 'Pay in full' },
  ] as const,
  notes: [
    `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    'Online payments go through your own connected Stripe account, so the money is paid to your business.',
    `A deposit counts towards the service price. On Starter every public booking is paid online: a ${deposit} deposit or the full price, chosen by the client. Starter services start at ${deposit}.`,
    'KERSIVO is not a till or card reader. Anything left to pay is paid in the shop the way you take payments today.',
  ],
  disclaimer: 'Prices here are examples. Nothing on this page takes a payment or connects to Stripe.',
} as const;

/* ---------- 06 Where bookings start ---------- */

export const BOB_CHANNELS_SECTION = {
  id: 'where-bookings-start',
  eyebrow: 'Where bookings start',
  title: 'One booking page, every place clients find you',
  lead: 'You share one link. Wherever a client taps it, they land on the same booking page and the booking goes into the same diary.',
} as const;

export const BOB_CHANNELS = [
  {
    id: 'website',
    title: 'Your website',
    body: 'On Full, the Book button sits on your own branded website and domain. On Starter you get a KERSIVO-hosted booking page.',
  },
  {
    id: 'google',
    title: 'Google Business Profile',
    body: 'Add your booking link to your Business Profile. KERSIVO guides you through it; it is not a native Google booking integration.',
  },
  {
    id: 'social',
    title: 'Instagram and TikTok bio',
    body: 'Paste the link into your bio or stories, so a client who likes your work can book without sending a DM.',
  },
  {
    id: 'qr',
    title: 'QR code in the shop',
    body: 'Walk-ins scan a code at the counter or window to book their next visit. Eligible verified UK shops can request one complimentary initial QR Kit per location.',
  },
] as const;

/* ---------- 07 After the booking ---------- */

export const BOB_AFTER = {
  id: 'after-booking',
  eyebrow: 'After the booking',
  title: 'Confirmations, reminders and changes',
  lead: 'What happens between the booking and the client sitting in the chair.',
  steps: [
    { when: 'Straight away', title: 'Confirmation email', body: 'The client gets the service, barber, time and price, with links to request a change or cancellation.' },
    { when: 'Straight away', title: 'In your diary', body: 'The booking shows as Booked on the barber’s timeline, and the client is added to your client list.' },
    { when: 'Before the visit', title: 'Reminder', body: 'An automatic email reminder on both plans. Full adds SMS appointment reminders within a monthly allowance.' },
    { when: 'If plans change', title: 'Change request', body: 'Requests follow your booking, cancellation and payment policy. Free changes and refunds are never automatic.' },
  ],
  policyLink: { label: 'free cancellation policy template', href: '/barbershop-cancellation-policy-template' },
  diaryLabel: 'See the owner’s diary demo',
} as const;

/* ---------- 08 Buyer checklist ---------- */

export const BOB_CHECKLIST = {
  id: 'checklist',
  eyebrow: 'Choosing a system',
  title: 'What to look for in barbershop booking software',
  lead: 'Seven questions worth asking any booking system before you move your clients onto it, with KERSIVO’s answer next to each.',
  items: [
    {
      question: 'Do clients book on your brand or on a marketplace?',
      why: 'On a marketplace your shop sits next to competitors, and the client relationship belongs partly to the app.',
      answer: 'Full KERSIVO puts booking on your own website and domain. There is no KERSIVO marketplace listing your competitors beside you.',
    },
    {
      question: 'Is there a commission on bookings?',
      why: 'A percentage per booking grows with your busiest months.',
      answer: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    },
    {
      question: 'Does the price rise with every barber?',
      why: 'Per-seat pricing makes hiring more expensive.',
      answer: `Full KERSIVO is ${fullPrice}/month per physical location, not per barber, subject to fair use.`,
    },
    {
      question: 'Can you take deposits?',
      why: 'A deposit gives the client a reason to turn up or cancel properly.',
      answer: `Yes. A ${deposit} deposit or payment in full, through your own Stripe account. On Full you can also choose Pay at shop.`,
    },
    {
      question: 'Do clients need an app or an account?',
      why: 'Every extra download or sign-up loses some clients before they book.',
      answer: 'No. Clients book in the browser.',
    },
    {
      question: 'Can you get your client data out?',
      why: 'If you ever move on, your client list should come with you.',
      answer: 'Yes. A free CSV export of client contact details and booking history is available, as set out in the Terms.',
    },
    {
      question: 'Can you leave without a contract?',
      why: 'Long contracts make a bad fit expensive.',
      answer: 'Yes. Full is billed monthly and you can cancel anytime; it stays active to the end of the paid month.',
    },
  ],
} as const;

/* ---------- 09 Setup ---------- */

export const BOB_SETUP = {
  id: 'setup',
  eyebrow: 'Getting started',
  title: 'How to set up online booking in your shop',
  lead: 'Whatever system you choose, these six steps decide how well online booking works for your shop.',
  steps: [
    {
      title: 'Write your service menu with real durations',
      body: 'Time a few of each service. A 30-minute slot for a 45-minute fade puts every barber behind by lunchtime.',
      link: { label: 'Free price list template', href: '/barbershop-price-list-template' },
    },
    {
      title: 'Set each barber’s hours and breaks',
      body: 'Online times are only as accurate as the rota behind them. Add lunch breaks and regular days off.',
    },
    {
      title: 'Decide your deposit rule',
      body: 'Pay at shop, a deposit or full payment. Write a short cancellation policy so clients know what happens if they don’t turn up.',
      link: { label: 'Free cancellation policy template', href: '/barbershop-cancellation-policy-template' },
    },
    {
      title: 'Connect Stripe',
      body: 'Online payments go into your own Stripe account. Starter needs it before public bookings go live.',
    },
    {
      title: 'Share one link everywhere',
      body: 'Website, Google Business Profile, Instagram and TikTok bio, and a QR code at the counter.',
    },
    {
      title: 'Tell your regulars',
      body: 'Keep your current system running until your link is live, then tell regulars where to book next time.',
    },
  ],
  tools: [
    { label: 'No-show cost calculator', href: '/barbershop-no-show-calculator' },
    { label: 'Barber software cost calculator', href: '/barber-software-cost-calculator' },
  ],
} as const;

/* ---------- 11 Close ---------- */

export const BOB_CLOSE = {
  title: ['Your chair.', 'Your link.', 'Your diary.'] as const,
  lead: `Full KERSIVO puts online booking on your own website and domain for ${fullPrice}/month per location. See your shop’s preview before you pay anything.`,
} as const;
