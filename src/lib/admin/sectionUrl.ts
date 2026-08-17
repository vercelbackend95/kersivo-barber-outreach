import { resolveDemoSectionAlias } from '@/lib/admin/demoConfig';

export const ADMIN_SPA_SECTIONS = [
  'bookings_dashboard',
  'bookings_blocks',
  'bookings_reports',
  'bookings_history',
  'bookings_clients',
  'services',
  'shop_products',
  'shop_orders',
  'shop_sales',
  'assistant',
  'barbershop_settings',
  'site_launch',
] as const;

export type AdminSpaSection = (typeof ADMIN_SPA_SECTIONS)[number];

function isAdminSpaPathname(pathname: string): boolean {
  return pathname === '/admin' || pathname === '/admin-demo';
}

export function resolveAdminSpaSection(raw: string | null | undefined): AdminSpaSection {
  const section = resolveDemoSectionAlias(raw ?? null) ?? raw;
  if (section === 'bookings_blocks') return 'bookings_blocks';
  if (section === 'bookings_reports') return 'bookings_reports';
  if (section === 'bookings_history') return 'bookings_history';
  if (section === 'bookings_clients') return 'bookings_clients';
  if (section === 'services') return 'services';
  if (section === 'shop_orders') return 'shop_orders';
  if (section === 'shop_sales') return 'shop_sales';
  if (section === 'shop_products') return 'shop_products';
  if (section === 'assistant') return 'assistant';
  if (section === 'barbershop_settings') return 'barbershop_settings';
  if (section === 'site_launch') return 'site_launch';
  if (section === 'team') return 'bookings_blocks';
  return 'bookings_dashboard';
}

export function parseAdminSpaHref(href: string): AdminSpaSection | null {
  let next: URL;
  try {
    next = new URL(href, 'https://kersivo.local');
  } catch {
    return null;
  }

  if (!isAdminSpaPathname(next.pathname)) return null;
  return resolveAdminSpaSection(next.searchParams.get('section'));
}

export function isAdminSpaSectionHref(href: string): boolean {
  return parseAdminSpaHref(href) !== null;
}
