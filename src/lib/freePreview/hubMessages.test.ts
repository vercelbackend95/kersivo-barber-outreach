import { describe, expect, it } from 'vitest';
import {
  HUB_MESSAGE_MAX_CHARS,
  hubMessageDayKey,
  hubMessagePostSchema,
  hubMessageTimeLabel,
} from './hubMessages';
import { escapeHubText, hubMessageExcerpt, splitHubMessageParts } from './hubMessageText';

describe('hub message text', () => {
  it('excerpts to 500 characters and keeps shorter bodies', () => {
    expect(hubMessageExcerpt('Hello')).toBe('Hello');
    expect(hubMessageExcerpt('x'.repeat(500))).toHaveLength(500);
    expect(hubMessageExcerpt('x'.repeat(501)).endsWith('…')).toBe(true);
    expect(hubMessageExcerpt('x'.repeat(501)).length).toBe(501);
  });

  it('escapes HTML so a message body cannot become markup', () => {
    expect(escapeHubText('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHubText('A & B')).toBe('A &amp; B');
  });

  it('splits safe http(s) links from surrounding text', () => {
    expect(splitHubMessageParts('See https://kersivo.co.uk/preview please')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'url', value: 'https://kersivo.co.uk/preview' },
      { type: 'text', value: ' please' },
    ]);
    expect(splitHubMessageParts('<script>alert(1)</script>')).toEqual([
      { type: 'text', value: '<script>alert(1)</script>' },
    ]);
  });

  it('formats day and time in Britain', () => {
    const date = new Date('2026-10-31T15:30:00Z');
    expect(hubMessageDayKey(date)).toMatch(/October 2026/);
    expect(hubMessageTimeLabel(date)).toMatch(/\d{2}:\d{2}/);
  });
});

describe('hubMessagePostSchema', () => {
  it('accepts a trimmed 1–2000 character body and up to 5 attachments', () => {
    const parsed = hubMessagePostSchema.parse({
      body: '  Please reopen this preview.  ',
      attachmentIds: ['a1', 'a2'],
    });
    expect(parsed.body).toBe('Please reopen this preview.');
    expect(parsed.attachmentIds).toEqual(['a1', 'a2']);
  });

  it('rejects an empty body and more than 5 attachments', () => {
    expect(hubMessagePostSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(hubMessagePostSchema.safeParse({ body: 'x'.repeat(HUB_MESSAGE_MAX_CHARS + 1) }).success).toBe(
      false,
    );
    expect(
      hubMessagePostSchema.safeParse({
        body: 'Hi',
        attachmentIds: ['1', '2', '3', '4', '5', '6'],
      }).success,
    ).toBe(false);
  });
});
