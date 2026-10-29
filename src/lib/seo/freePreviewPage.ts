import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FREE_PREVIEW_PAGE_PATH,
  PREVIEW_EXPIRY_DAYS,
  PREVIEW_TURNAROUND_TEXT,
  PREVIEW_TURNAROUND_TEXT_CAPITALISED,
} from '@/lib/freePreview/config';
import { FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM } from '@/lib/pricing/claimsPolicy';
import { buildBreadcrumbListJsonLd, type BreadcrumbTrailItem } from '@/lib/seo/breadcrumbs';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/** Content date of the /free-preview copy (sitemap lastmod via pageDates.ts). */
export const FREE_PREVIEW_PAGE_LAST_UPDATED_ISO = '2026-10-29';

export const FREE_PREVIEW_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  { name: 'Free website preview', path: FREE_PREVIEW_PAGE_PATH },
];

export type FreePreviewStep = { title: string; body: string };
export type FreePreviewFaqItem = { question: string; answer: string };

/** "How it works" (spec §10.1). Also the homepage "Getting started" steps (§10.3). */
export const FREE_PREVIEW_STEPS: readonly FreePreviewStep[] = [
  {
    title: 'Request your free preview',
    body: 'Send your shop name and a link to your current booking page, Instagram, Google listing or website. No card, no call.',
  },
  {
    title: 'We design your website',
    body: `We build a private preview individually for your shop — your services, barbers, photos and style. ${PREVIEW_TURNAROUND_TEXT_CAPITALISED}.`,
  },
  {
    title: 'Review it and ask for changes',
    body: 'Open your private link, try the booking flow and tell us what to change. One round of changes is included before you decide.',
  },
  {
    title: 'Subscribe and launch',
    body: `Happy with it? Subscribe for £${SAAS_MONTHLY_GBP}/month and we'll turn your preview into your live website, connect your domain and go live once you approve. Not for you? You owe nothing.`,
  },
];

/** Visible FAQ and its FAQPage JSON-LD (one source, so they always match). */
export const FREE_PREVIEW_FAQ_ITEMS: readonly FreePreviewFaqItem[] = [
  {
    question: 'Is the preview really free?',
    answer: `Yes. There's no card, no call and no obligation. You only pay if you decide to launch, at £${SAAS_MONTHLY_GBP}/month per location.`,
  },
  {
    question: 'Is my website a template?',
    answer: FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM,
  },
  {
    question: 'How long does it take?',
    answer: `${PREVIEW_TURNAROUND_TEXT_CAPITALISED} of receiving your details. If we need anything else, we'll email you.`,
  },
  {
    question: 'Will my preview be public?',
    answer: `No. It's on a private link, hidden from search engines, and it stays available for ${PREVIEW_EXPIRY_DAYS} days.`,
  },
  {
    question: 'What happens if I subscribe?',
    answer:
      'Your preview becomes your live website — nothing is rebuilt. You connect Stripe for online payments, we connect your domain, and your site goes live once you approve it.',
  },
  {
    question: 'Can I keep using Booksy, Fresha or Treatwell in the meantime?',
    answer: "Yes. Keep taking bookings as normal. You only switch your booking links after you've approved your new site.",
  },
  {
    question: 'Which photos do you use?',
    answer:
      'Photos from the links you send us, used only in your private preview and only with your permission. You can also send us your own photos by replying to our confirmation email.',
  },
  {
    question: "What if I don't like it?",
    answer: "Tell us what to change, or simply leave it. If you don't subscribe, your preview expires and we delete it.",
  },
];

/** /free-preview copy (docs/free-preview-spec.md §5, §10.1). */
export const FREE_PREVIEW_PAGE = {
  path: FREE_PREVIEW_PAGE_PATH,
  title: 'Free Website Preview for UK Barbershops | KERSIVO',
  description: `See your barbershop website before you pay. We design a free private preview for your shop — no card, no call. Launch for £${SAAS_MONTHLY_GBP}/month if you like it.`,
  h1: 'See your barbershop website before you pay',
  intro: `Send us a few details about your shop. We'll design a private preview of your website and booking page individually for you — your name, services, barbers, photos and style. Like it? Launch it for £${SAAS_MONTHLY_GBP}/month. Not for you? You owe nothing.`,
  trustLine: ['No card', 'No sales call', 'Private link, hidden from search engines'],
  whatYouGetHeading: "What you'll get",
  whatYouGet: [
    'A website designed for your shop, not a theme picked from a gallery',
    'Your services, prices and barbers on a booking page you can click through',
    'A private link to review on your phone',
    'One round of changes before you decide',
  ],
  howItWorksHeading: 'How it works',
  steps: FREE_PREVIEW_STEPS,
  formHeading: 'Request your free preview',
  submitLabel: 'Request my free preview',
  submitNote: "No card needed. We'll only use your details to create and send your preview.",
  privacyLabel: 'Privacy Policy',
  confirmationHeading: "Thanks — we've got your details",
  /** `{shopName}` and `{email}` are filled in on the client with textContent. */
  confirmationText: `We'll start on the preview for {shopName} and email you at {email}, ${PREVIEW_TURNAROUND_TEXT}. Got photos, a logo or anything you'd like us to include? Just reply to our confirmation email.`,
  demoLinkLabel: 'Explore the KERSIVO demo in the meantime',
  faqHeading: 'Questions about the free preview',
  faqs: FREE_PREVIEW_FAQ_ITEMS,
  starterLine: 'Just need online bookings for up to 4 barbers? KERSIVO Starter is £0/month.',
} as const;

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${FREE_PREVIEW_PAGE_PATH}`;
}

export function buildFreePreviewWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: FREE_PREVIEW_PAGE.title,
    description: FREE_PREVIEW_PAGE.description,
    inLanguage: 'en-GB',
    dateModified: FREE_PREVIEW_PAGE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  };
}

export function buildFreePreviewBreadcrumbJsonLd(): Record<string, unknown> {
  return buildBreadcrumbListJsonLd(FREE_PREVIEW_BREADCRUMBS);
}

/** Built from FREE_PREVIEW_FAQ_ITEMS, the same list the visible FAQ renders, so it matches exactly. */
export function buildFreePreviewFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl(siteUrl)}#faq`,
    mainEntity: FREE_PREVIEW_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
