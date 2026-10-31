import type { HubStage } from '@/lib/freePreview/hubStage';
import { HUB_STAGE_PILL } from '@/lib/freePreview/hubCopy';

/** /admin hub-mode shell copy (docs/admin-hub/ADMIN_HUB_SPEC.md §3). British English. */
export const ADMIN_HUB_NAV_GROUP = 'Your website';
export const ADMIN_HUB_LEAVE = 'Leave preview';
export const ADMIN_HUB_OPERATOR = 'Viewing as KERSIVO';
export const ADMIN_HUB_OPERATOR_BANNER =
  'Viewing as KERSIVO. You see what the owner sees; owner actions and view tracking are off.';
export const ADMIN_HUB_STAGE_PILL: Record<HubStage, string> = {
  ...HUB_STAGE_PILL,
  review: 'Preview ready',
};

export type AdminHubPillTone = 'accent' | 'live' | 'neutral';

export function adminHubPillTone(stage: HubStage): AdminHubPillTone {
  if (stage === 'live') return 'live';
  if (stage === 'declined' || stage === 'expired') return 'neutral';
  return 'accent';
}

export const ADMIN_HUB_APP_CLOSE = 'Close';
export const ADMIN_HUB_APP_LOADING = 'Loading…';
export const ADMIN_HUB_APP_RETRY = 'Try again';
export const ADMIN_HUB_APP_ERROR = 'Something went wrong. Try again.';
export const ADMIN_HUB_ACTIVITY_SHOW_ALL = 'Show all';
export const ADMIN_HUB_LAUNCH_READONLY =
  'The owner finishes these steps after they sign in.';
