/** App ids opened by `?app=` (docs/admin-hub/ADMIN_HUB_SPEC.md §6). Client-safe. */

export const ADMIN_HUB_APP_IDS = [
  'logo',
  'photos',
  'services',
  'team',
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
};

const META: Record<AdminHubAppId, Omit<AdminHubAppMeta, 'id'>> = {
  logo: { title: 'Logo', crumb: 'Overview › Logo', maxWidth: 1120 },
  photos: { title: 'Shop photos', crumb: 'Overview › Shop photos', maxWidth: 1120 },
  services: { title: 'Services & prices', crumb: 'Overview › Services & prices', maxWidth: 1120 },
  team: { title: 'Team', crumb: 'Overview › Team', maxWidth: 1120 },
  hours: { title: 'Opening hours', crumb: 'Overview › Opening hours', maxWidth: 1120 },
  about: { title: 'About your shop', crumb: 'Overview › About your shop', maxWidth: 1120 },
  colours: { title: 'Logo', crumb: 'Overview › Logo', maxWidth: 1120 },
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

/** Brand colours is Batch 4; until then the colours query opens the logo app. */
export function resolveAdminHubApp(id: AdminHubAppId): Exclude<AdminHubAppId, 'colours'> {
  return id === 'colours' ? 'logo' : id;
}

export function adminHubAppHref(id: AdminHubAppId): string {
  return `/admin?app=${id}`;
}
