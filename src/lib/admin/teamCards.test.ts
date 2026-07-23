import { describe, expect, it } from 'vitest';
import {
  canActorSetUpOnlineBookings,
  dashboardAccessOnlyLine,
  isJoinedTeamMemberStatus,
  isPendingInviteCard,
  memberCardStatus,
  onlineBookingsStateLabel,
  onlineBookingsToggleHint,
  partitionTeamCards,
  pendingInvitationsRevealLabel,
  roleLabel,
  teamAccountAccess,
  teamAccountAccessLabel,
  teamCardOnlineBookingsLine,
  teamProfileSummary,
  type TeamCardDto,
} from './teamCards';

function card(partial: Partial<TeamCardDto> & Pick<TeamCardDto, 'kind' | 'id' | 'role' | 'bookable'>): Pick<
  TeamCardDto,
  'kind' | 'id' | 'role' | 'bookable'
> {
  return partial;
}

describe('canActorSetUpOnlineBookings', () => {
  it('allows Owner to set up Owner, Manager, and Barber members', () => {
    expect(canActorSetUpOnlineBookings('OWNER', 'OWNER')).toBe(true);
    expect(canActorSetUpOnlineBookings('OWNER', 'MANAGER')).toBe(true);
    expect(canActorSetUpOnlineBookings('OWNER', 'BARBER')).toBe(true);
  });

  it('allows Manager to set up Barber members only', () => {
    expect(canActorSetUpOnlineBookings('MANAGER', 'BARBER')).toBe(true);
    expect(canActorSetUpOnlineBookings('MANAGER', 'MANAGER')).toBe(false);
    expect(canActorSetUpOnlineBookings('MANAGER', 'OWNER')).toBe(false);
  });

  it('blocks Barber actors', () => {
    expect(canActorSetUpOnlineBookings('BARBER', 'BARBER')).toBe(false);
  });
});

describe('isJoinedTeamMemberStatus', () => {
  it('treats NEW and ACTIVE as joined', () => {
    expect(isJoinedTeamMemberStatus('NEW')).toBe(true);
    expect(isJoinedTeamMemberStatus('ACTIVE')).toBe(true);
  });
});

describe('memberCardStatus', () => {
  it('maps NEW and ACTIVE to active (joined list)', () => {
    expect(memberCardStatus('NEW')).toBe('active');
    expect(memberCardStatus('ACTIVE')).toBe('active');
  });
});

describe('partitionTeamCards', () => {
  it('keeps Online bookings Off members and orphans in the main list; only invites pending', () => {
    const cards = [
      card({ kind: 'member', id: 'm1', role: 'BARBER', bookable: false }),
      card({ kind: 'member', id: 'barber:b1', role: 'BARBER', bookable: false }),
      card({ kind: 'invite', id: 'inv1', role: 'BARBER', bookable: true }),
      card({ kind: 'member', id: 'm2', role: 'MANAGER', bookable: true }),
    ];
    const { joinedCards, pendingInviteCards } = partitionTeamCards(cards);
    expect(joinedCards.map((c) => c.id)).toEqual(['m1', 'barber:b1', 'm2']);
    expect(pendingInviteCards.map((c) => c.id)).toEqual(['inv1']);
    expect(pendingInviteCards.every(isPendingInviteCard)).toBe(true);
  });
});

describe('pendingInvitationsRevealLabel', () => {
  it('uses singular and plural invitation copy', () => {
    expect(pendingInvitationsRevealLabel(1)).toBe('Show 1 pending invitation');
    expect(pendingInvitationsRevealLabel(3)).toBe('Show 3 pending invitations');
  });
});

describe('Team card presentation mapping', () => {
  it('Owner + joined + online bookings on', () => {
    const c = card({ kind: 'member', id: 'm1', role: 'OWNER', bookable: true });
    const access = teamAccountAccess(c);
    expect(roleLabel(c.role)).toBe('Owner');
    expect(teamAccountAccessLabel(access)).toBe('Joined');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: On');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBeNull();
    expect(teamProfileSummary(c.role, access)).toBe('Owner · Joined');
  });

  it('legacy NEW member still presents as Joined', () => {
    const c = card({ kind: 'member', id: 'm-legacy', role: 'BARBER', bookable: true });
    expect(teamAccountAccessLabel(teamAccountAccess(c))).toBe('Joined');
    expect(memberCardStatus('NEW')).toBe('active');
  });

  it('Manager + joined + online bookings off', () => {
    const c = card({ kind: 'member', id: 'm2', role: 'MANAGER', bookable: false });
    const access = teamAccountAccess(c);
    expect(roleLabel(c.role)).toBe('Manager');
    expect(teamAccountAccessLabel(access)).toBe('Joined');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: Off');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBe('Dashboard access only');
    expect(teamProfileSummary(c.role, access)).toBe('Manager · Joined');
  });

  it('Barber + pending invitation with online bookings on', () => {
    const c = card({
      kind: 'invite',
      id: 'inv1',
      role: 'BARBER',
      bookable: true,
      invitationStatus: 'pending',
    });
    const access = teamAccountAccess(c as TeamCardDto);
    expect(roleLabel(c.role)).toBe('Barber');
    expect(teamAccountAccessLabel(access)).toBe('Invitation pending');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: On');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBeNull();
  });

  it('Barber + expired invitation', () => {
    const c = card({
      kind: 'invite',
      id: 'inv-exp',
      role: 'BARBER',
      bookable: true,
      invitationStatus: 'expired',
    });
    const access = teamAccountAccess(c as TeamCardDto);
    expect(teamAccountAccessLabel(access)).toBe('Invitation expired');
  });

  it('Barber + pending invitation with online bookings off', () => {
    const c = card({
      kind: 'invite',
      id: 'inv2',
      role: 'BARBER',
      bookable: false,
      invitationStatus: 'pending',
    });
    const access = teamAccountAccess(c as TeamCardDto);
    expect(teamAccountAccessLabel(access)).toBe('Invitation pending');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: Off');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBe('Dashboard access only');
  });

  it('Roster-only Barber without dashboard account', () => {
    const c = card({ kind: 'member', id: 'barber:b1', role: 'BARBER', bookable: true });
    const access = teamAccountAccess(c);
    expect(access).toBe('no_dashboard');
    expect(roleLabel(c.role)).toBe('Barber');
    expect(teamAccountAccessLabel(access)).toBe('No dashboard account');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: On');
    expect(teamProfileSummary(c.role, access)).toBe('Barber · No dashboard account');
  });

  it('does not emit Activate, Awaiting activation, or join-coupled booking copy', () => {
    const labels = [
      onlineBookingsStateLabel(true),
      onlineBookingsStateLabel(false),
      teamCardOnlineBookingsLine('invite_pending', true),
      teamCardOnlineBookingsLine('invite_pending', false),
      teamAccountAccessLabel('joined'),
      teamAccountAccessLabel('invite_pending'),
      teamAccountAccessLabel('invite_expired'),
      teamAccountAccessLabel('no_dashboard'),
      onlineBookingsToggleHint(true, 'joined'),
      onlineBookingsToggleHint(false, 'joined'),
      onlineBookingsToggleHint(false, 'no_dashboard'),
      pendingInvitationsRevealLabel(2),
    ];
    const joined = labels.join('\n');
    expect(joined).not.toMatch(/\bActive\b|\bInactive\b/);
    expect(joined).not.toMatch(/Bookable|Not bookable|Hidden/);
    expect(joined).not.toMatch(/will start after joining|after joining/);
    expect(joined).not.toMatch(/Activate|Reactivate|Awaiting activation|Invite pending/);
    expect(joined).toContain('Invitation pending');
    expect(joined).toContain('Invitation expired');
  });
});
