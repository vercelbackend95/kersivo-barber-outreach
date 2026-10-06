import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

type LandingFaqItem = {
  question: string;
  answer: string;
};

export const BARBERSHOP_BOOKING_FAQ_ITEMS: LandingFaqItem[] = [
  {
    question: 'What is barbershop software?',
    answer:
      'Barbershop software helps a shop manage day-to-day tasks such as online bookings, appointment scheduling, barbers, services, clients, reminders and payments. KERSIVO Starter covers the core booking operation, while Full KERSIVO adds the branded website, own domain, Reports, Retail and wider business tools.',
  },
  {
    question: 'What should a barber booking system include?',
    answer:
      'A barber booking system should make it easy for clients to choose a service, barber and available time while giving the shop control over appointments, availability, client records, payments and reminders. KERSIVO also gives the shop an admin dashboard, with a hosted booking page on Starter and a complete own-domain customer experience on Full.',
  },
  {
    question: 'How much does KERSIVO cost?',
    answer: `KERSIVO Starter is £0/month for the core booking operation, with up to 4 active bookable barbers. Public Starter bookings require a connected Stripe account and are paid with a £5 deposit or in full. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location and adds your branded website, own domain and the wider business toolkit. There is no setup fee and KERSIVO takes 0% commission on booking payments on both plans. Standard Stripe processing fees apply to online card payments.`,
  },
  {
    question: 'Do you take commission on bookings or retail sales?',
    answer:
      'KERSIVO takes 0% commission on booking payments on Starter and Full KERSIVO, and 0% on retail sales processed through Full KERSIVO. Standard Stripe payment-processing fees still apply to online card payments.',
  },
  {
    question: `What is included in the £${SAAS_MONTHLY_GBP}/month Full KERSIVO plan?`,
    answer:
      'Full KERSIVO includes a branded barbershop website on your own domain, online booking, editable booking-payment controls including Pay at shop, £5 deposit or full payment, Advanced Clients, email confirmations, SMS appointment reminders, an admin dashboard, Retail pickup, Reports, hosting, SSL, maintenance and support.',
  },
  {
    question: 'Does KERSIVO charge more when I add more barbers?',
    answer: `Starter supports up to 4 active bookable barbers at £0/month. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location rather than per barber; additional barbers within that location are included subject to reasonable fair use.`,
  },
  {
    question: 'Is the website fully bespoke?',
    answer:
      'No. Full KERSIVO includes a professional website configured around your barbershop’s brand and content, but it is not a fully bespoke design project built from scratch. Unlimited redesigns and custom development are not included. KERSIVO Starter uses a hosted booking page rather than a full website.',
  },
  {
    question: 'Is my own domain included?',
    answer:
      'Yes, with Full KERSIVO. One standard domain is included for each physical location while Full is active. We can register a new standard domain or help connect an existing one. Premium or unusually expensive domains may require an additional charge. Starter uses a KERSIVO-hosted booking page.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Starter is self-serve: create the workspace, add your team, services and availability, then connect Stripe before public bookings go live. For Full KERSIVO, timing depends on the completeness of your materials and any migration work; you review a private preview before the Full website goes live.',
  },
  {
    question: 'What happens after I choose a KERSIVO plan?',
    answer:
      'With Starter, you configure the core booking workspace and connect Stripe to launch public bookings. With Full KERSIVO, you complete client onboarding and KERSIVO prepares the wider branded setup for review. Starter has no monthly software fee; Full billing begins when you subscribe.',
  },
  {
    question: 'Can you migrate me from Booksy, Fresha or another booking platform?',
    answer:
      'Full KERSIVO includes migration assistance for usable business data available from your current booking system, including supported CSV exports. The exact data that can be moved depends on what your current provider makes available and how complete the export is.',
  },
  {
    question: 'Will my clients need to download an app?',
    answer:
      'No. On Starter, clients book through your KERSIVO-hosted booking page in their browser. On Full KERSIVO, they book through your branded website and own domain. No customer app download is required.',
  },
  {
    question: 'What can I manage from the dashboard?',
    answer:
      'Starter includes bookings, team, services, availability, manual bookings, Clients Core and rolling 90-day booking history. Full KERSIVO adds the wider tools including Advanced Clients, full booking history, Reports, Retail, products and orders.',
  },
  {
    question: 'Can I cancel Full KERSIVO, and what happens afterwards?',
    answer:
      'Yes. Full remains active until the end of the paid billing period. You then explicitly choose whether to continue on KERSIVO Starter or leave KERSIVO. If you continue on Starter, the Starter workspace and eligible data remain active while Full-only features and the Full website/domain experience end. If you leave completely, the departure, export and retention rules in the Terms apply.',
  },
  {
    question: 'Do I need to be technical to use KERSIVO?',
    answer:
      'No. Starter guides you through the core setup and Stripe connection from the dashboard. With Full KERSIVO, KERSIVO also handles the standard website, hosting, SSL and domain setup. Day-to-day bookings, barbers, services, prices, working hours and clients are managed from the admin dashboard.',
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
