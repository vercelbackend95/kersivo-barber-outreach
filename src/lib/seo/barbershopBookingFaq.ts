import {
  KERSIVO_COMMISSION_WITH_STRIPE,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
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
    answer: `You pay your selected setup package, then £39/month Ongoing Care from go-live (mandatory, billed automatically). ${KERSIVO_COMMISSION_WITH_STRIPE} Domain purchase, management and renewal are included while Care is active. ${PRICE_VAT_DISCLAIMER}`,
  },
  {
    question: 'Can I buy without speaking to someone first?',
    answer:
      'Yes. You can choose a setup package, pay the deposit securely, then complete the onboarding form. Work begins after the deposit, completed onboarding and the start of project delivery.',
  },
  {
    question: 'Can you migrate us from another booking platform?',
    answer:
      'Yes. We help map your services, barbers, opening hours and booking flow from your current system. Where export/import is available, we can also help move client data from CSV.',
  },
  {
    question: 'Will my clients have to download a new app?',
    answer:
      'No. Clients book through your barbershop’s booking website in the browser. No app download is required.',
  },
  {
    question: 'What happens after I buy?',
    answer:
      'You pay a 50% setup deposit, complete onboarding, then KERSIVO prepares your booking website, admin dashboard and retail pickup shop. The remaining 50% is due before go-live. You review the setup before launch.',
  },
  {
    question: 'What happens if I cancel Ongoing Care?',
    answer:
      'There is no minimum term and no notice period. Care stays active until the end of the paid month, then the website, booking system, admin dashboard and retail system are taken offline. You own your domain, brand, content, client relationship and exported business data. KERSIVO owns the platform software — you license it while Care is active. Free CSV export (first name, surname where stored, email, phone, booking history) is available during Care and for 30 days after termination. After cancellation, domain management control is transferred to you.',
  },
  {
    question: 'What is the full cost breakdown?',
    answer: `Launch is £199 setup + £39/month Ongoing Care from go-live. Priority Growth is £299 setup + £39/month Ongoing Care from go-live. ${KERSIVO_COMMISSION_WITH_STRIPE} ${SMS_INCLUDED_CLAIM}. ${PRICE_VAT_DISCLAIMER}`,
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
