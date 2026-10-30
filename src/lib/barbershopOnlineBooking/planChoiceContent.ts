/**
 * Section 07 for /barbershop-online-booking — heading, intent-based plan chooser, disclosure, FAQ.
 */
import {
  BILLING_CYCLE_SHORT,
  FREE_PREVIEW_BILLING_CLAIM,
  EMAIL_REMINDERS_CLAIM,
  KERSIVO_COMMISSION_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const PLAN_CHOICE_SECTION_ID = 'booking-options';

export const PLAN_CHOICE_H2 = 'Choose the Booking Setup That Fits Your Shop.';

export const PLAN_CHOICE_LEAD =
  'Start from what you need online booking to do for your shop. Full adds your branded website and broader shop-management tools; Starter is a hosted booking page for smaller teams.';

export const PLAN_CHOICE_CLOSE =
  'Not sure yet? Starter and Full run on the same KERSIVO platform, so you can start on Starter and move to Full later.';

export type PlanChoiceIntentOption = {
  id: 'full' | 'starter';
  label: string;
  price: string;
  heading: string;
  intents: string[];
  primary: { label: string; href: string; trackEvent: string };
  secondary?: { label: string; href: string; trackEvent: string };
};

/** Intent-based chooser: Full first, Starter as the secondary path. */
export const PLAN_CHOICE_INTENTS: PlanChoiceIntentOption[] = [
  {
    id: 'full',
    label: 'Full KERSIVO',
    price: `£${SAAS_MONTHLY_GBP}/month per location`,
    heading: 'Choose Full if you want…',
    intents: [
      'Clients to book on your own branded website and domain',
      'More than 4 active bookable barbers',
      'To offer Pay at shop, or set the payment rule yourself',
      'Full booking history, Reports, Retail and SMS reminders within a monthly allowance',
    ],
    primary: {
      label: `Start Full KERSIVO — £${SAAS_MONTHLY_GBP}/month`,
      href: '/admin/launch',
      trackEvent: 'saas_subscribe_click',
    },
    secondary: { label: 'See what Full includes', href: '/pricing#plan', trackEvent: 'plan_my_setup_click' },
  },
  {
    id: 'starter',
    label: 'KERSIVO Starter',
    price: '£0/month',
    heading: 'Starter fits if…',
    intents: [
      'A KERSIVO-hosted booking page is enough for now',
      'You have up to 4 active bookable barbers',
      `Every online booking can take a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through your own Stripe account`,
    ],
    primary: { label: 'Start on Starter (£0/month)', href: '/starter', trackEvent: 'starter_plan_explore_click' },
  },
];

export type PlanChoiceFaq = {
  id: string;
  question: string;
  answer: string[];
};

export type PlanChoiceContent = {
  sectionId: typeof PLAN_CHOICE_SECTION_ID;
  h2: typeof PLAN_CHOICE_H2;
  lead: typeof PLAN_CHOICE_LEAD;
  close: typeof PLAN_CHOICE_CLOSE;
  disclosure: string[];
  faqs: PlanChoiceFaq[];
};

const deposit = `£${KERSIVO_BOOKING_DEPOSIT_GBP}`;
const fullPrice = `£${SAAS_MONTHLY_GBP}`;

export function buildPlanChoiceContent(freePreview = false): PlanChoiceContent {
  const disclosure = [
    STRIPE_FEES_NOTE,
    `Full KERSIVO costs ${fullPrice}/month per physical location. ${freePreview ? FREE_PREVIEW_BILLING_CLAIM : BILLING_CYCLE_SHORT}`,
    ONBOARDING_BILLING_INDEPENDENT_CLAIM,
    `Starter public online bookings require a connected Stripe account and at least ${deposit} paid online.`,
    KERSIVO_COMMISSION_CLAIM,
  ];

  const faqs: PlanChoiceFaq[] = [
    {
      id: 'app',
      question: 'Do my customers need to download an app?',
      answer: [
        'No. Customers can book in their browser on a phone, tablet or computer.',
      ],
    },
    {
      id: 'barber',
      question: 'Can customers choose their preferred barber?',
      answer: [
        'Yes. Clients can choose an eligible barber who offers the selected service and has an available appointment.',
        'KERSIVO Starter supports up to four active bookable barbers per physical location. Full KERSIVO is the path when you need a larger active team.',
      ],
    },
    {
      id: 'pay',
      question: 'Do customers have to pay when booking?',
      answer: [
        `On KERSIVO Starter, every public online booking requires at least ${deposit} paid online. For services above ${deposit}, the customer chooses a ${deposit} deposit or payment in full. A service priced at exactly ${deposit} is paid in full.`,
        `On Full KERSIVO, the shop owner chooses Pay at shop (no online payment), a ${deposit} deposit, or payment in full online. Deposits count towards the service price and the balance is paid at the shop. ${STRIPE_FEES_NOTE}`, 
      ],
    },
    {
      id: 'changes',
      question: 'Can customers reschedule or cancel appointments?',
      answer: [
        'Customers can request a change or cancellation through links in their booking confirmation email.',
        'Requests are subject to the shop’s booking, cancellation and payment policies. Free changes or automatic refunds are not guaranteed.',
      ],
    },
    {
      id: 'upgrade',
      question: 'Can I start with Starter and upgrade to Full later?',
      answer: [
        'Yes. Starter and Full share the same underlying KERSIVO platform. Full adds a branded website, your own domain arrangement, support for larger teams and wider business tools.',
        `Full KERSIVO is ${fullPrice}/month per physical location. Website preparation follows standard onboarding; it is not an instant launch.`,
      ],
    },
  ];

  return {
    sectionId: PLAN_CHOICE_SECTION_ID,
    h2: PLAN_CHOICE_H2,
    lead: PLAN_CHOICE_LEAD,
    close: PLAN_CHOICE_CLOSE,
    disclosure,
    faqs,
  };
}

/** Claims that must never appear as live Full automation advertising in this section. */
export const PLAN_CHOICE_BANNED_CLAIMS = [
  'thank-you email is sent',
  'automatically sends',
  'leave a google review',
  'book again',
  'rebooking campaign',
  'pay at shop on starter',
  'unlimited free cancellation',
  'guaranteed refund',
] as const;

/** Re-export for tests that assert email reminder wording stays truthful. */
export const PLAN_CHOICE_EMAIL_REMINDERS_REF = EMAIL_REMINDERS_CLAIM;
