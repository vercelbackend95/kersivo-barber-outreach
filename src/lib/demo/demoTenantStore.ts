/**
 * Where a branded demo keeps the bookings and orders a visitor makes on its public site, so the
 * matching owner dashboard can show them.
 *
 * - CUTSTATE (`/demo/*`, tenant `blackline`): sessionStorage, the original behaviour.
 * - Heritage Grooming (`/demo/heritage-grooming/*`): localStorage, so a booking made on the static site
 *   still shows when the dashboard is opened in another tab. Rows expire after 24 hours either way.
 *
 * The static Heritage site writes the same keys and row shape from
 * `public/demo/heritage-grooming/js/kersivo.js`; keep the two in step.
 */
import { HERITAGE_DEMO_BASE_PATH } from './heritage/data';

export type BrandedDemoTenant = 'blackline' | 'heritage';

export const HERITAGE_DEMO_BOOKINGS_KEY = 'kersivo.heritage.demo-bookings.v1';
export const HERITAGE_DEMO_ORDERS_KEY = 'kersivo.heritage.demo-orders.v1';
export const HERITAGE_RETAIL_JOURNEY_KEY = 'kersivo.heritage.retail-journey.v1';
export const HERITAGE_DEMO_REFERENCE_PREFIX = 'HG';

export function isHeritageDemoPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return normalized === HERITAGE_DEMO_BASE_PATH || normalized.startsWith(`${HERITAGE_DEMO_BASE_PATH}/`);
}

export function brandedDemoTenantForPathname(pathname: string): BrandedDemoTenant {
  return isHeritageDemoPathname(pathname) ? 'heritage' : 'blackline';
}

/** The branded demo the current page belongs to (CUTSTATE outside the browser). */
export function currentBrandedDemoTenant(): BrandedDemoTenant {
  try {
    const pathname = globalThis.location?.pathname;
    return typeof pathname === 'string' ? brandedDemoTenantForPathname(pathname) : 'blackline';
  } catch {
    return 'blackline';
  }
}

export function demoTenantStorage(tenant: BrandedDemoTenant = currentBrandedDemoTenant()): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    if (tenant === 'heritage') {
      return 'localStorage' in globalThis ? globalThis.localStorage : null;
    }
    return 'sessionStorage' in globalThis ? globalThis.sessionStorage : null;
  } catch {
    return null;
  }
}
