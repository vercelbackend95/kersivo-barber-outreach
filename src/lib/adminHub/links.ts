import { previewPagePath } from '@/lib/freePreview/config';

/** Hub links rendered by the shared hub components; client-safe (no server imports). */
export type HubLinks = {
  overview: string;
  website: string;
  booking: string;
  changes: string;
  details: string;
  messages: string;
  messagesDraft: (draft: 'message' | 'reopen') => string;
};

export const ADMIN_HUB_PATH = '/admin';
export const ADMIN_HUB_API_BASE = '/api/admin-hub';

export function tokenHubLinks(token: string): HubLinks {
  const base = previewPagePath(token);
  return {
    overview: base,
    website: `${base}/website`,
    booking: `${base}/website?view=booking`,
    changes: `${base}/changes`,
    details: `${base}/details`,
    messages: `${base}/messages`,
    messagesDraft: (draft) => `${base}/messages?draft=${draft}`,
  };
}

export const ADMIN_HUB_LINKS: HubLinks = {
  overview: ADMIN_HUB_PATH,
  website: `${ADMIN_HUB_PATH}?section=website`,
  booking: `${ADMIN_HUB_PATH}?section=website&view=booking`,
  changes: `${ADMIN_HUB_PATH}?section=changes`,
  details: `${ADMIN_HUB_PATH}?app=setup`,
  messages: `${ADMIN_HUB_PATH}?app=messages`,
  messagesDraft: (draft) => `${ADMIN_HUB_PATH}?app=messages&draft=${draft}`,
};

/** Base path of the hub JSON API: the token routes unless the caller is inside /admin. */
export function hubApiRoot(input: { token: string; apiBase?: string }): string {
  return input.apiBase ?? `/api/preview-hub/${encodeURIComponent(input.token)}`;
}

export const HUB_BRIDGE_SUBROUTES = ['', 'overview', 'website', 'changes', 'messages', 'details'] as const;
export type HubBridgeSubroute = (typeof HUB_BRIDGE_SUBROUTES)[number];

/** Old /preview/{token}/… URL → its /admin equivalent (docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). */
export function adminHubUrlFor(subroute: HubBridgeSubroute, search: URLSearchParams): string {
  const booking = search.get('view') === 'booking';
  switch (subroute) {
    case '':
      return booking ? ADMIN_HUB_LINKS.booking : ADMIN_HUB_PATH;
    case 'overview':
      return ADMIN_HUB_PATH;
    case 'website':
      return booking ? ADMIN_HUB_LINKS.booking : ADMIN_HUB_LINKS.website;
    case 'changes':
      return ADMIN_HUB_LINKS.changes;
    case 'messages': {
      const draft = search.get('draft');
      return draft === 'message' || draft === 'reopen'
        ? ADMIN_HUB_LINKS.messagesDraft(draft)
        : ADMIN_HUB_LINKS.messages;
    }
    case 'details':
      return ADMIN_HUB_LINKS.details;
  }
}
