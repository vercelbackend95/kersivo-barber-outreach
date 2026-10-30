import type { InsightCardItem } from '@/lib/editorial/insightIcons';
import { STRIPE_FEES_NOTE, WEBSITE_UPDATE_SUPPORT_CLAIM } from '@/lib/pricing/claimsPolicy';
import { offer } from '@/content/offer';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { SAAS_EXPORT_RETENTION_DAYS } from '@/lib/setup/saasEntitlement';
import { formatGbp } from '@/lib/seo/freshaFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { ABOUT_BREADCRUMBS, buildBreadcrumbListJsonLd } from '@/lib/seo/breadcrumbs';

export const ABOUT_PAGE_PATH = '/about';

export const ABOUT_PAGE_TITLE = 'About KERSIVO | Booking Software for UK Barbershops';

export const ABOUT_PAGE_DESCRIPTION =
  `Booking software and branded websites for independent UK barbershops. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location; Starter is £0/month. Stripe fees apply.`;

export const ABOUT_PAGE_H1 = 'About KERSIVO';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const ABOUT_PAGE_LAST_UPDATED_ISO = '2026-10-27';
export const ABOUT_PAGE_LAST_UPDATED_LABEL = '27 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

/** Opening entity definition — must stay the first paragraph under the H1. */
export const ABOUT_ENTITY_DEFINITION =
  `KERSIVO is booking and management software built specifically for independent UK barbershops. Full KERSIVO (£${SAAS_MONTHLY_GBP}/month per location) adds a branded website on the shop’s own domain, editable payment controls, SMS reminders within a monthly allowance, reports and retail pickup. KERSIVO Starter (£0/month) gives a shop online bookings paid through its own Stripe account, client, team and service management, and email reminders.`;

export const ABOUT_WHAT_IT_IS_LEAD =
  'KERSIVO is one system for the public side and the daily running of a barbershop. Clients find the shop online, choose a service and barber, and book directly. The shop manages bookings, clients, barbers, services and working hours from one admin dashboard; Full KERSIVO adds retail orders.';

export const ABOUT_WHAT_IT_IS_DETAIL =
  'It is a booking platform, not a consumer marketplace or a customer app. Each shop’s booking journey carries the shop’s own name and branding; on Full KERSIVO the website also runs on the shop’s own domain.';

export const ABOUT_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Built for', value: 'Independent UK barbershops' },
  { label: 'Plans', value: `Full ${PRICE}/month per location · Starter £0/month` },
  { label: 'Commission', value: '0% KERSIVO commission on both plans' },
];

export const ABOUT_AUDIENCE_INTRO =
  'KERSIVO is built for independent barbershops in the UK — from a single chair to a full team at one location.';

export const ABOUT_AUDIENCE: readonly InsightCardItem[] = [
  {
    title: 'Shops with their own following',
    body: 'Barbershops whose clients already find them through Google, Instagram, referrals and walk-ins, and who want those clients to book on the shop’s own website.',
    icon: 'storefront',
  },
  {
    title: 'Shops moving from another platform',
    body: 'Barbershops that want to move off a marketplace-style booking platform and keep the booking journey on their own brand. We help migrate the usable data available from the current system.',
    icon: 'direct',
  },
  {
    title: 'Shops with a growing team',
    body: 'Barbershops with several barbers at one location that want flat pricing: Starter covers up to 4 bookable barbers, and Full KERSIVO includes additional barbers rather than charging per seat, subject to reasonable fair use.',
    icon: 'seats',
  },
  {
    title: 'Shops launching online booking',
    body: 'Barbershops without a booking system yet that want online bookings live quickly on Starter, or a professional website with bookings and deposits on Full KERSIVO.',
    icon: 'stack',
  },
];

export const ABOUT_WHY_TITLE = 'Own your brand. Own your bookings.';

export const ABOUT_WHY_PARAGRAPHS = [
  'Many booking platforms place a barbershop inside a wider marketplace or customer app, where the platform’s brand sits between the shop and its clients.',
  'KERSIVO exists to keep that relationship with the barbershop. The booking journey and the client relationship stay under the shop’s own name — on Full KERSIVO, so do the website and the domain — with 0% KERSIVO commission on both plans.',
] as const;

export const ABOUT_INCLUDED_ITEMS = [
  'Online bookings paid through your own Stripe account (both plans)',
  'Client list with booking history',
  'Team, service and working-hours management',
  'Email confirmations and reminders',
  'Full KERSIVO: a branded barbershop website on your own domain',
  'Full KERSIVO: editable booking payment controls, including Pay at shop',
  'Full KERSIVO: SMS appointment reminders within a monthly allowance, booking and product sales reports',
  'Full KERSIVO: a retail pickup shop for products paid online and collected in store',
  'Hosting, SSL, platform updates and support; Full KERSIVO adds migration assistance',
] as const;

export const ABOUT_MODEL_POINTS: readonly { title: string; body: string }[] = [
  {
    title: 'Your own brand',
    body: 'On Full KERSIVO, your website is tailored to your shop’s name, logo, photos, team and contact details, with a subtle “Powered by KERSIVO” mark.',
  },
  {
    title: 'Your own domain (Full KERSIVO)',
    body: 'Full KERSIVO includes your own domain per location. If you already own a domain, you keep ownership of it.',
  },
  {
    title: 'Direct booking',
    body: 'Clients book through your website without downloading an app, and booking payments are paid into your own Stripe account.',
  },
];

export const ABOUT_PRICING_SUMMARY = `Full KERSIVO is ${PRICE} per month per physical barbershop location and KERSIVO Starter is £0/month, with no setup fee and 0% KERSIVO commission on both plans. ${STRIPE_FEES_NOTE} ${offer.fees.vat}`;

export const ABOUT_SETUP_PARAGRAPH =
  'You subscribe to Full KERSIVO and send us your shop details, branding, photos, services and team. We configure your website, booking flow and payment settings. Your site is typically ready in a few days once we receive all required information — that’s an estimate, not a guaranteed date. You review a private preview, and nothing goes live until you approve it. You can keep taking bookings on your current system until then.';

export const ABOUT_SUPPORT_PARAGRAPH = `Email hello@kersivo.co.uk for questions before or after you subscribe. Full KERSIVO subscribers have a first-response target of one business day. Day-to-day changes such as services, prices, barbers and opening hours are made by you in the dashboard. ${WEBSITE_UPDATE_SUPPORT_CLAIM}`;

export const ABOUT_DATA_PARAGRAPH = `Your business owns its domain, brand, content and client relationship. KERSIVO doesn’t sell your clients’ data. You can cancel anytime; Full KERSIVO stays active until the end of the month you’ve paid for. A free CSV export of client contact details and booking history is available while your service is active and for ${SAAS_EXPORT_RETENTION_DAYS} days after you leave KERSIVO completely, and Full KERSIVO owners can also download it once from the dashboard settings.`;

export function buildAboutPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${ABOUT_PAGE_PATH}`;
  const organizationId = getKersivoOrganizationId(siteUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: ABOUT_PAGE_TITLE,
    description: ABOUT_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: ABOUT_PAGE_LAST_UPDATED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': organizationId },
    about: { '@id': organizationId },
    mainEntity: { '@id': organizationId },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
  };
}

export function buildAboutBreadcrumbJsonLd(): Record<string, unknown> {
  return buildBreadcrumbListJsonLd(ABOUT_BREADCRUMBS);
}
