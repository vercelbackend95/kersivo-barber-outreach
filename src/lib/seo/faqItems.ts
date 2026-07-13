/**
 * ORPHANED default FAQ set — live homepage uses barbershopBookingFaq.ts instead.
 * Aligned with confirmed commercial rules 13 Jul 2026.
 */
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
    answer:
      'Setup (£199 or £299), Ongoing Care (£39/month from go-live), and standard Stripe payment-processing fees on online cards. Domain renewal is included while Care is active. Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.',
    details: 'If you take cash in-shop, payment processing fee can be 0% on that payment.',
  },
  {
    question: 'I have no booking system yet — does this work for me?',
    answer:
      'Yes. We launch new shops on their own domain in about two weeks, with deposit-protected bookings and unlimited automated SMS reminders from booking #1. Same product, same price, same 0% KERSIVO commission as switchers.',
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
      'We are onboarding founding barbershops in the UK right now while we widen the rollout. Early partners get our full attention and milestone-based pricing (remaining 50% before go-live).',
    details:
      'Open the live admin without signup, inspect the booking flow yourself, compare the pricing page to anything else you evaluate, then decide.',
  },
  {
    question: "What if I don't get more bookings after launching?",
    answer:
      'If we agree a KPI before go-live (utilisation, no-show £, or owner ops hours), we measure it on your data for 28 days post-launch and share the result. Your monthly Care includes up to one hour of minor development changes we can use to act on what the numbers show.',
    details:
      'You keep more of every booking with 0% KERSIVO commission and retain your client relationship and domain. The point is your margin per booking, not just booking volume.',
  },
  {
    question: 'How does this reduce no-shows?',
    answer:
      'Booking deposits plus unlimited automated SMS appointment reminders increase commitment before appointment time, which reduces empty-chair losses.',
    details: 'The outcome is fewer dead slots, more paid appointments, and less daily disruption.',
  },
  {
    question: 'What automations are included to recover revenue?',
    answer:
      'Unlimited automated SMS appointment reminders are included in Ongoing Care, with transactional emails while Care is active.',
    details:
      'The point is simple: your team spends less time chasing and more time delivering paid services.',
  },
  {
    question: 'Who controls the client relationship after switching?',
    answer:
      'You do. You own your domain, brand, content, client relationship and exported business data.',
    details:
      'You run under your signage and URLs. KERSIVO owns the platform software; you license it while Care is active.',
  },
  {
    question: 'Can I leave? What happens to my data?',
    answer:
      'Yes. There is no minimum term and no notice period. Care stays active until the end of the paid month, then the website, booking, admin and retail systems go offline. Free CSV export (first name, surname where stored, email, phone, booking history) is available during Care and for 30 days after termination.',
    details:
      'After cancellation, domain management control is transferred to you. The KERSIVO platform is not transferred with the domain.',
  },
  {
    question: 'What is the full cost breakdown — are there any charges I have not seen?',
    answer:
      'Your complete cost is: setup fee (£199 or £299, one-time) + Ongoing Care (£39/month) + Stripe’s standard card processing rate on online transactions. Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.',
    details:
      '0% KERSIVO commission on bookings and retail. Unlimited automated SMS reminders included. There are no per-booking platform fees and no volume surcharges as you add barbers.',
  },
  {
    question: 'What happens if the setup takes longer than expected, or something goes wrong?',
    answer:
      'If you cancel before work begins, we refund the deposit. Once work begins, the deposit is non-refundable. If KERSIVO cannot deliver, we refund the deposit. We do not move you live until you have reviewed and confirmed everything.',
    details:
      'Switchers stay active on their current platform throughout the build. If you are unresponsive for 30 days after work begins, we may close the project and retain the deposit.',
  },
];
