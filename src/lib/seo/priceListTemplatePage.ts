/**
 * /barbershop-price-list-template: free browser tool that lays out a barbershop price list
 * to print or copy. Copy, FAQ and JSON-LD live here so tests can assert them.
 */
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const PRICE_LIST_PAGE_PATH = '/barbershop-price-list-template';
export const PRICE_LIST_LAST_UPDATED_ISO = '2026-11-24';
export const PRICE_LIST_LAST_UPDATED_LABEL = '24 November 2026';
export const PRICE_LIST_BREADCRUMB_NAME = 'Price list template';
export const PRICE_LIST_TITLE = 'Free Barber Price List Template (Print or Copy) | KERSIVO';
export const PRICE_LIST_DESCRIPTION =
  'Make a barbershop price list in a minute: add your services, prices and times, then print it for the wall or copy it for Instagram and Google. Free, no sign-up.';
export const PRICE_LIST_H1 = 'Barber price list template';
export const PRICE_LIST_EYEBROW = 'Free tool · No sign-up';
export const PRICE_LIST_DIRECT_ANSWER =
  'Type your services and prices below. The tool lays them out as a clean price list you can print for the shop wall or window, or copy as text for Instagram, your Google Business Profile or your booking page. Nothing you type leaves your browser.';

export const PRICE_LIST_TRUST_SIGNALS: readonly string[] = [
  'Free, no account or email needed',
  'Prints on A4 for the wall or window',
  'Copies as plain text for social and Google',
];

export type PriceListGuideItem = { heading: string; points: readonly string[] };

export const PRICE_LIST_GUIDE: readonly PriceListGuideItem[] = [
  {
    heading: 'What to put on a barbershop price list',
    points: [
      'Your core services first: haircut, skin fade, scissor cut, beard trim, and the combination most clients ask for.',
      'Name each service the way clients ask for it, not the way the till lists it.',
      'Use “from” only when the price genuinely depends on the client, such as long or thick hair, and say what changes it.',
      'Add times if clients book online, so they pick the right slot.',
      'Keep it short: if a service is booked a handful of times a year, it can live on your booking page instead.',
    ],
  },
  {
    heading: 'Showing prices fairly',
    points: [
      'Show the full price a client will pay. Since April 2025, UK consumer law (the Digital Markets, Competition and Consumers Act 2024) treats leaving a compulsory fee out of the headline price as drip pricing.',
      'If your shop is VAT registered, show prices including VAT.',
      'If you take a deposit, say so on the price list or next to the booking button, and link to your cancellation policy.',
      'Use the same prices everywhere: the wall, your website, your booking page and your Google Business Profile.',
    ],
  },
  {
    heading: 'Where to use it',
    points: [
      'Printed by the mirror, at the till and in the window, where walk-ins decide before they come in.',
      'As an Instagram highlight or pinned post.',
      'In your Google Business Profile’s services list.',
      'On your website next to the booking button.',
    ],
  },
];

export type PriceListFaqItem = { question: string; answer: string };

export const PRICE_LIST_FAQ_ITEMS: readonly PriceListFaqItem[] = [
  {
    question: 'Is this barber price list template free?',
    answer:
      'Yes. It runs in your browser with no account, email or payment. Nothing you type is sent to KERSIVO or stored.',
  },
  {
    question: 'How do I print my barbershop price list?',
    answer:
      'Fill in your services and press Print. Only the price list itself is printed, laid out for A4. Choose “Save as PDF” in the print window to keep a file.',
  },
  {
    question: 'Should a barber price list show “from” prices?',
    answer:
      'Only where the price really depends on the client, for example long or very thick hair. Say what changes the price, and keep the main services at a fixed price so clients know what they will pay.',
  },
  {
    question: 'Do I have to show VAT on my prices?',
    answer:
      'If your shop is VAT registered, the prices you show to clients should include VAT. If you are not VAT registered, show your normal prices. This is general information, not tax advice.',
  },
  {
    question: 'How do I work out what to charge?',
    answer:
      'Start from what each chair hour has to earn to cover rent, wages and costs, then check local prices. The free KERSIVO barber price calculator does the sums for each service from your own costs and hours.',
  },
];

export const PRICE_LIST_RELATED_LINKS: readonly { href: string; label: string; description: string }[] = [
  {
    href: '/barber-price-calculator',
    label: 'Barber price calculator',
    description: 'Work out what to charge for each service before you fill in the list.',
  },
  {
    href: '/barbershop-cancellation-policy-template',
    label: 'Cancellation policy template',
    description: 'Write a deposit and no-show policy to sit next to your prices.',
  },
  {
    href: '/barbershop-no-show-calculator',
    label: 'No-show cost calculator',
    description: 'See what missed appointments cost and whether a deposit pays.',
  },
];

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${PRICE_LIST_PAGE_PATH}`;
}

export function buildPriceListJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: PRICE_LIST_TITLE,
      description: PRICE_LIST_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: PRICE_LIST_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#tool` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#tool`,
      name: 'KERSIVO barber price list template',
      url,
      description:
        'Free browser-based tool that lays out a UK barbershop price list to print on A4 or copy as text for social media and Google.',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      provider: { '@id': getKersivoOrganizationId(siteUrl) },
      inLanguage: 'en-GB',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: PRICE_LIST_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: PRICE_LIST_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
