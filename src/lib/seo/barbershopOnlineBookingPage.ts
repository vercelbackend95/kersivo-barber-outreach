import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { BARBERSHOP_WEBSITES_PAGE_PATH } from '@/lib/seo/barbershopWebsitesPage';
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
 * Hero secondary action: jump to Section 07 plan choice on this page.
 */
export const BARBERSHOP_ONLINE_BOOKING_HERO_COMPARE_HREF = '#booking-options';

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
    breadcrumb: {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Barbershop websites', item: `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}` },
        { '@type': 'ListItem', position: 3, name: 'Online booking', item: pageUrl },
      ],
    },
  };
}
