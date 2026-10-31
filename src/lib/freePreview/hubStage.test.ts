import { describe, expect, it } from 'vitest';
import type { PreviewRequestStatus } from '@prisma/client';
import { resolvePreviewPageState, type TokenPreviewRequest } from './previewAccess';
import { mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import {
  hubHeaderKind,
  ownerFacingStageLabel,
  resolveHubState,
  type HubCapabilities,
  type HubStage,
  type HubStageRequest,
} from './hubStage';

const NOW = new Date('2026-11-01T12:00:00Z');
const FUTURE = new Date('2026-11-30T12:00:00Z');
const PAST = new Date('2026-10-01T12:00:00Z');
const READY_AT = new Date('2026-10-31T12:00:00Z');

function request(overrides: Partial<HubStageRequest> = {}): HubStageRequest {
  return {
    status: 'REQUESTED',
    previewReadyAt: null,
    expiresAt: null,
    convertedAt: null,
    liveAt: null,
    includedChangeRounds: 1,
    changeRoundsUsed: 0,
    draftShopId: null,
    ...overrides,
  };
}

const TOKEN = mintPreviewToken();

function pageRow(overrides: Partial<TokenPreviewRequest> = {}): TokenPreviewRequest {
  return {
    id: 'req_1',
    publicToken: TOKEN,
    status: 'READY',
    firstName: 'Sam',
    email: 'sam@example.com',
    shopName: 'Sharp Cuts',
    townCity: 'Leeds',
    instagramUrl: null,
    websiteUrl: null,
    hasOwnDomain: 'no',
    barberCount: '2-3',
    currentBookingSystem: 'booksy',
    draftShopId: 'shop_draft',
    expiresAt: FUTURE,
    previewReadyAt: READY_AT,
    convertedAt: null,
    changesRequestedAt: null,
    createdAt: READY_AT,
    liveAt: null,
    includedChangeRounds: 1,
    changeRoundsUsed: 0,
    ...overrides,
  };
}

function expectHub(
  status: PreviewRequestStatus,
  isOperator: boolean,
  extra: Partial<HubStageRequest>,
  stage: HubStage,
  caps: Partial<HubCapabilities>,
  reviewSubstate?: 'ready' | 'changes_sent',
) {
  const state = resolveHubState({
    request: request({ status, ...extra }),
    isOperator,
    now: NOW,
    liveMarker: extra.liveAt ?? null,
  });
  expect(state.kind).toBe('hub');
  if (state.kind !== 'hub') return;
  expect(state.stage).toBe(stage);
  if (reviewSubstate) expect(state.reviewSubstate).toBe(reviewSubstate);
  expect(state.capabilities).toEqual(expect.objectContaining(caps));
}

const PRE_REVIEW = {
  canUpload: true,
  canEditDetails: true,
  canReview: false,
  canDraftChanges: false,
  canSendChanges: false,
  canMessage: true,
  canCheckout: false,
  showPreview: false,
};

const REVIEW = {
  canUpload: true,
  canEditDetails: true,
  canReview: true,
  canDraftChanges: true,
  canSendChanges: true,
  canMessage: true,
  canCheckout: true,
  showPreview: true,
};

describe('resolveHubState', () => {
  it.each([null, request({ status: 'REJECTED' })] as const)(
    'treats unknown and REJECTED as not_found (operator=%s does not matter)',
    (row) => {
      for (const isOperator of [false, true]) {
        expect(resolveHubState({ request: row, isOperator, now: NOW })).toEqual({ kind: 'not_found' });
      }
    },
  );

  it('expired previews that were never ready stay not_found (today’s rule)', () => {
    for (const isOperator of [false, true]) {
      expect(
        resolveHubState({
          request: request({ status: 'EXPIRED', previewReadyAt: null, expiresAt: PAST }),
          isOperator,
          now: NOW,
        }),
      ).toEqual({ kind: 'not_found' });
      expect(
        resolveHubState({
          request: request({ status: 'REQUESTED', previewReadyAt: null, expiresAt: PAST }),
          isOperator,
          now: NOW,
        }),
      ).toEqual({ kind: 'not_found' });
    }
  });

  it('maps every owner-visible status for owners and operators', () => {
    for (const isOperator of [false, true]) {
      expectHub('REQUESTED', isOperator, {}, 'requested', PRE_REVIEW);
      expectHub('IN_PROGRESS', isOperator, {}, 'designing', PRE_REVIEW);
      expectHub(
        'READY',
        isOperator,
        { previewReadyAt: READY_AT, expiresAt: FUTURE, draftShopId: 'shop_draft' },
        'review',
        REVIEW,
        'ready',
      );
      expectHub(
        'CHANGES_REQUESTED',
        isOperator,
        { previewReadyAt: READY_AT, expiresAt: FUTURE, draftShopId: 'shop_draft', changeRoundsUsed: 1 },
        'review',
        { ...REVIEW, canSendChanges: false },
        'changes_sent',
      );
      expectHub(
        'CONVERTED',
        isOperator,
        { previewReadyAt: READY_AT, convertedAt: NOW, draftShopId: 'shop_draft' },
        'launch',
        {
          canUpload: true,
          canEditDetails: false,
          canReview: false,
          canDraftChanges: false,
          canSendChanges: false,
          canMessage: true,
          canCheckout: false,
          showPreview: true,
        },
      );
      expectHub(
        'CONVERTED',
        isOperator,
        { previewReadyAt: READY_AT, convertedAt: NOW, liveAt: NOW, draftShopId: 'shop_draft' },
        'live',
        {
          canUpload: false,
          canEditDetails: false,
          canCheckout: false,
          canMessage: true,
          showPreview: true,
        },
      );
      expectHub(
        'DECLINED',
        isOperator,
        { previewReadyAt: READY_AT },
        'declined',
        { canMessage: true, canCheckout: false, showPreview: false, canUpload: false },
      );
      expectHub(
        'EXPIRED',
        isOperator,
        { previewReadyAt: READY_AT, expiresAt: PAST },
        'expired',
        { canMessage: true, canCheckout: false, showPreview: false, canUpload: false },
      );
    }
  });

  it('lets operators see the website iframe before Review when a draft shop exists', () => {
    const owner = resolveHubState({
      request: request({ status: 'IN_PROGRESS', draftShopId: 'shop_draft' }),
      isOperator: false,
      now: NOW,
    });
    const operator = resolveHubState({
      request: request({ status: 'IN_PROGRESS', draftShopId: 'shop_draft' }),
      isOperator: true,
      now: NOW,
    });
    expect(owner.kind === 'hub' && owner.capabilities.showPreview).toBe(false);
    expect(operator.kind === 'hub' && operator.capabilities.showPreview).toBe(true);
  });

  it('does not require a draft shop at Requested or Designing', () => {
    expect(
      resolveHubState({
        request: request({ status: 'REQUESTED', draftShopId: null }),
        isOperator: false,
        now: NOW,
      }).kind,
    ).toBe('hub');
  });

  it('treats a CHANGES_REQUESTED row with unused rounds as rounds already used (legacy rows)', () => {
    const state = resolveHubState({
      request: request({
        status: 'CHANGES_REQUESTED',
        previewReadyAt: READY_AT,
        expiresAt: FUTURE,
        changeRoundsUsed: 0,
      }),
      isOperator: false,
      now: NOW,
    });
    expect(state.kind === 'hub' && state.capabilities.canSendChanges).toBe(false);
  });

  it('uses liveMarker over request.liveAt when both are passed', () => {
    const without = resolveHubState({
      request: request({ status: 'CONVERTED', liveAt: null }),
      isOperator: false,
      now: NOW,
      liveMarker: NOW,
    });
    expect(without.kind === 'hub' && without.stage).toBe('live');
  });
});

describe('ownerFacingStageLabel', () => {
  it('returns the owner pill for hub states and Not found otherwise', () => {
    expect(ownerFacingStageLabel({ kind: 'not_found' })).toBe('Not found');
    const state = resolveHubState({
      request: request({ status: 'IN_PROGRESS' }),
      isOperator: false,
      now: NOW,
    });
    expect(ownerFacingStageLabel(state)).toBe('Designing');
  });
});

describe('hubHeaderKind', () => {
  it('picks the changes-sent header while Review is updating', () => {
    const ready = resolveHubState({
      request: request({ status: 'READY', previewReadyAt: READY_AT, expiresAt: FUTURE }),
      isOperator: false,
      now: NOW,
    });
    const sent = resolveHubState({
      request: request({ status: 'CHANGES_REQUESTED', previewReadyAt: READY_AT, expiresAt: FUTURE }),
      isOperator: false,
      now: NOW,
    });
    expect(ready.kind === 'hub' && hubHeaderKind(ready)).toBe('review');
    expect(sent.kind === 'hub' && hubHeaderKind(sent)).toBe('reviewChangesSent');
  });
});

describe('flag-off page state is unchanged (GLOBAL RULE 2)', () => {
  it('still 404s REQUESTED / IN_PROGRESS / REJECTED / unsent-expired for owners', () => {
    for (const row of [
      null,
      pageRow({ status: 'REQUESTED', previewReadyAt: null, expiresAt: null }),
      pageRow({ status: 'IN_PROGRESS', previewReadyAt: null, expiresAt: null }),
      pageRow({ status: 'REJECTED', previewReadyAt: null, expiresAt: null }),
      pageRow({ draftShopId: null }),
    ]) {
      expect(resolvePreviewPageState({ request: row, isOperator: false, now: NOW })).toEqual({
        kind: 'not_found',
      });
    }
  });

  it('still shows the legacy expired page after a send, and the iframe for READY', () => {
    expect(resolvePreviewPageState({ request: pageRow({ expiresAt: PAST }), isOperator: false, now: NOW })).toEqual({
      kind: 'expired',
    });
    expect(resolvePreviewPageState({ request: pageRow(), isOperator: false, now: NOW }).kind).toBe('preview');
  });
});
