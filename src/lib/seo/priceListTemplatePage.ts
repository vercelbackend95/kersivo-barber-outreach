/**
 * /barbershop-price-list-template: free browser tool that lays out a barbershop price list
 * to print, download as an image or copy. Copy, FAQ and JSON-LD live here so tests can assert them.
 */
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { PRICE_LIST_MAX_ITEMS } from '@/lib/priceList/priceListText';
import { PRICE_LIST_IMAGE_HEIGHT, PRICE_LIST_IMAGE_WIDTH } from '@/lib/priceList/priceListImage';
import { PRICE_LIST_THEMES } from '@/lib/priceList/priceListThemes';

export const PRICE_LIST_PAGE_PATH = '/barbershop-price-list-template';
export const PRICE_LIST_LAST_UPDATED_ISO = '2026-11-24';
export const PRICE_LIST_LAST_UPDATED_LABEL = '24 November 2026';
export const PRICE_LIST_BREADCRUMB_NAME = 'Price list template';
export const PRICE_LIST_TITLE = 'Free Barber Price List Template: Print or Instagram | KERSIVO';
export const PRICE_LIST_DESCRIPTION =
  'Make a barbershop price list in minutes: add services, prices and times, then print it on A4, save a PDF or download an Instagram image. Free, no sign-up.';
export const PRICE_LIST_H1 = 'Barber price list template';
export const PRICE_LIST_EYEBROW = 'Free tool · No sign-up';

const IMAGE_SIZE = `${PRICE_LIST_IMAGE_WIDTH} × ${PRICE_LIST_IMAGE_HEIGHT}`;

export const PRICE_LIST_DIRECT_ANSWER =
  'Type your services and prices, pick a style, and get a price list you can print on A4 for the wall, save as a PDF, download as an Instagram image or copy as text for Google. It is free, and nothing you type leaves your browser.';

/** Key facts under the hero answer: plain terms and values that search and AI tools can quote. */
export const PRICE_LIST_KEY_FACTS: readonly { term: string; value: string }[] = [
  { term: 'Cost', value: 'Free' },
  { term: 'Sign-up', value: 'None' },
  { term: 'Formats', value: 'Print, PDF, image, text' },
  { term: 'Privacy', value: 'Nothing stored' },
];

export type PriceListStep = { id: string; name: string; text: string };

/** The tool's four steps: the form's headings and the HowTo in JSON-LD. */
export const PRICE_LIST_STEPS: readonly PriceListStep[] = [
  {
    id: 'shop',
    name: 'Name your shop',
    text: 'It goes at the top in large type, so the list also works as a sign in the window.',
  },
  {
    id: 'services',
    name: 'Add services and prices',
    text: `Rows start with common barbershop services and no prices. Rename, reorder, remove or add rows, up to ${PRICE_LIST_MAX_ITEMS}.`,
  },
  {
    id: 'style',
    name: 'Choose a style',
    text: `${PRICE_LIST_THEMES.length} styles for the wall or window. Add times and a line at the bottom if you want them.`,
  },
  {
    id: 'export',
    name: 'Print, download or copy',
    text: `Print on A4 or save as a PDF, download a ${IMAGE_SIZE} image for Instagram, or copy plain text for Google and your booking page.`,
  },
];

/** Annotated parts of a good price list; `part` names the area highlighted on the example sheet. */
export type PriceListAnatomyPart = {
  part: 'title' | 'core' | 'names' | 'from' | 'time' | 'footer';
  heading: string;
  text: string;
};

export const PRICE_LIST_ANATOMY_TITLE = 'What to put on a barbershop price list';
export const PRICE_LIST_ANATOMY_LEAD =
  'A good price list is short, uses the words clients use and leaves no surprise at the till. This is what each part does.';

export const PRICE_LIST_ANATOMY: readonly PriceListAnatomyPart[] = [
  {
    part: 'title',
    heading: 'Your shop name, large',
    text: 'Big enough to read from the door, so the list doubles as a sign in the window.',
  },
  {
    part: 'core',
    heading: 'Core services first',
    text: 'Haircut, skin fade, scissor cut, beard trim and the combination most clients ask for. A service booked a handful of times a year can live on your booking page instead.',
  },
  {
    part: 'names',
    heading: 'Names clients use',
    text: 'Name each service the way clients ask for it, not the way the till lists it.',
  },
  {
    part: 'from',
    heading: '“From” only when it depends',
    text: 'Use “from” only when the price genuinely depends on the client, such as long or thick hair, and say what changes it.',
  },
  {
    part: 'time',
    heading: 'Times for online booking',
    text: 'Add times if clients book online, so they pick the right slot.',
  },
  {
    part: 'footer',
    heading: 'Where to book',
    text: 'Finish with where to book and, if you take a deposit, say so and link to your cancellation policy.',
  },
];

export const PRICE_LIST_FAIR_TITLE = 'How to show prices fairly in the UK';
export const PRICE_LIST_FAIR_LEAD = 'Clients should know what they will pay before they sit down. Four rules keep the list clear.';
export const PRICE_LIST_FAIR_NOTE = 'General information, not legal or tax advice.';

export type PriceListFairRule = { icon: 'pound' | 'receipt' | 'deposit' | 'sync'; heading: string; text: string };

export const PRICE_LIST_FAIR_RULES: readonly PriceListFairRule[] = [
  {
    icon: 'pound',
    heading: 'Show the full price',
    text: 'Since April 2025, UK consumer law (the Digital Markets, Competition and Consumers Act 2024) treats leaving a compulsory fee out of the headline price as drip pricing.',
  },
  {
    icon: 'receipt',
    heading: 'Include VAT if you charge it',
    text: 'If your shop is VAT registered, show prices including VAT. If it is not, show your normal prices.',
  },
  {
    icon: 'deposit',
    heading: 'Say if you take a deposit',
    text: 'Put it on the price list or next to the booking button, and link to your cancellation policy.',
  },
  {
    icon: 'sync',
    heading: 'One price everywhere',
    text: 'Use the same prices on the wall, your website, your booking page and your Google Business Profile.',
  },
];

export type PriceListPlacement = {
  id: 'wall' | 'instagram' | 'google' | 'website';
  heading: string;
  text: string;
  /** Tool action the tile runs, or a link. */
  action: { kind: 'print' | 'image' | 'copy'; label: string } | { kind: 'link'; label: string; href: string };
};

export const PRICE_LIST_PLACEMENTS_TITLE = 'Where to put your price list';
export const PRICE_LIST_PLACEMENTS_LEAD =
  'The same list, in every place a client checks before they book. Each button uses the list you made above.';

export const PRICE_LIST_PLACEMENTS: readonly PriceListPlacement[] = [
  {
    id: 'wall',
    heading: 'By the mirror and in the window',
    text: 'Where walk-ins decide before they come in. Print on A4, or save a PDF for a print shop.',
    action: { kind: 'print', label: 'Print or save as PDF' },
  },
  {
    id: 'instagram',
    heading: 'On Instagram',
    text: `As a pinned post or a highlight. The image is ${IMAGE_SIZE} pixels, a 4:5 portrait post.`,
    action: { kind: 'image', label: 'Download image' },
  },
  {
    id: 'google',
    heading: 'On your Google Business Profile',
    text: 'Copy the list as text, then add each service and price in the services section of your profile.',
    action: { kind: 'copy', label: 'Copy as text' },
  },
  {
    id: 'website',
    heading: 'On your website, next to booking',
    text: 'Full KERSIVO puts your services and prices on your own website, with online booking at those prices.',
    action: { kind: 'link', label: 'See Full KERSIVO pricing', href: '/pricing#plan' },
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
    question: 'What should a barber price list include?',
    answer:
      'Your shop name, your core services in the words clients use, the full price of each, “from” only where the price depends on the client, times if clients book online, and where to book. Rarely booked extras can live on your booking page.',
  },
  {
    question: 'How do I print my barbershop price list?',
    answer:
      'Fill in your services, pick a style and press Print. Only the price list itself is printed, laid out for A4. Choose “Save as PDF” in the print window to keep a file.',
  },
  {
    question: 'Can I download my price list for Instagram?',
    answer: `Yes. Download image saves a ${IMAGE_SIZE} PNG in the style you picked, a 4:5 portrait post ready to share or pin.`,
  },
  {
    question: 'How do I add my prices to Google?',
    answer:
      'Press Copy as text, then edit your Google Business Profile and add each service with its price in the services section. Use the same prices as on the wall and your booking page.',
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
    question: 'Is anything I type saved?',
    answer:
      'No. The tool stores nothing, so closing the tab clears it. Print, save a PDF, download the image or copy the text before you leave.',
  },
  {
    question: 'How do I work out what to charge?',
    answer:
      'Start from what each chair hour has to earn to cover rent, wages and costs, then check local prices. When you add times, the tool shows what each service earns per hour in the chair. The free KERSIVO barber price calculator works out what to charge for each service from your own costs and hours.',
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
  {
    href: '/chair-rent-vs-commission-calculator',
    label: 'Chair rent vs commission',
    description: 'Compare what one chair leaves the shop under rent or commission.',
  },
];

/** One-line summary for llms.txt. */
export const PRICE_LIST_LLMS_SUMMARY = `free barber price list template: add services, prices and times, choose one of ${PRICE_LIST_THEMES.length} styles, then print on A4, save a PDF, download a ${IMAGE_SIZE} Instagram image or copy as text for Google, with nothing stored`;

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${PRICE_LIST_PAGE_PATH}`;
}

export function buildPriceListJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  const organization = { '@id': getKersivoOrganizationId(siteUrl) };
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
      publisher: organization,
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#tool` },
      hasPart: [{ '@id': `${url}#howto` }, { '@id': `${url}#faq` }],
      about: { '@type': 'Thing', name: 'Barbershop price list' },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: 'Independent barbershop owners',
        geographicArea: { '@type': 'Country', name: 'United Kingdom' },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#tool`,
      name: 'KERSIVO barber price list template',
      url,
      description:
        'Free browser-based tool that lays out a UK barbershop price list to print on A4, save as a PDF, download as an Instagram image or copy as text for Google.',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      featureList: [
        `Up to ${PRICE_LIST_MAX_ITEMS} services with prices, “from” prices and times`,
        `${PRICE_LIST_THEMES.length} styles: ${PRICE_LIST_THEMES.map((theme) => theme.label).join(', ')}`,
        'Print on A4 or save as PDF',
        `Download a ${IMAGE_SIZE} PNG for Instagram`,
        'Copy as plain text for a Google Business Profile or booking page',
        'Shows what each service earns per hour in the chair',
        'Runs in the browser; nothing is sent or stored',
      ],
      provider: organization,
      inLanguage: 'en-GB',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      '@id': `${url}#howto`,
      name: 'How to make a barbershop price list',
      description: PRICE_LIST_DIRECT_ANSWER,
      inLanguage: 'en-GB',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'GBP', value: '0' },
      tool: { '@type': 'HowToTool', name: 'KERSIVO barber price list template' },
      step: PRICE_LIST_STEPS.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        url: `${url}#step-${step.id}`,
      })),
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
