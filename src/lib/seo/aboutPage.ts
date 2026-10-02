import type { InsightCardItem } from '@/lib/editorial/insightIcons';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { formatGbp } from '@/lib/seo/freshaFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const ABOUT_PAGE_PATH = '/about';

export const ABOUT_PAGE_TITLE = 'About KERSIVO | Booking Software for UK Barbershops';

export const ABOUT_PAGE_DESCRIPTION =
  'KERSIVO is booking and management software built for independent UK barbershops: a branded website on your own domain with bookings, deposits, clients and retail pickup.';

export const ABOUT_PAGE_H1 = 'About KERSIVO';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const ABOUT_PAGE_LAST_UPDATED_ISO = '2026-10-02';
export const ABOUT_PAGE_LAST_UPDATED_LABEL = '2 October 2026';

const PRICE = formatGbp(SAAS_MONTHLY_GBP);

/** Opening entity definition — must stay the first paragraph under the H1. */
export const ABOUT_ENTITY_DEFINITION =
  'KERSIVO is booking and management software built specifically for independent UK barbershops. It combines a branded barbershop website on the shop’s own domain with online bookings, deposits, client management, team and service management, appointment reminders and retail pickup.';

export const ABOUT_WHAT_IT_IS_LEAD =
  'KERSIVO is one system for the public side and the daily running of a barbershop. Clients find the shop’s own website, choose a service and barber, and book directly. The shop manages bookings, clients, barbers, services, working hours and retail orders from one admin dashboard.';

export const ABOUT_WHAT_IT_IS_DETAIL =
  'It is a subscription platform, not a consumer marketplace or a customer app. Each shop’s website and booking journey carry the shop’s own name, branding and domain.';

export const ABOUT_FACTS: readonly { label: string; value: string }[] = [
  { label: 'Built for', value: 'Independent UK barbershops' },
  { label: 'Plan', value: `${PRICE}/month per location` },
  { label: 'Commission', value: '0% on bookings and retail' },
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
    body: 'Barbershops with several barbers at one location that want one monthly plan, with additional barbers included rather than charged per seat, subject to reasonable fair use.',
    icon: 'seats',
  },
  {
    title: 'Shops launching online booking',
    body: 'Barbershops without a booking system yet that want a professional website, online bookings and deposits set up in one plan.',
    icon: 'stack',
  },
];

export const ABOUT_WHY_TITLE = 'Own your brand. Own your bookings.';

export const ABOUT_WHY_PARAGRAPHS = [
  'Many booking platforms place a barbershop inside a wider marketplace or customer app, where the platform’s brand sits between the shop and its clients.',
  'KERSIVO exists to keep that relationship with the barbershop. The website, the domain, the booking journey and the client relationship stay under the shop’s own name, on one simple monthly plan with 0% KERSIVO commission on bookings and retail sales.',
] as const;

export const ABOUT_INCLUDED_ITEMS = [
  'A branded barbershop website on your own standard domain',
  'Online bookings with optional booking deposits',
  'Client management with booking history and notes',
  'Team, service and working-hours management',
  'Email confirmations and reminders, plus SMS appointment reminders',
  'A retail pickup shop for products paid online and collected in store',
  'Booking reports and product sales reports',
  'Hosting, SSL, platform updates, support and migration assistance',
] as const;

export const ABOUT_MODEL_POINTS: readonly { title: string; body: string }[] = [
  {
    title: 'Your own brand',
    body: 'Your website is tailored to your shop’s name, logo, photos, team and contact details, with a subtle “Powered by KERSIVO” mark.',
  },
  {
    title: 'Your own domain',
    body: 'Each location includes one standard domain. If you already own a domain, you keep ownership of it.',
  },
  {
    title: 'Direct booking',
    body: 'Clients book through your website without downloading an app, and booking deposits are paid into your own Stripe account.',
  },
];

export const ABOUT_PRICING_SUMMARY = `KERSIVO is ${PRICE} per month per physical barbershop location, with no setup fee and 0% KERSIVO commission on bookings and retail sales. Standard Stripe payment-processing fees apply. KERSIVO is not currently VAT registered, so no VAT is added.`;

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
  };
}
