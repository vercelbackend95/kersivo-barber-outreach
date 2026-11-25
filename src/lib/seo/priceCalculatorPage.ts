/**
 * /barber-price-calculator: free browser tool that works out what to charge for each service
 * from the barber's own costs, hours and how busy the chair is, plus a price rise check.
 * Copy, FAQ and JSON-LD live here so tests can assert them. Defaults are example numbers, never UK averages.
 */
import { UK_RATES_TAX_YEAR, VAT } from '@/data/uk-rates-2026-27';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { INSIGHTS_HAIRCUT_PRICING } from '@/lib/seo/insights';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const PRICE_CALCULATOR_PAGE_PATH = '/barber-price-calculator';
export const PRICE_CALCULATOR_LAST_UPDATED_ISO = '2026-11-24';
export const PRICE_CALCULATOR_LAST_UPDATED_LABEL = '24 November 2026';
export const PRICE_CALCULATOR_BREADCRUMB_NAME = 'Barber price calculator';
export const PRICE_CALCULATOR_TITLE = 'Barber Price Calculator: What to Charge for a Haircut';
export const PRICE_CALCULATOR_DESCRIPTION =
  'Work out what to charge for a haircut, fade or beard trim from your rent, costs, hours and how busy you are, then test a price rise. Free, no sign-up.';
export const PRICE_CALCULATOR_H1 = 'Barber price calculator';
export const PRICE_CALCULATOR_EYEBROW = 'Free tool · No sign-up';

const VAT_PERCENT = `${Math.round(VAT.standardRate * 100)}%`;

/** Direct answer under the H1 (40–60 words) for "how much should I charge for a haircut". */
export const PRICE_CALCULATOR_DIRECT_ANSWER =
  'To work out what to charge for a haircut, add up what your chair costs each month and what you want to earn, divide it by the hours you are actually booked, then add products, card fees and any VAT. This free calculator does the sums for every service on your list.';

export const PRICE_CALCULATOR_TRUST_SIGNALS: readonly string[] = [
  'Free, no account or email needed',
  'Works for owners and chair renters',
  'Nothing you type leaves your browser',
];

export const PRICE_CALCULATOR_FORM_COPY = {
  examples: 'Example numbers — replace them with your own.',
  costsLegend: 'Your chair each month',
  rentLabel: 'Rent or chair rent per month',
  rentHelper: 'Weekly chair rent × 52 ÷ 12 gives the monthly figure. If several barbers share the shop, enter this chair’s share.',
  otherLabel: 'Other costs per month',
  otherHelper: 'Utilities, insurance, booking software, accountant, equipment.',
  takeHomeLabel: 'What you want to earn per month, before tax',
  timeLegend: 'Your time',
  hoursLabel: 'Hours you work per week',
  weeksLabel: 'Weeks you work per year',
  weeksHelper: 'Leave out holidays and the weeks the shop is closed.',
  bookedLabel: 'How busy you are: share of hours with a client in the chair',
  bookedHelper: 'Gaps, cleaning and breaks count as not booked. Check last month’s diary if you are unsure.',
  perServiceLegend: 'Per service',
  productsLabel: 'Products and consumables per service',
  cardShareLabel: 'Share of clients paying by card',
  cardFeeLabel: 'Card fee, %',
  cardFixedLabel: 'Card fee per payment',
  vatLabel: `VAT registered? (adds ${VAT_PERCENT} to prices)`,
  servicesLegend: 'Your services',
  servicesHelper: 'Name each service and how long it takes in the chair, including the consultation and clean-down.',
  addService: 'Add a service',
} as const;

export const PRICE_CALCULATOR_RESULTS_COPY = {
  heading: 'What to charge',
  perHourLabel: 'Each booked hour needs to earn',
  bookedHoursLabel: 'Booked hours a month',
  floorHourLabel: 'Costs alone, per booked hour',
  tableCaption: 'Prices per service, rounded up to the next 50p',
  serviceColumn: 'Service',
  timeColumn: 'Time',
  targetColumn: 'Your price',
  floorColumn: 'Covers costs only',
  floorNote: 'Below “covers costs only”, the service loses money. Between the two, it pays the bills but not you.',
  copy: 'Copy prices',
  print: 'Print',
  priceListLink: 'Put these prices on a price list',
} as const;

export const PRICE_CALCULATOR_SENSITIVITY_COPY = {
  heading: 'How busy you are changes the price',
  lead: 'The same costs spread over more booked hours make each service cheaper to deliver. This is the price of your first service at different levels of booking.',
  bookedColumn: 'Booked',
  priceColumn: 'Price',
} as const;

export const PRICE_CALCULATOR_RISE_COPY = {
  heading: 'Test a price rise',
  lead: 'A price rise only loses money if more clients leave than the rise can carry. Enter one service’s current and new price to see how many can go before you are worse off.',
  currentLabel: 'Current price',
  newLabel: 'New price',
  note: 'Uses the products, card fees and VAT you entered above.',
} as const;

/** "How to use it" steps; each one describes what the calculator already does. */
export const PRICE_CALCULATOR_HOW_TO_USE = {
  heading: 'How to use it',
  steps: [
    'Enter what your chair costs each month, what you want to earn and the hours you work, replacing the example numbers.',
    'Set how busy you are and list your services with the time each one takes in the chair.',
    'Read your price for each service, then test a price rise or copy the prices onto your price list.',
  ],
} as const;

export const PRICE_CALCULATOR_METHOD = {
  heading: 'How the calculator works',
  steps: [
    {
      title: 'Money the chair needs',
      body: 'Rent (or this chair’s share of it) plus your other monthly costs. For your price, the calculator adds what you want to earn; for “covers costs only”, it leaves that out.',
    },
    {
      title: 'Booked time',
      body: 'Hours per week × weeks worked per year ÷ 12 gives your working hours a month. Multiplying by the share of hours with a client in the chair gives the booked hours that have to pay for everything.',
    },
    {
      title: 'Price per service',
      body: 'Money needed ÷ booked minutes gives a cost per minute. Multiply by the service time and add products, and you have what you need to keep from one service.',
    },
    {
      title: 'Card fees and VAT',
      body: `Card fees are charged on what the client pays, so the price is grossed up until you still keep what you need after them. If you are VAT registered, ${VAT_PERCENT} VAT (${UK_RATES_TAX_YEAR} standard rate) is added on top. Prices are rounded up to the next 50p.`,
    },
    {
      title: 'Price rise check',
      body: 'What you keep from one service at the current price ÷ what you would keep at the new price shows how much of the old business you need to keep the same money. The rest is how many clients you could lose.',
    },
  ],
  limits:
    'It does not include Income Tax or National Insurance on what you earn, tips, retail sales or how prices compare locally. Check prices at shops near you before you set yours.',
} as const;

export type PriceCalculatorFaqItem = { question: string; answer: string };

export const PRICE_CALCULATOR_FAQ_ITEMS: readonly PriceCalculatorFaqItem[] = [
  {
    question: 'How much should a barber charge for a haircut in the UK?',
    answer:
      'There is no single right price: it depends on your rent, your costs, your hours and how busy you are. Work out the price that covers your costs and pays you, then compare it with shops near you. If local prices are lower, look at your costs and how full your diary is before you cut your price.',
  },
  {
    question: 'What does “how busy you are” mean?',
    answer:
      'The share of your working hours with a client in the chair. Gaps between bookings, cleaning and breaks all count as not booked. Comparing last month’s booked appointments with the hours you were at work gives you a realistic figure.',
  },
  {
    question: 'I rent a chair. Does this work for me?',
    answer:
      'Yes. Enter your chair rent as a monthly figure (weekly rent × 52 ÷ 12) and your own costs, such as products, insurance and booking software. If you own the shop and have several barbers, enter each chair’s share of the rent and costs.',
  },
  {
    question: 'Should my prices include VAT?',
    answer: `If you are VAT registered, the prices you show clients should include VAT, so switch it on and the calculator adds ${VAT_PERCENT}. If you are not registered, leave it off. This is general information, not tax advice.`,
  },
  {
    question: 'How many clients can I lose if I put my prices up?',
    answer:
      'Use the price rise check. It compares what you keep from one service before and after the rise, after card fees, products and VAT. For example, if you keep £18 now and would keep £23, you keep the same money with 18 ÷ 23 of the clients, so you could lose about 21%.',
  },
  {
    question: 'Is the calculator free, and is my data stored?',
    answer:
      'It is free, with no account or email. Everything is worked out in your browser: nothing you type is sent to KERSIVO or stored.',
  },
];

export const PRICE_CALCULATOR_RELATED_LINKS: readonly { href: string; label: string; description: string }[] = [
  {
    href: '/barbershop-price-list-template',
    label: 'Price list template',
    description: 'Put your new prices on a list to print for the wall or copy for Instagram.',
  },
  {
    href: INSIGHTS_HAIRCUT_PRICING.path,
    label: 'How to price a haircut in the UK',
    description: 'The method behind this calculator, with the local market and UK pricing rules.',
  },
  {
    href: '/barbershop-no-show-calculator',
    label: 'No-show cost calculator',
    description: 'See what missed appointments cost and whether a deposit pays.',
  },
];

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${PRICE_CALCULATOR_PAGE_PATH}`;
}

export function buildPriceCalculatorJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: PRICE_CALCULATOR_TITLE,
      description: PRICE_CALCULATOR_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: PRICE_CALCULATOR_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#tool` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#tool`,
      name: 'KERSIVO barber price calculator',
      url,
      description:
        'Free browser-based calculator that works out what a UK barber should charge for each service from rent, costs, working hours and how busy the chair is, with a price rise check.',
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
        { '@type': 'ListItem', position: 2, name: 'Free tools', item: `${siteUrl}/free-tools` },
        { '@type': 'ListItem', position: 3, name: PRICE_CALCULATOR_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: PRICE_CALCULATOR_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
