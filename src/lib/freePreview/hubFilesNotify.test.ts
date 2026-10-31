import { describe, expect, it } from 'vitest';
import { countsByKind, shouldSendHubFilesDigest } from './hubFilesNotify';
import { HUB_FILES_NOTIFY_WINDOW_MS } from './hubAssets';

describe('hub files digest debounce', () => {
  const now = new Date('2026-10-31T12:00:00Z');

  it('sends when ops has never been notified', () => {
    expect(shouldSendHubFilesDigest({ opsFilesNotifiedAt: null, now })).toBe(true);
  });

  it('defers when the last notify is inside 15 minutes', () => {
    expect(
      shouldSendHubFilesDigest({
        opsFilesNotifiedAt: new Date(now.getTime() - HUB_FILES_NOTIFY_WINDOW_MS + 1000),
        now,
      }),
    ).toBe(false);
  });

  it('sends again once 15 minutes have passed', () => {
    expect(
      shouldSendHubFilesDigest({
        opsFilesNotifiedAt: new Date(now.getTime() - HUB_FILES_NOTIFY_WINDOW_MS),
        now,
      }),
    ).toBe(true);
  });

  it('groups kinds for the email body', () => {
    expect(countsByKind([{ kind: 'SHOP_PHOTO' }, { kind: 'SHOP_PHOTO' }, { kind: 'LOGO' }])).toEqual([
      { kind: 'SHOP_PHOTO', count: 2 },
      { kind: 'LOGO', count: 1 },
    ]);
  });
});
