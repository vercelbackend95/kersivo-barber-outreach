import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'Do you take any percentage from bookings or product sales?',
    answer:
      'No. KERSIVO does not take commission from your bookings or retail sales. Your bookings and product sales stay with your shop. Stripe card processing fees may apply for online payments.',
  },
  {
    question: 'What fees do I still pay?',
    answer:
      'You pay your selected setup package, then £39/month Ongoing Care after go-live. Stripe card processing fees may apply for online card payments, and any domain-related costs depend on your domain setup. KERSIVO does not take commission on bookings or retail.',
  },
  {
    question: 'Can I buy without speaking to someone first?',
    answer:
      'Yes. You can choose your setup package online and pay securely through Stripe. After checkout, you’ll receive the onboarding form for your shop details. If anything needs clarification, we’ll contact you before the build continues.',
  },
  {
    question: 'Can you migrate us from Booksy, Fresha or Nearcut?',
    answer:
      'We help map your services, barbers, opening hours and booking flow while your current system stays live. When your KERSIVO setup is ready, we help you move your public booking link over to your own domain.',
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
      'Yes. KERSIVO is an early-stage platform built for independent UK barbershops. That is why the live booking flow and admin demo are available to explore before purchase, so you can see the system clearly before choosing your setup.',
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
