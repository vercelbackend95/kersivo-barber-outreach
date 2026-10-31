import { describe, expect, it } from 'vitest';
import { hasNewHubFiles } from './opsQueries';

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
