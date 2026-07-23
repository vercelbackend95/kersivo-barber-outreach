import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Team invitation resend UI', () => {
  it('wires Resend invitation action and per-card in-flight lock', () => {
    const overview = readFileSync(
      resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
      'utf8',
    );
    expect(overview).toMatch(/Resend invitation/);
    expect(overview).toMatch(/Resending…/);
    expect(overview).toMatch(/Invitation resent/);
    expect(overview).toMatch(/inviteResendInFlightRef/);
    expect(overview).toMatch(/\/api\/admin\/team\/invitations\//);
    expect(overview).toMatch(/TEAM_INVITE_RESEND_REFRESH_WARNING/);
    expect(overview).toMatch(/Copy invitation link|copyInviteAcceptPath/);
    expect(overview).toMatch(/inviteResendNetworkFailurePatch/);
    expect(overview).toMatch(/preserveExistingCardsOnFailure:\s*true/);
    expect(overview).toMatch(/shouldShowInviteResendAction/);
    expect(overview).toMatch(/invitationsSectionRevealLabel/);
    expect(overview).toMatch(/passiveInvitationLabel/);
  });

  it('roster card exposes inviteResend controls without Activate', () => {
    const card = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminBarberRosterCard.tsx'),
      'utf8',
    );
    expect(card).toMatch(/inviteResend/);
    expect(card).toMatch(/Copy invitation link/);
    expect(card).toMatch(/showAction/);
    expect(card).toMatch(/passiveLabel|passiveInvitationLabel/);
    expect(card).not.toMatch(/\bActivate\b/);
  });

  it('wizard surfaces pending and expired conflict copy', () => {
    const wizard = readFileSync(
      resolve(process.cwd(), 'src/components/admin/TeamInviteWizard.tsx'),
      'utf8',
    );
    expect(wizard).toMatch(/inviteCreationConflictMessage/);
  });
});
