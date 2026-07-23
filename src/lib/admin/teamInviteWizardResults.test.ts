import { describe, expect, it, vi } from 'vitest';
import {
  buildInvitationUrl,
  finishAfterSuccessfulMutation,
  inviteDeliveryFromResponse,
  teamRefreshWarning,
} from './teamInviteWizardResults';

describe('buildInvitationUrl', () => {
  it('builds a full URL from origin and acceptPath', () => {
    expect(buildInvitationUrl('/admin/invite?token=abc', 'https://shop.example')).toBe(
      'https://shop.example/admin/invite?token=abc',
    );
  });
});

describe('inviteDeliveryFromResponse', () => {
  it('parses successful email delivery', () => {
    expect(
      inviteDeliveryFromResponse({
        emailSent: true,
        acceptPath: '/admin/invite?token=tok',
      }),
    ).toEqual({
      emailSent: true,
      warning: '',
      acceptPath: '/admin/invite?token=tok',
    });
  });

  it('parses email delivery failure with warning', () => {
    expect(
      inviteDeliveryFromResponse({
        emailSent: false,
        warning: 'The invitation was created, but the email could not be sent.',
        acceptPath: '/admin/invite?token=tok',
      }),
    ).toEqual({
      emailSent: false,
      warning: 'The invitation was created, but the email could not be sent.',
      acceptPath: '/admin/invite?token=tok',
    });
  });
});

describe('teamRefreshWarning', () => {
  it('returns invite-specific copy', () => {
    expect(teamRefreshWarning('invite')).toBe(
      'The invitation was created, but the Team list could not refresh automatically. Close and reopen Team to see the latest information.',
    );
  });

  it('returns booking-specific copy', () => {
    expect(teamRefreshWarning('booking')).toBe(
      'The team member was added, but the Team list could not refresh automatically. Close and reopen Team to see the latest information.',
    );
  });
});

describe('finishAfterSuccessfulMutation', () => {
  it('does not report mutation failure when refresh rejects', async () => {
    const onRefreshFailure = vi.fn();
    await finishAfterSuccessfulMutation({
      mode: 'invite',
      onRefresh: async () => {
        throw new Error('refresh boom');
      },
      onRefreshFailure,
    });
    expect(onRefreshFailure).toHaveBeenCalledWith(teamRefreshWarning('invite'));
  });

  it('does not call refresh failure handler when refresh succeeds', async () => {
    const onRefreshFailure = vi.fn();
    await finishAfterSuccessfulMutation({
      mode: 'booking',
      onRefresh: async () => undefined,
      onRefreshFailure,
    });
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });
});
