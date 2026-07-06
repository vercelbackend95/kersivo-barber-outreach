import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'Do you take any percentage from bookings or product sales?',
    answer:
      'KERSIVO takes 0% commission from bookings and retail sales. Stripe/card processing fees may still apply to online card payments.',
  },
  {
    question: 'What fees do I still pay?',
    answer:
      'You pay your selected setup package, then £39/month Ongoing Care after go-live. Stripe card processing fees may apply for online card payments, and any domain-related costs depend on your domain setup. KERSIVO does not take commission on bookings or retail.',
  },
  {
    question: 'Can I buy without speaking to someone first?',
    answer:
      'Yes. You can choose a setup package, pay securely, then complete the onboarding form. KERSIVO will prepare the setup and nothing goes live without your review.',
  },
  {
    question: 'Can you migrate us from Booksy, Fresha or Nearcut?',
    answer:
      'We help map your services, barbers, opening hours and booking flow. Where export/import is available, we can also help move client data from CSV.',
  },
  {
    question: 'Will my clients have to download a new app?',
    answer:
      'No. Clients book through your barbershop’s booking website in the browser. No app download is required.',
  },
  {
    question: 'What happens after I buy?',
    answer:
      'You choose your setup package, pay securely through Stripe, complete the onboarding form, then KERSIVO prepares your booking website, admin dashboard and retail pickup shop. You review the setup before go-live.',
  },
  {
    question: 'What happens if I cancel?',
    answer:
      'Your domain, brand assets and operational data remain yours. KERSIVO Care keeps the hosted booking, admin and retail system running while active. If you leave, your booking, client and product data can be exported in standard formats.',
  },
  {
    question: 'What is the full cost breakdown?',
    answer:
      'Launch is £199 setup + £39/month Ongoing Care after go-live. Priority Growth is £299 setup + £39/month Ongoing Care after go-live. KERSIVO does not take commission on bookings or retail sales.',
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
    '@id': `${siteUrl}/barbershop-booking-system#faq`,
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
