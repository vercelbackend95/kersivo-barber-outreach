/**
 * Overview bento view-model (docs/admin-hub/ADMIN_HUB_SPEC.md §4).
 * Client-safe except where callers pass already-loaded data.
 */
import { adminHubMaterialsHref, hubCanAddShopItems } from './addMenu';
import { adminHubAppHref } from './apps';
import {
  ADMIN_HUB_ADD_LOGO,
  ADMIN_HUB_ADD_OTHER,
  ADMIN_HUB_ADD_PHOTOS,
  ADMIN_HUB_ADD_TEAM_PHOTOS,
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
  ADMIN_HUB_SHOP_PRODUCTS,
  ADMIN_HUB_SHOP_PRODUCTS_ADD,
  ADMIN_HUB_SHOP_PRODUCTS_COUNT,
  ADMIN_HUB_SHOP_SERVICES,
  ADMIN_HUB_SHOP_SERVICES_ADD,
  ADMIN_HUB_SHOP_SERVICES_COUNT,
  ADMIN_HUB_SHOP_TEAM,
  ADMIN_HUB_SHOP_TEAM_ADD,
  ADMIN_HUB_SHOP_TEAM_COUNT,
  ADMIN_HUB_STAGE_OF,
  ADMIN_HUB_STEP_TODAY,
  ADMIN_HUB_UNREAD_COUNT,
} from './copy';
import { ADMIN_HUB_API_BASE, ADMIN_HUB_LINKS } from './links';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';
import type { SetupShopCounts } from './setupCard';
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

export function shopInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

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

function isLightHex(hex: string): boolean {
  const raw = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(raw.slice(1, 3), 16);
  const g = parseInt(raw.slice(3, 5), 16);
  const b = parseInt(raw.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export type OverviewSwatch = { hex: string; css: string; role: 'Main' | 'Accent' | null; light: boolean };
export type OverviewColoursStatus = 'not_sent' | 'sent' | 'kersivo';

export function overviewColours(input: {
  hasLogo: boolean;
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandColoursSentAt?: Date | string | null;
  brandColoursSource?: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted?: Array<{ hex: string; share?: number }> | null;
}): {
  swatches: OverviewSwatch[];
  headline: string;
  status: OverviewColoursStatus;
  statusLabel: string;
} {
  const primary = parseCssColour(input.brandPrimaryColour);
  const secondary = parseCssColour(input.brandSecondaryColour);
  const palette = (input.brandPaletteExtracted ?? [])
    .map((row) => parseCssColour(row.hex))
    .filter((colour): colour is NonNullable<typeof colour> => Boolean(colour));

  const swatches: OverviewSwatch[] = [];
  const seen = new Set<string>();
  const push = (colour: { hex: string; css: string }, role: OverviewSwatch['role']) => {
    if (seen.has(colour.hex)) return;
    seen.add(colour.hex);
    swatches.push({ hex: colour.hex, css: colour.css, role, light: isLightHex(colour.hex) });
  };
  if (primary) push(primary, ADMIN_HUB_COLOURS_MAIN);
  if (secondary && secondary.hex !== primary?.hex) push(secondary, ADMIN_HUB_COLOURS_ACCENT);
  for (const colour of palette) {
    if (swatches.length >= 4) break;
    push(colour, null);
  }

  const source = input.brandColoursSource;
  const sent = Boolean(input.brandColoursSentAt);
  const status: OverviewColoursStatus =
    sent && source === 'KERSIVO_CHOOSES' ? 'kersivo' : sent ? 'sent' : 'not_sent';
  const statusLabel =
    status === 'kersivo' ? ADMIN_HUB_COLOURS_KERSIVO : status === 'sent' ? ADMIN_HUB_COLOURS_SENT : ADMIN_HUB_COLOURS_NOT_SENT;

  const headline = palette.length
    ? ADMIN_HUB_COLOURS_FOUND(palette.length)
    : swatches.length
      ? ADMIN_HUB_COLOURS_SAVED(swatches.length)
      : input.hasLogo
        ? ADMIN_HUB_COLOURS_HINT
        : ADMIN_HUB_COLOURS_EMPTY;

  return { swatches, headline, status, statusLabel };
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

export function overviewShowShopTile(stage: HubStage): boolean {
  return hubCanAddShopItems(stage);
}

export const OVERVIEW_BENTO_TILES = [
  'progress',
  'preview',
  'content',
  'shop',
  'changes',
  'colours',
  'activity',
] as const;

export type OverviewBentoTile = (typeof OVERVIEW_BENTO_TILES)[number];

/** Named grid areas. Source / DOM order matches mobile order for screen readers. */
export const OVERVIEW_BENTO_AREAS = {
  mobile: ['progress', 'preview', 'content', 'shop', 'changes', 'colours', 'activity'],
  mobileNoShop: ['progress', 'preview', 'content', 'changes', 'colours', 'activity'],
  tablet: [
    'progress progress progress progress progress progress',
    'preview preview preview content content content',
    'shop shop shop colours colours colours',
    'changes changes changes changes changes changes',
    'activity activity activity activity activity activity',
  ],
  tabletNoShop: [
    'progress progress progress progress progress progress',
    'preview preview preview content content content',
    'colours colours colours colours colours colours',
    'changes changes changes changes changes changes',
    'activity activity activity activity activity activity',
  ],
  desktop: [
    'progress progress progress progress progress progress progress progress preview preview preview preview',
    'content content content content shop shop shop shop preview preview preview preview',
    'changes changes changes changes changes changes changes changes colours colours colours colours',
    'activity activity activity activity activity activity activity activity activity activity activity activity',
  ],
  desktopNoShop: [
    'progress progress progress progress progress progress progress progress preview preview preview preview',
    'content content content content content content content content preview preview preview preview',
    'changes changes changes changes changes changes changes changes colours colours colours colours',
    'activity activity activity activity activity activity activity activity activity activity activity activity',
  ],
} as const;

export function overviewBentoAreasCss(rows: readonly string[]): string {
  return rows.map((row) => `"${row}"`).join('\n    ');
}

export function overviewBentoTiles(input: { stage: HubStage; showShop: boolean }): OverviewBentoTile[] {
  if (isOverviewTerminal(input.stage)) return [];
  return OVERVIEW_BENTO_TILES.filter((id) => id !== 'shop' || input.showShop);
}

export type OverviewContentAsset = {
  id: string;
  kind: string;
  hasThumb: boolean;
  contentType: string;
  createdAt: string;
};

export type OverviewContentThumb = {
  id: string;
  src: string;
};

export type OverviewContentStatusId = 'logo' | 'photos' | 'team-photos' | 'text' | 'other';

export type OverviewContentStatus = {
  id: OverviewContentStatusId;
  label: string;
  href: string;
  value: string;
  done: boolean;
};

export function hubAssetThumbSrc(asset: Pick<OverviewContentAsset, 'id' | 'hasThumb' | 'contentType'>): string | null {
  if (asset.hasThumb) return `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=thumb`;
  if (asset.contentType.startsWith('image/') && !asset.contentType.includes('svg')) {
    return `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=full`;
  }
  return null;
}

export function overviewWebsiteContent(input: {
  assets: OverviewContentAsset[];
  aboutText?: string | null;
  websiteExtraText?: string | null;
}): {
  empty: boolean;
  thumbs: OverviewContentThumb[];
  status: OverviewContentStatus[];
} {
  const photos = input.assets.filter((asset) => asset.kind === 'SHOP_PHOTO');
  const teamPhotos = input.assets.filter((asset) => asset.kind === 'TEAM_PHOTO');
  const others = input.assets.filter((asset) => asset.kind === 'OTHER');
  const hasLogo = input.assets.some((asset) => asset.kind === 'LOGO');
  const hasPriceList = input.assets.some((asset) => asset.kind === 'PRICE_LIST');
  const hasText = Boolean(input.aboutText?.trim() || input.websiteExtraText?.trim());
  const thumbs = [...photos]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4)
    .flatMap((asset) => {
      const src = hubAssetThumbSrc(asset);
      return src ? [{ id: asset.id, src }] : [];
    });
  const status: OverviewContentStatus[] = [
    {
      id: 'logo',
      label: ADMIN_HUB_ADD_LOGO,
      href: adminHubMaterialsHref('logo'),
      value: hasLogo ? ADMIN_HUB_CONTENT_DONE : ADMIN_HUB_NOT_ADDED,
      done: hasLogo,
    },
    {
      id: 'photos',
      label: ADMIN_HUB_ADD_PHOTOS,
      href: adminHubMaterialsHref('photos'),
      value: String(photos.length),
      done: photos.length > 0,
    },
    {
      id: 'team-photos',
      label: ADMIN_HUB_ADD_TEAM_PHOTOS,
      href: adminHubMaterialsHref('team-photos'),
      value: String(teamPhotos.length),
      done: teamPhotos.length > 0,
    },
    {
      id: 'text',
      label: ADMIN_HUB_ADD_TEXT,
      href: adminHubMaterialsHref('text'),
      value: hasText ? ADMIN_HUB_CONTENT_DONE : ADMIN_HUB_NOT_ADDED,
      done: hasText,
    },
  ];
  if (others.length > 0) {
    status.push({
      id: 'other',
      label: ADMIN_HUB_ADD_OTHER,
      href: adminHubMaterialsHref('other'),
      value: String(others.length),
      done: true,
    });
  }
  return {
    empty: !hasLogo && photos.length === 0 && teamPhotos.length === 0 && !hasText && others.length === 0 && !hasPriceList,
    thumbs,
    status,
  };
}

export type OverviewShopRowId = 'team' | 'services' | 'products';

export type OverviewShopRow = {
  id: OverviewShopRowId;
  name: string;
  detail: string;
  href: string;
  empty: boolean;
};

export function overviewShopTile(input: {
  stage: HubStage;
  counts: SetupShopCounts | null | undefined;
}): { show: boolean; rows: OverviewShopRow[] } {
  if (!overviewShowShopTile(input.stage)) return { show: false, rows: [] };
  const counts = input.counts ?? { activeServices: 0, activeBarbers: 0, products: 0 };
  return {
    show: true,
    rows: [
      shopRow('team', ADMIN_HUB_SHOP_TEAM, counts.activeBarbers, PREVIEW_HUB_PATHS.team, ADMIN_HUB_SHOP_TEAM_COUNT, ADMIN_HUB_SHOP_TEAM_ADD),
      shopRow(
        'services',
        ADMIN_HUB_SHOP_SERVICES,
        counts.activeServices,
        PREVIEW_HUB_PATHS.services,
        ADMIN_HUB_SHOP_SERVICES_COUNT,
        ADMIN_HUB_SHOP_SERVICES_ADD,
      ),
      shopRow(
        'products',
        ADMIN_HUB_SHOP_PRODUCTS,
        counts.products,
        PREVIEW_HUB_PATHS.products,
        ADMIN_HUB_SHOP_PRODUCTS_COUNT,
        ADMIN_HUB_SHOP_PRODUCTS_ADD,
      ),
    ],
  };
}

function shopRow(
  id: OverviewShopRowId,
  name: string,
  count: number,
  path: string,
  countLabel: (n: number) => string,
  addLabel: string,
): OverviewShopRow {
  if (count <= 0) {
    return { id, name, detail: addLabel, href: `${path}?add=1`, empty: true };
  }
  return { id, name, detail: countLabel(count), href: path, empty: false };
}

export function overviewTileHrefs() {
  return {
    preview: ADMIN_HUB_LINKS.website,
    booking: ADMIN_HUB_LINKS.booking,
    colours: adminHubAppHref('colours'),
    messages: ADMIN_HUB_LINKS.messages,
    changes: ADMIN_HUB_LINKS.changes,
    activity: adminHubAppHref('activity'),
    materials: adminHubAppHref('materials'),
    team: PREVIEW_HUB_PATHS.team,
    services: PREVIEW_HUB_PATHS.services,
    products: PREVIEW_HUB_PATHS.products,
  };
}

export { hubHeaderKind };
