import { describe, expect, it } from 'vitest';
import {
  dashboardAccessOnlyLine,
  memberCardStatus,
  onlineBookingsStateLabel,
  onlineBookingsToggleHint,
  pendingOnlineBookingsLine,
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

describe('memberCardStatus', () => {
  it('maps NEW to new and ACTIVE to active', () => {
    expect(memberCardStatus('NEW')).toBe('new');
    expect(memberCardStatus('ACTIVE')).toBe('active');
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

  it('Manager + joined + online bookings off', () => {
    const c = card({ kind: 'member', id: 'm2', role: 'MANAGER', bookable: false });
    const access = teamAccountAccess(c);
    expect(roleLabel(c.role)).toBe('Manager');
    expect(teamAccountAccessLabel(access)).toBe('Joined');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe('Online bookings: Off');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBe('Dashboard access only');
    expect(teamProfileSummary(c.role, access)).toBe('Manager · Joined');
  });

  it('Barber + pending invitation (bookable)', () => {
    const c = card({ kind: 'invite', id: 'inv1', role: 'BARBER', bookable: true });
    const access = teamAccountAccess(c);
    expect(roleLabel(c.role)).toBe('Barber');
    expect(teamAccountAccessLabel(access)).toBe('Invite pending');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe(
      'Online bookings will start after joining',
    );
    expect(pendingOnlineBookingsLine(true)).toBe('Online bookings will start after joining');
    expect(dashboardAccessOnlyLine(access, c.bookable)).toBeNull();
  });

  it('Barber + pending invitation (not bookable)', () => {
    const c = card({ kind: 'invite', id: 'inv2', role: 'MANAGER', bookable: false });
    const access = teamAccountAccess(c);
    expect(teamAccountAccessLabel(access)).toBe('Invite pending');
    expect(teamCardOnlineBookingsLine(access, c.bookable)).toBe(
      'Dashboard access only after joining',
    );
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

  it('does not emit Active/Inactive, Bookable, Not bookable, or Hidden labels', () => {
    const labels = [
      onlineBookingsStateLabel(true),
      onlineBookingsStateLabel(false),
      pendingOnlineBookingsLine(true),
      pendingOnlineBookingsLine(false),
      teamAccountAccessLabel('joined'),
      teamAccountAccessLabel('invite_pending'),
      teamAccountAccessLabel('no_dashboard'),
      onlineBookingsToggleHint(true, 'joined'),
      onlineBookingsToggleHint(false, 'joined'),
      onlineBookingsToggleHint(false, 'no_dashboard'),
    ];
    const joined = labels.join('\n');
    expect(joined).not.toMatch(/\bActive\b|\bInactive\b/);
    expect(joined).not.toMatch(/Bookable|Not bookable|Hidden/);
  });
});
