import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const overview = readFileSync(path.join(process.cwd(), 'src/components/previewHub/HubOverview.astro'), 'utf8');
const shell = readFileSync(path.join(process.cwd(), 'src/components/previewHub/HubShell.astro'), 'utf8');

describe('HubOverview key UI states', () => {
  it('uses the copy module for headers, Now, primary actions and help', () => {
    expect(overview).toContain('hubHeaderCopy');
    expect(overview).toContain('HUB_NOW');
    expect(overview).toContain('HUB_PRIMARY');
    expect(overview).toContain('HUB_PREVIEW_CARD_LOCKED');
    expect(overview).toContain('HUB_ACTIVITY_EMPTY');
    expect(overview).toContain('HUB_HELP_TITLE');
  });

  it('renders a designed expired CTA that stays disabled until Batch 3', () => {
    expect(overview).toContain('expiredDisabled');
    expect(overview).toContain('HUB_AVAILABLE_SOON');
    expect(overview).toContain('disabled');
    expect(overview).toContain('HUB_PRIMARY.expired');
  });

  it('shows the Review subscribe control in the Overview header', () => {
    expect(overview).toContain('canCheckout');
    expect(overview).toContain('chrome="checkout"');
  });
});

describe('HubShell', () => {
  it('has a skip link, private label, stage pill and locked-tab reason', () => {
    expect(shell).toContain('hub-shell__skip');
    expect(shell).toContain('Skip to content');
    expect(shell).toContain('HUB_PRIVATE_LABEL');
    expect(shell).toContain('HUB_STAGE_PILL');
    expect(shell).toContain('HUB_LOCKED_REASON_PREVIEW');
    expect(shell).toContain('aria-label="Hub sections"');
    expect(shell).toContain('aria-label="Hub pages"');
  });
});
