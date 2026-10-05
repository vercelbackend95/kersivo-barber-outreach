import type {
  KersivoCapability,
  KersivoProductState,
  SerializedKersivoAccess,
  SerializedKersivoCapabilities,
} from '@/lib/shop/kersivoAccess';
import type { AdminSpaSection } from './sectionUrl';

/**
 * Client-safe Full KERSIVO lock model for the admin dashboard.
 * Product locks are independent from RBAC: a section is first filtered by permissions,
 * then shown locked when the shop's plan lacks the capability.
 */

/** What the user tried to open — passed to the upgrade dialog (analytics hook for later phases). */
export type FullKersivoFeature =
  | 'reports'
  | 'clients'
  | 'retail'
  | 'assistant'
  | 'history'
  | 'manual_bookings'
  | 'branded_site'
  | 'launch';

export const FULL_KERSIVO_FEATURES: readonly FullKersivoFeature[] = [
  'reports',
  'clients',
  'retail',
  'assistant',
  'history',
  'manual_bookings',
  'branded_site',
  'launch',
];

export const FULL_KERSIVO_FEATURE_LABELS: Readonly<Record<FullKersivoFeature, string>> = {
  reports: 'Reports',
  clients: 'Clients',
  retail: 'Retail',
  assistant: 'Assistant',
  history: 'Booking history',
  manual_bookings: 'Manual bookings',
  branded_site: 'Branded website',
  launch: 'Full KERSIVO',
};

export type SectionProductLock = {
  capability: keyof SerializedKersivoCapabilities;
  feature: FullKersivoFeature;
};

export const SECTION_PRODUCT_LOCKS: Readonly<Partial<Record<AdminSpaSection, SectionProductLock>>> = {
  bookings_reports: { capability: 'reports', feature: 'reports' },
  bookings_clients: { capability: 'clients', feature: 'clients' },
  bookings_history_tab: { capability: 'recentBookingHistory', feature: 'history' },
  shop_products: { capability: 'retail', feature: 'retail' },
  shop_orders: { capability: 'retail', feature: 'retail' },
  shop_sales: { capability: 'retail', feature: 'retail' },
  assistant: { capability: 'assistant', feature: 'assistant' },
  site_launch: { capability: 'brandedSite', feature: 'branded_site' },
};

/** Server capability name → upgrade-dialog feature, for page-level redirects. */
export const CAPABILITY_UPGRADE_FEATURE: Readonly<Partial<Record<KersivoCapability, FullKersivoFeature>>> = {
  REPORTS: 'reports',
  CLIENTS: 'clients',
  RECENT_BOOKING_HISTORY: 'history',
  FULL_BOOKING_HISTORY: 'history',
  RETAIL: 'retail',
  ASSISTANT: 'assistant',
  MANUAL_BOOKINGS: 'manual_bookings',
  BRANDED_SITE: 'branded_site',
};

export const ADMIN_UPGRADE_QUERY_PARAM = 'upgrade';

export function parseFullKersivoFeature(raw: string | null | undefined): FullKersivoFeature | null {
  const value = raw?.trim() ?? '';
  return (FULL_KERSIVO_FEATURES as readonly string[]).includes(value) ? (value as FullKersivoFeature) : null;
}

/**
 * Dashboard lock presentation only. SETUP tenants are normally routed through onboarding /
 * Free activation, so the SPA doesn't show them a Full-upgrade dashboard. Server authorization
 * never uses this: APIs deny any missing capability, SETUP included.
 */
export function isPlanLockedState(state: KersivoProductState): boolean {
  return state === 'FREE_BOOKING';
}

/**
 * Plan locks for the dashboard. Only real signed-in Free Booking tenants are locked; public demo,
 * BLACKLINE showcase, guest preview, legacy secret access and SETUP keep their current behaviour.
 * Null = nothing is plan-locked.
 */
export function resolveAdminProductGate(input: {
  demoMode: boolean;
  via: string | null | undefined;
  productAccess: SerializedKersivoAccess | null | undefined;
}): SerializedKersivoAccess | null {
  if (input.demoMode || input.via !== 'session' || !input.productAccess) return null;
  return isPlanLockedState(input.productAccess.state) ? input.productAccess : null;
}

export function isCapabilityLocked(
  gate: SerializedKersivoAccess | null,
  capability: keyof SerializedKersivoCapabilities,
): boolean {
  return Boolean(gate && !gate.capabilities[capability]);
}

/** Feature to show in the upgrade lock when `section` is plan-locked; otherwise null. */
export function lockedFeatureForSection(
  gate: SerializedKersivoAccess | null,
  section: string,
): FullKersivoFeature | null {
  const lock = SECTION_PRODUCT_LOCKS[section as AdminSpaSection];
  if (!lock) return null;
  return isCapabilityLocked(gate, lock.capability) ? lock.feature : null;
}
