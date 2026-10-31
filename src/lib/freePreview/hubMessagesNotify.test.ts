import { describe, expect, it } from 'vitest';
import { HUB_MESSAGES_NOTIFY_WINDOW_MS } from './hubMessages';
import { shouldSendHubMessagesDigest } from './hubMessagesNotify';

describe('hub messages digest debounce', () => {
  const now = new Date('2026-10-31T12:00:00Z');

  it('sends when ops has never been notified', () => {
    expect(shouldSendHubMessagesDigest({ opsMessagesNotifiedAt: null, now })).toBe(true);
  });

  it('defers when the last notify is inside 15 minutes', () => {
    expect(
      shouldSendHubMessagesDigest({
        opsMessagesNotifiedAt: new Date(now.getTime() - HUB_MESSAGES_NOTIFY_WINDOW_MS + 1000),
        now,
      }),
    ).toBe(false);
  });

  it('sends again once 15 minutes have passed', () => {
    expect(
      shouldSendHubMessagesDigest({
        opsMessagesNotifiedAt: new Date(now.getTime() - HUB_MESSAGES_NOTIFY_WINDOW_MS),
        now,
      }),
    ).toBe(true);
  });
});
