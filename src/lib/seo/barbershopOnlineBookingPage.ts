import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBERSHOP_ONLINE_BOOKING_PAGE_PATH = '/barbershop-online-booking';

export const BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE = 'Barbershop Online Booking: How It Works | KERSIVO';

export const BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION =
  'See how barbershop online booking works — from choosing a barber and available time to payments, confirmations and the shop diary. Explore KERSIVO.';

export const BARBERSHOP_ONLINE_BOOKING_PAGE_H1 = 'See How Online Booking Works for Your Barbershop';

/**
 * The supporting page is only partially built. Keep it out of the index and the
 * marketing sitemap until every section has been approved.
 */
export const BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE = false;

export const BARBERSHOP_ONLINE_BOOKING_DEMO_HREF = '/demo/book';

/**
 * Temporary: the Hero's "Compare your booking options" action belongs on the
 * Section 07 `#booking-options` anchor. Until that section exists it points at
 * the live Starter/Full pricing comparison.
 */
export const BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF = '/pricing';

export function buildBarbershopOnlineBookingJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_ONLINE_BOOKING_PAGE_TITLE,
    description: BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
  };
}
