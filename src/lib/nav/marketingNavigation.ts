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
import {
  HERITAGE_ADMIN_DASHBOARD_HREF,
  HERITAGE_ADMIN_DEMO_PATH,
  HERITAGE_DEMO_BOOK_HREF,
  HERITAGE_DEMO_SERVICES_HREF,
  HERITAGE_DEMO_SHOP_HREF,
  KERSIVO_LIVE_DEMO_HREF,
} from '@/lib/demo/heritage/links';

export type MarketingNavGroupId = 'product' | 'compare' | 'tools' | 'resources';

export type MarketingNavItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  group: MarketingNavGroupId;
  /** Section id within the group (see MarketingNavGroup.sections). */
  section: string;
  icon: MarketingNavIcon;
  /** Short name for compact layouts, e.g. "Booksy" for the Booksy comparison. */
  shortLabel?: string;
  /** Extra words the navigation finder matches on (never rendered). */
  keywords?: readonly string[];
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
  /** Mobile tab label when the full label is too long for a four-tab bar. */
  tabLabel?: string;
  eyebrow: string;
  heading: string;
  description?: string;
  featuredAction?: { label: string; href: string };
  /** Path prefixes that mark the group trigger current even when no child link matches. */
  currentPrefixes?: readonly string[];
  /** Mobile hub opens on this group's tab unless the current page belongs to another group. */
  defaultOpen?: boolean;
  /** 'compact' lists items by short name in a dense grid (used for the long list of comparisons). */
  layout?: 'compact';
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
    description: 'Fees, features and own-brand booking, side by side for UK barbershops.',
    featuredAction: { label: 'Estimate your costs', href: '/barber-software-cost-calculator' },
    layout: 'compact',
    sections: [{ id: 'alternatives', label: 'KERSIVO vs' }],
  },
  {
    id: 'tools',
    label: 'Free tools',
    tabLabel: 'Tools',
    eyebrow: 'FREE TOOLS',
    heading: 'Run the numbers on your shop.',
    description: 'Free calculators and templates for UK barbershops.',
    sections: [
      { id: 'calculators', label: 'Calculators' },
      { id: 'templates', label: 'Templates' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    eyebrow: 'RESOURCES',
    heading: 'Guides and answers for your barbershop.',
    sections: [
      { id: 'guides', label: 'Guides' },
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
    href: HERITAGE_ADMIN_DASHBOARD_HREF,
    group: 'product',
    section: 'included',
    icon: 'admin',
    matchPrefix: HERITAGE_ADMIN_DEMO_PATH,
  },
  {
    id: 'platform-retail',
    label: 'Retail pickup',
    description: 'Sell products for collection in your shop.',
    href: HERITAGE_DEMO_SHOP_HREF,
    group: 'product',
    section: 'included',
    icon: 'retail',
      },
  {
    id: 'product-starter',
    label: 'KERSIVO Starter',
    description: '£0/month online bookings for up to 4 barbers.',
    href: '/starter',
    group: 'product',
    section: 'included',
    icon: 'pricing',
    keywords: ['free', '£0'],
    emphasis: 'quiet',
  },
  {
    id: 'product-demo',
    label: 'Live demo overview',
    description: 'Website, booking and shop in the live demo.',
    href: KERSIVO_LIVE_DEMO_HREF,
    group: 'product',
    section: 'demo',
    icon: 'system',
  },
  {
    id: 'platform-booking',
    label: 'Client booking experience',
    description: 'Try the booking journey from the client side.',
    href: HERITAGE_DEMO_BOOK_HREF,
    match: HERITAGE_DEMO_SERVICES_HREF,
    group: 'product',
    section: 'demo',
    icon: 'booking',
      },
  {
    id: 'compare-booksy',
    label: 'Booksy Alternative',
    description: 'Compare Booksy and KERSIVO for an independent UK barbershop.',
    href: '/booksy-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Booksy',
  },
  {
    id: 'compare-fresha',
    label: 'Fresha Alternative',
    description: 'Compare Fresha pricing, marketplace fees and KERSIVO.',
    href: '/fresha-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Fresha',
  },
  {
    id: 'compare-vagaro',
    label: 'Vagaro Alternative',
    description: 'Compare Vagaro UK fees, calendars and independent branded booking.',
    href: '/vagaro-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Vagaro',
  },
  {
    id: 'compare-treatwell',
    label: 'Treatwell Alternative',
    description: 'Treatwell UK commission, Treatwell Connect pricing and direct bookings compared.',
    href: '/treatwell-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Treatwell',
  },
  {
    id: 'compare-timely',
    label: 'Timely Alternative',
    description: 'Compare Timely costs, online booking and KERSIVO for UK barbershops.',
    href: '/timely-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Timely',
  },
  {
    id: 'compare-nearcut',
    label: 'Nearcut Alternative',
    description: 'Compare Nearcut pricing, booking charges and KERSIVO for UK barbershops.',
    href: '/nearcut-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Nearcut',
  },
  {
    id: 'compare-phorest',
    label: 'Phorest Alternative',
    description: 'Compare Phorest UK salon pricing, bookings and KERSIVO for barbershops.',
    href: '/phorest-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Phorest',
  },
  {
    id: 'compare-square',
    label: 'Square Appointments Alternative',
    description: 'Compare Square Appointments UK pricing, card fees, bookings and websites.',
    href: '/square-appointments-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Square',
  },
  {
    id: 'compare-squire',
    label: 'SQUIRE Alternative',
    description: 'Compare SQUIRE UK prices, POS, deposits and own-brand bookings with KERSIVO.',
    href: '/squire-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'SQUIRE',
  },
  {
    id: 'compare-setora',
    label: 'Setora Alternative',
    description: 'Compare Setora UK pricing, websites and booking features with KERSIVO.',
    href: '/setora-alternative',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    shortLabel: 'Setora',
  },
  {
    id: 'compare-cost-calculator',
    label: 'Barber software cost calculator',
    description: 'Estimate Booksy, Fresha, Nearcut and KERSIVO costs using your shop numbers.',
    href: '/barber-software-cost-calculator',
    group: 'tools',
    section: 'calculators',
    icon: 'calculator',
    keywords: ['price', 'fees', 'commission', 'savings'],
    featured: true,
  },
  {
    id: 'compare-hub',
    label: 'Compare all booking systems',
    description: 'KERSIVO, Booksy, Fresha, Nearcut and more side by side for UK barbershops.',
    href: '/compare',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    keywords: ['alternatives', 'versus', 'switch'],
    featured: true,
  },
  {
    id: 'compare-booksy-vs-fresha',
    label: 'Booksy vs Fresha',
    description: 'The two biggest platforms compared for a UK barbershop, by team size.',
    href: '/booksy-vs-fresha',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    keywords: ['booksy or fresha', 'which is better', 'commission'],
    shortLabel: 'Booksy vs Fresha',
  },
  {
    id: 'compare-kersivo-vs-booksy',
    label: 'KERSIVO vs Booksy',
    description: 'An interactive walk through your own branded site against a marketplace profile.',
    href: '/kersivo-vs-booksy',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    keywords: ['kersivo or booksy', 'own website', 'marketplace'],
    shortLabel: 'KERSIVO vs Booksy',
  },
  {
    id: 'compare-fees-report',
    label: 'Booking software fees report',
    description: 'Monthly cost, new-client fees and card fees for 10 UK systems, with dates.',
    href: '/barber-booking-fees-uk',
    group: 'compare',
    section: 'alternatives',
    icon: 'compare',
    keywords: ['fees', 'prices', 'report', 'cost'],
    shortLabel: 'Fees report',
  },
  {
    id: 'resources-website-design',
    label: 'Barbershop website design',
    description: 'Practical tips for barbershop branding, photography and mobile website design.',
    href: BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH,
    group: 'resources',
    section: 'guides',
    icon: 'guide',
    visible: BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  },
  {
    id: 'resources-online-booking',
    label: 'Online booking for barbershops',
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
    keywords: ['blog', 'articles', 'news'],
    matchPrefix: '/insights',
  },
  {
    id: 'resources-no-show-calculator',
    label: 'No-show cost calculator',
    description: 'See what missed appointments cost and whether a deposit pays.',
    href: '/barbershop-no-show-calculator',
    group: 'tools',
    section: 'calculators',
    icon: 'calculator',
    keywords: ['deposit', 'missed appointments', 'cancellations'],
  },
  {
    id: 'resources-chair-rent-calculator',
    label: 'Chair rent vs commission',
    description: 'Compare employing a barber with renting out a chair.',
    href: '/chair-rent-vs-commission-calculator',
    group: 'tools',
    section: 'calculators',
    icon: 'calculator',
    keywords: ['self-employed', 'staff', 'wages'],
  },
  {
    id: 'resources-cancellation-policy',
    label: 'Cancellation policy template',
    description: 'Create a free deposit and no-show policy for your shop.',
    href: '/barbershop-cancellation-policy-template',
    group: 'tools',
    section: 'templates',
    icon: 'policy',
    keywords: ['deposit', 'no-show', 'late'],
  },
  {
    id: 'resources-price-list',
    label: 'Price list template',
    description: 'Lay out your prices to print for the wall or copy for Instagram.',
    href: '/barbershop-price-list-template',
    group: 'tools',
    section: 'templates',
    icon: 'policy',
    keywords: ['prices', 'menu', 'tariff', 'print'],
  },
  {
    id: 'resources-faq',
    label: 'Frequently asked questions',
    description: 'Answers about pricing, setup, switching, domains and billing.',
    href: '/#faq',
    group: 'resources',
    section: 'help',
    icon: 'faq',
    keywords: ['questions', 'setup', 'billing', 'domain'],
  },
  {
    id: 'resources-about',
    label: 'About KERSIVO',
    description: 'Who KERSIVO is for and how it works.',
    href: '/about',
    group: 'resources',
    section: 'help',
    icon: 'info',
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

export type MarketingNavQuickLink = { id: string; label: string; meta: string; href: string; icon: MarketingNavIcon };

/** The four shortcuts at the top of the mobile hub: the pages owners ask for first. */
export function buildMarketingNavQuickLinks(
  groups: readonly ResolvedMarketingNavGroup[] = buildMarketingNavigation(),
): MarketingNavQuickLink[] {
  const compare = groups.find((group) => group.id === 'compare');
  const alternatives = compare ? compare.sections.flatMap((section) => section.items).length : 0;
  return [
    { id: 'quick-pricing', label: 'Pricing', meta: 'Plans and Starter', href: '/pricing', icon: 'pricing' },
    { id: 'quick-demo', label: 'Live demo', meta: 'Try it as a client', href: KERSIVO_LIVE_DEMO_HREF, icon: 'system' },
    {
      id: 'quick-compare',
      label: 'Compare',
      meta: alternatives ? `${alternatives} alternatives` : 'Side by side',
      href: '/compare',
      icon: 'compare',
    },
    {
      id: 'quick-cost',
      label: 'Cost calculator',
      meta: 'Your shop numbers',
      href: '/barber-software-cost-calculator',
      icon: 'calculator',
    },
  ];
}

export type MarketingNavFinderEntry = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: MarketingNavIcon;
  /** Group label shown beside the result. */
  context: string;
  /** Lower-case text the finder matches against. */
  terms: string;
  /** Lower-case name; results whose name matches rank first. */
  title: string;
};

/** Every navigation destination, flattened for the search finder. One entry per href. */
export function buildMarketingNavFinderEntries(
  groups: readonly ResolvedMarketingNavGroup[] = buildMarketingNavigation(),
): MarketingNavFinderEntry[] {
  const entries: MarketingNavFinderEntry[] = [
    {
      id: 'finder-home',
      label: 'Home',
      description: 'Booking software and branded websites for UK barbershops.',
      href: '/',
      icon: 'overview',
      context: 'KERSIVO',
      terms: 'home kersivo homepage',
      title: 'home',
    },
    {
      id: 'finder-pricing',
      label: 'Pricing',
      description: 'Full KERSIVO and KERSIVO Starter.',
      href: '/pricing',
      icon: 'pricing',
      context: 'KERSIVO',
      terms: 'pricing price plans cost monthly full kersivo starter',
      title: 'pricing',
    },
  ];
  for (const group of groups) {
    for (const item of [...group.featured, ...group.sections.flatMap((section) => section.items)]) {
      entries.push({
        id: item.id,
        label: item.label,
        description: item.description,
        href: item.href,
        icon: item.icon,
        context: group.label,
        terms: [item.label, item.shortLabel, item.description, group.label, ...(item.keywords ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        title: [item.label, item.shortLabel].filter(Boolean).join(' ').toLowerCase(),
      });
    }
  }
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.href)) return false;
    seen.add(entry.href);
    return true;
  });
}

export const MARKETING_NAV_SECONDARY_ACTION: MarketingNavAction = { label: 'See live demo', href: KERSIVO_LIVE_DEMO_HREF };

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
