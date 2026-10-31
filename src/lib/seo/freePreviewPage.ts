import { FREE_PREVIEW_STEPS, type SetupStep, type SetupStepOwner } from '@/content/setupSteps';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FREE_PREVIEW_PAGE_PATH,
  PREVIEW_EXPIRY_DAYS,
  PREVIEW_TURNAROUND_TEXT,
  PREVIEW_TURNAROUND_TEXT_CAPITALISED,
  PREVIEW_TURNAROUND_TEXT_SHORT,
} from '@/lib/freePreview/config';
import { FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM } from '@/lib/pricing/claimsPolicy';
import { buildBreadcrumbListJsonLd, type BreadcrumbTrailItem } from '@/lib/seo/breadcrumbs';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export type FreePreviewStepOwner = SetupStepOwner;
export type FreePreviewStep = SetupStep;
export { FREE_PREVIEW_STEPS };

/** Content date of the /free-preview copy (sitemap lastmod via pageDates.ts). */
export const FREE_PREVIEW_PAGE_LAST_UPDATED_ISO = '2026-10-29';

export const FREE_PREVIEW_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  { name: 'Free website preview', path: FREE_PREVIEW_PAGE_PATH },
];

export type FreePreviewFaqItem = { question: string; answer: string };

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
  h1Lines: ['See your website', 'before you pay.'],
  eyebrow: 'Free website preview',
  intro: `Send us a few details about your shop. We'll design a private preview of your website and booking page individually for you — your name, services, barbers, photos and style. Like it? Launch it for £${SAAS_MONTHLY_GBP}/month. Not for you? You owe nothing.`,
  trustLine: ['No card', 'No sales call', 'Private link, hidden from search engines'],
  showcaseEyebrow: "What you'll see",
  showcaseHeading: 'A private preview built around your shop',
  showcasePins: ['Your name, logo and colours', 'Your services and prices', 'Your barbers and booking'],
  visualCaption:
    'Example: CUTSTATE Barbers, a fictional demo shop. Your preview is designed for your shop.',
  formEyebrow: 'Request your free preview',
  formReadyLine: `Usually ready ${PREVIEW_TURNAROUND_TEXT_SHORT}.`,
  whatYouGetHeading: "What you'll get",
  whatYouGet: [
    'A website designed for your shop, not a theme picked from a gallery',
    'Your services, prices and barbers on a booking page you can click through',
    'A private link to review on your phone',
    'One round of changes before you decide',
  ],
  timelineHeading: 'What happens next',
  steps: FREE_PREVIEW_STEPS,
  formHeading: 'Tell us about your shop',
  shopNamePlaceholder: 'e.g. Northside Barbers',
  townCityPlaceholder: 'e.g. Leeds',
  emailLabel: 'Email for your preview link',
  emailPlaceholder: 'you@yourshop.co.uk',
  emailHint: "We'll send your private preview here.",
  submitLabel: 'Get my free preview',
  submitNoteLead: 'No card. No sales call.',
  privacyLabel: 'Privacy Policy',
  noLinkNotice: 'No link added yet. A Booksy, Fresha or Instagram link helps us use your real services, prices and photos.',
  noLinkAddLabel: 'Add a link',
  noLinkSendLabel: 'Send without a link',
  errorShopName: 'Please enter your barbershop name.',
  errorTownCity: 'Please enter your town or city.',
  errorEmail: 'Please enter a valid email address.',
  errorNetwork: "Something went wrong and your request wasn't sent. Your details are still here — please try again.",
  errorRateLimited: 'Too many requests. Please try again a little later.',
  confirmationHeading: "Thanks — we've got your request",
  /** `{email}` is filled in on the client with textContent. */
  confirmationText: `We'll email your private preview to {email}, ${PREVIEW_TURNAROUND_TEXT}. If we need anything else, we'll ask.`,
  detailsHeading: 'Optional: help us get your first draft right',
  detailsBarbersLabel: 'How many barbers work at the shop?',
  detailsBookingLabel: 'What do you use for bookings now?',
  detailsDomainLabel: 'Do you already have a website domain?',
  detailsFirstNameLabel: 'Your first name (optional)',
  detailsNotesLabel: 'Anything we should include? (optional)',
  detailsNotesPlaceholder: 'e.g. your logo, colours or a service we should feature',
  detailsPhotosLine: 'Want to send photos or a logo? Just reply to our confirmation email.',
  detailsSaveLabel: 'Save these details',
  detailsSkipLabel: 'Skip',
  detailsSaved: 'Saved — thank you. Keep an eye on your inbox.',
  detailsExpired: 'This form has expired. Just reply to our confirmation email with any details.',
  /** Shorter chip labels for FREE_PREVIEW_BOOKING_SYSTEMS; the stored values and other labels are unchanged. */
  detailsBookingChipLabels: {
    'other-platform': 'Other platform',
    'mixed-manual': 'Manual or mixed',
    none: 'None',
  },
  faqHeading: 'Questions about the free preview',
  faqs: FREE_PREVIEW_FAQ_ITEMS,
  starterLine: 'Just need online bookings for up to 4 barbers? KERSIVO Starter is £0/month.',
  starterBefore: 'Just need online bookings for up to 4 barbers?',
  starterLink: 'KERSIVO Starter is £0/month.',
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
