import { describe, expect, it } from 'vitest';
import type { TeamCardDto } from './teamCards';
import {
  applyMemberBookingProfileSetupToCards,
  assertOptimisticSetupCardState,
  combineSetupRefreshResults,
} from './memberBookingProfileSetup';

function memberCard(overrides: Partial<TeamCardDto> = {}): TeamCardDto {
  return {
    kind: 'member',
    id: 'mem-1',
    role: 'BARBER',
    name: 'Alex',
    email: 'alex@example.com',
    cardStatus: 'active',
    bookable: false,
    barberId: null,
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    barber: null,
    canManageOnlineBookings: false,
    canSetUpOnlineBookings: true,
    invitationStatus: null,
    inviteExpiresAt: null,
    canResendInvitation: false,
    ...overrides,
  };
}

describe('applyMemberBookingProfileSetupToCards', () => {
  it('patches only the matching member card to bookable with setup disabled', () => {
    const other = memberCard({ id: 'mem-2', name: 'Other', canSetUpOnlineBookings: true });
    const invite: TeamCardDto = {
      ...memberCard({ id: 'inv-1', kind: 'invite', cardStatus: 'pending' }),
      invitationStatus: 'pending',
      inviteExpiresAt: '2026-08-01T00:00:00.000Z',
      canResendInvitation: true,
    };
    const cards = [memberCard(), other, invite];
    const next = applyMemberBookingProfileSetupToCards(cards, {
      memberId: 'mem-1',
      barberId: 'b-new',
      name: 'Alex Online',
      email: 'alex@example.com',
      avatarUrl: 'https://cdn.example/a.jpg',
      serviceIds: ['svc-1'],
      active: true,
    });

    const patched = next.find((c) => c.id === 'mem-1');
    expect(patched).toBeTruthy();
    const state = assertOptimisticSetupCardState(patched);
    expect(state.joined).toBe(true);
    expect(state.bookable).toBe(true);
    expect(state.canSetUp).toBe(false);
    expect(patched?.barberId).toBe('b-new');
    expect(patched?.canManageOnlineBookings).toBe(true);
    expect(patched?.barber?.serviceIds).toEqual(['svc-1']);
    expect(patched?.role).toBe('BARBER');
    expect(patched?.createdAt).toBe('2026-01-01T00:00:00.000Z');

    expect(next.find((c) => c.id === 'mem-2')?.canSetUpOnlineBookings).toBe(true);
    expect(next.find((c) => c.id === 'inv-1')?.kind).toBe('invite');
  });

  it('keeps the optimistic card usable when a later refresh would fail', () => {
    const cards = [memberCard()];
    const next = applyMemberBookingProfileSetupToCards(cards, {
      memberId: 'mem-1',
      barberId: 'b-new',
      name: 'Alex',
      email: 'alex@example.com',
      avatarUrl: null,
      serviceIds: ['svc-1'],
      active: true,
    });
    // Simulate refresh failure: keep optimistic cards as-is
    expect(assertOptimisticSetupCardState(next[0]).canSetUp).toBe(false);
    expect(assertOptimisticSetupCardState(next[0]).bookable).toBe(true);
    expect(assertOptimisticSetupCardState(next[0]).joined).toBe(true);
  });
});

describe('combineSetupRefreshResults', () => {
  it('requires every refresh to be explicitly true', () => {
    expect(combineSetupRefreshResults(true, true, true)).toBe(true);
    expect(combineSetupRefreshResults(false, true, true)).toBe(false);
    expect(combineSetupRefreshResults(true, false, true)).toBe(false);
    expect(combineSetupRefreshResults(true, true, false)).toBe(false);
  });
});
