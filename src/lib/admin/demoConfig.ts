/** Public admin preview route — instant access, read-only demo data. */
export const PUBLIC_ADMIN_DEMO_PATH = '/admin-demo' as const;

/** Must match server `ADMIN_SECRET` on demo deployments. */
export const DEMO_ADMIN_SECRET = 'supersecret123';

export const DEMO_ACTION_BLOCKED_MESSAGE =
  'This action is disabled in the public demo.';

export const DEMO_BANNER_LABEL = 'Admin Demo';

export const DEMO_BANNER_LEAD =
  'This is a safe preview of the KERSIVO admin dashboard using example barbershop data.';

export const DEMO_ADMIN_MODE_HEADER = 'x-admin-demo-mode';

export function adminDemoHref(section?: string): string {
  if (!section) return PUBLIC_ADMIN_DEMO_PATH;
  return `${PUBLIC_ADMIN_DEMO_PATH}?section=${section}`;
}

export function isPublicAdminDemoPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return (
    normalized === PUBLIC_ADMIN_DEMO_PATH ||
    normalized.startsWith(`${PUBLIC_ADMIN_DEMO_PATH}/`)
  );
}

/** Marketing-friendly URL section params → canonical AdminSection values. */
export const DEMO_SECTION_ALIASES = {
  timeline: 'bookings_dashboard',
  dashboard: 'bookings_dashboard',
  kpis: 'shop_sales',
  retail: 'shop_products',
  barbers: 'bookings_blocks',
  reports: 'bookings_reports',
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
