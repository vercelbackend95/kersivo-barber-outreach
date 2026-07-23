import { describe, expect, it, vi } from 'vitest';
import {
  buildInvitationUrl,
  combineRefreshResults,
  createSubmissionGate,
  finishAfterSuccessfulMutation,
  inviteDeliveryFromResponse,
  teamRefreshWarning,
} from './teamInviteWizardResults';
import { fetchBarbersListRefresh, fetchTeamListRefresh } from './teamRefreshFetch';

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

describe('combineRefreshResults', () => {
  it('returns false if either refresh is false', () => {
    expect(combineRefreshResults(false, true)).toBe(false);
    expect(combineRefreshResults(true, false)).toBe(false);
    expect(combineRefreshResults(false, false)).toBe(false);
  });

  it('returns true when both succeed', () => {
    expect(combineRefreshResults(true, true)).toBe(true);
  });

  it('treats void/undefined as success', () => {
    expect(combineRefreshResults(undefined, true)).toBe(true);
    expect(combineRefreshResults(true, undefined)).toBe(true);
    expect(combineRefreshResults(undefined, undefined)).toBe(true);
  });
});

describe('createSubmissionGate', () => {
  it('allows only one immediate begin', () => {
    const gate = createSubmissionGate();
    expect(gate.tryBegin()).toBe(true);
    expect(gate.tryBegin()).toBe(false);
    expect(gate.isInFlight()).toBe(true);
  });

  it('releases after mutation failure so retry can begin', () => {
    const gate = createSubmissionGate();
    expect(gate.tryBegin()).toBe(true);
    gate.release();
    expect(gate.isInFlight()).toBe(false);
    expect(gate.tryBegin()).toBe(true);
  });

  it('blocks a second mutation after markFinished', () => {
    const gate = createSubmissionGate();
    expect(gate.tryBegin()).toBe(true);
    gate.markFinished();
    expect(gate.isFinished()).toBe(true);
    expect(gate.isInFlight()).toBe(false);
    expect(gate.tryBegin()).toBe(false);
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

  it('reports refresh warning when onRefresh returns false', async () => {
    const onRefreshFailure = vi.fn();
    await finishAfterSuccessfulMutation({
      mode: 'booking',
      onRefresh: async () => false,
      onRefreshFailure,
    });
    expect(onRefreshFailure).toHaveBeenCalledWith(teamRefreshWarning('booking'));
  });

  it('does not call refresh failure handler when refresh succeeds', async () => {
    const onRefreshFailure = vi.fn();
    await finishAfterSuccessfulMutation({
      mode: 'booking',
      onRefresh: async () => true,
      onRefreshFailure,
    });
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });

  it('treats void refresh as success', async () => {
    const onRefreshFailure = vi.fn();
    await finishAfterSuccessfulMutation({
      mode: 'invite',
      onRefresh: async () => undefined,
      onRefreshFailure,
    });
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });
});

describe('fetchTeamListRefresh', () => {
  it('returns ok true on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cards: [{ id: '1' }], actorRole: 'OWNER' }),
    });
    await expect(fetchTeamListRefresh(fetchImpl)).resolves.toEqual({
      ok: true,
      cards: [{ id: '1' }],
      actorRole: 'OWNER',
    });
  });

  it('returns ok false on HTTP 500', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });
    await expect(fetchTeamListRefresh(fetchImpl)).resolves.toEqual({
      ok: false,
      error: 'Server error',
    });
  });

  it('returns ok false on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchTeamListRefresh(fetchImpl)).resolves.toEqual({
      ok: false,
      error: 'offline',
    });
  });
});

describe('fetchBarbersListRefresh', () => {
  it('returns ok true on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ barbers: [{ id: 'b1' }] }),
    });
    await expect(fetchBarbersListRefresh(fetchImpl)).resolves.toEqual({
      ok: true,
      barbers: [{ id: 'b1' }],
    });
  });

  it('returns ok false on HTTP 500', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    await expect(fetchBarbersListRefresh(fetchImpl)).resolves.toEqual({ ok: false });
  });

  it('returns ok false on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchBarbersListRefresh(fetchImpl)).resolves.toEqual({ ok: false });
  });
});
