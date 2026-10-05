import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const STARTER_PAGE_PATH = '/starter';

export const STARTER_PAGE_TITLE =
  'KERSIVO Starter for UK Barbers | £0/Month & 0% Commission';

export const STARTER_PAGE_DESCRIPTION =
  'KERSIVO Starter for UK barbershops: £0/month, 0% KERSIVO commission. Hosted booking page, up to 4 barbers, email reminders, Google booking setup and a QR Kit.';

export const STARTER_PAGE_H1 = 'Start taking bookings with KERSIVO Starter.';

export const STARTER_PAGE_LAST_UPDATED_ISO = '2026-10-05';
export const STARTER_PAGE_LAST_UPDATED_LABEL = '5 October 2026';

export type StarterFaqItem = {
  question: string;
  answer: string;
};

export const STARTER_FAQ_ITEMS: StarterFaqItem[] = [
  {
    question: 'Is KERSIVO Starter really £0 a month?',
    answer:
      'Yes. KERSIVO Starter has no monthly subscription fee and no setup fee. It is a real operating plan, not a time-limited trial.',
  },
  {
    question: 'Does KERSIVO charge commission on Starter bookings?',
    answer:
      'No. KERSIVO takes 0% commission on Starter bookings. Standard Stripe processing fees apply only if you connect Stripe to take deposits or full payments online, and that money goes to your own Stripe account.',
  },
  {
    question: 'Do I need Stripe to use KERSIVO Starter?',
    answer:
      'No. You can activate Starter and take bookings in Pay at shop mode without connecting Stripe. If you later want required deposits or full online card payments, you can connect your own Stripe account from Settings.',
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
    question: 'Do customers need an app to book?',
    answer:
      'No. Customers book through your KERSIVO-hosted booking page in their browser. They do not need to install a customer app.',
  },
  {
    question: 'Can I upgrade from Starter to Full KERSIVO later?',
    answer: `Yes. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location, also with 0% KERSIVO commission. Upgrade when you want your own branded website and domain, more than 4 bookable barbers, full booking history, Advanced Clients, Reports, Retail, SMS reminders and the live KERSIVO Assistant.`,
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
