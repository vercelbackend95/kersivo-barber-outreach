import { describe, expect, it } from 'vitest';
import { hasNewHubFiles, sortPreviewRequestsForOps, unreadOwnerMessageCount } from './opsQueries';

describe('hasNewHubFiles', () => {
  it('is false when the request has no files', () => {
    expect(hasNewHubFiles({ opsLastSeenAt: null, hubAssets: [] })).toBe(false);
  });

  it('is true when files exist and ops has never opened the request', () => {
    expect(
      hasNewHubFiles({
        opsLastSeenAt: null,
        hubAssets: [{ createdAt: new Date('2026-10-31T12:00:00Z') }],
      }),
    ).toBe(true);
  });

  it('is true only when a file is newer than opsLastSeenAt', () => {
    const seen = new Date('2026-10-31T12:00:00Z');
    expect(
      hasNewHubFiles({
        opsLastSeenAt: seen,
        hubAssets: [{ createdAt: new Date('2026-10-31T11:00:00Z') }],
      }),
    ).toBe(false);
    expect(
      hasNewHubFiles({
        opsLastSeenAt: seen,
        hubAssets: [{ createdAt: new Date('2026-10-31T12:00:01Z') }],
      }),
    ).toBe(true);
  });
});

describe('ops unread owner messages', () => {
  it('counts unread owner messages', () => {
    expect(unreadOwnerMessageCount({ hubMessages: [{ id: '1' }, { id: '2' }] })).toBe(2);
    expect(unreadOwnerMessageCount({})).toBe(0);
  });

  it('sorts requests with unread owner messages first', () => {
    const older = { id: 'a', createdAt: new Date('2026-10-01T00:00:00Z'), hubMessages: [] };
    const newer = { id: 'b', createdAt: new Date('2026-10-31T00:00:00Z'), hubMessages: [] };
    const unread = { id: 'c', createdAt: new Date('2026-10-15T00:00:00Z'), hubMessages: [{ id: 'm' }] };
    expect(sortPreviewRequestsForOps([older, newer, unread], 'newest').map((row) => row.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});
