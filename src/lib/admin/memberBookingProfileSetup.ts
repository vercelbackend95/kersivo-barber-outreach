import type { TeamCardDto } from '@/lib/admin/teamCards';
import { teamAccountAccess } from '@/lib/admin/teamCards';

export type MemberBookingProfileSetupResult = {
  memberId: string;
  barberId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  serviceIds: string[];
  active: boolean;
};

/**
 * Optimistically patch a joined member Team card after online-bookings setup.
 * Preserves id/role/createdAt/invitation fields; keeps the card Joined.
 */
export function applyMemberBookingProfileSetupToCards(
  cards: TeamCardDto[],
  result: MemberBookingProfileSetupResult,
): TeamCardDto[] {
  return cards.map((card) => {
    if (card.kind !== 'member' || card.id !== result.memberId) return card;
    if (card.id.startsWith('barber:')) return card;

    const prevBarber = card.barber;
    return {
      ...card,
      name: result.name,
      email: result.email,
      avatarUrl: result.avatarUrl,
      barberId: result.barberId,
      bookable: true,
      canSetUpOnlineBookings: false,
      canManageOnlineBookings: true,
      barber: {
        id: result.barberId,
        name: result.name,
        isActive: result.active,
        avatarUrl: result.avatarUrl,
        sortOrder: prevBarber?.sortOrder ?? 0,
        serviceIds: result.serviceIds,
        todayLabel: prevBarber?.todayLabel ?? '—',
        todayIsOnShift: prevBarber?.todayIsOnShift ?? null,
        todayShiftWindow: prevBarber?.todayShiftWindow ?? null,
      },
    };
  });
}

/** Assert optimistic setup keeps Joined account access and disables further setup. */
export function assertOptimisticSetupCardState(card: TeamCardDto | undefined): {
  joined: boolean;
  bookable: boolean;
  canSetUp: boolean;
} {
  if (!card) {
    return { joined: false, bookable: false, canSetUp: false };
  }
  return {
    joined: teamAccountAccess(card) === 'joined',
    bookable: card.bookable,
    canSetUp: card.canSetUpOnlineBookings,
  };
}

/**
 * Strict combiner for setup-member post-mutation refreshes.
 * Any explicit false fails; undefined is not treated as success.
 */
export function combineSetupRefreshResults(
  barbersOk: boolean,
  teamOk: boolean,
  workingHoursOk: boolean,
): boolean {
  return barbersOk === true && teamOk === true && workingHoursOk === true;
}

export const SETUP_BOOKING_PROFILE_ALREADY_EXISTS_RECOVERY =
  'Online bookings may already be set up for this person. Close this window and reopen Team to see the latest information.';
