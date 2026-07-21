import {
  BILLING_CYCLE_CLAIM,
  DOMAIN_EXISTING_CLAIM,
  DOMAIN_INCLUDED_CLAIM,
  DOMAIN_LIMIT_CLAIM,
  DOMAIN_NEW_CLAIM,
  FAIR_USE_INTRO,
  FAIR_USE_ORDINARY_BREACH_CLAIM,
  INCLUDED_SETUP_CLAIM,
  KERSIVO_COMMISSION_WITH_STRIPE,
  MISSING_CRITICAL_MATERIALS_CLAIM,
  MISSING_OPTIONAL_MATERIALS_CLAIM,
  NO_FAKE_STOCK_CLAIM,
  NO_PAUSE_CLAIM,
  NO_SETUP_FEE_CLAIM,
  ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  ONBOARDING_MATERIALS_CLAIM,
  ONBOARDING_TIMELINE_CLAIM,
  OWNER_SELF_CONFIG_CLAIM,
  PLAN_SCOPE_CLAIM,
  PLAN_SCOPE_HIGHLIGHTS,
  PLAN_SCOPE_PILLS,
  POWERED_BY_KERSIVO_CLAIM,
  PREVIEW_LAUNCH_CLAIM,
  PRICE_CHANGE_NOTICE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_CLAIM,
  STANDARD_SITE_NOT_BESPOKE_CLAIM,
  STANDARD_SITE_SCOPE_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'Do you take any percentage from bookings or product sales?',
    answer: `0% KERSIVO commission on bookings and retail. ${STRIPE_FEES_NOTE}`,
  },
  {
    question: 'What fees do I still pay?',
    answer: `You pay £${SAAS_MONTHLY_GBP}/month for your KERSIVO subscription. ${NO_SETUP_FEE_CLAIM} ${PLAN_SCOPE_CLAIM} ${BILLING_CYCLE_CLAIM} ${KERSIVO_COMMISSION_WITH_STRIPE} ${DOMAIN_INCLUDED_CLAIM} ${PRICE_VAT_DISCLAIMER}`,
  },
  {
    question: 'Is there a setup or installation fee?',
    answer: `${NO_SETUP_FEE_CLAIM} ${INCLUDED_SETUP_CLAIM}`,
  },
  {
    question: 'Is a domain included?',
    answer: `${DOMAIN_INCLUDED_CLAIM} ${DOMAIN_NEW_CLAIM} ${DOMAIN_EXISTING_CLAIM}`,
  },
  {
    question: 'What if the domain I want is premium or costs more than the standard allowance?',
    answer: DOMAIN_LIMIT_CLAIM,
  },
  {
    question: 'What does the £39/month plan include for setup?',
    answer: INCLUDED_SETUP_CLAIM,
  },
  {
    question: 'What can I configure myself in the dashboard?',
    answer: OWNER_SELF_CONFIG_CLAIM,
  },
  {
    question: 'What does the barbershop website include?',
    answer: `${STANDARD_SITE_SCOPE_CLAIM} ${STANDARD_SITE_NOT_BESPOKE_CLAIM}`,
  },
  {
    question: 'Is the website fully bespoke or custom-built from scratch?',
    answer: `${STANDARD_SITE_NOT_BESPOKE_CLAIM} We do not offer unlimited design or unlimited redesigns as part of the standard £39 plan.`,
  },
  {
    question: 'What is the “Powered by KERSIVO” mark?',
    answer: POWERED_BY_KERSIVO_CLAIM,
  },
  {
    question: 'Does the price cover more than one shop?',
    answer: PLAN_SCOPE_CLAIM,
  },
  {
    question: 'Are there limits on the £39 plan?',
    answer: `${FAIR_USE_INTRO} ${FAIR_USE_ORDINARY_BREACH_CLAIM} Full prohibited-use and immediate-restriction rules are in the Terms (Limits and fair use).`,
  },
  {
    question: "What's included in the £39/month plan?",
    answer: `Highlights: ${PLAN_SCOPE_HIGHLIGHTS.join('; ')}. Also included: ${PLAN_SCOPE_PILLS.join('; ')}. ${KERSIVO_COMMISSION_WITH_STRIPE} ${SMS_INCLUDED_CLAIM}. The full subscription list is in the Terms.`,
  },
  {
    question: 'How does billing work?',
    answer: `${BILLING_CYCLE_CLAIM} ${ONBOARDING_BILLING_INDEPENDENT_CLAIM} ${PRICE_VAT_DISCLAIMER}`,
  },
  {
    question: 'What happens after I subscribe?',
    answer: `${ONBOARDING_MATERIALS_CLAIM} ${INCLUDED_SETUP_CLAIM} ${OWNER_SELF_CONFIG_CLAIM} ${ONBOARDING_TIMELINE_CLAIM} ${PREVIEW_LAUNCH_CLAIM}`,
  },
  {
    question: 'Does waiting on materials pause my subscription billing?',
    answer: ONBOARDING_BILLING_INDEPENDENT_CLAIM,
  },
  {
    question: 'How long does setup take?',
    answer: ONBOARDING_TIMELINE_CLAIM,
  },
  {
    question: 'How does preview and launch work?',
    answer: PREVIEW_LAUNCH_CLAIM,
  },
  {
    question: 'What if I do not send every photo or logo?',
    answer: `${MISSING_OPTIONAL_MATERIALS_CLAIM} ${MISSING_CRITICAL_MATERIALS_CLAIM} ${NO_FAKE_STOCK_CLAIM}`,
  },
  {
    question: 'Can I pause my subscription?',
    answer: NO_PAUSE_CLAIM,
  },
  {
    question: 'Can the £39/month price change?',
    answer: PRICE_CHANGE_NOTICE_CLAIM,
  },
  {
    question: 'Can I buy without speaking to someone first?',
    answer: `Yes. You can start a £${SAAS_MONTHLY_GBP}/month subscription securely, then complete the onboarding form. ${NO_SETUP_FEE_CLAIM} The first payment is taken immediately when you subscribe. ${ONBOARDING_BILLING_INDEPENDENT_CLAIM} ${OWNER_SELF_CONFIG_CLAIM}`,
  },
  {
    question: 'Can you migrate us from another booking platform?',
    answer:
      'Yes. Migration help is included in the standard £39/month setup. We help map your services, barbers, opening hours and booking flow from your current system. Where export/import is available, we can also help move client data from CSV.',
  },
  {
    question: 'Will my clients have to download a new app?',
    answer:
      'No. Clients book through your barbershop’s booking website in the browser. No app download is required.',
  },
  {
    question: 'What happens if I cancel my subscription?',
    answer: `${NO_PAUSE_CLAIM} There is no minimum term and no notice period. After the paid month ends, the website, booking system, admin dashboard and retail system are taken offline. You own your domain, brand, content, client relationship and exported business data. KERSIVO owns the platform software — you license it while your subscription is active. Free CSV export (first name, surname where stored, email, phone, booking history) is available during your subscription and for 30 days after termination. After cancellation, domain management control is transferred to you.`,
  },
  {
    question: 'What is the full cost breakdown?',
    answer: `£${SAAS_MONTHLY_GBP}/month subscription per physical location — ${NO_SETUP_FEE_CLAIM} ${KERSIVO_COMMISSION_WITH_STRIPE} ${SMS_INCLUDED_CLAIM}. ${PRICE_VAT_DISCLAIMER}`,
  },
  {
    question: 'Is KERSIVO new?',
    answer:
      'Yes — KERSIVO is early-stage and currently onboarding selected UK barbershops. That means you get closer setup support, direct founder attention and a system built around real barbershop needs.',
  },
];

export function buildBarbershopBookingFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: BARBERSHOP_BOOKING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
