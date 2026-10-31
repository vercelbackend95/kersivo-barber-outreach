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
    expect(overview).toContain('HUB_CHECKLIST_TITLE');
    expect(overview).toContain('checklist');
  });

  it('sends declined and expired primary actions to the messages composer with a draft', () => {
    expect(overview).toContain('messages?draft=message');
    expect(overview).toContain('messages?draft=reopen');
    expect(overview).toContain('HUB_PRIMARY[state.stage]');
    expect(overview).not.toContain('expiredDisabled');
  });

  it('shows launch progress and live next-step cards from the copy module', () => {
    expect(overview).toContain('HUB_LAUNCH_YOUR_STEPS');
    expect(overview).toContain('HUB_LAUNCH_OUR_STEPS');
    expect(overview).toContain('HUB_LAUNCH_FINISH_DASHBOARD');
    expect(overview).toContain('HUB_LIVE_NEXT_TITLE');
    expect(overview).toContain('HUB_LIVE_NEXT_GOOGLE');
    expect(overview).toContain('HUB_LIVE_NEXT_RETAIL');
    expect(overview).not.toContain('launchRetail');
    expect(overview).not.toContain('launchDeposits');
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
    expect(shell).toContain('unreadMessages');
    expect(shell).toContain('hub-unread');
  });
});
