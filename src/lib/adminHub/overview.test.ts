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
  overviewShopTile,
  overviewShowLaunch,
  overviewShowShopTile,
  overviewStagePill,
  overviewTileHrefs,
  overviewUnreadLabel,
  overviewWebsiteContent,
  shopInitials,
  OVERVIEW_BENTO_AREAS,
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
    expect(withBrand.swatches.map((swatch) => [swatch.hex, swatch.css, swatch.role])).toEqual([
      ['#1F6F6B', '#1F6F6B', 'Main'],
      ['#C9A24A', '#C9A24A', 'Accent'],
    ]);
    expect(
      overviewColours({
        hasLogo: true,
        brandPrimaryColour: 'rgb(31, 111, 107)',
      }).swatches.map((swatch) => swatch.hex),
    ).toEqual(['#1F6F6B']);
    expect(
      overviewColours({
        hasLogo: true,
        brandPrimaryColour: 'not-a-colour',
        brandPaletteExtracted: [{ hex: 'oklch(0.5 0.1 20)' }],
      }).swatches,
    ).toEqual([]);
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
    ).toMatchObject({ empty: true, thumbs: [], status: expect.any(Array) });

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
    expect(filled.thumbs.map((thumb) => thumb.id)).toEqual(['new', 'old']);
    expect(filled.thumbs[0]?.src).toBe('/api/admin-hub/assets/new?size=thumb');
    expect(filled.status.map((row) => [row.id, row.value, row.href, row.done])).toEqual([
      ['logo', '✓', '/admin?app=materials&item=logo', true],
      ['photos', '3', '/admin?app=materials&item=photos', true],
      ['team-photos', '1', '/admin?app=materials&item=team-photos', true],
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

  it('builds shop rows with counts or first-add links, and hides without draft-shop admin access', () => {
    expect(overviewShowShopTile('requested')).toBe(true);
    expect(overviewShowShopTile('designing')).toBe(true);
    expect(overviewShowShopTile('review')).toBe(true);
    expect(overviewShowShopTile('launch')).toBe(false);
    expect(overviewShopTile({ stage: 'launch', counts: { activeServices: 2, activeBarbers: 1, products: 3 } })).toEqual({
      show: false,
      rows: [],
    });
    expect(overviewShopTile({ stage: 'review', counts: null }).rows).toEqual([
      { id: 'team', name: 'Team', detail: 'Add your first team member', href: '/admin/team?add=1', empty: true },
      { id: 'services', name: 'Services', detail: 'Add your first service', href: '/admin/services?add=1', empty: true },
      { id: 'products', name: 'Products', detail: 'Add your first product', href: '/admin/products?add=1', empty: true },
    ]);
    expect(
      overviewShopTile({
        stage: 'requested',
        counts: { activeServices: 2, activeBarbers: 1, products: 4 },
      }).rows,
    ).toEqual([
      { id: 'team', name: 'Team', detail: '1 team member', href: '/admin/team', empty: false },
      { id: 'services', name: 'Services', detail: '2 services', href: '/admin/services', empty: false },
      { id: 'products', name: 'Products', detail: '4 products', href: '/admin/products', empty: false },
    ]);
  });

  it('keeps every requested tile in requested, designing, review and launch', () => {
    for (const stage of ['requested', 'designing', 'review'] as const) {
      expect(overviewBentoTiles({ stage, showShop: true })).toEqual([
        'progress',
        'preview',
        'content',
        'shop',
        'changes',
        'colours',
        'activity',
      ]);
    }
    expect(overviewBentoTiles({ stage: 'launch', showShop: false })).toEqual([
      'progress',
      'preview',
      'content',
      'changes',
      'colours',
      'activity',
    ]);
    expect(overviewBentoTiles({ stage: 'expired', showShop: false })).toEqual([]);
  });

  it('snapshots grid-template-areas for each breakpoint', () => {
    expect(OVERVIEW_BENTO_AREAS).toEqual({
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
    });
    expect(overviewBentoAreasCss(OVERVIEW_BENTO_AREAS.desktop)).toContain(
      '"content content content content shop shop shop shop preview preview preview preview"',
    );
  });
});
