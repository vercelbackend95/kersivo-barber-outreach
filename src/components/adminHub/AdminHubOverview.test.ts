import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubOverview.astro'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'src/pages/admin.astro'), 'utf8');
const old = readFileSync(resolve(process.cwd(), 'src/components/previewHub/HubOverview.astro'), 'utf8');

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
    expect(src).toContain('data-tile="colours"');
    expect(src).not.toContain('data-tile="messages"');
    expect(src).not.toContain('admin-hub-bento__messages');
    expect(src).toContain('data-tile="changes"');
    expect(src).toContain('data-tile="activity"');
    expect(src).toContain('data-tile="add"');
    expect(src).toContain('data-admin-hub-app="materials"');
    expect(src).toContain('AdminHubSwatches');
    expect(src).toContain('AdminHubActivityFeed');
    expect(src).not.toContain('admin-hub-sw--empty');
    expect(src).toContain('overviewHideAddMaterialsPrimary');
    expect(src).toContain('overviewPreviewLocked');
    expect(src).toContain('overviewChangesLocked');
    expect(src).toContain('isOverviewTerminal');
    expect(src).toContain('HUB_PREVIEW_CARD_LOCKED');
    expect(src).toContain('HUB_LOCKED_REASON_PREVIEW');
    expect(src).toContain('chrome="checkout-outline"');
    expect(src).toContain('admin-hub-progress__steps');
    expect(src).toContain('aria-current');
    expect(src).toContain('websiteBuildProgressFromHubStage');
    expect(src).not.toContain('admin-hub-nowbox--you');
    expect(src).not.toContain('admin-hub-stages');
    expect(src).not.toContain('formatOverviewStepDate');
  });

  it('links tiles to apps and sections without a token', () => {
    expect(src).toContain('hrefs.preview');
    expect(src).toContain('hrefs.booking');
    expect(src).toContain('hrefs.colours');
    expect(src).toContain('hrefs.changes');
    expect(src).toContain('hrefs.activity');
    expect(src).not.toContain('/preview/');
    expect(src).not.toContain('publicToken');
    expect(src).not.toContain('app=services');
    expect(src).not.toContain('app=team');
  });
});
