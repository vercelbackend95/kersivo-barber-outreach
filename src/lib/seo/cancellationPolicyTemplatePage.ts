import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { INSIGHTS_NO_SHOW_DEPOSITS } from '@/lib/seo/insights';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from '@/lib/seo/barbershopOnlineBookingPage';
import { BARBER_COST_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberCostCalculatorPage';
import { STARTER_PAGE_PATH } from '@/lib/seo/starterPage';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { ONE_LINE_MAX_CHARS, SHORT_VERSION_MAX_CHARS } from '@/lib/cancellationPolicy/policyText';

/**
 * Visible copy, SEO metadata and JSON-LD for /barbershop-cancellation-policy-template.
 * KERSIVO claims here are limited to what the product does: Starter public bookings take a
 * £5 deposit or full payment through the shop's connected Stripe account; Full KERSIVO adds
 * Pay at shop; 0% KERSIVO commission; Stripe fees apply.
 */

export const CANCELLATION_POLICY_PAGE_PATH = '/barbershop-cancellation-policy-template';

export const CANCELLATION_POLICY_TITLE = 'Barbershop Cancellation Policy Template UK (Free Tool)';

export const CANCELLATION_POLICY_DESCRIPTION =
  'Create a clear cancellation, deposit and no-show policy for your barbershop. Free UK template to copy to your website, Instagram or booking page.';

export const CANCELLATION_POLICY_H1 = 'Barbershop Cancellation Policy Template';

export const CANCELLATION_POLICY_BREADCRUMB_NAME = 'Cancellation Policy Template';

export const CANCELLATION_POLICY_APP_NAME = 'Barbershop Cancellation Policy Template';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const CANCELLATION_POLICY_LAST_UPDATED_ISO = '2026-10-29';
export const CANCELLATION_POLICY_LAST_UPDATED_LABEL = '29 October 2026';

export const CANCELLATION_POLICY_OG_IMAGE_PATH = '/images/og/barbershop-cancellation-policy-template.jpg';
export const CANCELLATION_POLICY_OG_IMAGE_ALT = 'Free Cancellation Policy Template for Barbershops — KERSIVO';

export const CANCELLATION_POLICY_LEAD =
  'Choose a few options and get a ready-to-paste cancellation, deposit and no-show policy for your website, Instagram or Google Business Profile and booking confirmations. Free, no sign-up, and nothing you enter is stored.';

export const CANCELLATION_POLICY_EYEBROW = 'Free tool for UK barbershops';

/** Hero check marks: each one restates what the tool already does. */
export const CANCELLATION_POLICY_TRUST_SIGNALS = [
  'Free, no sign-up',
  'Nothing you enter is stored',
  'Updates as you choose',
  'Copy, download or print',
] as const;

/** Hero summary of the three versions; limits come from the generator itself. */
export const CANCELLATION_POLICY_VERSIONS = [
  { letter: 'A', name: 'Website version', use: 'The full policy for your website and booking page.' },
  {
    letter: 'B',
    name: 'Short version',
    use: `Up to ${SHORT_VERSION_MAX_CHARS} characters for Instagram, Google Business Profile or a booking page.`,
  },
  { letter: 'C', name: 'One line', use: `Up to ${ONE_LINE_MAX_CHARS} characters for booking confirmations.` },
] as const;

export const CANCELLATION_POLICY_DISCLAIMER =
  'This template is general information, not legal advice. Your policy should be fair, clear and shown to clients before they book. If you’re unsure, check with a legal adviser.';

/* ----------------------------------- CTA ----------------------------------- */

export const CANCELLATION_POLICY_CTA = {
  heading: 'Got your policy? Now make deposits automatic.',
  body: `KERSIVO Starter is £0/month. Public bookings are secured with a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through your own connected Stripe account, and KERSIVO takes 0% commission. Stripe processing fees apply.`,
  primary: { label: 'Start KERSIVO Starter', href: STARTER_PAGE_PATH },
  secondary: { label: 'See how online booking works', href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH },
  fullLink: {
    lead: 'Want Pay at shop or your own website?',
    label: `See Full KERSIVO — £${SAAS_MONTHLY_GBP}/month per location`,
    href: '/pricing',
  },
} as const;

/* ------------------------------ Guide content ------------------------------ */

export const CANCELLATION_POLICY_WHY = {
  heading: 'Why your barbershop needs a cancellation policy',
  body: 'A clear policy tells clients what happens if they cancel late or don’t turn up, before it happens. It protects your barbers’ time, makes conversations at the chair easier and means you’re not deciding case by case. Most clients are happy to follow a policy they’ve seen in advance; the problems usually start when the rules are unclear.',
} as const;

export const CANCELLATION_POLICY_FAIR = {
  heading: 'How to set a fair policy',
  bullets: [
    'Keep the notice period realistic. 24 hours is a common, easy-to-remember choice; 48 hours suits longer or higher-value appointments.',
    'Keep any deposit small and take it off the service price, so it feels like part of the booking, not a penalty.',
    'Always refund clients in full if you cancel or move their appointment.',
    'Decide in advance how you’ll handle lateness, and apply it the same way for everyone.',
    'Show the policy before clients book — on your booking page, website and confirmation emails.',
  ],
} as const;

export const CANCELLATION_POLICY_DISPLAY = {
  heading: 'Where to display your policy',
  body: 'Clients should see your policy before they book, not after they’ve missed an appointment. Put it everywhere a booking starts or is confirmed:',
} as const;

export const GOOGLE_BUSINESS_PROFILE_GUIDE_PATH = '/insights/google-business-profile-booking-link-barbershop';

export const CANCELLATION_POLICY_DEPOSITS = {
  heading: 'Should a barbershop take deposits?',
  body: 'Deposits reduce the cost of a missed appointment, but they add a step for clients and some may book elsewhere. Many shops start with a small fixed deposit that comes off the service price, and only keep it when a client cancels late or doesn’t turn up.',
  linkLead: 'Work through the numbers to see',
  linkLabel: 'when a deposit makes sense for your shop',
  linkHref: INSIGHTS_NO_SHOW_DEPOSITS.path,
} as const;

/* ----------------------------------- FAQ ----------------------------------- */

export type CancellationPolicyFaqItem = { question: string; answer: string };

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const CANCELLATION_POLICY_FAQ_ITEMS: CancellationPolicyFaqItem[] = [
  {
    question: 'What should a barbershop cancellation policy include?',
    answer:
      'A good policy covers the notice period for free cancellation, what happens to a deposit or payment if a client cancels late or doesn’t turn up, how lateness is handled, how clients should cancel or rebook, and what happens if the shop cancels or moves the appointment.',
  },
  {
    question: 'How much notice should clients give to cancel?',
    answer:
      '24 hours is a common choice and easy for clients to remember. Choose a notice period that works for your diary, show it before clients book and apply it consistently.',
  },
  {
    question: 'Can I keep a deposit if a client doesn’t turn up?',
    answer:
      'Many shops do, provided the policy was clear and shown before the client booked and the deposit is a reasonable amount. This is general information, not legal advice.',
  },
  {
    question: 'Is this template free to use?',
    answer:
      'Yes. The cancellation policy template is free to use with no sign-up. It runs in your browser and nothing you enter is stored.',
  },
  {
    question: 'Can KERSIVO take deposits automatically?',
    answer: `Yes. On KERSIVO Starter (£0/month), every public booking is paid online with a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or in full through your own connected Stripe account. Full KERSIVO (£${SAAS_MONTHLY_GBP}/month per location) adds booking-payment controls, so you can choose Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment. KERSIVO takes 0% commission; Stripe processing fees apply.`,
  },
];

/* ------------------------------ Related links ------------------------------ */

export const CANCELLATION_POLICY_RELATED_LINKS = [
  {
    label: 'Barber Software Cost Calculator',
    href: BARBER_COST_CALCULATOR_PAGE_PATH,
    description: 'Compare booking software costs using your own shop numbers.',
  },
  {
    label: 'Online Booking for Barbershops',
    href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
    description: 'How booking, deposits and the shop diary work together.',
  },
  {
    label: 'KERSIVO Starter',
    href: STARTER_PAGE_PATH,
    description: '£0/month online booking with deposits or full payment at booking.',
  },
] as const;

/* --------------------------------- JSON-LD --------------------------------- */

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${CANCELLATION_POLICY_PAGE_PATH}`;
}

export function buildCancellationPolicyWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: CANCELLATION_POLICY_TITLE,
    description: CANCELLATION_POLICY_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: CANCELLATION_POLICY_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    mainEntity: { '@id': `${url}#tool` },
  };
}

/** Static description of the tool only: no ratings, reviews or install claims. */
export function buildCancellationPolicyWebApplicationJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${url}#tool`,
    name: CANCELLATION_POLICY_APP_NAME,
    url,
    description:
      'Free browser-based generator that writes a cancellation, deposit and no-show policy for a UK barbershop in three lengths: website, social or booking page, and booking confirmation.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    provider: { '@id': getKersivoOrganizationId(siteUrl) },
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${url}#webpage` },
  };
}

export function buildCancellationPolicyBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: CANCELLATION_POLICY_BREADCRUMB_NAME, item: url },
    ],
  };
}

export function buildCancellationPolicyFaqJsonLd(): Record<string, unknown> {
  const url = pageUrl(getPublicSiteUrl());
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: CANCELLATION_POLICY_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildCancellationPolicyJsonLd(): Record<string, unknown>[] {
  return [
    buildCancellationPolicyWebPageJsonLd(),
    buildCancellationPolicyWebApplicationJsonLd(),
    buildCancellationPolicyBreadcrumbJsonLd(),
    buildCancellationPolicyFaqJsonLd(),
  ];
}
