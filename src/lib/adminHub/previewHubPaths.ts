/** Preview-hub routes under /admin. Client-safe. */

export const PREVIEW_HUB_SECTIONS = ['overview', 'changes', 'website', 'messages'] as const;
export type PreviewHubSection = (typeof PREVIEW_HUB_SECTIONS)[number];

export const PREVIEW_HUB_PATHS = {
  overview: '/admin',
  changes: '/admin/changes',
  website: '/admin/website',
  messages: '/admin/messages',
  leave: '/admin/leave-preview',
} as const;

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
  return 'overview';
}

/** Old query-string hub URLs → path routes. */
export function previewHubLegacyRedirect(url: URL): string | null {
  const section = url.searchParams.get('section');
  const app = url.searchParams.get('app');
  const view = url.searchParams.get('view');
  const draft = url.searchParams.get('draft');

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
