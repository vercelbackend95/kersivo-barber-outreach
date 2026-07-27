import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Team invitation resend UI', () => {
  const overview = readFileSync(
    resolve(process.cwd(), 'src/components/admin/BarbersOverview.tsx'),
    'utf8',
  );

  it('does not wire Resend invitation on roster cards', () => {
    expect(overview).not.toMatch(/Resend invitation/);
    expect(overview).not.toMatch(/handleResendInvitation/);
    expect(overview).not.toMatch(/inviteResend=/);
    expect(overview).not.toMatch(/copyInviteAcceptPath/);
    expect(overview).toMatch(/onlineBookingsOffRevealLabel/);
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

  it('roster card has no inviteResend controls', () => {
    const card = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminBarberRosterCard.tsx'),
      'utf8',
    );
    expect(card).not.toMatch(/inviteResend/);
    expect(card).not.toMatch(/Resend invitation/);
    expect(card).not.toMatch(/Copy invitation link/);
    expect(card).not.toMatch(/passiveInvitationLabel/);
    expect(card).not.toMatch(/\bActivate\b/);
  });

  it('profile Check the invite sheet still resends', () => {
    const sheet = readFileSync(
      resolve(process.cwd(), 'src/components/admin/TeamDashboardAccountSheet.tsx'),
      'utf8',
    );
    expect(sheet).toMatch(/\/resend/);
    expect(sheet).toMatch(/Resend/);
  });

  it('wizard surfaces pending and expired conflict copy', () => {
    const wizard = readFileSync(
      resolve(process.cwd(), 'src/components/admin/TeamInviteWizard.tsx'),
      'utf8',
    );
    expect(wizard).toMatch(/inviteCreationConflictMessage/);
  });
});
