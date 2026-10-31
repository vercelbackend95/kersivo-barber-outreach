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

export const ADMIN_HUB_TILE_PROGRESS = 'Your website build';
export const ADMIN_HUB_TILE_PREVIEW = 'Your preview';
export const ADMIN_HUB_TILE_COLOURS = 'Brand colours';
export const ADMIN_HUB_TILE_MESSAGES = 'Messages';
export const ADMIN_HUB_TILE_CHANGES = 'Changes';
export const ADMIN_HUB_TILE_ACTIVITY = 'Activity';
export const ADMIN_HUB_OPEN = 'Open';
export const ADMIN_HUB_STEP_TODAY = 'Today';
export const ADMIN_HUB_STAGE_OF = (current: number, total: number, label: string) =>
  `Stage ${current} of ${total} · ${label}`;

export const ADMIN_HUB_COLOURS_HINT = "We'll find colours in your logo";
export const ADMIN_HUB_COLOURS_EMPTY = "Add your logo and we'll find colours";
export const ADMIN_HUB_COLOURS_SAVED = (n: number) =>
  n === 1 ? '1 colour from your shop' : `${n} colours from your shop`;
export const ADMIN_HUB_COLOURS_NOT_SENT = 'Not sent yet';
export const ADMIN_HUB_COLOURS_SENT = 'Sent';
export const ADMIN_HUB_COLOURS_KERSIVO = "Using KERSIVO's choice";
export const ADMIN_HUB_COLOURS_MINUTE = 'Takes about a minute';
export const ADMIN_HUB_COLOURS_MAIN = 'Main';
export const ADMIN_HUB_COLOURS_ACCENT = 'Accent';

export const ADMIN_HUB_WRITE_MESSAGE = 'Write a message…';
export const ADMIN_HUB_UNREAD_COUNT = (n: number) => (n === 1 ? '1 unread' : `${n} unread`);
export const ADMIN_HUB_MESSAGES_EMPTY = 'No messages yet';

export const ADMIN_HUB_CHANGES_DRAFTS = 'Drafts';
export const ADMIN_HUB_CHANGES_WITH = 'With KERSIVO';
export const ADMIN_HUB_CHANGES_DONE = 'Done';
export const ADMIN_HUB_CHANGES_SEND_READY = "Send when you're ready";
export const ADMIN_HUB_CHANGES_EMPTY = 'No changes yet';

export const ADMIN_HUB_LAUNCH_BUTTON = 'Launch this website';
export const ADMIN_HUB_LAUNCH_PRICE = '£39/month';
