/**
 * ORPHANED default FAQ set — live homepage uses barbershopBookingFaq.ts instead.
 * Aligned with commercial claims (email + SMS appointment reminders included).
 */
import {
  BILLING_CYCLE_CLAIM,
  NO_PAUSE_CLAIM,
  PLAN_SCOPE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type FaqItem = {
  question: string;
  answer: string;
  /** Optional extra context for teams that want more depth. */
  details?: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Do you take any percentage from bookings or product sales?',
    answer: 'No. 0% KERSIVO commission on bookings and retail.',
    details: 'Standard Stripe payment-processing fees still apply on online card payments.',
  },
  {
    question: 'What fees do I still pay?',
    answer: `£${SAAS_MONTHLY_GBP}/month subscription per physical location, and standard Stripe payment-processing fees on online cards. Domain renewal is included while your subscription is active. ${PRICE_VAT_DISCLAIMER}`,
    details: `If you take cash in-shop, payment processing fee can be 0% on that payment. ${PLAN_SCOPE_CLAIM} ${BILLING_CYCLE_CLAIM}`,
  },
  {
    question: 'I have no booking system yet — does this work for me?',
    answer:
      'Yes. We launch new shops on their own domain in about two weeks, with deposit-protected bookings and email appointment confirmations from booking #1. Same product, same price, same 0% KERSIVO commission as switchers.',
    details:
      'We build your booking site on your domain, configure deposits and reminders, set up a Google Business Profile pointer so people find you on Maps, and walk your team through the admin. You start on your own brand from day one — not as a tile in a marketplace.',
  },
  {
    question: 'Can you migrate us from another booking platform?',
    answer:
      'Yes. We handle the switch with guided onboarding, service/team mapping, and controlled go-live support.',
    details:
      'We configure your services, team, deposits, and reminders before go-live. Where direct data transfer is limited by source platform restrictions, we use the fastest supported migration path and stay in contact throughout. You stay on your current system until everything is ready and confirmed.',
  },
  {
    question: 'Will my clients have to download a new app or register again?',
    answer:
      'No. Your clients book through your URL on a normal web page — no app install, no account creation. The booking experience feels the same as before, only on your brand.',
    details:
      'If you are switching, the public booking link they have used before can redirect to your Kersivo system. From their side, they land on your branded booking page. Existing bookings on your previous platform are typically honoured there until they expire.',
  },
  {
    question: 'Are you new — do you have other shops using this yet?',
    answer:
      'We are onboarding founding barbershops in the UK right now while we widen the rollout. Early partners get our full attention.',
    details:
      'Open the live admin without signup, inspect the booking flow yourself, compare the pricing page to anything else you evaluate, then decide.',
  },
  {
    question: "What if I don't get more bookings after launching?",
    answer:
      'If we agree a KPI before go-live (utilisation, no-show £, or owner ops hours), we measure it on your data for 28 days post-launch and share the result. Your subscription includes website update support we can use to act on what the numbers show.',
    details:
      'You keep more of every booking with 0% KERSIVO commission and retain your client relationship and domain. The point is your margin per booking, not just booking volume.',
  },
  {
    question: 'How does this reduce no-shows?',
    answer:
      'Booking deposits plus email and SMS appointment confirmations and reminders increase commitment before appointment time, which reduces empty-chair losses.',
    details: 'The outcome is fewer dead slots, more paid appointments, and less daily disruption.',
  },
  {
    question: 'What automations are included to recover revenue?',
    answer: `Transactional email confirmations and reminders are included while your subscription is active. ${SMS_INCLUDED_CLAIM}.`,
    details:
      'The point is simple: your team spends less time chasing and more time delivering paid services.',
  },
  {
    question: 'Who controls the client relationship after switching?',
    answer:
      'You do. You own your domain, brand, content, client relationship and exported business data.',
    details:
      'You run under your signage and URLs. KERSIVO owns the platform software; you license it while your subscription is active.',
  },
  {
    question: 'Can I leave? What happens to my data?',
    answer: `Yes. ${NO_PAUSE_CLAIM} Free CSV export (first name, surname where stored, email, phone, booking history) is available during your subscription and for 30 days after termination.`,
    details:
      'After cancellation, domain management control is transferred to you. The KERSIVO platform is not transferred with the domain.',
  },
  {
    question: 'What is the full cost breakdown — are there any charges I have not seen?',
    answer: `Your complete cost is: £${SAAS_MONTHLY_GBP}/month subscription per physical location + Stripe’s standard card processing rate on online transactions. No setup fee. ${PRICE_VAT_DISCLAIMER}`,
    details:
      '0% KERSIVO commission on bookings and retail. Email appointment reminders included. There are no per-booking platform fees and no volume surcharges as you add barbers. There is no automatic multi-location discount.',
  },
  {
    question: 'What happens if the setup takes longer than expected, or something goes wrong?',
    answer:
      'We do not move you live until you have reviewed and confirmed everything. If something goes wrong on our side, we work with you to put it right.',
    details:
      'Switchers stay active on their current platform throughout the build.',
  },
];
