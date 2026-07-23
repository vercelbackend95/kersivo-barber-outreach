import type { InvitationLifecycleStatus } from '@/lib/admin/teamCards';

export type InviteResendPhase =
  | 'idle'
  | 'resending'
  | 'resent'
  | 'email_failed'
  | 'cooldown'
  | 'error';

export type InviteResendStatePatch = {
  phase: InviteResendPhase;
  message: string;
  acceptPath?: string;
  copyFeedback?: string;
  refreshWarning?: string;
};

export const INVITE_RESEND_NETWORK_ERROR_MESSAGE =
  'Could not renew invitation. Check your connection and try again.';

/** Pure state after a client-side network/unexpected failure before mutation success. */
export function inviteResendNetworkFailurePatch(): InviteResendStatePatch {
  return {
    phase: 'error',
    message: INVITE_RESEND_NETWORK_ERROR_MESSAGE,
    acceptPath: '',
    copyFeedback: '',
    refreshWarning: '',
  };
}

/** Whether the primary Resend CTA should be shown (not past-tense success). */
export function shouldShowInviteResendAction(phase: InviteResendPhase | undefined): boolean {
  return phase !== 'resent' && phase !== 'email_failed';
}

export function passiveInvitationLabel(
  status: InvitationLifecycleStatus | null | undefined,
): string {
  return status === 'expired' ? 'Invitation expired' : 'Invitation pending';
}

export function countInvitationStatuses(
  cards: Array<{ kind: string; invitationStatus?: InvitationLifecycleStatus | null }>,
): { pendingCount: number; expiredCount: number } {
  let pendingCount = 0;
  let expiredCount = 0;
  for (const card of cards) {
    if (card.kind !== 'invite') continue;
    if (card.invitationStatus === 'expired') expiredCount += 1;
    else pendingCount += 1;
  }
  return { pendingCount, expiredCount };
}

export function invitationsSectionRevealLabel(params: {
  pendingCount: number;
  expiredCount: number;
}): string {
  const { pendingCount, expiredCount } = params;
  const total = pendingCount + expiredCount;
  if (total === 0) return 'Show 0 invitations';
  if (pendingCount > 0 && expiredCount === 0) {
    return pendingCount === 1
      ? 'Show 1 pending invitation'
      : `Show ${pendingCount} pending invitations`;
  }
  if (expiredCount > 0 && pendingCount === 0) {
    return expiredCount === 1
      ? 'Show 1 expired invitation'
      : `Show ${expiredCount} expired invitations`;
  }
  return `Show ${total} invitations`;
}

export const INVITATIONS_SECTION_HIDE_LABEL = 'Hide invitations';
export const INVITATIONS_SECTION_ARIA_LABEL = 'Invitations';

/**
 * Decide whether a Team refresh failure should clear the card list.
 * Post-mutation refreshes must preserve existing cards.
 */
export function shouldClearTeamCardsOnRefreshFailure(params: {
  preserveExistingCardsOnFailure: boolean;
  hasExistingCards: boolean;
}): boolean {
  if (params.preserveExistingCardsOnFailure && params.hasExistingCards) return false;
  return true;
}

export type PostMutationRefreshPlan = {
  refreshTeam: boolean;
  refreshBarbers: boolean;
  preserveExistingCardsOnFailure: boolean;
};

/** After invitation resend: Team only — Barber rows are unchanged. */
export function inviteResendPostMutationRefresh(): PostMutationRefreshPlan {
  return {
    refreshTeam: true,
    refreshBarbers: false,
    preserveExistingCardsOnFailure: true,
  };
}

/** Background Team reload when the barbers prop changes. */
export function barbersDrivenTeamRefreshOpts(): {
  preserveExistingCardsOnFailure: true;
} {
  return { preserveExistingCardsOnFailure: true };
}

/** After invite creation: Team + Barbers (booking profile may have been created). */
export function inviteCreationPostMutationRefresh(): PostMutationRefreshPlan {
  return {
    refreshTeam: true,
    refreshBarbers: true,
    preserveExistingCardsOnFailure: true,
  };
}
