import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'How much does KERSIVO cost?',
    answer: `KERSIVO costs £${SAAS_MONTHLY_GBP}/month per physical location. There is no setup fee. Your first payment is taken when you subscribe, then monthly. KERSIVO is not currently VAT registered, so no VAT is added. Standard Stripe payment-processing fees apply to online card payments.`,
  },
  {
    question: 'Do you take commission on bookings or retail sales?',
    answer:
      'KERSIVO charges 0% commission on bookings and retail sales. Standard Stripe payment-processing fees still apply to online card payments.',
  },
  {
    question: `What is included in the £${SAAS_MONTHLY_GBP}/month plan?`,
    answer:
      'The plan includes a branded barbershop website on your own domain, online booking, deposits, client management, email confirmations, SMS appointment reminders, an admin dashboard, retail pickup, reports, hosting, SSL, maintenance and support.',
  },
  {
    question: 'Is the website fully bespoke?',
    answer:
      'No. The standard plan includes a professional website configured around your barbershop’s brand and content, but it is not a fully bespoke design project built from scratch. Unlimited redesigns and custom development are not included.',
  },
  {
    question: 'Is my own domain included?',
    answer:
      'Yes. One standard domain is included for each physical location while your subscription is active. We can register a new standard domain or help connect an existing one. Premium or unusually expensive domains may require an additional charge.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Most standard setups are ready for private review roughly 1–2 weeks after we receive all required information. The exact timing depends on the completeness of your materials and any migration work.',
  },
  {
    question: 'What happens after I subscribe?',
    answer:
      'After subscribing, you complete the onboarding form, we prepare your KERSIVO setup, and you review a private preview. Nothing goes live until you approve it. Billing starts when you subscribe and continues while we wait for any required materials.',
  },
  {
    question: 'Can you migrate me from Booksy, Fresha or another booking platform?',
    answer:
      'Yes. We can help map your services, barbers, opening hours and booking flow. Where your current platform provides a usable export, we can also help import compatible client data from CSV. We cannot guarantee that every type of data can be migrated.',
  },
  {
    question: 'Will my clients need to download an app?',
    answer:
      'No. Clients book through your barbershop’s website in their browser, so no app download is required.',
  },
  {
    question: 'What can I manage from the dashboard?',
    answer:
      'You can manage bookings, clients, barbers, services, prices, working hours, products, retail orders and reports from your KERSIVO dashboard.',
  },
  {
    question: 'Can I cancel anytime, and what happens when I cancel?',
    answer:
      'Yes. There is no minimum term or notice period. Your service remains active until the end of the paid billing period, then the website and KERSIVO systems are taken offline. You can export supported business data, and domain management can be transferred to you. Full cancellation and export rules are available in the Terms.',
  },
  {
    question: 'Do I need to be technical to use KERSIVO?',
    answer:
      'No. KERSIVO prepares the initial website and booking setup, including hosting, SSL and domain configuration. Once it is ready, you can manage bookings, barbers, services, prices, working hours, clients and products from a straightforward admin dashboard.',
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
