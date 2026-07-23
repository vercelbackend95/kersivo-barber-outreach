import type { ShopRole, TeamMemberStatus } from '@prisma/client';

export type TeamCardStatus = 'pending' | 'active';

export type InvitationLifecycleStatus = 'pending' | 'expired';

/** Pure role gate matching assertCanInviteRole (for DTOs / UI). */
export function canActorResendInvitation(
  actorRole: ShopRole | string,
  inviteRole: ShopRole | string,
): boolean {
  if (inviteRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return inviteRole === 'MANAGER' || inviteRole === 'BARBER';
  if (actorRole === 'MANAGER') return inviteRole === 'BARBER';
  return false;
}

export type TeamCardDto = {
  kind: 'member' | 'invite';
  id: string;
  role: ShopRole;
  name: string;
  email: string | null;
  cardStatus: TeamCardStatus;
  bookable: boolean;
  barberId: string | null;
  avatarUrl: string | null;
  /** ISO timestamp for newest-New badge */
  createdAt: string;
  /** Roster fields when bookable and barber exists */
  barber: {
    id: string;
    name: string;
    isActive: boolean;
    avatarUrl: string | null;
    sortOrder: number;
    serviceIds: string[];
    todayLabel: string;
    todayIsOnShift: boolean | null;
    todayShiftWindow: {
      startMinutes: number;
      endMinutes: number;
      breakStartMin: number | null;
      breakEndMin: number | null;
    } | null;
  } | null;
  /** Authorised Owner/Manager may manage online bookings when a booking profile exists. */
  canManageOnlineBookings: boolean;
  /** Unaccepted invite lifecycle; null for members / standalone barbers. */
  invitationStatus: InvitationLifecycleStatus | null;
  /** ISO expiry for unaccepted invites; null otherwise. */
  inviteExpiresAt: string | null;
  canResendInvitation: boolean;
};

/**
 * Legacy NEW is treated as joined (same as ACTIVE). Team GET remains read-only —
 * it never silently writes NEW → ACTIVE. Acceptance writes ACTIVE going forward.
 */
export function isJoinedTeamMemberStatus(teamStatus: TeamMemberStatus): boolean {
  return teamStatus === 'ACTIVE' || teamStatus === 'NEW';
}

/** Map ShopMember.teamStatus to roster card status (legacy NEW → active / joined). */
export function memberCardStatus(_teamStatus: TeamMemberStatus): TeamCardStatus {
  // ShopMembers (NEW or ACTIVE) always appear in the main/joined list.
  // Pending is reserved for unaccepted invites (kind === 'invite').
  return 'active';
}

export function invitationLifecycleStatus(
  expiresAt: Date | string,
  now = new Date(),
): InvitationLifecycleStatus {
  const expiryMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return expiryMs > now.getTime() ? 'pending' : 'expired';
}

export function emptyInvitationFields(): Pick<
  TeamCardDto,
  'invitationStatus' | 'inviteExpiresAt' | 'canResendInvitation'
> {
  return {
    invitationStatus: null,
    inviteExpiresAt: null,
    canResendInvitation: false,
  };
}

export function inviteCardInvitationFields(params: {
  expiresAt: Date;
  inviteRole: ShopRole;
  actorRole: ShopRole | string;
  now?: Date;
}): Pick<TeamCardDto, 'invitationStatus' | 'inviteExpiresAt' | 'canResendInvitation'> {
  const status = invitationLifecycleStatus(params.expiresAt, params.now ?? new Date());
  return {
    invitationStatus: status,
    inviteExpiresAt: params.expiresAt.toISOString(),
    canResendInvitation: canActorResendInvitation(params.actorRole, params.inviteRole),
  };
}

/** Main Team list vs pending invitations — Online bookings Off never implies pending. */
export function isPendingInviteCard(card: Pick<TeamCardDto, 'kind'>): boolean {
  return card.kind === 'invite';
}

export function partitionTeamCards<T extends Pick<TeamCardDto, 'kind'>>(cards: T[]): {
  joinedCards: T[];
  pendingInviteCards: T[];
} {
  const joinedCards: T[] = [];
  const pendingInviteCards: T[] = [];
  for (const card of cards) {
    if (isPendingInviteCard(card)) pendingInviteCards.push(card);
    else joinedCards.push(card);
  }
  return { joinedCards, pendingInviteCards };
}

export function pendingInvitationsRevealLabel(count: number): string {
  if (count === 1) return 'Show 1 pending invitation';
  return `Show ${count} pending invitations`;
}

/** Owner → Manager → Barber for Team roster ordering */
export function roleSortRank(role: ShopRole | string): number {
  if (role === 'OWNER') return 0;
  if (role === 'MANAGER') return 1;
  if (role === 'BARBER') return 2;
  return 3;
}

export function rolePillClass(role: ShopRole | string): string {
  const base = 'admin-team__role-pill';
  if (role === 'OWNER') return `${base} ${base}--owner`;
  if (role === 'MANAGER') return `${base} ${base}--manager`;
  if (role === 'BARBER') return `${base} ${base}--barber`;
  return base;
}

export function roleLabel(role: ShopRole | string): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'BARBER') return 'Barber';
  return role;
}

/** Account access as shown on Team cards / profile — not Online bookings. */
export type TeamAccountAccess = 'invite_pending' | 'invite_expired' | 'joined' | 'no_dashboard';

export function teamAccountAccess(
  card: Pick<TeamCardDto, 'kind' | 'id'> & { invitationStatus?: InvitationLifecycleStatus | null },
): TeamAccountAccess {
  if (card.kind === 'invite') {
    return card.invitationStatus === 'expired' ? 'invite_expired' : 'invite_pending';
  }
  if (card.id.startsWith('barber:')) return 'no_dashboard';
  return 'joined';
}

export function teamAccountAccessLabel(access: TeamAccountAccess): string {
  if (access === 'invite_pending') return 'Invitation pending';
  if (access === 'invite_expired') return 'Invitation expired';
  if (access === 'no_dashboard') return 'No dashboard account';
  return 'Joined';
}

/** Online booking line — independent of invite acceptance. */
export function onlineBookingsStateLabel(bookable: boolean): string {
  return bookable ? 'Online bookings: On' : 'Online bookings: Off';
}

/**
 * Secondary line when the person has (or will have) dashboard access
 * but is not accepting online bookings.
 */
export function dashboardAccessOnlyLine(
  access: TeamAccountAccess,
  bookable: boolean,
): string | null {
  if (access === 'no_dashboard') return null;
  if (!bookable) return 'Dashboard access only';
  return null;
}

/** Primary online-booking line for a Team card (invite state is separate). */
export function teamCardOnlineBookingsLine(
  _access: TeamAccountAccess,
  bookable: boolean,
): string {
  return onlineBookingsStateLabel(bookable);
}

export function teamProfileSummary(
  role: ShopRole | string,
  access: TeamAccountAccess,
): string {
  return `${roleLabel(role)} · ${teamAccountAccessLabel(access)}`;
}

export const ONLINE_BOOKINGS_ON_HINT =
  'Clients can choose this person in the booking flow during their working hours.';

export const ONLINE_BOOKINGS_OFF_HINT_DASHBOARD =
  'They keep their dashboard access but will not appear in the client booking flow.';

export const ONLINE_BOOKINGS_OFF_HINT_NO_DASHBOARD =
  'They will not appear in the client booking flow.';

export const ONLINE_BOOKINGS_OFF_HINT_INVITE =
  'They will have dashboard access but will not appear in the client booking flow.';

export function onlineBookingsToggleHint(
  bookable: boolean,
  access: TeamAccountAccess | null | undefined,
): string {
  if (bookable) return ONLINE_BOOKINGS_ON_HINT;
  if (access === 'no_dashboard') return ONLINE_BOOKINGS_OFF_HINT_NO_DASHBOARD;
  return ONLINE_BOOKINGS_OFF_HINT_DASHBOARD;
}

/** Customer-facing wizard copy when create conflicts with an existing invite. */
export function inviteCreationConflictMessage(code: string | undefined): string | null {
  if (code === 'INVITATION_ALREADY_PENDING') {
    return 'An invitation for this email already exists. Close this window and resend it from the pending invitations section.';
  }
  if (code === 'EXPIRED_INVITATION_EXISTS') {
    return 'An expired invitation for this email already exists. Close this window and renew it from the invitations section.';
  }
  return null;
}

export const TEAM_INVITE_RESEND_REFRESH_WARNING =
  'The invitation was renewed, but the Team list could not refresh automatically. Close and reopen Team to see the latest information.';
