import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokenHubLinks } from '@/lib/adminHub/links';

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
    expect(overview).toContain("links.messagesDraft('message')");
    expect(overview).toContain("links.messagesDraft('reopen')");
    expect(tokenHubLinks('tok').messagesDraft('message')).toBe('/preview/tok/messages?draft=message');
    expect(tokenHubLinks('tok').messagesDraft('reopen')).toBe('/preview/tok/messages?draft=reopen');
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

  it('shows the Review subscribe control in the Overview header as secondary chrome', () => {
    expect(overview).toContain('canCheckout');
    expect(overview).toContain('chrome="checkout"');
    expect(overview).toContain('class="btn btn--primary"');
    expect(overview).toContain('HUB_PRIMARY');
  });

  it('uses a phone-frame placeholder, not an iframe, for the preview card', () => {
    expect(overview).toContain('hub-phone-frame');
    expect(overview).toContain('HUB_PREVIEW_OPEN_WEBSITE');
    expect(overview).toContain('HUB_PREVIEW_TRY_BOOKING');
    expect(overview).not.toMatch(/<iframe[\s\S]*hub-phone-frame|hub-phone-frame[\s\S]*<iframe/);
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

  it('shows the KERSIVO wordmark, outline tab icons and a lock on locked tabs', () => {
    expect(shell).toContain('hub-topbar__mark');
    expect(shell).toContain('hub-tabs__icon');
    expect(shell).toContain('aria-hidden="true"');
    expect(shell).toContain('hub-tabs__lock');
    expect(shell).toContain('hub-count');
    expect(shell).toContain('${tab.label} ${openChanges} open');
  });
});
