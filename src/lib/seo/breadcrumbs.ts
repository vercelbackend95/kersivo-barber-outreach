import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/**
 * Shared breadcrumb trails for marketing pages. The same trail drives both the visible
 * breadcrumb nav and the BreadcrumbList JSON-LD, so schema always matches visible content.
 * "Home" is implied as position 1; the last item is the current page (its canonical path).
 */
export type BreadcrumbTrailItem = { name: string; path: string };

export const PRICING_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [{ name: 'Pricing', path: '/pricing' }];
export const STARTER_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [{ name: 'KERSIVO Starter', path: '/starter' }];
export const ABOUT_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [{ name: 'About KERSIVO', path: '/about' }];
export const BARBERSHOP_WEBSITES_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  { name: 'Barbershop Websites', path: '/barbershop-websites' },
];
export const BARBERSHOP_ONLINE_BOOKING_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  { name: 'Online Booking for Barbershops', path: '/barbershop-online-booking' },
];
/** Supporting guide of the Websites pillar, so the pillar stays as the middle level. */
export const BARBERSHOP_WEBSITE_DESIGN_BREADCRUMBS: readonly BreadcrumbTrailItem[] = [
  ...BARBERSHOP_WEBSITES_BREADCRUMBS,
  { name: 'Barbershop Website Design', path: '/barbershop-website-design' },
];

export const BREADCRUMB_HOME_LABEL = 'Home';

/**
 * BreadcrumbList node. Pass `withContext: false` when nesting it inside another node
 * (e.g. WebPage.breadcrumb).
 */
export function buildBreadcrumbListJsonLd(
  trail: readonly BreadcrumbTrailItem[],
  options: { siteUrl?: string; withContext?: boolean } = {},
): Record<string, unknown> {
  const siteUrl = options.siteUrl ?? getPublicSiteUrl();
  const current = trail[trail.length - 1];
  const pageUrl = `${siteUrl}${current.path}`;
  return {
    ...(options.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: BREADCRUMB_HOME_LABEL, item: `${siteUrl}/` },
      ...trail.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: crumb.name,
        item: `${siteUrl}${crumb.path}`,
      })),
    ],
  };
}
