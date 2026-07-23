import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Team invitation resend UI', () => {
  const overview = readFileSync(
    resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
    'utf8',
  );

  it('wires Resend invitation action and per-card in-flight lock', () => {
    expect(overview).toMatch(/Resend invitation/);
    expect(overview).toMatch(/Resending…/);
    expect(overview).toMatch(/Invitation resent/);
    expect(overview).toMatch(/inviteResendInFlightRef/);
    expect(overview).toMatch(/\/api\/admin\/team\/invitations\//);
    expect(overview).toMatch(/TEAM_INVITE_RESEND_REFRESH_WARNING/);
    expect(overview).toMatch(/Copy invitation link|copyInviteAcceptPath/);
    expect(overview).toMatch(/inviteResendNetworkFailurePatch/);
    expect(overview).toMatch(/shouldShowInviteResendAction/);
    expect(overview).toMatch(/invitationsSectionRevealLabel/);
    expect(overview).toMatch(/passiveInvitationLabel/);
  });

  it('resend refreshes Team only — never onBarberSaved', () => {
    expect(overview).toMatch(/inviteResendPostMutationRefresh/);
    const handlerStart = overview.indexOf('async function handleResendInvitation');
    expect(handlerStart).toBeGreaterThan(-1);
    const nextFn = overview.indexOf('\n  async function ', handlerStart + 1);
    const handler = overview.slice(handlerStart, nextFn === -1 ? undefined : nextFn);
    expect(handler).toMatch(/inviteResendPostMutationRefresh/);
    expect(handler).toMatch(/loadTeam/);
    expect(handler).not.toMatch(/onBarberSaved/);
    expect(handler).not.toMatch(/Promise\.all/);
  });

  it('barbers-driven Team effect uses preserve mode', () => {
    expect(overview).toMatch(/barbersDrivenTeamRefreshOpts/);
    expect(overview).toMatch(
      /void loadTeam\(barbersDrivenTeamRefreshOpts\(\)\)/,
    );
    expect(overview).toMatch(/\[loadTeam, barbers\]/);
  });

  it('wizard onSent still refreshes Team and Barbers', () => {
    expect(overview).toMatch(/inviteCreationPostMutationRefresh/);
    const onSentStart = overview.indexOf('onSent={async () => {');
    expect(onSentStart).toBeGreaterThan(-1);
    const onSentEnd = overview.indexOf('}}', onSentStart);
    const onSent = overview.slice(onSentStart, onSentEnd);
    expect(onSent).toMatch(/inviteCreationPostMutationRefresh/);
    expect(onSent).toMatch(/onBarberSaved/);
    expect(onSent).toMatch(/loadTeam/);
    expect(onSent).toMatch(/Promise\.all/);
  });

  it('email-failure path keeps Copy invitation link wiring', () => {
    expect(overview).toMatch(/phase === 'email_failed'/);
    expect(overview).toMatch(/showCopyLink:\s*resendState\?\.phase === 'email_failed'/);
    expect(overview).toMatch(/Copy invitation link|copyInviteAcceptPath/);
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
