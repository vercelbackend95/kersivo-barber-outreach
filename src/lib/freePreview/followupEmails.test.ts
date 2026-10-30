import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));

import { buildPreviewExpiryReminderEmail, buildPreviewFollowupEmail, previewNoThanksUrl } from './emails';

const input = {
  to: 'owner@example.com',
  firstName: null,
  shopName: 'Sharp & Co',
  previewUrl: 'https://kersivo.co.uk/preview/token',
  noThanksUrl: 'https://kersivo.co.uk/preview/token/no-thanks',
};

describe('free preview follow-up emails (spec §9)', () => {
  it('builds the no-thanks URL from the preview URL', () => {
    expect(previewNoThanksUrl('abc')).toBe('https://kersivo.co.uk/preview/abc/no-thanks');
  });

  it('E5 uses the spec copy', () => {
    const email = buildPreviewFollowupEmail(input);
    expect(email.subject).toBe('Had a chance to look at your Sharp & Co preview?');
    expect(email.replyTo).toBe('hello@kersivo.co.uk');
    expect(email.html).toContain('Hi there,');
    expect(email.html).toContain('Just checking you saw the website preview we made for Sharp &amp; Co:');
    expect(email.html).toContain("If something isn't quite right, tell us and we'll change it.");
    expect(email.html).toContain(
      `Not for you? No problem — <a href="${input.noThanksUrl}">Click here</a> and we won't email you about it again.`,
    );
    expect(email.html).toContain('The KERSIVO team');
  });

  it('E6 uses the spec copy and the UK expiry date', () => {
    const email = buildPreviewExpiryReminderEmail({ ...input, firstName: 'Sam', expiresAt: new Date('2026-11-28T10:00:00Z') });
    expect(email.subject).toBe('Your Sharp & Co preview expires on 28 November 2026');
    expect(email.html).toContain('Hi Sam,');
    expect(email.html).toContain('will expire on 28 November 2026:');
    expect(email.html).toContain("Want to launch it, or need more time? Reply to this email and we'll help.");
    expect(email.html).toContain(
      `<a href="${input.noThanksUrl}">Click here</a> if you'd rather we didn't email you about it again.`,
    );
  });
});
