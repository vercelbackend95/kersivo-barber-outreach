import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { found: { id: string; status: string } | null; status: string } = { found: null, status: 'READY' };
const update = vi.fn();
const suppress = vi.fn();
const tx = {
  $queryRaw: vi.fn(),
  previewRequest: { findUnique: vi.fn(async () => ({ status: state.status })), update: (...a: unknown[]) => update(...a) },
};

vi.mock('@/lib/db/client', () => ({ prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));
vi.mock('./previewAccess', () => ({ resolvePreviewRequestByToken: vi.fn(async () => state.found) }));
vi.mock('./followups', () => ({ suppressPendingPreviewFollowups: (...a: unknown[]) => suppress(...a) }));

import { declinePreviewByToken, noThanksStateFor, resolveNoThanksState } from './noThanks';

const NOW = new Date('2026-11-05T10:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  state.found = { id: 'req_1', status: 'READY' };
  state.status = 'READY';
});

describe('noThanksStateFor', () => {
  it.each([
    ['READY', 'can_decline'],
    ['CHANGES_REQUESTED', 'can_decline'],
    ['EXPIRED', 'can_decline'],
    ['DECLINED', 'already_declined'],
    ['CONVERTED', 'converted'],
    ['REQUESTED', 'not_found'],
    ['IN_PROGRESS', 'not_found'],
    ['REJECTED', 'not_found'],
  ] as const)('%s → %s', (status, expected) => {
    expect(noThanksStateFor(status)).toBe(expected);
  });
});

describe('declinePreviewByToken', () => {
  it('sets declined + opt-out, logs it and stops queued follow-ups', async () => {
    expect(await declinePreviewByToken('token', NOW)).toBe('can_decline');
    expect(update.mock.calls[0]![0].data).toMatchObject({
      status: 'DECLINED',
      declinedAt: NOW,
      emailOptOut: true,
      emailOptOutAt: NOW,
      events: { create: { action: 'DECLINED', fromStatus: 'READY', toStatus: 'DECLINED' } },
    });
    expect(suppress).toHaveBeenCalledWith('req_1', tx);
  });

  it('is idempotent', async () => {
    state.status = 'DECLINED';
    expect(await declinePreviewByToken('token', NOW)).toBe('already_declined');
    expect(update).not.toHaveBeenCalled();
  });

  it('never declines a paying customer, even if they converted after the lookup', async () => {
    state.status = 'CONVERTED';
    expect(await declinePreviewByToken('token', NOW)).toBe('converted');
    expect(update).not.toHaveBeenCalled();
  });

  it('answers not_found for an unknown token', async () => {
    state.found = null;
    expect(await declinePreviewByToken('token', NOW)).toBe('not_found');
    expect(await resolveNoThanksState('token')).toBe('not_found');
    expect(update).not.toHaveBeenCalled();
  });
});
