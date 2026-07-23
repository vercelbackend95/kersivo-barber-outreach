import { describe, expect, it } from 'vitest';
import {
  INVITATIONS_SECTION_ARIA_LABEL,
  INVITATIONS_SECTION_HIDE_LABEL,
  INVITE_RESEND_NETWORK_ERROR_MESSAGE,
  countInvitationStatuses,
  inviteResendNetworkFailurePatch,
  invitationsSectionRevealLabel,
  passiveInvitationLabel,
  shouldClearTeamCardsOnRefreshFailure,
  shouldShowInviteResendAction,
} from './teamInviteResendUi';

describe('inviteResendNetworkFailurePatch', () => {
  it('moves resending to retryable error without leaving busy semantics', () => {
    const patch = inviteResendNetworkFailurePatch();
    expect(patch.phase).toBe('error');
    expect(patch.message).toBe(INVITE_RESEND_NETWORK_ERROR_MESSAGE);
    expect(shouldShowInviteResendAction(patch.phase)).toBe(true);
  });
});

describe('shouldShowInviteResendAction', () => {
  it('hides the action after success or email-failure result', () => {
    expect(shouldShowInviteResendAction('resent')).toBe(false);
    expect(shouldShowInviteResendAction('email_failed')).toBe(false);
    expect(shouldShowInviteResendAction('error')).toBe(true);
    expect(shouldShowInviteResendAction('idle')).toBe(true);
    expect(shouldShowInviteResendAction('cooldown')).toBe(true);
  });
});

describe('shouldClearTeamCardsOnRefreshFailure', () => {
  it('preserves cards for post-mutation refresh failures', () => {
    expect(
      shouldClearTeamCardsOnRefreshFailure({
        preserveExistingCardsOnFailure: true,
        hasExistingCards: true,
      }),
    ).toBe(false);
  });

  it('clears cards on initial load failure', () => {
    expect(
      shouldClearTeamCardsOnRefreshFailure({
        preserveExistingCardsOnFailure: false,
        hasExistingCards: false,
      }),
    ).toBe(true);
  });
});

describe('invitationsSectionRevealLabel', () => {
  it('uses pending-only copy', () => {
    expect(invitationsSectionRevealLabel({ pendingCount: 1, expiredCount: 0 })).toBe(
      'Show 1 pending invitation',
    );
    expect(invitationsSectionRevealLabel({ pendingCount: 3, expiredCount: 0 })).toBe(
      'Show 3 pending invitations',
    );
  });

  it('uses expired-only copy', () => {
    expect(invitationsSectionRevealLabel({ pendingCount: 0, expiredCount: 1 })).toBe(
      'Show 1 expired invitation',
    );
    expect(invitationsSectionRevealLabel({ pendingCount: 0, expiredCount: 2 })).toBe(
      'Show 2 expired invitations',
    );
  });

  it('uses mixed invitations copy', () => {
    expect(invitationsSectionRevealLabel({ pendingCount: 1, expiredCount: 2 })).toBe(
      'Show 3 invitations',
    );
  });

  it('exposes hide and aria labels', () => {
    expect(INVITATIONS_SECTION_HIDE_LABEL).toBe('Hide invitations');
    expect(INVITATIONS_SECTION_ARIA_LABEL).toBe('Invitations');
  });
});

describe('passiveInvitationLabel', () => {
  it('never calls expired invitations Pending invitation', () => {
    expect(passiveInvitationLabel('pending')).toBe('Invitation pending');
    expect(passiveInvitationLabel('expired')).toBe('Invitation expired');
    expect(passiveInvitationLabel('expired')).not.toMatch(/Pending invitation/);
  });
});

describe('countInvitationStatuses', () => {
  it('counts pending and expired invite cards', () => {
    expect(
      countInvitationStatuses([
        { kind: 'invite', invitationStatus: 'pending' },
        { kind: 'invite', invitationStatus: 'expired' },
        { kind: 'member', invitationStatus: null },
      ]),
    ).toEqual({ pendingCount: 1, expiredCount: 1 });
  });
});
