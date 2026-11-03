import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubOverview.astro'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'src/pages/admin.astro'), 'utf8');
const old = readFileSync(resolve(process.cwd(), 'src/components/previewHub/HubOverview.astro'), 'utf8');
const contentTile = readFileSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubContentTile.tsx'), 'utf8');
const coloursTile = readFileSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubColoursTile.tsx'), 'utf8');
const previewPhone = readFileSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubPreviewPhone.tsx'), 'utf8');
const hubCss = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');
const fabCss = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-mobile-fab.css'), 'utf8');
const lockedChanges = readFileSync(resolve(process.cwd(), 'src/pages/admin/changes.astro'), 'utf8');
const lockedWebsite = readFileSync(resolve(process.cwd(), 'src/pages/admin/website.astro'), 'utf8');

describe('AdminHubOverview', () => {
  it('is the /admin Overview and leaves the old hub overview for the flag-off path', () => {
    expect(page).toContain('AdminHubOverview');
    expect(page).not.toContain("import HubOverview from '@/components/previewHub/HubOverview.astro'");
    expect(old).toContain('hub-overview');
    expect(src).not.toContain('<iframe');
    expect(src).not.toContain('Northgate');
  });

  it('renders the bento tiles and stage variants', () => {
    expect(src).toContain('data-tile="progress"');
    expect(src).toContain('data-tile="preview"');
    expect(src).toContain('<AdminHubContentTile client:load initialState={liveState}');
    expect(contentTile).toContain('data-tile="content"');
    expect(src).not.toContain('data-tile="shop"');
    expect(src).toContain('<AdminHubColoursTile client:load initialState={liveState}');
    expect(coloursTile).toContain('data-tile="colours"');
    expect(src).toContain('<AdminHubPreviewPhone client:load initialState={liveState}');
    expect(previewPhone).toContain('admin-hub-phone__screen');
    expect(src).not.toContain('data-tile="messages"');
    expect(src).not.toContain('admin-hub-bento__messages');
    expect(src).toContain('data-tile="changes"');
    expect(src).toContain('data-tile="activity"');
    expect(src).not.toContain('data-tile="add"');
    expect(src).not.toContain('admin-hub-add-tile');
    expect(src).not.toContain('admin-hub-bento__add');
    expect(contentTile).toContain('variant="icon"');
    // Empty Website content: the round "+" in the tile head is the only add control.
    expect(contentTile).toMatch(/<div className="admin-hub-content-empty">\s*<p>\{ADMIN_HUB_CONTENT_EMPTY\}<\/p>\s*<\/div>/);
    expect(contentTile).not.toContain('admin-hub-content-add');
    expect(src).not.toContain('admin-hub-content-add');
    expect(src).not.toContain('ADMIN_HUB_ADD_TILE');
    expect(hubCss).not.toMatch(/\.admin-hub-content-empty \{[^}]*margin-top: auto/);
    // Swatches render inside the live colours tile (P7); the old island is gone.
    expect(src).not.toContain('AdminHubSwatches');
    expect(coloursTile).toContain('admin-hub-palette');
    expect(src).toContain('AdminHubOverviewAnnouncer');
    expect(src).toContain('AdminHubActivityFeed');
    expect(src).not.toContain('admin-hub-sw--empty');
    expect(src).toContain('overviewHideAddMaterialsPrimary');
    expect(src).toContain('AdminHubAddMenu');
    expect(src).toContain('showMobileFab');
    expect(src).toContain('admin-has-mobile-fab');
    expect(src).toContain('overviewAddMenuFromHub');
    expect(src).not.toContain('HUB_PRIMARY.requested');
    expect(src).not.toContain('HUB_PRIMARY.designing');
    expect(src).toContain('overviewPreviewLocked');
    expect(src).toContain('overviewShowChangesTile');
    expect(src).toContain('admin-hub-bento--no-changes');
    expect(src).toContain('isOverviewTerminal');
    expect(src).toContain('HUB_PREVIEW_CARD_LOCKED');
    expect(src).not.toContain('HUB_LOCKED_REASON_PREVIEW');
    expect(src).not.toContain('ADMIN_HUB_ACTIVITY_SHOW_ALL');
    expect(src).toContain('chrome="checkout-outline"');
    expect(src).toContain('admin-hub-progress__steps');
    expect(src).toContain('aria-current');
    expect(src).toContain('websiteBuildProgressFromHubStage');
    expect(src).not.toContain('admin-hub-nowbox--you');
    expect(src).not.toContain('admin-hub-stages');
    expect(src).not.toContain('formatOverviewStepDate');
    expect(src).toContain('admin-section-header');
    expect(src).toContain('admin-section-header-title');
    expect(src).toContain('{header.h1}');
    expect(src).toContain('admin-section-header-desc');
    expect(src).toContain('admin-section-header-actions');
    expect(src).not.toContain('admin-hub-head');
    expect(src).not.toContain('admin-hub-head__eyebrow');
    expect(src).not.toContain('<h1>');
    expect(src).not.toContain('HUB_NAV.overview');
    expect(hubCss).not.toContain('admin-hub-head');
    expect(hubCss).toContain('.admin-hub-messages > .admin-section-header');
    expect(fabCss).toContain('.admin-section-header-actions .admin-hub-add-menu');
    expect(fabCss).toContain('.admin-section-header-actions:has(.admin-hub-add-menu)');
    expect(lockedChanges).toContain('AdminSectionHeader');
    expect(lockedChanges).not.toContain('admin-hub-head');
    expect(lockedWebsite).toContain('AdminSectionHeader');
    expect(lockedWebsite).not.toContain('admin-hub-head');
  });

  it('links tiles to apps and sections without a token', () => {
    expect(src).toContain('hrefs.preview');
    expect(src).toContain('hrefs.booking');
    expect(coloursTile).toContain('overviewTileHrefs().colours');
    expect(coloursTile).toContain('className="admin-hub-tile admin-hub-bento__colours"');
    const colours = coloursTile;
    expect(colours).not.toContain('admin-hub-tile__hit');
    expect(colours).not.toContain('<button');
    expect(colours).toContain('className="admin-hub-colours-logos"');
    expect(colours).toContain('admin-hub-palette--loading');
    expect(colours).toContain('colours?.href ?? overviewTileHrefs().colours');
    expect(colours).toContain('colours.locked');
    expect(colours).toContain('data-locked');
    expect(colours).toContain("event.key === ' '");
    expect(src).toContain('hrefs.changes');
    expect(src).toContain('hrefs.activity');
    expect(contentTile).toContain('overviewWebsiteContent');
    expect(src).not.toContain('overviewShopTile');
    expect(src).not.toContain('admin-hub-bento--no-shop');
    expect(src).not.toContain('AdminHubSetupCard');
    expect(src).not.toContain('admin-hub-setup--mobile');
    expect(src).not.toContain('/preview/');
    expect(src).not.toContain('publicToken');
    expect(src).not.toContain('app=services');
    expect(src).not.toContain('app=team');
  });

  it('keeps bento source order as mobile / screen-reader order', () => {
    const start = src.indexOf('admin-hub-bento');
    const bento = src.slice(start, src.lastIndexOf('admin-hub-bento__activity'));
    const islands: Record<string, string> = { AdminHubContentTile: 'content', AdminHubColoursTile: 'colours' };
    const tiles = [...bento.matchAll(/data-tile="([^"]+)"|<(AdminHubContentTile|AdminHubColoursTile) /g)].map(
      (match) => match[1] ?? islands[match[2]!],
    );
    const first = tiles.filter((id, index) => tiles.indexOf(id) === index);
    expect(first).toEqual(['progress', 'preview', 'content', 'changes', 'colours']);
  });

  it('links the locked preview tile and Activity arrow, and hides Changes until preview is ready', () => {
    const locked = src.slice(src.indexOf('previewLocked'), src.indexOf('<AdminHubContentTile'));
    expect(locked).toContain('admin-hub-tile__hit');
    expect(locked).toContain('hrefs.preview');
    expect(locked).toContain('admin-hub-tile__open');
    expect(src).toContain('aria-label="Open activity"');
    expect(src).toContain('hrefs.activity');
    expect(src).toContain('showChanges');
    const changesBlock = src.slice(src.indexOf('showChanges ? ('), src.indexOf('<AdminHubColoursTile'));
    expect(changesBlock).toContain('data-tile="changes"');
    expect(changesBlock).not.toContain('admin-hub-tile--locked');
  });
});
