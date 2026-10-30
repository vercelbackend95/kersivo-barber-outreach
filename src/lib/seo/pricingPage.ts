import { offer } from '@/content/offer';
import {
  NO_PAUSE_CLAIM,
  PRICE_VAT_DISCLAIMER,
  SMS_INCLUDED_WITH_ALLOWANCE_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { formatGbp } from '@/lib/seo/freshaFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBreadcrumbListJsonLd, PRICING_BREADCRUMBS } from '@/lib/seo/breadcrumbs';

export const PRICING_PAGE_PATH = '/pricing';

export const PRICING_PAGE_TITLE = `KERSIVO Pricing: Full £${SAAS_MONTHLY_GBP}/Month or Starter £0 | UK Barbers`;

export const PRICING_PAGE_DESCRIPTION = `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location with your website, domain and online booking. No setup fee, no VAT added. Starter is £0/month. Stripe fees apply.`;

export const PRICING_PAGE_H1 = 'KERSIVO pricing for independent barbershops';

export const PRICING_PAGE_LAST_UPDATED_ISO = '2026-10-28';
export const PRICING_PAGE_LAST_UPDATED_LABEL = '28 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

export const PRICING_QUICK_ANSWER = `Full KERSIVO is ${PRICE}/month per physical location, with your branded website, own domain, online booking, payment control, clients, reports and retail pickup. No setup fee and no VAT added. KERSIVO Starter is £0/month for online bookings at one shop with up to 4 barbers; every public Starter booking is paid with a £5 deposit or in full through your connected Stripe account. KERSIVO takes 0% commission on both plans; Stripe processing fees apply to online payments.`;

export const PRICING_QUICK_FACTS = [
  { label: 'Full KERSIVO', value: `${PRICE}/month per location` },
  { label: 'KERSIVO Starter', value: '£0/month' },
  { label: 'KERSIVO commission', value: '0% on both plans' },
] as const;

export type PricingFactGroup = {
  title: string;
  items: readonly string[];
};

export const PRICING_INCLUDED_GROUPS: readonly PricingFactGroup[] = [
  {
    title: `Full KERSIVO — ${PRICE}/month per location`,
    items: [
      'The complete Starter booking operation',
      'Your own branded barbershop website',
      'Your own domain included',
      'Hosting, SSL and platform updates',
      'More than 4 bookable barbers and dashboard users at the same location, subject to reasonable fair use',
      'Editable booking payment controls, including Pay at shop, £5 deposit or full payment',
      'Full booking history',
      'Advanced Clients / CRM',
      'Reports',
      'Retail pickup shop for products paid online and collected in your shop',
      `${SMS_INCLUDED_WITH_ALLOWANCE_CLAIM}`,
      'KERSIVO Assistant — AI guidance on using KERSIVO and running your shop',
      'Migration assistance from your current booking system',
      'Included initial QR Kit for an eligible verified UK location',
    ],
  },
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
      'Included initial QR Kit for an eligible verified UK location',
    ],
  },
  {
    title: 'Both plans',
    items: [
      'No setup fee',
      '0% KERSIVO commission',
      STRIPE_FEES_NOTE,
      'Each plan covers one physical barbershop location',
    ],
  },
] as const;

export const PRICING_FEES_POINTS = [
  'KERSIVO takes 0% commission on booking payments with Starter and Full KERSIVO, and 0% on Full retail sales.',
  'Starter public bookings require a connected Stripe account.',
  'Starter public bookings use a fixed £5-deposit-or-Pay-in-full model. Full KERSIVO unlocks editable payment controls, including Pay at shop.',
  `${offer.fees.vat} The Full KERSIVO price is ${PRICE}.`,
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
    question: 'What does Full KERSIVO add?',
    answer: `Full KERSIVO is ${PRICE}/month per physical location. It adds your branded website and own domain, more than 4 active bookable barbers, editable booking-payment controls including Pay at shop, full booking history, Advanced Clients / CRM, Reports, Retail, SMS reminders within a monthly allowance and the KERSIVO Assistant, an AI helper for guidance on using KERSIVO and running your shop.`,
  },
  {
    question: 'When does billing start?',
    answer:
      'Your first Full KERSIVO payment is taken when you subscribe, then monthly on the same day. Your site is typically ready in a few days once we receive all required information.',
  },
  {
    question: "What if you can't deliver Full KERSIVO?",
    answer: offer.billing.refund,
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
      `KERSIVO takes 0% commission on both Starter and Full. ${STRIPE_FEES_NOTE} Payments are processed through the barbershop’s connected Stripe account.`,
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
  {
    question: 'What is included in KERSIVO Starter?',
    answer:
      'KERSIVO Starter is £0/month and includes a KERSIVO-hosted booking page, up to 4 active bookable barbers, bookings, team, services and availability, manual bookings, rolling 90-day booking history, Clients Core, automated email reminders, guided Google booking-link setup and, for an eligible verified UK location, the included initial QR Kit. Public bookings require a connected Stripe account and use the fixed £5-deposit-or-Pay-in-full payment flow.',
  },
  {
    question: 'How do payments work on KERSIVO Starter?',
    answer:
      `For services above £5, the customer chooses a £5 deposit or Pay in full. A £5 service is paid £5 in full. Public Pay at shop is not available on Starter, although staff-created manual bookings may still be paid at the shop. ${STRIPE_FEES_NOTE}`,
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
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
  };
}

export function buildPricingBreadcrumbJsonLd(): Record<string, unknown> {
  return buildBreadcrumbListJsonLd(PRICING_BREADCRUMBS);
}

const FREE_PREVIEW_PRICING_ANSWERS: Record<string, string> = {
  'When does billing start?':
    "You don't pay anything for your preview. If you decide to launch, your first Full KERSIVO payment is taken when you subscribe, then monthly on the same day. Your site is typically ready in a few days once we receive all required information.",
};

/** FAQ with the free preview answers while FREE_PREVIEW_FLOW_ENABLED is on. */
export function getPricingFaqItems(freePreview = false): PricingFaqItem[] {
  if (!freePreview) return PRICING_FAQ_ITEMS;
  return PRICING_FAQ_ITEMS.map((item) => {
    const answer = FREE_PREVIEW_PRICING_ANSWERS[item.question];
    return answer ? { ...item, answer } : item;
  });
}

export function buildPricingFaqJsonLd(freePreview = false): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${PRICING_PAGE_PATH}#faq`,
    mainEntity: getPricingFaqItems(freePreview).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
