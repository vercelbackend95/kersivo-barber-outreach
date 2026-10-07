import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const STARTER_PAGE_PATH = '/starter';

export const STARTER_PAGE_TITLE =
  'KERSIVO Starter | £0/Month for UK Barbershops';

export const STARTER_PAGE_DESCRIPTION =
  'KERSIVO Starter for UK barbershops: £0/month, 0% KERSIVO commission, hosted online booking, up to 4 barbers, £5 deposits or full payment, reminders and QR Kit.';

export const STARTER_PAGE_H1 = 'Run your barbershop bookings for £0/month.';

export const STARTER_PAGE_LAST_UPDATED_ISO = '2026-10-06';
export const STARTER_PAGE_LAST_UPDATED_LABEL = '6 October 2026';

export type StarterFaqItem = {
  question: string;
  answer: string;
};

export const STARTER_FAQ_ITEMS: StarterFaqItem[] = [
  {
    question: 'Is KERSIVO Starter really £0 a month?',
    answer:
      'Yes. KERSIVO Starter has no monthly software subscription fee and no setup fee. It is a real operating plan, not a time-limited trial. KERSIVO also takes 0% commission on Starter booking payments.',
  },
  {
    question: 'Does KERSIVO charge commission on Starter bookings?',
    answer:
      'No. KERSIVO takes 0% commission and adds 0% platform fee to Starter booking payments. Standard Stripe processing fees still apply to card payments, and the booking payment is processed through your connected Stripe account.',
  },
  {
    question: 'Do I need Stripe to use KERSIVO Starter?',
    answer:
      'You can create and configure your Starter workspace before Stripe is connected, but a connected Stripe account must be ready before new public bookings can go live. KERSIVO guides the owner through the Stripe connection from the dashboard.',
  },
  {
    question: 'How do customers pay when they book on KERSIVO Starter?',
    answer:
      'For services above £5, the customer chooses either a £5 deposit or Pay in full. A service priced at exactly £5 is paid £5 in full with one clear payment option. Every customer-created public Starter booking therefore includes at least £5 paid online.',
  },
  {
    question: 'Can customers choose Pay at shop on KERSIVO Starter?',
    answer:
      'Not for customer-created public Starter bookings. Starter uses a fixed payment-powered booking flow. Staff can still add manual bookings that are paid at the shop. Full KERSIVO unlocks editable booking-payment controls, including Pay at shop.',
  },
  {
    question: 'How many barbers can use KERSIVO Starter?',
    answer:
      'Starter supports up to 4 active bookable barbers at one physical shop location. If your shop needs more active bookable barbers, Full KERSIVO is the upgrade path.',
  },
  {
    question: 'Does KERSIVO Starter include my own website and domain?',
    answer:
      'No. Starter gives you a KERSIVO-hosted booking page. Full KERSIVO is for shops that want the complete branded website, their own domain and the wider business toolkit.',
  },
  {
    question: 'What is included in the KERSIVO QR Kit?',
    answer:
      'Eligible verified UK Starter locations can request one included initial QR Kit with two printed QR codes: a WINDOW code for inside the shop glass and a REBOOK code for the counter. Both open your booking page and keep working if you later move to Full KERSIVO. KERSIVO verifies the shop details before the kit goes to print. Replacements and reorders are handled separately.',
  },
  {
    question: 'Can customers book from my Google Business Profile?',
    answer:
      'KERSIVO provides a guided setup that gives you the correct booking URL to add to your Google Business Profile. Google controls Business Profile eligibility and where booking actions appear, so KERSIVO cannot guarantee a particular Book button placement.',
  },
  {
    question: 'Can I upgrade from Starter to Full KERSIVO later?',
    answer: `Yes. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location, also with 0% KERSIVO commission. Upgrade when you want your own branded website and domain, more than 4 bookable barbers, full booking history, Advanced Clients, Reports, Retail, SMS reminders, the live KERSIVO Assistant and control over how customers pay when they book.`,
  },
];

export function buildStarterWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${STARTER_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: STARTER_PAGE_TITLE,
    description: STARTER_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: STARTER_PAGE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}

export function buildStarterFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${STARTER_PAGE_PATH}#faq`,
    mainEntity: STARTER_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
