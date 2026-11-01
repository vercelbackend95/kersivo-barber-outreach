/** App ids opened by `?app=` (docs/admin-hub/ADMIN_HUB_SPEC.md §6). Client-safe. */

export const ADMIN_HUB_APP_IDS = [
  'logo',
  'photos',
  'materials',
  'hours',
  'about',
  'colours',
  'messages',
  'activity',
  'setup',
  'business',
  'domain',
  'payments',
  'approve',
] as const;

export type AdminHubAppId = (typeof ADMIN_HUB_APP_IDS)[number];

const APP_ID_SET = new Set<string>(ADMIN_HUB_APP_IDS);

export function parseAdminHubApp(raw: string | null | undefined): AdminHubAppId | null {
  const id = (raw ?? '').trim();
  return APP_ID_SET.has(id) ? (id as AdminHubAppId) : null;
}

export type AdminHubAppMeta = {
  id: AdminHubAppId;
  title: string;
  crumb: string;
  /** Desktop window max-width in px. Messages is the narrow one. */
  maxWidth: 720 | 1120;
  /** Use a sheet at or below this width. Default 1024. */
  sheetBelow?: 640 | 1024;
};

const META: Record<AdminHubAppId, Omit<AdminHubAppMeta, 'id'>> = {
  logo: { title: 'Logo', crumb: 'Overview › Logo', maxWidth: 1120 },
  photos: { title: 'Shop photos', crumb: 'Overview › Shop photos', maxWidth: 1120 },
  materials: {
    title: 'Add to your website',
    crumb: 'Overview › Add to your website',
    maxWidth: 1120,
    sheetBelow: 640,
  },
  hours: { title: 'Opening hours', crumb: 'Overview › Opening hours', maxWidth: 1120 },
  about: { title: 'About your shop', crumb: 'Overview › About your shop', maxWidth: 1120 },
  colours: { title: 'Brand colours', crumb: 'Overview › Brand colours', maxWidth: 1120 },
  messages: { title: 'Messages', crumb: 'We reply here and by email', maxWidth: 720 },
  activity: { title: 'Activity', crumb: 'Overview › Activity', maxWidth: 1120 },
  setup: { title: 'Your shop', crumb: 'Overview › Your shop', maxWidth: 1120 },
  business: { title: 'Business details', crumb: 'Overview › Business details', maxWidth: 1120 },
  domain: { title: 'Domain', crumb: 'Overview › Domain', maxWidth: 1120 },
  payments: { title: 'Payments', crumb: 'Overview › Payments', maxWidth: 1120 },
  approve: { title: 'Approve your website', crumb: 'Overview › Approve your website', maxWidth: 1120 },
};

export function adminHubAppMeta(id: AdminHubAppId): AdminHubAppMeta {
  return { id, ...META[id] };
}

export function resolveAdminHubApp(id: AdminHubAppId): AdminHubAppId {
  return id === 'about' ? 'materials' : id;
}

/** Old ?app=about links open the materials window on the text card. */
export function adminHubAppOpenTarget(id: AdminHubAppId): {
  id: AdminHubAppId;
  item: 'text' | null;
} {
  if (id === 'about') return { id: 'materials', item: 'text' };
  return { id, item: null };
}

export function adminHubAppHref(id: AdminHubAppId): string {
  return `/admin?app=${id}`;
}
