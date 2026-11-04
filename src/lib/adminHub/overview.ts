/**
 * Overview bento view-model (docs/admin-hub/ADMIN_HUB_SPEC.md §4).
 * Client-safe except where callers pass already-loaded data.
 */
import { adminHubMaterialsHref } from './addMenu';
import { adminHubAppHref } from './apps';
import {
  ADMIN_HUB_ADD_LOGO,
  ADMIN_HUB_ADD_OTHER,
  ADMIN_HUB_ADD_PHOTOS,
  ADMIN_HUB_ADD_TEXT,
  ADMIN_HUB_CHANGES_DONE,
  ADMIN_HUB_CHANGES_DRAFTS,
  ADMIN_HUB_CHANGES_EMPTY,
  ADMIN_HUB_CHANGES_SEND_READY,
  ADMIN_HUB_CHANGES_WITH,
  ADMIN_HUB_ACTIVITY_TODAY,
  ADMIN_HUB_ACTIVITY_YESTERDAY,
  ADMIN_HUB_BUILD_STAGES,
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_FOUND,
  ADMIN_HUB_COLOURS_HINT,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SAVED,
  ADMIN_HUB_COLOURS_SENT,
  ADMIN_HUB_CONTENT_DONE,
  ADMIN_HUB_NOT_ADDED,
  ADMIN_HUB_STAGE_OF,
  ADMIN_HUB_STEP_TODAY,
  ADMIN_HUB_UNREAD_COUNT,
} from './copy';
import { ADMIN_HUB_API_BASE, ADMIN_HUB_LINKS } from './links';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';
import {
  HUB_CHANGES_DONE,
  HUB_CHANGES_DRAFT,
  HUB_CHANGES_IN_PROGRESS,
  HUB_CHANGES_NOT_POSSIBLE,
  HUB_CHANGES_ROUND,
  HUB_CHANGES_STATUS_SENT,
  HUB_KERSIVO,
  HUB_LAUNCH_OUR_DOMAIN,
  HUB_LAUNCH_OUR_PUBLISH,
  HUB_LAUNCH_OUR_SSL,
  HUB_LAUNCH_OUR_STEPS,
  HUB_NOW,
  HUB_NOW_LABEL_DOING,
  HUB_NOW_LABEL_NEED,
  HUB_NOW_NOTHING,
  HUB_PRIMARY,
  HUB_YOU,
} from '@/lib/freePreview/hubCopy';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import type { HubMessagePublic } from '@/lib/freePreview/hubMessages.shared';
import { parseCssColour } from '@/lib/adminHub/colour';
import { formatHubRelativeTime, formatHubStepDate, type HubActivityItem, type HubStepperStep } from '@/lib/freePreview/hubPage';
import type { OurLaunchStep } from '@/lib/freePreview/hubLaunch';
import { hubHeaderKind, type HubStage, type HubState } from '@/lib/freePreview/hubStage';
import { hubAssetThumbSrc, overviewColours, overviewTileHrefs, overviewWebsiteContent, shopInitials } from './overviewTiles';

export {
  hubAssetThumbSrc,
  overviewColours,
  overviewTileHrefs,
  overviewWebsiteContent,
  shopInitials,
} from './overviewTiles';
export type {
  OverviewColoursLook,
  OverviewColoursState,
  OverviewContentAsset,
  OverviewContentStatus,
  OverviewContentStatusId,
  OverviewContentImage,
  OverviewContentLogo,
  OverviewPaletteChip,
  OverviewRoleColour,
} from './overviewTiles';

export function isOverviewTerminal(stage: HubStage): boolean {
  return stage === 'expired' || stage === 'declined';
}

export function formatOverviewStepDate(date: Date | null, now: Date): string | null {
  if (!date) return null;
  const day = (value: Date) =>
    value.toLocaleDateString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  return day(date) === day(now) ? ADMIN_HUB_STEP_TODAY : formatHubStepDate(date);
}

export function overviewStagePill(steps: HubStepperStep[]): string | null {
  const current = steps.findIndex((step) => step.status === 'current');
  if (current < 0) return null;
  return ADMIN_HUB_STAGE_OF(current + 1, steps.length, steps[current]!.label);
}

export function overviewNowCopy(input: {
  stage: HubStage;
  reviewSubstate?: string;
  reviewNeed?: string | null;
}): { doingLabel: string; doing: string; needLabel: string; need: string; needIsAction: boolean } {
  const nowCopy =
    input.stage === 'review' && input.reviewSubstate === 'changes_sent' ? HUB_NOW.reviewChangesSent : HUB_NOW[input.stage];
  const need =
    input.stage === 'review' && input.reviewSubstate !== 'changes_sent' && input.reviewNeed
      ? input.reviewNeed
      : nowCopy.need;
  return {
    doingLabel: HUB_NOW_LABEL_DOING,
    doing: nowCopy.doing,
    needLabel: HUB_NOW_LABEL_NEED,
    need,
    needIsAction: need !== HUB_NOW_NOTHING,
  };
}

const OUR_STEP_LABEL: Record<OurLaunchStep, string> = {
  domain: HUB_LAUNCH_OUR_DOMAIN,
  ssl: HUB_LAUNCH_OUR_SSL,
  live: HUB_LAUNCH_OUR_PUBLISH,
};

export function overviewOurSteps(
  steps: Array<{ id: OurLaunchStep; status?: 'pending' | 'done'; done?: boolean }> | null | undefined,
): { label: string; items: Array<{ id: OurLaunchStep; label: string; done: boolean }> } | null {
  if (!steps?.length) return null;
  return {
    label: HUB_LAUNCH_OUR_STEPS,
    items: steps.map((step) => ({
      id: step.id,
      label: OUR_STEP_LABEL[step.id],
      done: step.status === 'done' || step.done === true,
    })),
  };
}

export function overviewPrimary(input: {
  state: Extract<HubState, { kind: 'hub' }>;
}): { href: string; label: string } | null {
  const stage = input.state.stage;
  const label =
    stage === 'review' && input.state.reviewSubstate === 'changes_sent'
      ? HUB_PRIMARY.reviewChangesSent
      : HUB_PRIMARY[stage];
  const href =
    stage === 'requested' || stage === 'designing'
      ? ADMIN_HUB_LINKS.details
      : stage === 'review'
        ? ADMIN_HUB_LINKS.website
        : stage === 'launch'
          ? adminHubAppHref('business')
          : stage === 'live'
            ? '/admin'
            : stage === 'declined'
              ? ADMIN_HUB_LINKS.messagesDraft('message')
              : stage === 'expired'
                ? ADMIN_HUB_LINKS.messagesDraft('reopen')
                : null;
  return href ? { href, label } : null;
}

export function overviewShowLaunch(state: Extract<HubState, { kind: 'hub' }>): boolean {
  return Boolean(state.capabilities.canCheckout);
}

export function overviewPreviewLocked(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing';
}

export function overviewChangesLocked(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing';
}

/** Overview Changes tile — only once the website preview exists (not requested/designing). */
export function overviewShowChangesTile(input: { stage: HubStage; hasWebsitePreview: boolean }): boolean {
  return input.stage !== 'requested' && input.stage !== 'designing' && input.hasWebsitePreview;
}

export type OverviewChangeTone = 'draft' | 'sent' | 'prog' | 'done';

export function overviewChanges(input: {
  items: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
}): {
  drafts: number;
  withKersivo: number;
  done: number;
  latest: Array<{
    id: string;
    pageLabel: string;
    body: string;
    statusLabel: string;
    tone: OverviewChangeTone;
  }>;
  labels: { drafts: string; withKersivo: string; done: string };
  roundText: string;
  sendHint: string | null;
  empty: string;
} {
  const drafts = input.items.filter((item) => item.status === 'DRAFT').length;
  const withKersivo = input.items.filter((item) => item.status === 'SENT' || item.status === 'IN_PROGRESS').length;
  const done = input.items.filter((item) => item.status === 'DONE' || item.status === 'NOT_POSSIBLE').length;
  const latest = [...input.items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 2)
    .map((item) => ({
      id: item.id,
      pageLabel: item.pageLabel,
      body: item.body,
      statusLabel:
        item.status === 'DRAFT'
          ? HUB_CHANGES_DRAFT
          : item.status === 'SENT'
            ? HUB_CHANGES_STATUS_SENT
            : item.status === 'IN_PROGRESS'
              ? HUB_CHANGES_IN_PROGRESS
              : item.status === 'NOT_POSSIBLE'
                ? HUB_CHANGES_NOT_POSSIBLE
                : HUB_CHANGES_DONE,
      tone:
        item.status === 'DRAFT'
          ? ('draft' as const)
          : item.status === 'SENT'
            ? ('sent' as const)
            : item.status === 'IN_PROGRESS'
              ? ('prog' as const)
              : ('done' as const),
    }));
  return {
    drafts,
    withKersivo,
    done,
    latest,
    labels: {
      drafts: ADMIN_HUB_CHANGES_DRAFTS,
      withKersivo: ADMIN_HUB_CHANGES_WITH,
      done: ADMIN_HUB_CHANGES_DONE,
    },
    roundText: HUB_CHANGES_ROUND(input.changeRoundsUsed, input.includedChangeRounds),
    sendHint: drafts > 0 ? ADMIN_HUB_CHANGES_SEND_READY : null,
    empty: ADMIN_HUB_CHANGES_EMPTY,
  };
}

export function overviewLatestMessage(
  message: HubMessagePublic | null,
  now: Date,
): { authorLabel: string; author: HubMessagePublic['author']; body: string; relative: string } | null {
  if (!message) return null;
  return {
    author: message.author,
    authorLabel: message.author === 'KERSIVO' ? HUB_KERSIVO : HUB_YOU,
    body: message.body,
    relative: formatHubRelativeTime(new Date(message.createdAt), now),
  };
}

export function overviewUnreadLabel(count: number): string | null {
  return count > 0 ? ADMIN_HUB_UNREAD_COUNT(count) : null;
}

export type OverviewActivityKind = 'message' | 'upload' | 'status' | 'change' | 'default';

const STATUS_ACTIONS = new Set([
  'CREATED',
  'MARKED_READY',
  'CONVERTED',
  'DECLINED',
  'EXPIRED',
  'hub_live',
  'ops_hub_mark_live',
]);

const CHANGE_ACTIONS = new Set(['CHANGES_REQUESTED', 'hub_changes_sent', 'ops_hub_change_status']);

const STATUS_STAGE_LABEL: Record<string, string> = {
  CREATED: ADMIN_HUB_BUILD_STAGES[0],
  MARKED_READY: ADMIN_HUB_BUILD_STAGES[2],
  CONVERTED: ADMIN_HUB_BUILD_STAGES[3],
  hub_live: ADMIN_HUB_BUILD_STAGES[4],
  ops_hub_mark_live: ADMIN_HUB_BUILD_STAGES[4],
};

export function overviewActivityKind(item: Pick<HubActivityItem, 'action' | 'label'>): OverviewActivityKind {
  if (CHANGE_ACTIONS.has(item.action) || /change/i.test(item.label)) return 'change';
  if (STATUS_ACTIONS.has(item.action) || /preview is ready|request received/i.test(item.label)) return 'status';
  if (
    item.action === 'hub_asset_uploaded' ||
    /logo|photo|file|price list/i.test(item.label)
  ) {
    return 'upload';
  }
  if (/message|replied/i.test(item.label) || item.action.endsWith('message_sent')) return 'message';
  return 'default';
}

export function overviewActivityLabel(item: Pick<HubActivityItem, 'action' | 'label'>): string {
  return STATUS_STAGE_LABEL[item.action] ?? item.label;
}

export function formatOverviewCompactRelativeTime(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatHubStepDate(date);
}

function londonDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

function londonYesterdayKey(now: Date): string {
  const [year, month, day] = londonDayKey(now).split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10);
}

export function overviewActivityDayLabel(date: Date, now: Date): string {
  const key = londonDayKey(date);
  if (key === londonDayKey(now)) return ADMIN_HUB_ACTIVITY_TODAY;
  if (key === londonYesterdayKey(now)) return ADMIN_HUB_ACTIVITY_YESTERDAY;
  return formatHubStepDate(date);
}

export type OverviewActivityRow = {
  id: string;
  action: string;
  label: string;
  kind: OverviewActivityKind;
  at: string;
  relative: string;
  absolute: string;
};

export type OverviewActivityGroup = {
  label: string;
  items: OverviewActivityRow[];
};

export function overviewActivityFeed(
  activity: HubActivityItem[],
  now: Date,
  limit = 5,
): OverviewActivityGroup[] {
  const items = activity.slice(0, limit).map((item) => ({
    id: item.id,
    action: item.action,
    label: overviewActivityLabel(item),
    kind: overviewActivityKind(item),
    at: item.at.toISOString(),
    relative: formatOverviewCompactRelativeTime(item.at, now),
    absolute: item.absolute,
  }));
  const groups: OverviewActivityGroup[] = [];
  for (const item of items) {
    const label = overviewActivityDayLabel(new Date(item.at), now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function overviewHideAddMaterialsPrimary(stage: HubStage): boolean {
  return stage === 'requested' || stage === 'designing';
}

export const OVERVIEW_BENTO_TILES = [
  'progress',
  'preview',
  'content',
  'changes',
  'colours',
  'activity',
] as const;

export type OverviewBentoTile = (typeof OVERVIEW_BENTO_TILES)[number];

/** Named grid areas. Source / DOM order matches mobile order for screen readers. */
export const OVERVIEW_BENTO_AREAS = {
  mobile: ['progress', 'preview', 'content', 'changes', 'colours', 'activity'],
  tablet: [
    'progress progress progress progress progress progress',
    'preview preview preview colours colours colours',
    'changes changes changes changes changes changes',
    'content content content activity activity activity',
  ],
  desktop: [
    'progress progress progress progress progress progress progress progress preview preview preview preview',
    'colours colours colours colours colours colours colours colours preview preview preview preview',
    'changes changes changes changes changes changes changes changes changes changes changes changes',
    'content content content content content content activity activity activity activity activity activity',
  ],
} as const;

/** Grid areas when the Changes tile is omitted — no empty cells. */
export const OVERVIEW_BENTO_AREAS_NO_CHANGES = {
  mobile: ['progress', 'preview', 'content', 'colours', 'activity'],
  tablet: [
    'progress progress progress progress progress progress',
    'preview preview preview colours colours colours',
    'content content content activity activity activity',
  ],
  desktop: [
    'progress progress progress progress progress progress progress progress preview preview preview preview',
    'colours colours colours colours colours colours colours colours preview preview preview preview',
    'content content content content content content activity activity activity activity activity activity',
  ],
} as const;

export function overviewBentoAreasCss(rows: readonly string[]): string {
  return rows.map((row) => `"${row}"`).join('\n    ');
}

export function overviewBentoTiles(stage: HubStage, hasWebsitePreview = true): OverviewBentoTile[] {
  if (isOverviewTerminal(stage)) return [];
  if (!overviewShowChangesTile({ stage, hasWebsitePreview })) {
    return OVERVIEW_BENTO_TILES.filter((tile) => tile !== 'changes');
  }
  return [...OVERVIEW_BENTO_TILES];
}

export { hubHeaderKind };
