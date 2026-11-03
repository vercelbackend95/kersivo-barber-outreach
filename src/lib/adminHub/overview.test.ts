import { describe, expect, it } from 'vitest';
import {
  formatOverviewCompactRelativeTime,
  formatOverviewStepDate,
  isOverviewTerminal,
  overviewActivityDayLabel,
  overviewActivityFeed,
  overviewActivityKind,
  overviewActivityLabel,
  overviewChanges,
  overviewChangesLocked,
  overviewColours,
  overviewBentoAreasCss,
  overviewBentoTiles,
  overviewHideAddMaterialsPrimary,
  overviewLatestMessage,
  overviewNowCopy,
  overviewOurSteps,
  overviewPreviewLocked,
  overviewPrimary,
  overviewShowChangesTile,
  overviewShowLaunch,
  overviewStagePill,
  overviewTileHrefs,
  overviewUnreadLabel,
  overviewWebsiteContent,
  shopInitials,
  OVERVIEW_BENTO_AREAS,
  OVERVIEW_BENTO_AREAS_NO_CHANGES,
} from './overview';
import {
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_HINT,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_NO_LOGO,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SAVED,
  ADMIN_HUB_COLOURS_SENT,
  ADMIN_HUB_STEP_TODAY,
  formatBrandSubmittedDate,
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
    expect(overviewShowChangesTile({ stage: 'requested', hasWebsitePreview: false })).toBe(false);
    expect(overviewShowChangesTile({ stage: 'designing', hasWebsitePreview: true })).toBe(false);
    expect(overviewShowChangesTile({ stage: 'review', hasWebsitePreview: false })).toBe(false);
    expect(overviewShowChangesTile({ stage: 'review', hasWebsitePreview: true })).toBe(true);
    expect(overviewShowChangesTile({ stage: 'launch', hasWebsitePreview: true })).toBe(true);
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
    expect(hrefs.preview).toBe('/admin/website');
    expect(hrefs.booking).toBe('/admin/website?view=booking');
    expect(hrefs.colours).toBe('/admin?app=colours');
    expect(hrefs.changes).toBe('/admin/changes');
    expect(hrefs.messages).toBe('/admin/messages');
    expect(hrefs.activity).toBe('/admin?app=activity');
    expect(hrefs.materials).toBe('/admin?app=materials');
    expect(hrefs.team).toBe('/admin/team');
    expect(hrefs.services).toBe('/admin/services');
    expect(hrefs.products).toBe('/admin/products');
    expect(Object.values(hrefs).every((href) => href.startsWith('/admin'))).toBe(true);
  });

  it('re-exports the Brand colours tile model (states live in overviewTiles.test.ts)', () => {
    expect(overviewColours({ hasLogo: false })).toMatchObject({
      state: 'no_logo',
      palette: [],
      main: null,
      accent: null,
      headline: ADMIN_HUB_COLOURS_NO_LOGO,
      guidance: ADMIN_HUB_COLOURS_EMPTY,
      statusLabel: ADMIN_HUB_COLOURS_NOT_SENT,
    });
    expect(overviewColours({ hasLogo: true }).headline).toBe(ADMIN_HUB_COLOURS_HINT);
    expect(
      overviewColours({ hasLogo: true, brandPrimaryColour: '#1f6f6b', brandSecondaryColour: '#c9a24a' }).headline,
    ).toBe(ADMIN_HUB_COLOURS_SAVED(2));
    expect(
      overviewColours({ hasLogo: true, brandColoursSentAt: new Date('2026-10-31'), brandColoursSource: 'KERSIVO_CHOOSES' })
        .statusLabel,
    ).toBe(ADMIN_HUB_COLOURS_KERSIVO);
    expect(
      overviewColours({ hasLogo: true, brandColoursSentAt: new Date('2026-10-31'), brandColoursSource: 'LOGO' }),
    ).toMatchObject({ statusLabel: ADMIN_HUB_COLOURS_SENT, locked: true, submittedAt: new Date('2026-10-31').toISOString() });
    expect(formatBrandSubmittedDate('2026-11-02T12:00:00.000Z')).toBe('2 November 2026');
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
    expect(overviewActivityKind({ action: 'MARKED_READY', label: 'Preview ready' })).toBe('status');
    expect(overviewActivityKind({ action: 'hub_asset_uploaded', label: 'You added your logo' })).toBe('upload');
    expect(overviewActivityKind({ action: 'hub_asset_uploaded', label: 'You added 6 shop photos' })).toBe('upload');
    expect(overviewActivityKind({ action: 'ops_hub_message_sent', label: 'KERSIVO replied' })).toBe('message');
    expect(overviewActivityKind({ action: 'CREATED', label: 'Request received' })).toBe('status');
    expect(overviewActivityKind({ action: 'hub_changes_sent', label: 'Changes sent' })).toBe('change');
  });

  it('uses progress-bar stage names for status-change events', () => {
    expect(overviewActivityLabel({ action: 'CREATED', label: 'Request received' })).toBe('Requested');
    expect(overviewActivityLabel({ action: 'MARKED_READY', label: 'Preview ready' })).toBe('Review');
    expect(overviewActivityLabel({ action: 'CONVERTED', label: 'Subscribed' })).toBe('Launch');
    expect(overviewActivityLabel({ action: 'hub_live', label: 'Site live' })).toBe('Live');
    expect(overviewActivityLabel({ action: 'hub_message_sent', label: 'You sent a message' })).toBe('You sent a message');
    expect(overviewActivityLabel({ action: 'OWNER_EDITED_SERVICES', label: 'You updated your services' })).toBe(
      'You updated your services',
    );
    expect(overviewActivityLabel({ action: 'OWNER_EDITED_TEAM', label: 'You updated your team' })).toBe(
      'You updated your team',
    );
    expect(overviewActivityLabel({ action: 'OWNER_EDITED_WEBSITE_TEXT', label: 'You updated the text for your website' })).toBe(
      'You updated the text for your website',
    );
    expect(overviewActivityLabel({ action: 'OWNER_EDITED_PRODUCTS', label: 'You updated your products' })).toBe(
      'You updated your products',
    );
  });

  it('groups the latest five events by London day and uses compact relative time', () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    const groups = overviewActivityFeed(
      [
        { id: '1', action: 'MARKED_READY', label: 'Preview ready', at: now, relative: 'just now', absolute: '31 Oct 2026, 15:00' },
        { id: '2', action: 'hub_asset_uploaded', label: 'You added a logo', at: new Date('2026-10-30T12:00:00.000Z'), relative: 'yesterday', absolute: '30 Oct 2026, 12:00' },
        { id: '3', action: 'CREATED', label: 'Request received', at: new Date('2026-10-28T08:00:00.000Z'), relative: '3 days ago', absolute: '28 Oct 2026, 08:00' },
      ],
      now,
    );
    expect(groups.map((group) => [group.label, group.items.map((item) => item.label)])).toEqual([
      ['Today', ['Review']],
      ['Yesterday', ['You added a logo']],
      ['28 Oct', ['Requested']],
    ]);
    expect(formatOverviewCompactRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000), now)).toBe('2h ago');
    expect(overviewActivityDayLabel(new Date('2026-10-31T08:00:00.000Z'), now)).toBe('Today');
    expect(overviewHideAddMaterialsPrimary('requested')).toBe(true);
    expect(overviewHideAddMaterialsPrimary('review')).toBe(false);
  });

  it('builds website content thumbs and status rows, and treats empty as nothing added', () => {
    expect(
      overviewWebsiteContent({
        assets: [],
        aboutText: '  ',
        websiteExtraText: null,
      }),
    ).toMatchObject({ empty: true, logo: null, photos: [], photoTotal: 0, status: expect.any(Array) });

    const filled = overviewWebsiteContent({
      assets: [
        {
          id: 'old',
          kind: 'SHOP_PHOTO',
          hasThumb: true,
          contentType: 'image/jpeg',
          createdAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'new',
          kind: 'SHOP_PHOTO',
          hasThumb: true,
          contentType: 'image/jpeg',
          createdAt: '2026-10-31T10:00:00.000Z',
        },
        {
          id: 'mid',
          kind: 'SHOP_PHOTO',
          hasThumb: false,
          contentType: 'application/pdf',
          createdAt: '2026-10-20T10:00:00.000Z',
        },
        { id: 'logo', kind: 'LOGO', hasThumb: true, contentType: 'image/png', createdAt: '2026-10-02T10:00:00.000Z' },
        {
          id: 'team',
          kind: 'TEAM_PHOTO',
          hasThumb: true,
          contentType: 'image/jpeg',
          createdAt: '2026-10-03T10:00:00.000Z',
        },
        { id: 'file', kind: 'OTHER', hasThumb: false, contentType: 'application/pdf', createdAt: '2026-10-04T10:00:00.000Z' },
      ],
      aboutText: 'Family shop',
      websiteExtraText: null,
    });
    expect(filled.empty).toBe(false);
    expect(filled.photos.map((photo) => photo.id)).toEqual(['new', 'old']);
    expect(filled.photos[0]?.src).toBe('/api/admin-hub/assets/new?size=thumb');
    expect(filled.photoTotal).toBe(3);
    expect(filled.logo?.id).toBe('logo');
    expect(filled.status.map((row) => [row.id, row.value, row.href, row.done])).toEqual([
      ['logo', '✓', '/admin?app=materials&item=logo', true],
      ['photos', '3', '/admin?app=materials&item=photos', true],
      ['text', '✓', '/admin?app=materials&item=text', true],
      ['other', '1', '/admin?app=materials&item=other', true],
    ]);
    expect(
      overviewWebsiteContent({
        assets: [],
        aboutText: null,
        websiteExtraText: 'Walk-ins welcome',
      }).status.find((row) => row.id === 'text'),
    ).toMatchObject({ value: '✓', done: true });
    expect(
      overviewWebsiteContent({ assets: [], aboutText: null, websiteExtraText: null }).status.find(
        (row) => row.id === 'other',
      ),
    ).toBeUndefined();
  });

  it('keeps every requested tile in requested, designing, review and launch', () => {
    expect(overviewBentoTiles('requested')).toEqual(['progress', 'preview', 'content', 'colours', 'activity']);
    expect(overviewBentoTiles('designing')).toEqual(['progress', 'preview', 'content', 'colours', 'activity']);
    expect(overviewBentoTiles('review')).toEqual([
      'progress',
      'preview',
      'content',
      'changes',
      'colours',
      'activity',
    ]);
    expect(overviewBentoTiles('review', false)).toEqual(['progress', 'preview', 'content', 'colours', 'activity']);
    expect(overviewBentoTiles('launch')).toEqual([
      'progress',
      'preview',
      'content',
      'changes',
      'colours',
      'activity',
    ]);
    expect(overviewBentoTiles('expired')).toEqual([]);
  });

  it('snapshots grid-template-areas for each breakpoint', () => {
    expect(OVERVIEW_BENTO_AREAS).toEqual({
      mobile: ['progress', 'preview', 'content', 'changes', 'colours', 'activity'],
      tablet: [
        'progress progress progress progress progress progress',
        'preview preview preview colours colours colours',
        'changes changes changes content content content',
        'activity activity activity activity activity activity',
      ],
      desktop: [
        'progress progress progress progress progress progress progress progress preview preview preview preview',
        'colours colours colours colours colours colours colours colours preview preview preview preview',
        'changes changes changes changes changes changes changes changes content content content content',
        'activity activity activity activity activity activity activity activity activity activity activity activity',
      ],
    });
    expect(overviewBentoAreasCss(OVERVIEW_BENTO_AREAS.desktop)).toContain(
      '"colours colours colours colours colours colours colours colours preview preview preview preview"',
    );
    expect(OVERVIEW_BENTO_AREAS_NO_CHANGES).toEqual({
      mobile: ['progress', 'preview', 'content', 'colours', 'activity'],
      tablet: [
        'progress progress progress progress progress progress',
        'preview preview preview colours colours colours',
        'content content content content content content',
        'activity activity activity activity activity activity',
      ],
      desktop: [
        'progress progress progress progress progress progress progress progress preview preview preview preview',
        'colours colours colours colours colours colours colours colours preview preview preview preview',
        'content content content content content content content content content content content content',
        'activity activity activity activity activity activity activity activity activity activity activity activity',
      ],
    });
  });
});
