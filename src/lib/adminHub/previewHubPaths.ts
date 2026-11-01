/** Preview-hub routes under /admin. Client-safe. */

export const PREVIEW_HUB_SECTIONS = [
  'overview',
  'changes',
  'website',
  'messages',
  'team',
  'services',
  'products',
] as const;
export type PreviewHubSection = (typeof PREVIEW_HUB_SECTIONS)[number];

export const PREVIEW_HUB_PATHS = {
  overview: '/admin',
  changes: '/admin/changes',
  website: '/admin/website',
  messages: '/admin/messages',
  team: '/admin/team',
  services: '/admin/services',
  products: '/admin/products',
  leave: '/admin/leave-preview',
} as const;

/** Paid SPA `?section=` for a hub real-admin path, so bookmarks work in both worlds. */
export const PREVIEW_HUB_PAID_SECTION: Record<'team' | 'services' | 'products', string> = {
  team: 'bookings_blocks',
  services: 'services',
  products: 'shop_products',
};

export function paidAdminRedirectForHubPath(
  section: 'team' | 'services' | 'products',
  search?: URLSearchParams | string | null,
): string {
  const params = new URLSearchParams();
  params.set('section', PREVIEW_HUB_PAID_SECTION[section]);
  const incoming =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  if (incoming?.get('add') === '1') params.set('add', '1');
  return `/admin?${params.toString()}`;
}

const ALLOWED = new Set<string>(Object.values(PREVIEW_HUB_PATHS));

/** Pages a hub-mode visitor may open. Paid-only /admin/* paths are not in this set. */
export function isPreviewHubAllowedPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ALLOWED.has(path);
}

export function previewHubSectionFromPath(pathname: string): PreviewHubSection {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === PREVIEW_HUB_PATHS.changes) return 'changes';
  if (path === PREVIEW_HUB_PATHS.website) return 'website';
  if (path === PREVIEW_HUB_PATHS.messages) return 'messages';
  if (path === PREVIEW_HUB_PATHS.team) return 'team';
  if (path === PREVIEW_HUB_PATHS.services) return 'services';
  if (path === PREVIEW_HUB_PATHS.products) return 'products';
  return 'overview';
}

/** Old query-string hub URLs → path routes. */
export function previewHubLegacyRedirect(url: URL): string | null {
  const section = url.searchParams.get('section');
  const app = url.searchParams.get('app');
  const view = url.searchParams.get('view');
  const draft = url.searchParams.get('draft');

  if (app === 'services') return PREVIEW_HUB_PATHS.services;
  if (app === 'team') return PREVIEW_HUB_PATHS.team;
  if (section === 'changes') return withSearch(PREVIEW_HUB_PATHS.changes, { view, draft, app });
  if (section === 'website') return withSearch(PREVIEW_HUB_PATHS.website, { view, draft, app });
  if (section === 'messages') {
    return withSearch(PREVIEW_HUB_PATHS.messages, {
      draft: draft === 'message' || draft === 'reopen' ? draft : null,
    });
  }
  return null;
}

function withSearch(
  path: string,
  params: { view?: string | null; draft?: string | null; app?: string | null },
): string {
  const search = new URLSearchParams();
  if (params.view === 'booking') search.set('view', 'booking');
  if (params.draft === 'message' || params.draft === 'reopen') search.set('draft', params.draft);
  if (params.app && params.app !== 'messages') search.set('app', params.app);
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
