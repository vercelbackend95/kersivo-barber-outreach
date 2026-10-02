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

export const PRICING_PAGE_TITLE = `KERSIVO Pricing | £${SAAS_MONTHLY_GBP}/Month for UK Barbershops`;

export const PRICING_PAGE_DESCRIPTION = `KERSIVO costs £${SAAS_MONTHLY_GBP} per month per barbershop location, with no setup fee and 0% commission on bookings and retail sales. See what the plan includes.`;

export const PRICING_PAGE_H1 = 'Simple KERSIVO pricing for independent barbershops';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const PRICING_PAGE_LAST_UPDATED_ISO = '2026-10-02';
export const PRICING_PAGE_LAST_UPDATED_LABEL = '2 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

export const PRICING_QUICK_ANSWER = `KERSIVO costs ${PRICE} per month per physical barbershop location. There is no setup fee, and KERSIVO takes 0% commission on bookings and retail sales. Standard Stripe payment-processing fees still apply.`;

export const PRICING_QUICK_FACTS = [
  { label: 'Monthly plan', value: `${PRICE} per location` },
  { label: 'Setup fee', value: 'None' },
  { label: 'KERSIVO commission', value: '0% on bookings and retail' },
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
      `${PRICE} per month per physical barbershop location`,
      'No setup fee',
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
    question: 'Is there a setup fee?',
    answer: `No. KERSIVO does not charge a separate setup fee. The ${PRICE} monthly plan includes standard configuration: your account, platform setup, a standard website tailored to your shop’s brand, migration help, one standard domain, hosting, SSL and platform updates.`,
  },
  {
    question: 'Do I pay more for each barber?',
    answer: `No. KERSIVO is ${PRICE} per month per physical location. Additional barbers and dashboard users at the same location are included, subject to reasonable fair use.`,
  },
  {
    question: 'What does the plan cover if I have more than one shop?',
    answer: `${PLAN_SCOPE_CLAIM} Each additional physical location needs its own plan.`,
  },
  {
    question: 'Are SMS appointment reminders included?',
    answer: `Yes. ${SMS_INCLUDED_WITH_ALLOWANCE_CLAIM} Email appointment confirmations and reminders are included too.`,
  },
  {
    question: 'What fees still apply?',
    answer:
      'KERSIVO takes 0% commission on bookings and retail sales. Standard Stripe payment-processing fees apply when clients pay online, for example booking deposits and retail orders. Payments go to your own Stripe account.',
  },
  {
    question: 'Is VAT added to the price?',
    answer: PRICE_VAT_DISCLAIMER,
  },
  {
    question: 'Is a domain included?',
    answer:
      'Yes. Each location includes one standard domain. If you already own a domain, you keep it and we can help connect it. Premium and aftermarket domains are not part of the standard package.',
  },
  {
    question: 'Will you help me move from my current booking system?',
    answer:
      'Yes. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. What can be moved depends on what your current provider lets you export and how complete that data is.',
  },
  {
    question: 'Can I cancel?',
    answer: `Yes, you can cancel anytime. ${NO_PAUSE_CLAIM}`,
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
