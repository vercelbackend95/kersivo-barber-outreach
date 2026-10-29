import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { FREE_PREVIEW_PAGE_PATH, PREVIEW_TURNAROUND_TEXT } from '@/lib/freePreview/config';

/** /free-preview copy (docs/free-preview-spec.md §5, §10.1). Batch 3 adds the remaining sections and schema. */
export const FREE_PREVIEW_PAGE = {
  path: FREE_PREVIEW_PAGE_PATH,
  title: 'Free Website Preview for UK Barbershops | KERSIVO',
  description: `See your barbershop website before you pay. We design a free private preview for your shop — no card, no call. Launch for £${SAAS_MONTHLY_GBP}/month if you like it.`,
  h1: 'See your barbershop website before you pay',
  intro: `Send us a few details about your shop. We'll design a private preview of your website and booking page individually for you — your name, services, barbers, photos and style. Like it? Launch it for £${SAAS_MONTHLY_GBP}/month. Not for you? You owe nothing.`,
  trustLine: ['No card', 'No sales call', 'Private link, hidden from search engines'],
  formHeading: 'Request your free preview',
  submitLabel: 'Request my free preview',
  submitNote: "No card needed. We'll only use your details to create and send your preview.",
  privacyLabel: 'Privacy Policy',
  confirmationHeading: "Thanks — we've got your details",
  /** `{shopName}` and `{email}` are filled in on the client with textContent. */
  confirmationText: `We'll start on the preview for {shopName} and email you at {email}, ${PREVIEW_TURNAROUND_TEXT}. Got photos, a logo or anything you'd like us to include? Just reply to our confirmation email.`,
  demoLinkLabel: 'Explore the KERSIVO demo in the meantime',
  starterLine: 'Just need online bookings for up to 4 barbers? KERSIVO Starter is £0/month.',
} as const;
