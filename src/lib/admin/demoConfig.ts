/** Public admin preview route — instant access, read-only demo data. */
export const PUBLIC_ADMIN_DEMO_PATH = '/admin-demo' as const;

/** BLACKLINE owner dashboard — same AdminPanel, dedicated tenant fixtures. */
export const BLACKLINE_ADMIN_DEMO_PATH = '/demo/admin' as const;

export const BLACKLINE_ADMIN_API_PREFIX = '/api/demo/admin' as const;

export const DEMO_ACTION_BLOCKED_MESSAGE =
  'This action is disabled in the public demo.';

export const DEMO_PILL_LABEL_FULL = 'DEMO MODE';

export const DEMO_PILL_LABEL_SHORT = 'DEMO';

export const DEMO_PILL_TOOLTIP = 'This preview uses example barbershop data.';

export const DEMO_ADMIN_MODE_HEADER = 'x-admin-demo-mode';

export type PublicAdminDemoTenant = 'generic' | 'blackline';

/** Canonical create-shop entry — existing onboarding wizard, not launch or retail. */
export const CREATE_OWN_BARBERSHOP_HREF = '/admin/onboarding' as const;

export function getPublicAdminDemoCapabilities(tenant: PublicAdminDemoTenant = 'generic') {
  const isBlackline = tenant === 'blackline';
  return {
    isBlackline,
    showLaunchCta: !isBlackline,
    showDuplicateOwnerNotice: false,
    showDemoModePills: !isBlackline,
    conversionAccountMenu: isBlackline,
    createShopHref: CREATE_OWN_BARBERSHOP_HREF,
    previewWebsiteHref: '/demo',
    kersivoHomeHref: '/',
  } as const;
}

export function adminDemoHref(section?: string): string {
  if (!section) return PUBLIC_ADMIN_DEMO_PATH;
  return `${PUBLIC_ADMIN_DEMO_PATH}?section=${section}`;
}

function normalizeDemoPathname(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

export function isPublicAdminDemoPathname(pathname: string): boolean {
  const normalized = normalizeDemoPathname(pathname);
  return (
    normalized === PUBLIC_ADMIN_DEMO_PATH ||
    normalized.startsWith(`${PUBLIC_ADMIN_DEMO_PATH}/`)
  );
}

export function isBlacklineAdminDemoPathname(pathname: string): boolean {
  const normalized = normalizeDemoPathname(pathname);
  return (
    normalized === BLACKLINE_ADMIN_DEMO_PATH ||
    normalized.startsWith(`${BLACKLINE_ADMIN_DEMO_PATH}/`)
  );
}

export function isAnyPublicAdminDemoPathname(pathname: string): boolean {
  return isPublicAdminDemoPathname(pathname) || isBlacklineAdminDemoPathname(pathname);
}

export function blacklineAdminHref(section?: string): string {
  if (!section) return BLACKLINE_ADMIN_DEMO_PATH;
  return `${BLACKLINE_ADMIN_DEMO_PATH}?section=${section}`;
}

/** Marketing-friendly URL section params → canonical AdminSection values. */
export const DEMO_SECTION_ALIASES = {
  timeline: 'bookings_dashboard',
  dashboard: 'bookings_dashboard',
  kpis: 'shop_sales',
  retail: 'shop_products',
  barbers: 'bookings_blocks',
  team: 'bookings_blocks',
  reports: 'bookings_reports',
  bookings_services: 'services',
  ai: 'assistant',
} as const;

export function resolveDemoSectionAlias(section: string | null): string | null {
  if (!section) return null;
  if (section in DEMO_SECTION_ALIASES) {
    return DEMO_SECTION_ALIASES[section as keyof typeof DEMO_SECTION_ALIASES];
  }
  return section;
}

export function isPublicAdminHref(href: string): boolean {
  try {
    const url = new URL(href, 'https://kersivo.local');
    return isPublicAdminDemoPathname(url.pathname);
  } catch {
    return false;
  }
}
