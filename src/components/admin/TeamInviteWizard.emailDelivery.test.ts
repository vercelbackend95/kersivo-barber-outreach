import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('TeamInviteWizard email delivery UI', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/admin/TeamInviteWizard.tsx'), 'utf8');

  it('shows Invitation sent for successful email delivery', () => {
    expect(src).toMatch(/Invitation sent/);
    expect(src).toMatch(/The invitation was sent to \$\{email\.trim\(\)\}/);
  });

  it('does not claim Invite sent when email delivery fails', () => {
    expect(src).not.toMatch(/'Invite sent'/);
    expect(src).not.toMatch(/`Invite sent/);
    expect(src).toMatch(/Invitation created — email not sent/);
    expect(src).toMatch(/inviteEmailSent/);
    expect(src).toMatch(/emailSent !== false/);
  });

  it('exposes Copy invitation link for email failure', () => {
    expect(src).toMatch(/Copy invitation link/);
    expect(src).toMatch(/new URL\(inviteAcceptPath, window\.location\.origin\)/);
    expect(src).toMatch(/Invitation link copied/);
    expect(src).toMatch(/Could not copy the invitation link\./);
  });

  it('does not console-log invitation tokens or URLs', () => {
    expect(src).not.toMatch(/console\.(log|info|debug).*acceptPath/);
    expect(src).not.toMatch(/console\.(log|info|debug).*token/);
  });
});
