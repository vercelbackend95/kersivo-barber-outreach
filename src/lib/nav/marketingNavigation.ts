/**
 * Single source of truth for the KERSIVO marketing navigation.
 * Desktop mega panels and the mobile navigation hub both render buildMarketingNavigation(), so adding a
 * future comparison, guide or tool page means adding one item here — never editing component markup.
 */

import { NAVBAR_SUBSCRIBE_CTA_LABEL, type Navbar17CtaTrack } from './navbar17Items';
import type { MarketingNavIcon } from './marketingNavIcons';

export type MarketingNavGroupId = 'platform' | 'compare' | 'resources';

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
  sections: readonly MarketingNavSection[];
};

export type MarketingNavDirectLink = {
  id: string;
  label: string;
  href: string;
  /** Homepage section id used for the in-view state on `/`. Omit for links to standalone pages. */
  sectionId?: string;
};

export type MarketingNavAction = { label: string; href: string | null; track?: Navbar17CtaTrack };

export type ResolvedMarketingNavSection = MarketingNavSection & { items: MarketingNavItem[] };

export type ResolvedMarketingNavGroup = Omit<MarketingNavGroup, 'sections'> & {
  featured: MarketingNavItem[];
  sections: ResolvedMarketingNavSection[];
};

export const MARKETING_NAV_GROUPS: readonly MarketingNavGroup[] = [
  {
    id: 'platform',
    label: 'Platform',
    eyebrow: 'KERSIVO PLATFORM',
    heading: 'Your brand. Your bookings. One connected system.',
    description: 'Explore the booking experience your clients see and the system your shop uses behind it.',
    featuredAction: { label: 'See KERSIVO in action', href: '/#live-demo' },
    sections: [{ id: 'explore', label: null }],
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
      { id: 'tools', label: 'Tools' },
      { id: 'guides', label: 'Guides' },
      { id: 'help', label: 'Help' },
    ],
  },
];

export const MARKETING_NAV_ITEMS: readonly MarketingNavItem[] = [
  {
    id: 'platform-overview',
    label: 'KERSIVO Overview',
    description: 'Branded website, bookings, deposits, clients and retail.',
    href: '/',
    group: 'platform',
    section: 'explore',
    icon: 'overview',
  },
  {
    id: 'platform-inside',
    label: 'Inside the System',
    description: 'See the admin, booking flow, retail and reports.',
    href: '/#live-demo',
    group: 'platform',
    section: 'explore',
    icon: 'system',
  },
  {
    id: 'platform-booking',
    label: 'Client Booking Experience',
    description: 'Try the booking journey from the client side.',
    href: '/demo/book',
    group: 'platform',
    section: 'explore',
    icon: 'booking',
  },
  {
    id: 'platform-admin',
    label: 'Admin & Shop System',
    description: 'Explore bookings, clients, reports and shop tools.',
    href: '/demo/admin?section=bookings_dashboard',
    group: 'platform',
    section: 'explore',
    icon: 'admin',
  },
  {
    id: 'platform-retail',
    label: 'Retail Pickup Shop',
    description: 'See how online retail pickup works.',
    href: '/demo/shop',
    group: 'platform',
    section: 'explore',
    icon: 'retail',
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
    id: 'compare-nearcut',
    label: 'Nearcut Alternative',
    description: 'Compare Nearcut pricing, booking charges and KERSIVO for UK barbershops.',
    href: '/nearcut-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
  },
  {
    id: 'compare-treatwell',
    label: 'Treatwell Alternative',
    description: 'Compare Treatwell marketplace commission, payment fees and KERSIVO for UK barbershops.',
    href: '/treatwell-alternative',
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
    id: 'resources-cost-calculator',
    label: 'Barber Software Cost Calculator',
    description: 'Model subscriptions, team fees, marketplace costs, VAT and booking deposits.',
    href: '/barber-software-cost-calculator',
    group: 'resources',
    section: 'tools',
    icon: 'calculator',
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

export const MARKETING_NAV_DIRECT_LINKS: readonly MarketingNavDirectLink[] = [
  { id: 'starter', label: 'Starter', href: '/starter' },
  { id: 'pricing', label: 'Pricing', href: '/pricing' },
  { id: 'faq', label: 'FAQ', href: '/#faq', sectionId: 'faq' },
];

export const MARKETING_NAV_SECONDARY_ACTION: MarketingNavAction = { label: 'See live demo', href: '/demo' };

/** Fallback when middleware has not resolved a session-aware CTA. */
export const MARKETING_NAV_PRIMARY_ACTION: MarketingNavAction = {
  label: NAVBAR_SUBSCRIBE_CTA_LABEL,
  href: '/admin/launch',
  track: 'saas_subscribe_click',
};

/** Internal application surfaces that must never appear in the marketing navigation. */
const PRIVATE_PATH = /^\/(admin(\/|$)|setup(\/|$)|preview(\/|$)|ops(\/|$)|api(\/|$)|checkout(\/|$)|book(\/|$)|shop\/(?!demo\/)[^/]+)/;

export function isPublicMarketingHref(href: string): boolean {
  if (!href.startsWith('/')) return true;
  const pathname = new URL(href, 'https://kersivo.co.uk').pathname;
  return !PRIVATE_PATH.test(pathname);
}

/** Pathname that marks an item as the current page, or null for in-page section links. */
export function marketingNavItemMatch(item: Pick<MarketingNavItem, 'href' | 'match'>): string | null {
  if (item.match) return item.match;
  if (item.href.includes('#') || !item.href.startsWith('/')) return null;
  return new URL(item.href, 'https://kersivo.co.uk').pathname;
}

export function isMarketingNavItemCurrent(item: Pick<MarketingNavItem, 'href' | 'match'>, pathname: string): boolean {
  const match = marketingNavItemMatch(item);
  if (!match) return false;
  const normalize = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);
  return normalize(pathname) === normalize(match);
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
