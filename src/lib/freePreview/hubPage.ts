import { prisma } from '@/lib/db/client';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { isAdminHubEnabled, isAnyHubEnabled, isFreePreviewFlowEnabled, isPreviewHubEnabled } from './config';
import {
  HUB_ACTIVITY_ADDED,
  HUB_ACTIVITY_KIND_FILE,
  HUB_ACTIVITY_KIND_FILES,
  HUB_ACTIVITY_KIND_LOGO,
  HUB_ACTIVITY_KIND_PHOTO,
  HUB_ACTIVITY_KIND_PHOTOS,
  HUB_ACTIVITY_KIND_PRICE,
  HUB_ACTIVITY_KIND_PRICES,
  HUB_ACTIVITY_KIND_TEAM,
  HUB_ACTIVITY_KIND_TEAMS,
  HUB_ACTIVITY_KERSIVO_REPLIED,
  HUB_ACTIVITY_LABELS,
  HUB_ACTIVITY_YOU_SENT,
  HUB_OWNER_ACTIVITY_ACTIONS,
  HUB_STEPPER_LABELS,
} from './hubCopy';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { resolveHubState, type HubStage, type HubState } from './hubStage';
import { verifyHubSession } from '@/lib/adminHub/hubSession';
import {
  loadPreviewDraftShop,
  resolvePreviewRequestById,
  resolvePreviewRequestByToken,
  type TokenPreviewRequest,
} from './previewAccess';
import { previewNotFoundResponse } from './previewHeaders';

export type HubActivityItem = {
  id: string;
  action: string;
  label: string;
  at: Date;
  relative: string;
  absolute: string;
};

export type HubStepperStep = {
  label: string;
  status: 'complete' | 'current' | 'upcoming';
  date: Date | null;
};

export function isHubRouteEnabled(): boolean {
  return isFreePreviewFlowEnabled() && isPreviewHubEnabled();
}

/** /admin hub mode, /api/admin-hub/* and the /preview/{token} bridge. Independent of PREVIEW_HUB_ENABLED. */
export function isAdminHubRouteEnabled(): boolean {
  return isFreePreviewFlowEnabled() && isAdminHubEnabled();
}

/** Ops hub APIs (messages, reviews, launch-steps) when either hub route is on. */
export function isAnyHubRouteEnabled(): boolean {
  return isHubRouteEnabled() || isAdminHubRouteEnabled();
}

export { isAnyHubEnabled };

export function hubNotFound(): Response {
  return previewNotFoundResponse();
}

export function formatHubRelativeTime(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatHubAbsoluteDate(date);
}

export function formatHubAbsoluteDate(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatHubStepDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
  });
}

export type HubPageContext = {
  /** The URL token on /preview/{token} and /api/preview-hub/{token}; always '' when resolved from `ks_hub`. */
  token: string;
  source: 'token' | 'cookie';
  request: TokenPreviewRequest;
  state: Extract<HubState, { kind: 'hub' }>;
  isOperator: boolean;
  draft: Awaited<ReturnType<typeof loadPreviewDraftShop>>;
};

/** `previewRequestId` is for trusted server callers only (a signed-in owner's own converted request). */
export type HubContextSource =
  | { token: string }
  | { cookie: string | null | undefined }
  | { previewRequestId: string };

/**
 * One resolver for every hub entry point: the token routes, /api/admin-hub/* and /admin hub mode
 * (docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). Both sources end in the same stage check, so REJECTED and unknown
 * requests are null either way. An operator cookie is only honoured alongside a live operator session.
 */
export async function resolveHubContext(
  source: HubContextSource,
  input: { isOperator: boolean; now: Date },
): Promise<HubPageContext | null> {
  let request: TokenPreviewRequest | null;
  if ('token' in source) {
    request = await resolvePreviewRequestByToken(source.token);
  } else if ('previewRequestId' in source) {
    request = await resolvePreviewRequestById(source.previewRequestId);
  } else {
    const session = verifyHubSession(source.cookie, input.now);
    if (!session) return null;
    if (session.operator && !input.isOperator) return null;
    request = await resolvePreviewRequestById(session.previewRequestId);
  }
  const state = resolveHubState({
    request,
    isOperator: input.isOperator,
    now: input.now,
    liveMarker: request?.liveAt ?? null,
  });
  if (!request || state.kind !== 'hub') return null;
  const draft = request.draftShopId ? await loadPreviewDraftShop(request.draftShopId) : null;
  return {
    token: 'token' in source ? source.token : '',
    source: 'token' in source ? 'token' : 'cookie',
    request,
    state,
    isOperator: input.isOperator,
    draft,
  };
}

export async function resolveHubPageContext(input: {
  token: string;
  isOperator: boolean;
  now: Date;
}): Promise<HubPageContext | null> {
  return resolveHubContext({ token: input.token }, { isOperator: input.isOperator, now: input.now });
}

/** First owner view per stage: event + hub_viewed analytics. Operators are never counted. */
export async function recordHubOwnerView(input: {
  requestId: string;
  stage: HubStage;
  isOperator: boolean;
  now: Date;
  clientId: string | null;
}): Promise<boolean> {
  if (input.isOperator) return false;
  await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: { ownerLastSeenAt: input.now },
  });
  const already = await prisma.previewRequestEvent.findMany({
    where: {
      previewRequestId: input.requestId,
      action: PREVIEW_REQUEST_ACTIONS.HUB_VIEWED,
    },
    select: { meta: true },
    take: 20,
  });
  if (already.some((row) => (row.meta as { stage?: string } | null)?.stage === input.stage)) {
    return false;
  }
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: input.requestId,
      action: PREVIEW_REQUEST_ACTIONS.HUB_VIEWED,
      meta: { stage: input.stage },
    },
  });
  await sendServerAnalyticsEvent({
    name: FUNNEL_EVENTS.hub_viewed,
    clientId: input.clientId,
    params: { stage: input.stage },
  });
  return true;
}

const STEPPER_INDEX: Record<HubStage, number> = {
  requested: 0,
  designing: 1,
  review: 2,
  launch: 3,
  live: 4,
  declined: -1,
  expired: -1,
};

export function hubStepper(input: {
  stage: HubStage;
  createdAt: Date;
  previewReadyAt: Date | null;
  convertedAt: Date | null;
  liveAt: Date | null;
  designingAt: Date | null;
}): HubStepperStep[] {
  const current = STEPPER_INDEX[input.stage];
  const dates: Array<Date | null> = [
    input.createdAt,
    input.designingAt,
    input.previewReadyAt,
    input.convertedAt,
    input.liveAt,
  ];
  return HUB_STEPPER_LABELS.map((label, index) => {
    let status: HubStepperStep['status'] = 'upcoming';
    if (current < 0) {
      if (dates[index]) status = 'complete';
    } else if (index < current) status = 'complete';
    else if (index === current) status = 'current';
    return { label, status, date: dates[index] ?? null };
  });
}

export function designingAtFromEvents(
  events: Array<{ action: string; toStatus: string | null; createdAt: Date }>,
): Date | null {
  const hit = events.find(
    (event) => event.action === PREVIEW_REQUEST_ACTIONS.STATUS_CHANGED && event.toStatus === 'IN_PROGRESS',
  );
  return hit?.createdAt ?? null;
}

function uploadKindLabel(kind: string | undefined, count: number): string {
  switch (kind) {
    case 'LOGO':
      return HUB_ACTIVITY_KIND_LOGO;
    case 'SHOP_PHOTO':
      return count === 1 ? HUB_ACTIVITY_KIND_PHOTO : HUB_ACTIVITY_KIND_PHOTOS;
    case 'TEAM_PHOTO':
      return count === 1 ? HUB_ACTIVITY_KIND_TEAM : HUB_ACTIVITY_KIND_TEAMS;
    case 'PRICE_LIST':
      return count === 1 ? HUB_ACTIVITY_KIND_PRICE : HUB_ACTIVITY_KIND_PRICES;
    default:
      return count === 1 ? HUB_ACTIVITY_KIND_FILE : HUB_ACTIVITY_KIND_FILES;
  }
}

function eventKind(event: { meta?: unknown }): string | undefined {
  const meta = event.meta as { kind?: string } | null;
  return typeof meta?.kind === 'string' ? meta.kind : undefined;
}

export function hubActivityItems(
  events: Array<{ id: string; action: string; createdAt: Date; meta?: unknown }>,
  now: Date,
  limit = 10,
): HubActivityItem[] {
  const visible = events.filter(
    (event) => HUB_OWNER_ACTIVITY_ACTIONS.has(event.action) && event.action !== PREVIEW_REQUEST_ACTIONS.HUB_VIEWED,
  );
  const grouped: HubActivityItem[] = [];
  let i = 0;
  while (i < visible.length && grouped.length < limit) {
    const event = visible[i]!;
    if (event.action === PREVIEW_REQUEST_ACTIONS.HUB_ASSET_UPLOADED) {
      const kind = eventKind(event);
      let count = 1;
      let j = i + 1;
      while (
        j < visible.length &&
        visible[j]!.action === PREVIEW_REQUEST_ACTIONS.HUB_ASSET_UPLOADED &&
        eventKind(visible[j]!) === kind
      ) {
        count += 1;
        j += 1;
      }
      grouped.push({
        id: event.id,
        action: event.action,
        label:
          kind === 'OTHER'
            ? HUB_ACTIVITY_LABELS.hub_asset_uploaded
            : HUB_ACTIVITY_ADDED(count, uploadKindLabel(kind, count)),
        at: event.createdAt,
        relative: formatHubRelativeTime(event.createdAt, now),
        absolute: formatHubAbsoluteDate(event.createdAt),
      });
      i = j;
      continue;
    }
      const messageLabel =
        event.action === PREVIEW_REQUEST_ACTIONS.HUB_MESSAGE_SENT
          ? (event.meta as { actor?: string } | null)?.actor === 'kersivo'
            ? HUB_ACTIVITY_KERSIVO_REPLIED
            : HUB_ACTIVITY_YOU_SENT
          : event.action === PREVIEW_REQUEST_ACTIONS.OPS_HUB_MESSAGE_SENT
            ? HUB_ACTIVITY_KERSIVO_REPLIED
            : (HUB_ACTIVITY_LABELS[event.action] ?? event.action);
      grouped.push({
        id: event.id,
        action: event.action,
        label: messageLabel,
        at: event.createdAt,
        relative: formatHubRelativeTime(event.createdAt, now),
        absolute: formatHubAbsoluteDate(event.createdAt),
      });
    i += 1;
  }
  return grouped;
}

export async function loadHubOverviewExtras(previewRequestId: string) {
  return prisma.previewRequestEvent.findMany({
    where: { previewRequestId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, action: true, toStatus: true, createdAt: true, meta: true },
  });
}

export function hostnameOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function tokenPrefixForLog(token: string): string {
  return token.slice(0, 6);
}
