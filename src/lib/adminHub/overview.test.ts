import { describe, expect, it } from 'vitest';
import {
  formatOverviewStepDate,
  isOverviewTerminal,
  overviewActivityKind,
  overviewChanges,
  overviewChangesLocked,
  overviewColours,
  overviewLatestMessage,
  overviewNowCopy,
  overviewOurSteps,
  overviewPreviewLocked,
  overviewPrimary,
  overviewShowLaunch,
  overviewStagePill,
  overviewTileHrefs,
  overviewUnreadLabel,
  shopInitials,
} from './overview';
import {
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_HINT,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SAVED,
  ADMIN_HUB_COLOURS_SENT,
  ADMIN_HUB_STEP_TODAY,
  ADMIN_HUB_UNREAD_COUNT,
} from './copy';
import { ADMIN_HUB_LINKS } from './links';
import { adminHubAppHref } from './apps';
import {
  HUB_CHANGES_DRAFT,
  HUB_LOCKED_REASON_PREVIEW,
  HUB_NOW,
  HUB_NOW_NOTHING,
  HUB_NOW_REVIEW_NEED_ALL,
  HUB_PREVIEW_CARD_LOCKED,
  HUB_PRIMARY,
} from '@/lib/freePreview/hubCopy';
import type { HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import type { HubCapabilities, HubStage, HubState } from '@/lib/freePreview/hubStage';

function caps(overrides: Partial<HubCapabilities> = {}): HubCapabilities {
  return {
    canUpload: true,
    canEditDetails: true,
    canReview: false,
    canDraftChanges: false,
    canSendChanges: false,
    canMessage: true,
    canCheckout: false,
    showPreview: false,
    ...overrides,
  };
}

function hub(stage: HubStage, extra: Partial<Extract<HubState, { kind: 'hub' }>> = {}): Extract<HubState, { kind: 'hub' }> {
  return {
    kind: 'hub',
    stage,
    reviewSubstate: extra.reviewSubstate,
    capabilities: extra.capabilities ?? caps(),
  };
}

function change(partial: Partial<HubChangePublic> & Pick<HubChangePublic, 'id' | 'status' | 'createdAt'>): HubChangePublic {
  return {
    page: 'HOME',
    pageLabel: 'Home',
    body: 'Use the shopfront photo',
    attachmentId: null,
    opsNote: null,
    round: null,
    sentAt: null,
    resolvedAt: null,
    ...partial,
  };
}

describe('overview view-model', () => {
  it('locks preview and changes before Review', () => {
    expect(overviewPreviewLocked('requested')).toBe(true);
    expect(overviewPreviewLocked('designing')).toBe(true);
    expect(overviewPreviewLocked('review')).toBe(false);
    expect(overviewChangesLocked('requested')).toBe(true);
    expect(overviewChangesLocked('launch')).toBe(false);
    expect(isOverviewTerminal('expired')).toBe(true);
    expect(isOverviewTerminal('declined')).toBe(true);
    expect(isOverviewTerminal('review')).toBe(false);
    expect(HUB_PREVIEW_CARD_LOCKED).toBe('Your preview will appear here');
    expect(HUB_LOCKED_REASON_PREVIEW).toBe('Available when your preview is ready');
  });

  it('uses §9.2 Now copy and ambers only when the owner has something to do', () => {
    const requested = overviewNowCopy({ stage: 'requested' });
    expect(requested.doing).toBe(HUB_NOW.requested.doing);
    expect(requested.need).toBe(HUB_NOW.requested.need);
    expect(requested.needIsAction).toBe(true);

    const designing = overviewNowCopy({ stage: 'designing' });
    expect(designing.need).toBe(HUB_NOW_NOTHING);
    expect(designing.needIsAction).toBe(false);

    const review = overviewNowCopy({ stage: 'review', reviewNeed: HUB_NOW_REVIEW_NEED_ALL });
    expect(review.need).toBe(HUB_NOW_REVIEW_NEED_ALL);
    expect(review.needIsAction).toBe(true);

    const sent = overviewNowCopy({ stage: 'review', reviewSubstate: 'changes_sent', reviewNeed: HUB_NOW_REVIEW_NEED_ALL });
    expect(sent.doing).toBe(HUB_NOW.reviewChangesSent.doing);
    expect(sent.need).toBe(HUB_NOW_NOTHING);
    expect(sent.needIsAction).toBe(false);
  });

  it('shows Our steps on Launch', () => {
    const our = overviewOurSteps([
      { id: 'domain', status: 'pending' },
      { id: 'ssl', done: true },
      { id: 'live', status: 'pending' },
    ]);
    expect(our?.label).toBe('Our steps');
    expect(our?.items.map((item) => [item.id, item.done])).toEqual([
      ['domain', false],
      ['ssl', true],
      ['live', false],
    ]);
  });

  it('routes header primary and tile hrefs without a token', () => {
    expect(overviewPrimary({ state: hub('requested') })).toEqual({
      href: ADMIN_HUB_LINKS.details,
      label: HUB_PRIMARY.requested,
    });
    expect(overviewPrimary({ state: hub('review', { capabilities: caps({ canCheckout: true, showPreview: true }) }) })).toEqual({
      href: ADMIN_HUB_LINKS.website,
      label: HUB_PRIMARY.review,
    });
    expect(overviewPrimary({ state: hub('launch') })).toEqual({
      href: adminHubAppHref('business'),
      label: HUB_PRIMARY.launch,
    });
    expect(overviewPrimary({ state: hub('expired') })?.href).toBe(ADMIN_HUB_LINKS.messagesDraft('reopen'));
    expect(overviewPrimary({ state: hub('declined') })?.href).toBe(ADMIN_HUB_LINKS.messagesDraft('message'));
    expect(overviewShowLaunch(hub('review', { capabilities: caps({ canCheckout: true }) }))).toBe(true);
    expect(overviewShowLaunch(hub('requested'))).toBe(false);

    const hrefs = overviewTileHrefs();
    expect(hrefs.preview).toBe('/admin?section=website');
    expect(hrefs.booking).toBe('/admin?section=website&view=booking');
    expect(hrefs.colours).toBe('/admin?app=colours');
    expect(hrefs.messages).toBe('/admin?app=messages');
    expect(hrefs.changes).toBe('/admin?section=changes');
    expect(hrefs.activity).toBe('/admin?app=activity');
    expect(Object.values(hrefs).every((href) => href.startsWith('/admin'))).toBe(true);
  });

  it('uses extracted palette count and sent / KERSIVO status', () => {
    expect(overviewColours({ hasLogo: false })).toMatchObject({
      swatches: [],
      headline: ADMIN_HUB_COLOURS_EMPTY,
      status: 'not_sent',
      statusLabel: ADMIN_HUB_COLOURS_NOT_SENT,
    });
    expect(overviewColours({ hasLogo: true })).toMatchObject({
      headline: ADMIN_HUB_COLOURS_HINT,
      swatches: [],
    });
    const withBrand = overviewColours({
      hasLogo: true,
      brandPrimaryColour: '#1f6f6b',
      brandSecondaryColour: '#c9a24a',
    });
    expect(withBrand.headline).toBe(ADMIN_HUB_COLOURS_SAVED(2));
    expect(withBrand.swatches.map((swatch) => [swatch.hex, swatch.role])).toEqual([
      ['#1F6F6B', 'Main'],
      ['#C9A24A', 'Accent'],
    ]);
    expect(withBrand.statusLabel).toBe(ADMIN_HUB_COLOURS_NOT_SENT);
    expect(
      overviewColours({
        hasLogo: true,
        brandColoursSentAt: new Date('2026-10-31'),
        brandColoursSource: 'KERSIVO_CHOOSES',
      }).statusLabel,
    ).toBe(ADMIN_HUB_COLOURS_KERSIVO);
    expect(
      overviewColours({
        hasLogo: true,
        brandColoursSentAt: new Date('2026-10-31'),
        brandColoursSource: 'LOGO',
      }).statusLabel,
    ).toBe(ADMIN_HUB_COLOURS_SENT);
    expect(
      overviewColours({
        hasLogo: true,
        brandPaletteExtracted: [
          { hex: '#1F6F6B', share: 0.5 },
          { hex: '#C9A24A', share: 0.3 },
          { hex: '#141414', share: 0.14 },
          { hex: '#F2E8D5', share: 0.06 },
        ],
        brandPrimaryColour: '#1F6F6B',
        brandSecondaryColour: '#C9A24A',
      }).headline,
    ).toBe('4 colours found in your logo');
  });

  it('counts change buckets and keeps the two latest', () => {
    const summary = overviewChanges({
      includedChangeRounds: 1,
      changeRoundsUsed: 0,
      items: [
        change({ id: 'a', status: 'DRAFT', createdAt: '2026-10-30T10:00:00.000Z', body: 'Older draft' }),
        change({ id: 'b', status: 'SENT', createdAt: '2026-10-31T09:00:00.000Z', page: 'BARBERS', pageLabel: 'Barbers' }),
        change({ id: 'c', status: 'DRAFT', createdAt: '2026-10-31T12:00:00.000Z', body: 'Newest draft' }),
        change({ id: 'd', status: 'DONE', createdAt: '2026-10-29T10:00:00.000Z' }),
      ],
    });
    expect(summary).toMatchObject({ drafts: 2, withKersivo: 1, done: 1 });
    expect(summary.latest.map((item) => item.id)).toEqual(['c', 'b']);
    expect(summary.latest[0]).toMatchObject({ statusLabel: HUB_CHANGES_DRAFT, tone: 'draft' });
    expect(summary.sendHint).toBe("Send when you're ready");
    expect(summary.roundText).toBe('Round 1 of 1 included');
  });

  it('formats unread and latest-message badges', () => {
    expect(overviewUnreadLabel(0)).toBeNull();
    expect(overviewUnreadLabel(1)).toBe(ADMIN_HUB_UNREAD_COUNT(1));
    expect(overviewUnreadLabel(3)).toBe(ADMIN_HUB_UNREAD_COUNT(3));
    const latest = overviewLatestMessage(
      {
        id: 'm1',
        author: 'KERSIVO',
        body: 'Your preview is ready.',
        createdAt: new Date('2026-10-31T10:00:00.000Z').toISOString(),
        readByOwnerAt: null,
        readByOpsAt: null,
        attachments: [],
      },
      new Date('2026-10-31T12:00:00.000Z'),
    );
    expect(latest).toMatchObject({ authorLabel: 'KERSIVO', body: 'Your preview is ready.', relative: '2 hours ago' });
  });

  it('labels the current stepper stage and uses Today for the same London day', () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    expect(
      overviewStagePill([
        { label: 'Requested', status: 'complete', date: now },
        { label: 'Designing', status: 'complete', date: now },
        { label: 'Review', status: 'current', date: now },
        { label: 'Launch', status: 'upcoming', date: null },
        { label: 'Live', status: 'upcoming', date: null },
      ]),
    ).toBe('Stage 3 of 5 · Review');
    expect(formatOverviewStepDate(new Date('2026-10-31T08:00:00.000Z'), now)).toBe(ADMIN_HUB_STEP_TODAY);
    expect(formatOverviewStepDate(new Date('2026-10-28T08:00:00.000Z'), now)).toBe('28 Oct');
    expect(shopInitials('Hub QA Ready')).toBe('HQ');
  });

  it('picks activity icons from the owner-visible label', () => {
    expect(overviewActivityKind({ action: 'MARKED_READY', label: 'Preview ready' })).toBe('ready');
    expect(overviewActivityKind({ action: 'hub_asset_uploaded', label: 'You added your logo' })).toBe('logo');
    expect(overviewActivityKind({ action: 'hub_asset_uploaded', label: 'You added 6 shop photos' })).toBe('photo');
    expect(overviewActivityKind({ action: 'ops_hub_message_sent', label: 'KERSIVO replied' })).toBe('message');
    expect(overviewActivityKind({ action: 'CREATED', label: 'Request received' })).toBe('ok');
  });
});
