import type { PreviewRequestStatus } from '@prisma/client';
import { HUB_STAGE_PILL, type HubHeaderKind } from './hubCopy';
import { isPreviewExpired } from './previewAccess';

export const HUB_STAGES = [
  'requested',
  'designing',
  'review',
  'launch',
  'live',
  'declined',
  'expired',
] as const;

export type HubStage = (typeof HUB_STAGES)[number];
export type HubReviewSubstate = 'ready' | 'changes_sent';

export type HubCapabilities = {
  canUpload: boolean;
  canEditDetails: boolean;
  canReview: boolean;
  canDraftChanges: boolean;
  canSendChanges: boolean;
  canMessage: boolean;
  canCheckout: boolean;
  showPreview: boolean;
};

export type HubState =
  | { kind: 'not_found' }
  | {
      kind: 'hub';
      stage: HubStage;
      reviewSubstate?: HubReviewSubstate;
      capabilities: HubCapabilities;
    };

export type HubStageRequest = {
  status: PreviewRequestStatus;
  previewReadyAt: Date | null;
  expiresAt: Date | null;
  convertedAt?: Date | null;
  liveAt?: Date | null;
  includedChangeRounds?: number;
  changeRoundsUsed?: number;
  draftShopId?: string | null;
};

const NONE: HubCapabilities = {
  canUpload: false,
  canEditDetails: false,
  canReview: false,
  canDraftChanges: false,
  canSendChanges: false,
  canMessage: true,
  canCheckout: false,
  showPreview: false,
};

function roundsLeft(request: HubStageRequest): boolean {
  const included = request.includedChangeRounds ?? 1;
  const used =
    request.status === 'CHANGES_REQUESTED'
      ? Math.max(request.changeRoundsUsed ?? 0, 1)
      : (request.changeRoundsUsed ?? 0);
  return used < included;
}

function capabilitiesFor(stage: HubStage, request: HubStageRequest, isOperator: boolean): HubCapabilities {
  const operatorPreview = isOperator && Boolean(request.draftShopId);
  switch (stage) {
    case 'requested':
    case 'designing':
      return {
        canUpload: true,
        canEditDetails: true,
        canReview: false,
        canDraftChanges: false,
        canSendChanges: false,
        canMessage: true,
        canCheckout: false,
        showPreview: operatorPreview,
      };
    case 'review':
      return {
        canUpload: true,
        canEditDetails: true,
        canReview: true,
        canDraftChanges: true,
        canSendChanges: roundsLeft(request),
        canMessage: true,
        canCheckout: true,
        showPreview: true,
      };
    case 'launch':
      return {
        canUpload: true,
        canEditDetails: false,
        canReview: false,
        canDraftChanges: false,
        canSendChanges: false,
        canMessage: true,
        canCheckout: false,
        showPreview: true,
      };
    case 'live':
      return {
        ...NONE,
        showPreview: true,
      };
    case 'declined':
    case 'expired':
      return NONE;
  }
}

function hubResult(
  stage: HubStage,
  request: HubStageRequest,
  isOperator: boolean,
  reviewSubstate?: HubReviewSubstate,
): HubState {
  return {
    kind: 'hub',
    stage,
    ...(reviewSubstate ? { reviewSubstate } : {}),
    capabilities: capabilitiesFor(stage, request, isOperator),
  };
}

/**
 * Owner-facing hub stage. REJECTED and unknown tokens are not_found (indistinguishable).
 * Expired previews that were never ready stay not_found (today's rule).
 * Operators can open any non-rejected request; their views are counted elsewhere, never here.
 */
export function resolveHubState(input: {
  request: HubStageRequest | null;
  isOperator: boolean;
  now: Date;
  liveMarker?: Date | null;
}): HubState {
  const { request, isOperator, now } = input;
  if (!request) return { kind: 'not_found' };
  if (request.status === 'REJECTED') return { kind: 'not_found' };

  const liveAt = input.liveMarker ?? request.liveAt ?? null;

  if (request.status === 'DECLINED') {
    return hubResult('declined', request, isOperator);
  }

  if (request.status === 'CONVERTED' || (request.convertedAt && request.previewReadyAt)) {
    return hubResult(liveAt ? 'live' : 'launch', request, isOperator);
  }

  const expired = isPreviewExpired(request, now) || request.status === 'EXPIRED';
  if (expired) {
    if (!request.previewReadyAt) return { kind: 'not_found' };
    return hubResult('expired', request, isOperator);
  }

  switch (request.status) {
    case 'REQUESTED':
      return hubResult('requested', request, isOperator);
    case 'IN_PROGRESS':
      return hubResult('designing', request, isOperator);
    case 'READY':
      return hubResult('review', request, isOperator, 'ready');
    case 'CHANGES_REQUESTED':
      return hubResult('review', request, isOperator, 'changes_sent');
    default:
      return { kind: 'not_found' };
  }
}

export function ownerFacingStageLabel(state: HubState): string {
  if (state.kind !== 'hub') return 'Not found';
  return HUB_STAGE_PILL[state.stage];
}

export function hubHeaderKind(state: Extract<HubState, { kind: 'hub' }>): HubHeaderKind {
  if (state.stage === 'review') {
    return state.reviewSubstate === 'changes_sent' ? 'reviewChangesSent' : 'review';
  }
  return state.stage;
}
