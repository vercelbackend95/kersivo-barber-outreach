/**
 * Single source of truth for the KERSIVO marketing navigation.
 * Desktop mega panels and the mobile navigation hub both render buildMarketingNavigation(), so adding a
 * future comparison, guide or tool page means adding one item here — never editing component markup.
 */

import { NAVBAR_SUBSCRIBE_CTA_LABEL, type Navbar17CtaTrack } from './navbar17Items';
import { FREE_PREVIEW_CTA_HREF, FREE_PREVIEW_CTA_TRACK, NAVBAR_FREE_PREVIEW_CTA_LABEL } from '@/lib/freePreview/fullPlanCta';
import type { MarketingNavIcon } from './marketingNavIcons';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE, BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH } from '@/lib/seo/barbershopWebsiteDesignPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE, BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from '@/lib/seo/barbershopOnlineBookingPage';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE, BARBERSHOP_WEBSITES_PAGE_PATH } from '@/lib/seo/barbershopWebsitesPage';

export type MarketingNavGroupId = 'product' | 'compare' | 'resources';

export type MarketingNavItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  group: MarketingNavGroupId;
  /** Section id within the group (see MarketingNavGroup.sections). */
  section: string;
  icon: MarketingNavIcon;
  /** Rendered in the group's featured column instead of a section list. */
  featured?: boolean;
  /** Opens in a new tab (external destinations only). */
  external?: boolean;
  /** Pathname that marks this item as the current page. Defaults to the href pathname when the href has no hash. */
  match?: string;
  /** Marks this item current on the prefix and its descendants, e.g. /insights/slug. */
  matchPrefix?: string;
  /** Secondary items stay in the list but read lighter than the primary offer. */
  emphasis?: 'quiet';
  /** Set false to keep a configured item out of the rendered navigation. */
  visible?: boolean;
};

export type MarketingNavSection = { id: string; label: string | null };

export type MarketingNavGroup = {
  id: MarketingNavGroupId;
  label: string;
  eyebrow: string;
  heading: string;
  description?: string;
  featuredAction?: { label: string; href: string };
  /** Path prefixes that mark the group trigger current even when no child link matches. */
  currentPrefixes?: readonly string[];
  /** Mobile accordion starts expanded. Desktop panels stay closed until opened. */
  defaultOpen?: boolean;
  sections: readonly MarketingNavSection[];
};

export type MarketingNavDirectLink = {
  id: string;
  label: string;
  href: string;
  /** Homepage section id used for the in-view state on `/`. Omit for links to standalone pages. */
  sectionId?: string;
  /** Mark this direct link active on descendant pages, e.g. /insights/slug. */
  matchPrefix?: string;
};

export type MarketingNavAction = { label: string; href: string | null; track?: Navbar17CtaTrack };

export type ResolvedMarketingNavSection = MarketingNavSection & { items: MarketingNavItem[] };

export type ResolvedMarketingNavGroup = Omit<MarketingNavGroup, 'sections'> & {
  featured: MarketingNavItem[];
  sections: ResolvedMarketingNavSection[];
};

export const MARKETING_NAV_GROUPS: readonly MarketingNavGroup[] = [
  {
    id: 'product',
    label: 'Product',
    eyebrow: 'KERSIVO',
    heading: 'Your website, bookings and shop in one system.',
    description: 'A branded website, online bookings and the shop tools behind them.',
    featuredAction: { label: 'See KERSIVO in action', href: '/#live-demo' },
    currentPrefixes: ['/demo'],
    defaultOpen: true,
    sections: [
      { id: 'included', label: 'What you get' },
      { id: 'demo', label: 'See it working' },
    ],
  },
  {
    id: 'compare',
    label: 'Compare',
    eyebrow: 'COMPARE',
    heading: 'Compare your options before you switch.',
    sections: [{ id: 'alternatives', label: 'Alternatives' }],
  },
  {
    id: 'resources',
    label: 'Resources',
    eyebrow: 'RESOURCES',
    heading: 'Tools and answers for your barbershop.',
    sections: [
      { id: 'guides', label: 'Guides' },
      { id: 'tools', label: 'Tools' },
      { id: 'help', label: 'Help' },
    ],
  },
];

export const MARKETING_NAV_ITEMS: readonly MarketingNavItem[] = [
  {
    id: 'product-websites',
    label: 'Barbershop websites',
    description: 'Your branded site on your own domain.',
    href: BARBERSHOP_WEBSITES_PAGE_PATH,
    group: 'product',
    section: 'included',
    icon: 'overview',
    visible: BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  },
  {
    id: 'product-online-booking',
    label: 'Online booking & deposits',
    description: 'Service, barber, time — with Pay at shop, £5 deposit or full payment.',
    href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
    group: 'product',
    section: 'included',
    icon: 'booking',
    visible: BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE,
  },
  {
    id: 'platform-admin',
    label: 'Admin & reports',
    description: 'Bookings, clients, team and performance.',
    href: '/demo/admin?section=bookings_dashboard',
    group: 'product',
    section: 'included',
    icon: 'admin',
    matchPrefix: '/demo/admin',
  },
  {
    id: 'platform-retail',
    label: 'Retail pickup',
    description: 'Sell products for collection in your shop.',
    href: '/demo/shop',
    group: 'product',
    section: 'included',
    icon: 'retail',
    matchPrefix: '/demo/shop',
  },
  {
    id: 'product-starter',
    label: 'KERSIVO Starter',
    description: '£0/month online bookings for up to 4 barbers.',
    href: '/starter',
    group: 'product',
    section: 'included',
    icon: 'pricing',
    emphasis: 'quiet',
  },
  {
    id: 'product-demo',
    label: 'Live demo overview',
    description: 'Website, booking and shop in the live demo.',
    href: '/demo',
    group: 'product',
    section: 'demo',
    icon: 'system',
  },
  {
    id: 'platform-booking',
    label: 'Client booking experience',
    description: 'Try the booking journey from the client side.',
    href: '/demo/book',
    group: 'product',
    section: 'demo',
    icon: 'booking',
    matchPrefix: '/demo/book',
  },
  {
    id: 'product-admin-demo',
    label: 'Admin demo',
    description: 'Explore bookings, clients, reports and shop tools.',
    href: '/demo/admin?section=bookings_dashboard',
    group: 'product',
    section: 'demo',
    icon: 'admin',
    matchPrefix: '/demo/admin',
  },
  {
    id: 'compare-booksy',
    label: 'Booksy Alternative',
    description: 'Compare Booksy and KERSIVO for an independent UK barbershop.',
    href: '/booksy-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-fresha',
    label: 'Fresha Alternative',
    description: 'Compare Fresha pricing, marketplace fees and KERSIVO.',
    href: '/fresha-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-vagaro',
    label: 'Vagaro Alternative',
    description: 'Compare Vagaro UK fees, calendars and independent branded booking.',
    href: '/vagaro-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-treatwell',
    label: 'Treatwell Alternative',
    description: 'Treatwell UK commission, Treatwell Connect pricing and direct bookings compared.',
    href: '/treatwell-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-timely',
    label: 'Timely Alternative',
    description: 'Compare Timely costs, online booking and KERSIVO for UK barbershops.',
    href: '/timely-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-nearcut',
    label: 'Nearcut Alternative',
    description: 'Compare Nearcut pricing, booking charges and KERSIVO for UK barbershops.',
    href: '/nearcut-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-phorest',
    label: 'Phorest Alternative',
    description: 'Compare Phorest UK salon pricing, bookings and KERSIVO for barbershops.',
    href: '/phorest-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-square',
    label: 'Square Appointments Alternative',
    description: 'Compare Square Appointments UK pricing, card fees, bookings and websites.',
    href: '/square-appointments-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-squire',
    label: 'SQUIRE Alternative',
    description: 'Compare SQUIRE UK prices, POS, deposits and own-brand bookings with KERSIVO.',
    href: '/squire-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-setora',
    label: 'Setora Alternative',
    description: 'Compare Setora UK pricing, websites and booking features with KERSIVO.',
    href: '/setora-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-cost-calculator',
    label: 'Barber Software Cost Calculator',
    description: 'Estimate Booksy, Fresha, Nearcut and KERSIVO costs using your shop numbers.',
    href: '/barber-software-cost-calculator',
    group: 'compare',
    section: 'alternatives',
    icon: 'calculator',
    featured: true,
  },
  {
    id: 'compare-hub',
    label: 'Compare All Booking Systems',
    description: 'KERSIVO, Booksy, Fresha, Nearcut and more side by side for UK barbershops.',
    href: '/compare',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    featured: true,
  },
  {
    id: 'resources-website-design',
    label: 'Barbershop Website Design',
    description: 'Practical tips for barbershop branding, photography and mobile website design.',
    href: BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH,
    group: 'resources',
    section: 'guides',
    icon: 'guide',
    visible: BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  },
  {
    id: 'resources-online-booking',
    label: 'Online Booking for Barbershops',
    description: 'Booking steps, availability, deposits and the shop diary explained.',
    href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
    group: 'resources',
    section: 'guides',
    icon: 'guide',
    visible: BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  },
  {
    id: 'resources-insights',
    label: 'Insights',
    description: 'Practical notes on bookings, clients, costs and running a UK barbershop.',
    href: '/insights',
    group: 'resources',
    section: 'guides',
    icon: 'guide',
    matchPrefix: '/insights',
  },
  {
    id: 'resources-no-show-calculator',
    label: 'No-Show Cost Calculator',
    description: 'See what missed appointments cost and whether a deposit pays.',
    href: '/barbershop-no-show-calculator',
    group: 'resources',
    section: 'tools',
    icon: 'calculator',
  },
  {
    id: 'resources-chair-rent-calculator',
    label: 'Chair Rent vs Commission',
    description: 'Compare employing a barber with renting out a chair.',
    href: '/chair-rent-vs-commission-calculator',
    group: 'resources',
    section: 'tools',
    icon: 'calculator',
  },
  {
    id: 'resources-cancellation-policy',
    label: 'Cancellation Policy Template',
    description: 'Create a free deposit and no-show policy for your shop.',
    href: '/barbershop-cancellation-policy-template',
    group: 'resources',
    section: 'tools',
    icon: 'policy',
  },
  {
    id: 'resources-faq',
    label: 'Frequently Asked Questions',
    description: 'Answers about pricing, setup, switching, domains and billing.',
    href: '/#faq',
    group: 'resources',
    section: 'help',
    icon: 'faq',
  },
  {
    id: 'resources-contact',
    label: 'Contact KERSIVO',
    description: 'Ask a question about your barbershop setup.',
    href: '/#contact',
    group: 'resources',
    section: 'help',
    icon: 'contact',
  },
];

/** Pricing is the only top-level link. Websites, booking, Starter and Insights live inside the panels. */
export const MARKETING_NAV_DIRECT_LINKS: readonly MarketingNavDirectLink[] = [
  { id: 'pricing', label: 'Pricing', href: '/pricing' },
];

export const MARKETING_NAV_SECONDARY_ACTION: MarketingNavAction = { label: 'See live demo', href: '/demo' };

/** Fallback when middleware has not resolved a session-aware CTA. */
export const MARKETING_NAV_PRIMARY_ACTION: MarketingNavAction = {
  label: NAVBAR_SUBSCRIBE_CTA_LABEL,
  href: '/admin/launch',
  track: 'saas_subscribe_click',
};

/** Fallback while FREE_PREVIEW_FLOW_ENABLED is on (docs/free-preview-spec.md §10.2). */
export const MARKETING_NAV_FREE_PREVIEW_ACTION: MarketingNavAction = {
  label: NAVBAR_FREE_PREVIEW_CTA_LABEL,
  href: FREE_PREVIEW_CTA_HREF,
  track: FREE_PREVIEW_CTA_TRACK,
};

/** Internal application surfaces that must never appear in the marketing navigation. */
const PRIVATE_PATH = /^\/(admin(\/|$)|setup(\/|$)|preview(\/|$)|ops(\/|$)|api(\/|$)|checkout(\/|$)|book(\/|$)|shop\/(?!demo\/)[^/]+)/;

export function isPublicMarketingHref(href: string): boolean {
  if (!href.startsWith('/')) return true;
  const pathname = new URL(href, 'https://kersivo.co.uk').pathname;
  return !PRIVATE_PATH.test(pathname);
}

function normalizeNavPath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path || '/';
}

/** True when pathname is the prefix itself or a descendant. `/demo` does not match `/demonstration`. */
export function pathMatchesNavPrefix(pathname: string, prefix: string): boolean {
  const path = normalizeNavPath(pathname);
  const base = normalizeNavPath(prefix);
  return path === base || path.startsWith(`${base}/`);
}

export function isMarketingDirectLinkCurrent(
  link: Pick<MarketingNavDirectLink, 'href' | 'matchPrefix' | 'sectionId'>,
  pathname: string,
): boolean {
  if (link.sectionId) return false;
  const path = normalizeNavPath(pathname);
  const hrefPath = normalizeNavPath(link.href.split('#')[0] || '/');
  if (link.matchPrefix) return pathMatchesNavPrefix(path, link.matchPrefix);
  return path === hrefPath;
}

/** Pathname that marks an item as the current page, or null for in-page section links. */
export function marketingNavItemMatch(item: Pick<MarketingNavItem, 'href' | 'match'>): string | null {
  if (item.match) return item.match;
  if (item.href.includes('#') || !item.href.startsWith('/')) return null;
  return new URL(item.href, 'https://kersivo.co.uk').pathname;
}

export function isMarketingNavItemCurrent(
  item: Pick<MarketingNavItem, 'href' | 'match' | 'matchPrefix'>,
  pathname: string,
): boolean {
  if (item.matchPrefix && pathMatchesNavPrefix(pathname, item.matchPrefix)) return true;
  const match = marketingNavItemMatch(item);
  if (!match) return false;
  return normalizeNavPath(pathname) === normalizeNavPath(match);
}

export function isMarketingNavGroupCurrent(
  group: Pick<ResolvedMarketingNavGroup, 'featured' | 'sections' | 'currentPrefixes'>,
  pathname: string,
): boolean {
  const items = [...group.featured, ...group.sections.flatMap((section) => section.items)];
  if (items.some((item) => isMarketingNavItemCurrent(item, pathname))) return true;
  return (group.currentPrefixes ?? []).some((prefix) => pathMatchesNavPrefix(pathname, prefix));
}

/** True when a navbar action would navigate to the page already on screen. Hash links stay available. */
export function isMarketingNavSelfHref(href: string | null, pathname: string): boolean {
  if (!href || href.startsWith('#')) return false;
  const target = new URL(href, 'https://kersivo.co.uk');
  if (target.hash) return false;
  return normalizeNavPath(target.pathname) === normalizeNavPath(pathname);
}

export function buildMarketingNavigation(
  items: readonly MarketingNavItem[] = MARKETING_NAV_ITEMS,
  groups: readonly MarketingNavGroup[] = MARKETING_NAV_GROUPS,
): ResolvedMarketingNavGroup[] {
  const visible = items.filter((item) => item.visible !== false);
  return groups
    .map((group) => {
      const own = visible.filter((item) => item.group === group.id);
      return {
        ...group,
        featured: own.filter((item) => item.featured),
        sections: group.sections
          .map((section) => ({
            ...section,
            items: own.filter((item) => !item.featured && item.section === section.id),
          }))
          .filter((section) => section.items.length > 0),
      };
    })
    .filter((group) => group.featured.length > 0 || group.sections.length > 0);
}

/** One top-level order for the desktop navbar and mobile hub: Product, Compare, Resources, then direct links. */
export type MarketingNavTopLevelEntry =
  | { kind: 'group'; group: ResolvedMarketingNavGroup }
  | { kind: 'link'; link: MarketingNavDirectLink };

export function buildMarketingNavTopLevelEntries(
  groups: readonly ResolvedMarketingNavGroup[] = buildMarketingNavigation(),
  directLinks: readonly MarketingNavDirectLink[] = MARKETING_NAV_DIRECT_LINKS,
): MarketingNavTopLevelEntry[] {
  return [
    ...groups.map((group): MarketingNavTopLevelEntry => ({ kind: 'group', group })),
    ...directLinks.map((link): MarketingNavTopLevelEntry => ({ kind: 'link', link })),
  ];
}
