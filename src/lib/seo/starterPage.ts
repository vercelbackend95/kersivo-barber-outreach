import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const STARTER_PAGE_PATH = '/starter';

export const STARTER_PAGE_TITLE =
  'KERSIVO Starter for UK Barbers | £0/Month & 0% Commission';

export const STARTER_PAGE_DESCRIPTION =
  'Start taking bookings with KERSIVO Starter. £0/month, 0% KERSIVO commission, up to 4 bookable barbers, Clients Core, email reminders, Google booking setup and an included QR Kit.';

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
      'Yes. KERSIVO Starter has no monthly subscription fee and KERSIVO takes 0% commission on bookings. Standard Stripe processing fees apply only when you choose to take online card payments.',
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
      'Eligible verified UK Starter locations can request one included initial QR Kit with separate WINDOW and REBOOK booking QR assets. KERSIVO verifies the shop details before the kit goes to print. Replacement and reorder handling is separate.',
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
    answer:
      'Yes. Starter is designed as a real operating plan, with a clear path to Full KERSIVO when you want your own branded website and domain, full booking history, Advanced Clients, Reports, Retail, SMS reminders and the live KERSIVO Assistant.',
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
