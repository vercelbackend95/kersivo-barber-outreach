/**
 * Section 07 section chrome for /barbershop-online-booking — heading, disclosure, FAQ.
 * Plan cards are rendered by the shared StarterFullPlanCards component.
 */
import {
  BILLING_CYCLE_SHORT,
  EMAIL_REMINDERS_CLAIM,
  KERSIVO_COMMISSION_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const PLAN_CHOICE_SECTION_ID = 'booking-options';

export const PLAN_CHOICE_H2 = 'Start With Bookings. Grow Into Your Own Brand.';

export const PLAN_CHOICE_LEAD =
  'Choose a KERSIVO setup that fits your barbershop today — from a free booking page to a complete branded website and business platform.';

export const PLAN_CHOICE_CLOSE = 'Your Shop. Your Bookings. Your Next Move.';

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

export function buildPlanChoiceContent(): PlanChoiceContent {
  const disclosure = [
    `Stripe processing fees apply to online card payments. ${STRIPE_FEES_NOTE}`,
    `Full KERSIVO costs ${fullPrice}/month per physical location. ${BILLING_CYCLE_SHORT}`,
    ONBOARDING_BILLING_INDEPENDENT_CLAIM,
    `Starter public online bookings require a connected Stripe account and at least ${deposit} paid online.`,
    `${KERSIVO_COMMISSION_CLAIM} That is separate from third-party card-processing costs.`,
  ];

  const faqs: PlanChoiceFaq[] = [
    {
      id: 'app',
      question: 'Do my customers need to download an app?',
      answer: [
        'No. Customers book through a browser-based booking experience — on a phone, tablet or computer — without downloading an app.',
      ],
    },
    {
      id: 'barber',
      question: 'Can customers choose their preferred barber?',
      answer: [
        'Yes. Clients can select from eligible bookable barbers and available appointments for the services you offer.',
        'KERSIVO Starter supports up to four active bookable barbers per physical location. Full KERSIVO is the path when you need a larger active team.',
      ],
    },
    {
      id: 'pay',
      question: 'Do customers have to pay when booking?',
      answer: [
        `On KERSIVO Starter, every public online booking requires at least ${deposit} paid online. For services above ${deposit}, the customer chooses a ${deposit} deposit or payment in full. A service priced at exactly ${deposit} is paid in full.`,
        `On Full KERSIVO, booking deposits are optional for the shop: a fixed ${deposit} per booking that counts towards the service price when enabled. ${STRIPE_FEES_NOTE}`,
      ],
    },
    {
      id: 'changes',
      question: 'Can customers reschedule or cancel appointments?',
      answer: [
        'Customers can request changes through the reschedule and cancel links in their booking confirmation email.',
        'Booking changes remain subject to the applicable booking, cancellation and payment policies. The standard booking flow does not promise unlimited free changes or automatic refunds.',
      ],
    },
    {
      id: 'upgrade',
      question: 'Can I start with Starter and upgrade to Full later?',
      answer: [
        'Yes. Starter and Full use the same underlying KERSIVO platform. Full unlocks the branded website, standard domain arrangement, larger team support and the wider business tools when you are ready.',
        `Full KERSIVO is ${fullPrice}/month per physical location. Website preparation still follows the standard onboarding process — it is not an instant launch with zero setup.`,
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
