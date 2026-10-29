/**
 * Visible copy, SEO metadata and JSON-LD for /barbershop-no-show-calculator.
 * FAQ answers here are the single source for both the visible FAQ and FAQPage schema.
 * The method mirrors the Insights article INSIGHTS_NO_SHOW_DEPOSITS.
 */
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { buildBreadcrumbListJsonLd, type BreadcrumbTrailItem } from '@/lib/seo/breadcrumbs';
import { CANCELLATION_POLICY_PAGE_PATH } from '@/lib/seo/cancellationPolicyTemplatePage';
import { INSIGHTS_NO_SHOW_DEPOSITS } from '@/lib/seo/insights';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const NO_SHOW_CALCULATOR_PAGE_PATH = '/barbershop-no-show-calculator';
export const NO_SHOW_CALCULATOR_TITLE = 'Barbershop No-Show Cost Calculator UK (Free Tool)';
export const NO_SHOW_CALCULATOR_DESCRIPTION =
  'Work out what missed appointments really cost your barbershop each year, and whether a deposit would pay for itself. Free UK calculator, no sign-up.';
export const NO_SHOW_CALCULATOR_H1 = 'Barbershop No-Show Cost Calculator';
export const NO_SHOW_CALCULATOR_APP_NAME = 'Barbershop No-Show Cost Calculator';
export const NO_SHOW_CALCULATOR_BREADCRUMB_NAME = 'No-Show Cost Calculator';
/** Drives both the visible breadcrumb and the BreadcrumbList JSON-LD. */
export const NO_SHOW_CALCULATOR_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  { name: NO_SHOW_CALCULATOR_BREADCRUMB_NAME, path: '/barbershop-no-show-calculator' },
];

/** Visible "Last updated", WebPage dateModified and sitemap lastmod. */
export const NO_SHOW_CALCULATOR_LAST_UPDATED_ISO = '2026-10-29';
export const NO_SHOW_CALCULATOR_LAST_UPDATED_LABEL = '29 October 2026';

export const NO_SHOW_CALCULATOR_OG_IMAGE_PATH = '/images/tools/no-show-calculator-og.png';
export const NO_SHOW_CALCULATOR_OG_IMAGE_ALT =
  'KERSIVO graphic with the question: What do no-shows really cost your barbershop?';

export const NO_SHOW_ARTICLE_PATH = INSIGHTS_NO_SHOW_DEPOSITS.path;
/** Article H2 "Is £5 a "small" deposit?" — CRA 2015 and CMA37 net-loss guidance. */
export const NO_SHOW_ARTICLE_LEGAL_ANCHOR = `${INSIGHTS_NO_SHOW_DEPOSITS.path}#is-5-a-small-deposit`;
/** Article H2 on online bookings and the 14-day cancellation right. */
export const NO_SHOW_ARTICLE_CANCELLATION_ANCHOR = `${INSIGHTS_NO_SHOW_DEPOSITS.path}#online-bookings-14-day-cancellation-rights-and-deposits`;

export const NO_SHOW_SECONDARY_CTA = {
  label: 'Create your cancellation policy',
  href: CANCELLATION_POLICY_PAGE_PATH,
} as const;

export const NO_SHOW_HERO = {
  eyebrow: 'Free tool for UK barbershops',
  lead: 'Enter your own numbers to see what missed appointments really cost you each year, and whether a deposit would recover more than it costs.',
  examplesNote: 'Example numbers — replace them with your own.',
} as const;

export const NO_SHOW_RESULTS_DISCLAIMER =
  'Estimates based on the numbers you entered. Fixed costs such as rent and fixed wages are not included because they don’t change when one client doesn’t turn up. Not financial or legal advice.';

export const NO_SHOW_ESTIMATE_HELPER =
  'There is no reliable public data on UK barbershop no-show rates, so these start at 0%. Enter your own estimate.';

export const NO_SHOW_KEPT_WARNING =
  'Keeping a deposit when you lost nothing is harder to justify under CMA guidance.';

export const NO_SHOW_CTA = {
  heading: 'Ready to protect your diary?',
  text: `KERSIVO Starter is £0/month. Public bookings are secured with a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through your own connected Stripe account, with 0% KERSIVO commission. Stripe processing fees apply.`,
  primaryLabel: 'Start KERSIVO Starter',
  primaryHref: '/starter',
  fullLinkLabel: `Need Pay at shop or your own website? See Full KERSIVO — £${SAAS_MONTHLY_GBP}/month per location`,
  fullLinkHref: '/pricing',
} as const;

export const NO_SHOW_HOW_IT_WORKS = [
  'A no-show doesn’t lose you the full price of the cut. You don’t use the products, you don’t pay the card fee, and sometimes a walk-in fills the gap.',
  'So the calculator works out the contribution you lose — the price minus products and card fees — weighted by how likely each slot is to be refilled. Busy slots are refilled more often than quiet ones, which is why it asks how your no-shows split between the two.',
  'For the deposit, it compares a typical week with and without one: deposits kept from no-shows, the extra fixed card fee when a booking is paid in two parts, any fall in no-shows and any bookings the deposit puts off.',
] as const;

export const NO_SHOW_NOT_INCLUDED = [
  'Fixed wages, rent and business rates — you pay them whether or not the client turns up.',
  'Clients who rebook later into a slot that would otherwise have been empty.',
  'The effect on your reputation or on future visits.',
  'Time spent chasing no-shows.',
] as const;

export const NO_SHOW_LAW_PARAGRAPHS = [
  'UK law doesn’t stop you taking a deposit, but it limits when you can keep one. Under the Consumer Rights Act 2015, an unfair term isn’t binding on the client, and the CMA’s unfair terms guidance (CMA37) links fairness to your net loss: keeping a deposit is easier to justify when it reflects what the no-show actually cost you.',
  'Online bookings may also carry a statutory 14-day right to cancel, which a “no refunds” line on the booking page can’t remove. This is general information, not legal advice.',
] as const;

export type NoShowFaqItem = { question: string; answer: string };

export const NO_SHOW_FAQ_ITEMS: readonly NoShowFaqItem[] = [
  {
    question: 'How much does a no-show cost a barbershop?',
    answer:
      'It depends on your price, products, card fees and whether the slot is refilled. You save the products and the card fee, and a walk-in sometimes fills the gap, so the loss is usually less than the full price. Quiet-time no-shows usually cost far more than busy-time ones, because busy slots are more likely to be refilled. Use the calculator above with your own numbers.',
  },
  {
    question: 'Should a barber take deposits?',
    answer:
      'It depends on your numbers. A deposit recovers part of the loss when a client doesn’t turn up and may discourage no-shows, but it adds a step to booking and, when the balance is paid by card, a second fixed card fee on every booking that turns up. The calculator shows the break-even point: how far no-shows would need to fall for a deposit to pay for itself.',
  },
  {
    question: 'How big should a deposit be?',
    answer:
      'Small enough not to put clients off. Under CMA guidance, keeping a deposit is easier to justify when it reflects your net loss from the no-show. The calculator shows your estimated net loss per no-show in busy and quiet slots, so you can compare it with the deposit you have in mind.',
  },
  {
    question: 'Why aren’t wages and rent included?',
    answer:
      'They’re paid whether or not the client turns up, so they aren’t an extra cost of a no-show. The calculator counts only what changes when one client doesn’t arrive: the price, products and card fees.',
  },
  {
    question: 'Is the calculator free? Is my data stored?',
    answer:
      'Yes, it’s free and there’s no sign-up. Everything runs in your browser: nothing you enter is stored or sent anywhere. If you share a link, your numbers travel only in the part of the link after the # sign.',
  },
];

export const NO_SHOW_RELATED_LINKS = [
  { label: 'Cancellation Policy Template', href: CANCELLATION_POLICY_PAGE_PATH, description: 'Create a free deposit and no-show policy to show clients before they book.' },
  { label: 'Barber Software Cost Calculator', href: '/barber-software-cost-calculator', description: 'Compare booking software costs using your shop’s numbers.' },
  { label: 'What a no-show really costs — and when a deposit makes sense', href: NO_SHOW_ARTICLE_PATH, description: 'The full method, worked example and UK rules behind this calculator.' },
  { label: 'KERSIVO Starter', href: '/starter', description: `£0/month booking with a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment on public bookings.` },
] as const;

function pageUrl(): { siteUrl: string; url: string } {
  const siteUrl = getPublicSiteUrl();
  return { siteUrl, url: `${siteUrl}${NO_SHOW_CALCULATOR_PAGE_PATH}` };
}

export function buildNoShowCalculatorJsonLd(): Record<string, unknown>[] {
  const { siteUrl, url } = pageUrl();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: NO_SHOW_CALCULATOR_TITLE,
      description: NO_SHOW_CALCULATOR_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: NO_SHOW_CALCULATOR_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#calculator` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#calculator`,
      name: NO_SHOW_CALCULATOR_APP_NAME,
      url,
      description: NO_SHOW_CALCULATOR_DESCRIPTION,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      inLanguage: 'en-GB',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      provider: { '@id': getKersivoOrganizationId(siteUrl) },
      isPartOf: { '@id': `${url}#webpage` },
    },
    buildBreadcrumbListJsonLd(NO_SHOW_CALCULATOR_BREADCRUMBS, { siteUrl }),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: NO_SHOW_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
