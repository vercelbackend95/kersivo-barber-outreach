import {
  NO_PAUSE_CLAIM,
  PLAN_SCOPE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_WITH_ALLOWANCE_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { formatGbp } from '@/lib/seo/freshaFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const PRICING_PAGE_PATH = '/pricing';

export const PRICING_PAGE_TITLE = `KERSIVO Pricing | Starter £0 & Full £${SAAS_MONTHLY_GBP}/Month`;

export const PRICING_PAGE_DESCRIPTION = `KERSIVO Starter is £0/month with 0% KERSIVO commission. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location for the branded website, own domain and complete business toolkit.`;

export const PRICING_PAGE_H1 = 'KERSIVO pricing for independent barbershops';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const PRICING_PAGE_LAST_UPDATED_ISO = '2026-10-02';
export const PRICING_PAGE_LAST_UPDATED_LABEL = '2 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

export const PRICING_QUICK_ANSWER = `KERSIVO Starter is £0/month for the core booking operation. Full KERSIVO is ${PRICE}/month per physical barbershop location for the complete branded website, own domain and wider business toolkit. KERSIVO takes 0% commission on both plans. Standard Stripe processing fees apply to online card payments.`;

export const PRICING_QUICK_FACTS = [
  { label: 'Starter', value: '£0/month' },
  { label: 'Full KERSIVO', value: `${PRICE}/month per location` },
  { label: 'KERSIVO commission', value: '0% on both plans' },
] as const;

export type PricingFactGroup = {
  title: string;
  items: readonly string[];
};

/** Everything rendered as "included" on /pricing. Keep in line with the Commercial Offer. */
export const PRICING_INCLUDED_GROUPS: readonly PricingFactGroup[] = [
  {
    title: 'Plan and pricing',
    items: [
      `Full KERSIVO: ${PRICE} per month per physical barbershop location`,
      'KERSIVO Starter: £0/month',
      'No setup fee on either plan',
      'Additional barbers and dashboard users at the same location included, subject to reasonable fair use',
    ],
  },
  {
    title: 'Your brand online',
    items: [
      'Your own branded barbershop website',
      'Your own standard domain included',
      'Hosting, SSL and platform updates',
    ],
  },
  {
    title: 'Running the shop',
    items: [
      'Online bookings',
      'Optional booking deposits',
      'Client management',
      'Team, service and working-hours management',
    ],
  },
  {
    title: 'Clients and retail',
    items: [
      'Email appointment confirmations and reminders',
      SMS_INCLUDED_WITH_ALLOWANCE_CLAIM,
      'Retail pickup shop for products paid online and collected in your shop',
      'Migration assistance from your current booking system',
    ],
  },
] as const;

export const PRICING_FEES_POINTS = [
  'KERSIVO takes 0% commission on bookings and retail sales.',
  'Standard Stripe payment-processing fees apply to online card payments, such as deposits and retail orders.',
  `KERSIVO is not currently VAT registered, so no VAT is added to the ${PRICE} price.`,
  'Billed today, then monthly on the same billing-cycle day. Cancel anytime.',
] as const;

export type PricingFaqItem = {
  question: string;
  answer: string;
};

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const PRICING_FAQ_ITEMS: PricingFaqItem[] = [
  {
    question: 'How much does KERSIVO cost?',
    answer: PRICING_QUICK_ANSWER,
  },
  {
    question: 'What is included in KERSIVO Starter?',
    answer:
      'KERSIVO Starter is £0/month and includes a KERSIVO-hosted booking page, up to 4 active bookable barbers, bookings, services and availability, manual bookings, 90-day booking history, Clients Core, automated email reminders, guided Google booking setup and eligibility to request the included initial QR Kit. Stripe is optional for Pay at shop bookings.',
  },
  {
    question: 'What does Full KERSIVO add?',
    answer: `Full KERSIVO is ${PRICE}/month per physical location. It adds the complete branded website and own domain, more than 4 active bookable barbers, full booking history, Advanced Clients / CRM, Reports, Retail, SMS reminders and the live KERSIVO Assistant.`,
  },
  {
    question: 'Is there a setup fee?',
    answer:
      'No. KERSIVO does not charge a separate setup fee for Starter or Full KERSIVO.',
  },
  {
    question: 'Do I pay more for each barber?',
    answer:
      'Starter supports up to 4 active bookable barbers. Full KERSIVO is priced per physical location rather than per barber, subject to reasonable fair use.',
  },
  {
    question: 'Are SMS appointment reminders included?',
    answer: `SMS reminders are a Full KERSIVO feature. ${SMS_INCLUDED_WITH_ALLOWANCE_CLAIM} Starter includes automated email reminders.`,
  },
  {
    question: 'What fees still apply?',
    answer:
      'KERSIVO takes 0% commission on both Starter and Full. Standard Stripe processing fees apply when clients pay online, for example required booking deposits or full upfront card payments.',
  },
  {
    question: 'Is VAT added to Full KERSIVO?',
    answer: PRICE_VAT_DISCLAIMER,
  },
  {
    question: 'Can I upgrade from Starter to Full later?',
    answer:
      'Yes. Starter is designed as a real operating plan with a direct upgrade path to Full KERSIVO when the shop needs the complete branded website, own domain or wider business tools.',
  },
  {
    question: 'Can I cancel Full KERSIVO?',
    answer: `Yes, you can cancel anytime. ${NO_PAUSE_CLAIM} When Full ends, the owner explicitly chooses whether to continue on Starter or leave KERSIVO.`,
  },
];


export function buildPricingWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${PRICING_PAGE_PATH}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: PRICING_PAGE_TITLE,
    description: PRICING_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: PRICING_PAGE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}

export function buildPricingFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${PRICING_PAGE_PATH}#faq`,
    mainEntity: PRICING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
