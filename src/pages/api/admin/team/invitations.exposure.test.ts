import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  invitationLifecycleStatus,
  inviteCardInvitationFields,
  inviteCreationConflictMessage,
  partitionTeamCards,
  teamAccountAccess,
  teamAccountAccessLabel,
  type TeamCardDto,
} from '@/lib/admin/teamCards';

function card(
  partial: Partial<TeamCardDto> & Pick<TeamCardDto, 'kind' | 'id' | 'role' | 'bookable'>,
): Pick<TeamCardDto, 'kind' | 'id' | 'role' | 'bookable' | 'invitationStatus'> {
  return {
    invitationStatus: null,
    ...partial,
  };
}

describe('GET /api/admin/team invitation exposure', () => {
  it('query no longer filters out expired invites by expiresAt', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/team/index.ts'), 'utf8');
    expect(src).toMatch(/acceptedAt:\s*null/);
    expect(src).not.toMatch(/expiresAt:\s*\{\s*gt:/);
    expect(src).toMatch(/inviteCardInvitationFields/);
    expect(src).toMatch(/emptyInvitationFields/);
  });

  it('maps pending and expired invitation labels', () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    expect(invitationLifecycleStatus(new Date('2026-07-24T12:00:00.000Z'), now)).toBe('pending');
    expect(invitationLifecycleStatus(new Date('2026-07-22T12:00:00.000Z'), now)).toBe('expired');

    const pending = card({
      kind: 'invite',
      id: 'inv-p',
      role: 'BARBER',
      bookable: true,
      invitationStatus: 'pending',
    });
    const expired = card({
      kind: 'invite',
      id: 'inv-e',
      role: 'BARBER',
      bookable: false,
      invitationStatus: 'expired',
    });
    expect(teamAccountAccessLabel(teamAccountAccess(pending))).toBe('Invitation pending');
    expect(teamAccountAccessLabel(teamAccountAccess(expired))).toBe('Invitation expired');
  });

  it('keeps valid and expired invites in the invitations section', () => {
    const cards = [
      card({ kind: 'member', id: 'm1', role: 'BARBER', bookable: false }),
      card({
        kind: 'invite',
        id: 'inv-p',
        role: 'BARBER',
        bookable: true,
        invitationStatus: 'pending',
      }),
      card({
        kind: 'invite',
        id: 'inv-e',
        role: 'MANAGER',
        bookable: false,
        invitationStatus: 'expired',
      }),
      card({ kind: 'member', id: 'barber:b1', role: 'BARBER', bookable: false }),
    ];
    const { joinedCards, pendingInviteCards } = partitionTeamCards(cards);
    expect(joinedCards.map((c) => c.id)).toEqual(['m1', 'barber:b1']);
    expect(pendingInviteCards.map((c) => c.id)).toEqual(['inv-p', 'inv-e']);
  });

  it('sets canResendInvitation from actor role', () => {
    const expiresAt = new Date('2026-08-01T00:00:00.000Z');
    expect(
      inviteCardInvitationFields({
        expiresAt,
        inviteRole: 'BARBER',
        actorRole: 'OWNER',
      }).canResendInvitation,
    ).toBe(true);
    expect(
      inviteCardInvitationFields({
        expiresAt,
        inviteRole: 'MANAGER',
        actorRole: 'MANAGER',
      }).canResendInvitation,
    ).toBe(false);
  });
});

describe('inviteCreationConflictMessage', () => {
  it('returns customer-facing pending and expired copy', () => {
    expect(inviteCreationConflictMessage('INVITATION_ALREADY_PENDING')).toMatch(
      /resend it from the pending invitations section/,
    );
    expect(inviteCreationConflictMessage('EXPIRED_INVITATION_EXISTS')).toMatch(
      /renew it from the invitations section/,
    );
    expect(inviteCreationConflictMessage('OTHER')).toBeNull();
  });
});

describe('GET /api/admin/team remains read-only', () => {
  it('does not write on GET', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/team/index.ts'), 'utf8');
    expect(src).not.toMatch(/\.create\(/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\$transaction/);
  });
});
