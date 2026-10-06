import {
  NO_PAUSE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_WITH_ALLOWANCE_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { formatGbp } from '@/lib/seo/freshaFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const PRICING_PAGE_PATH = '/pricing';

export const PRICING_PAGE_TITLE = `KERSIVO Pricing | Starter £0 & Full £${SAAS_MONTHLY_GBP}/Month`;

export const PRICING_PAGE_DESCRIPTION = `KERSIVO pricing: Starter £0/month with £5 deposits or full payment. Full £${SAAS_MONTHLY_GBP}/month per location adds your website, domain and payment control. 0% commission.`;

export const PRICING_PAGE_H1 = 'KERSIVO pricing for independent barbershops';

export const PRICING_PAGE_LAST_UPDATED_ISO = '2026-10-06';
export const PRICING_PAGE_LAST_UPDATED_LABEL = '6 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

export const PRICING_QUICK_ANSWER = `KERSIVO Starter is £0/month for the core booking operation: connect Stripe to launch public bookings, then every customer-created booking is paid with a £5 deposit or in full. Full KERSIVO is ${PRICE}/month per physical location and adds your branded website, own domain and the wider business toolkit, including control over how clients pay. There is no setup fee and KERSIVO takes 0% commission on both plans. Standard Stripe processing fees apply to online card payments.`;

export const PRICING_QUICK_FACTS = [
  { label: 'KERSIVO Starter', value: '£0/month' },
  { label: 'Full KERSIVO', value: `${PRICE}/month per location` },
  { label: 'KERSIVO commission', value: '0% on both plans' },
] as const;

export type PricingFactGroup = {
  title: string;
  items: readonly string[];
};

export const PRICING_INCLUDED_GROUPS: readonly PricingFactGroup[] = [
  {
    title: 'KERSIVO Starter — £0/month',
    items: [
      'KERSIVO-hosted booking page',
      'Up to 4 active bookable barbers at one location',
      'Bookings, team, services and availability',
      'Manual bookings',
      'Rolling 90-day booking history',
      'Clients Core',
      'Automated email confirmations and reminders',
      'Fixed public booking payments: £5 deposit or Pay in full',
      'Connected Stripe account required before public bookings go live',
      'Guided Google Business Profile booking-link setup',
      'Included initial QR Kit for eligible verified UK Starter locations',
    ],
  },
  {
    title: `Full KERSIVO — ${PRICE}/month per location`,
    items: [
      'The complete Starter booking operation',
      'Your own branded barbershop website',
      'Your own standard domain included',
      'Hosting, SSL and platform updates',
      'More than 4 bookable barbers and dashboard users at the same location, subject to reasonable fair use',
      'Editable booking payment controls, including Pay at shop, £5 deposit or full payment',
      'Full booking history',
      'Advanced Clients / CRM',
      'Reports',
      'Retail pickup shop for products paid online and collected in your shop',
      `${SMS_INCLUDED_WITH_ALLOWANCE_CLAIM}`,
      'Live KERSIVO Assistant',
      'Migration assistance from your current booking system',
    ],
  },
  {
    title: 'Both plans',
    items: [
      'No setup fee',
      '0% KERSIVO commission',
      'Standard Stripe payment-processing fees apply to online card payments',
      'Each plan covers one physical barbershop location',
    ],
  },
] as const;

export const PRICING_FEES_POINTS = [
  'KERSIVO takes 0% commission on booking payments with Starter and Full KERSIVO, and 0% on Full retail sales.',
  'Standard Stripe payment-processing fees apply to online card payments. Starter public bookings require a connected Stripe account.',
  'Starter public bookings use a fixed £5-deposit-or-Pay-in-full model. Full KERSIVO unlocks editable payment controls, including Pay at shop.',
  `Full KERSIVO is billed today, then monthly on the same billing-cycle day. Cancel anytime. KERSIVO is not currently VAT registered, so no VAT is added to the ${PRICE} price.`,
] as const;

export type PricingFaqItem = {
  question: string;
  answer: string;
};

export const PRICING_FAQ_ITEMS: PricingFaqItem[] = [
  {
    question: 'How much does KERSIVO cost?',
    answer: PRICING_QUICK_ANSWER,
  },
  {
    question: 'What is included in KERSIVO Starter?',
    answer:
      'KERSIVO Starter is £0/month and includes a KERSIVO-hosted booking page, up to 4 active bookable barbers, bookings, team, services and availability, manual bookings, rolling 90-day booking history, Clients Core, automated email reminders, guided Google booking-link setup and, for eligible verified UK Starter locations, the included initial QR Kit. Public bookings require a connected Stripe account and use the fixed £5-deposit-or-Pay-in-full payment flow.',
  },
  {
    question: 'How do payments work on KERSIVO Starter?',
    answer:
      'For services above £5, the customer chooses a £5 deposit or Pay in full. A £5 service is paid £5 in full. Public Pay at shop is not available on Starter, although staff-created manual bookings may still be paid at the shop. Standard Stripe processing fees apply.',
  },
  {
    question: 'What does Full KERSIVO add?',
    answer: `Full KERSIVO is ${PRICE}/month per physical location. It adds your branded website and own domain, more than 4 active bookable barbers, editable booking-payment controls including Pay at shop, full booking history, Advanced Clients / CRM, Reports, Retail, SMS reminders and the live KERSIVO Assistant.`,
  },
  {
    question: 'Is there a setup fee?',
    answer: 'No. KERSIVO does not charge a setup fee for KERSIVO Starter or Full KERSIVO.',
  },
  {
    question: 'Do I pay more for each barber?',
    answer:
      'No. Starter supports up to 4 active bookable barbers at no monthly cost. Full KERSIVO is priced per physical location rather than per barber, with additional barbers included subject to reasonable fair use.',
  },
  {
    question: 'Are SMS appointment reminders included?',
    answer:
      'SMS reminders are part of Full KERSIVO, subject to the plan’s monthly SMS allowance. KERSIVO Starter includes automated email reminders.',
  },
  {
    question: 'What fees still apply?',
    answer:
      'KERSIVO takes 0% commission on both Starter and Full. Standard Stripe processing fees apply when clients pay online. Payments are processed through the barbershop’s connected Stripe account.',
  },
  {
    question: 'Is VAT added to Full KERSIVO?',
    answer: PRICE_VAT_DISCLAIMER,
  },
  {
    question: 'Can I upgrade from Starter to Full later?',
    answer:
      'Yes. Starter is a real operating plan with a direct upgrade path to Full KERSIVO when the shop wants its own branded website and domain, a larger team, the wider business tools or control over how customers pay.',
  },
  {
    question: 'Can I cancel Full KERSIVO?',
    answer: `Yes, you can cancel anytime. ${NO_PAUSE_CLAIM} When Full ends, the owner explicitly chooses whether to continue on KERSIVO Starter or leave KERSIVO.`,
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
