import { HERITAGE_DEMO_BOOK_HREF } from '@/lib/demo/heritage/links';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoSoftwareId } from '@/lib/seo/barberDemoJsonLd';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBreadcrumbListJsonLd, BARBERSHOP_ONLINE_BOOKING_BREADCRUMBS } from '@/lib/seo/breadcrumbs';

export const BARBERSHOP_ONLINE_BOOKING_PAGE_PATH = '/barbershop-online-booking';

/**
 * Search intent: "barbershop online booking" / "online booking for barbers", UK. The brand is not
 * known yet, so the title leads with the keyword, the price and the commission hook (the same
 * pattern as the click-and-collect page) instead of "| KERSIVO". The hook names KERSIVO's commission
 * ("0% KERSIVO Commission"), never a claim of zero fees: Stripe fees apply, and the description says so.
 */
export const BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE = `Barbershop Online Booking UK: £${SAAS_MONTHLY_GBP}/mo, 0% KERSIVO Commission`;

export const BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION =
  `Online booking for UK barbershops at £${SAAS_MONTHLY_GBP}/month per location: real free times, deposits, reminders and your own diary. 0% KERSIVO commission. Stripe fees apply.`;

export const BARBERSHOP_ONLINE_BOOKING_PAGE_H1 = 'Barbershop online booking, explained in one booking.';

/**
 * Content date of the guide (shown on the page and used as WebPage dateModified and sitemap lastmod).
 * Change it only when the guide's content meaningfully changes.
 */
export const BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO = '2026-11-25';

/** Published booking guide, with reciprocal pillar links and canonical WebPage schema. */
export const BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE = true;

export const BARBERSHOP_ONLINE_BOOKING_DEMO_HREF = HERITAGE_DEMO_BOOK_HREF;

/** Hero secondary action when the free preview flow is off: jump to the plan choice on this page. */
export const BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF = '#booking-options';

/** The questions the guide answers, in page order (WebPage `about` topics for search and AI answers). */
export const BARBERSHOP_ONLINE_BOOKING_TOPICS = [
  'Barbershop online booking',
  'Barber appointment scheduling',
  'Booking deposits',
  'Appointment reminders',
  'Barbershop booking software cost',
] as const;

export function buildBarbershopOnlineBookingJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE,
    headline: BARBERSHOP_ONLINE_BOOKING_PAGE_H1,
    description: BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    dateModified: BARBERSHOP_ONLINE_BOOKING_LAST_MODIFIED_ISO,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: [
      { '@id': getKersivoSoftwareId(siteUrl) },
      ...BARBERSHOP_ONLINE_BOOKING_TOPICS.map((name) => ({ '@type': 'Thing', name })),
    ],
    audience: { '@type': 'BusinessAudience', audienceType: 'Independent barbershop owners in the United Kingdom' },
    breadcrumb: buildBreadcrumbListJsonLd(BARBERSHOP_ONLINE_BOOKING_BREADCRUMBS, { siteUrl, withContext: false }),
  };
}
