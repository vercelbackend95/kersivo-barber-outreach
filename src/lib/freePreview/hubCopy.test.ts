import { describe, expect, it } from 'vitest';
import { PREVIEW_OVER_CAP_MESSAGE, PREVIEW_TURNAROUND_TEXT } from './config';
import {
  HUB_ACK_BUTTON,
  HUB_ACK_HUB_READY,
  HUB_ACK_HUB_USES,
  HUB_ACK_INTRO,
  HUB_ACK_NO_PAY,
  HUB_ACK_SUBJECT,
  HUB_ACK_WHEN_READY,
  HUB_FREE_PREVIEW_FAQ_PHOTOS_ANSWER,
  HUB_FREE_PREVIEW_PHOTOS_LINE,
  HUB_HEADERS,
  HUB_LOCKED_REASON_PREVIEW,
  HUB_MESSAGES_EMPTY,
  HUB_PAYMENTS_OPTIONAL,
  HUB_PRIVATE_LABEL,
  HUB_REVIEW_CARD_FOOTER,
  HUB_ROUND_USED,
  HUB_UPLOAD_HINT,
  HUB_FILES_PRIVACY,
  hubHeaderCopy,
} from './hubCopy';

describe('hubCopy §9', () => {
  it('keeps the acknowledgement strings from the spec', () => {
    expect(HUB_ACK_SUBJECT('Sharp Cuts')).toBe("We're designing your Sharp Cuts website");
    expect(HUB_ACK_INTRO('Sharp Cuts')).toBe(
      `Thanks for requesting a free website preview for Sharp Cuts. We design every preview individually, ${PREVIEW_TURNAROUND_TEXT}.`,
    );
    expect(HUB_ACK_BUTTON).toBe('Open your shop hub');
    expect(HUB_ACK_HUB_READY).toBe('Your private shop hub is ready now:');
    expect(HUB_ACK_HUB_USES).toContain('Everything is optional');
    expect(HUB_ACK_WHEN_READY).toContain("we'll email you");
    expect(HUB_ACK_NO_PAY).toBe(
      "There's nothing to pay and no card needed. You only pay if you decide to launch.",
    );
    expect(PREVIEW_OVER_CAP_MESSAGE).toContain('up to 3 working days');
  });

  it('keeps every stage header from §9.2', () => {
    expect(hubHeaderCopy('requested', 'Sharp Cuts')).toEqual({
      h1: "We've got your request",
      sub: "We'll start designing Sharp Cuts's website soon. Add anything that helps — it's all optional.",
    });
    expect(hubHeaderCopy('designing', 'Sharp Cuts').h1).toBe("We're designing your website");
    expect(hubHeaderCopy('review', 'Sharp Cuts').h1).toBe('Your preview is ready');
    expect(hubHeaderCopy('reviewChangesSent', 'Sharp Cuts').h1).toBe("We're updating your preview");
    expect(hubHeaderCopy('launch', 'Sharp Cuts').h1).toBe("Let's put Sharp Cuts live");
    expect(hubHeaderCopy('live', 'Sharp Cuts').h1).toBe('Sharp Cuts is live');
    expect(hubHeaderCopy('declined', 'Sharp Cuts').h1).toBe("You've closed this preview");
    expect(hubHeaderCopy('expired', 'Sharp Cuts').h1).toBe('This preview has expired');
    expect(Object.keys(HUB_HEADERS)).toEqual([
      'requested',
      'designing',
      'review',
      'reviewChangesSent',
      'launch',
      'live',
      'declined',
      'expired',
    ]);
  });

  it('keeps §9.3 microcopy', () => {
    expect(HUB_PRIVATE_LABEL).toBe('Private · hidden from search engines');
    expect(HUB_UPLOAD_HINT).toBe('Phone photos are perfect. JPG, PNG, WEBP or PDF.');
    expect(HUB_FILES_PRIVACY).toBe(
      "Your files are private. If you don't launch, we delete them with your preview.",
    );
    expect(HUB_REVIEW_CARD_FOOTER).toContain("don't use your round");
    expect(HUB_ROUND_USED).toContain('included round of changes');
    expect(HUB_MESSAGES_EMPTY).toContain('we reply by email and here');
    expect(HUB_PAYMENTS_OPTIONAL).toContain('pay at the shop by default');
    expect(HUB_LOCKED_REASON_PREVIEW).toBe('Available when your preview is ready');
    expect(HUB_FREE_PREVIEW_PHOTOS_LINE).toContain('private link');
    expect(HUB_FREE_PREVIEW_FAQ_PHOTOS_ANSWER).toContain('private shop hub');
  });
});
