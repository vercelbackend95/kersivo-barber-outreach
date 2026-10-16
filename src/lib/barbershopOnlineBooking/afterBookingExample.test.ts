import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import {
  AFTER_BOOKING_BANNED_CLAIMS,
  AFTER_BOOKING_CONCEPT_STATUS,
  AFTER_BOOKING_EXAMPLE_CLIENT,
  AFTER_BOOKING_GOOGLE_MARK_SRC,
  buildAfterBookingExample,
  decodeHtmlEntities,
  extractStrongLines,
} from './afterBookingExample';

describe('Section 06 after-booking post-visit example', () => {
  const example = buildAfterBookingExample();

  it('exposes three post-visit moments with communication previews', () => {
    expect(example.moments.map((moment) => moment.id)).toEqual(['thanks', 'review', 'rebook']);
    expect(example.conceptStatus).toBe(AFTER_BOOKING_CONCEPT_STATUS);
    expect(example.googleMarkSrc).toBe(AFTER_BOOKING_GOOGLE_MARK_SRC);
    expect(example).not.toHaveProperty('bridgeNote');
    expect(example).not.toHaveProperty('scenes');
    expect(example).not.toHaveProperty('stages');

    const thanks = example.moments.find((moment) => moment.id === 'thanks');
    const review = example.moments.find((moment) => moment.id === 'review');
    const rebook = example.moments.find((moment) => moment.id === 'rebook');

    expect(thanks?.thanksPreview?.from).toBe(DEMO_SHOP_NAME);
    expect(thanks?.thanksPreview?.subject).toBe('Thanks for coming in.');
    expect(thanks?.thanksPreview?.message).toContain(DEMO_SHOP_NAME);
    expect(review?.reviewPreview?.heading).toBe('How was your visit?');
    expect(review?.reviewPreview?.ctaLabel).toBe('Leave a Google Review');
    expect(review?.display).toBe('A GREAT CUT DESERVES AN HONEST REVIEW.');
    expect(rebook?.rebookPreview?.ctaLabel).toBe('BOOK AGAIN');
    expect(rebook?.rebookPreview?.heading).toBe('Time for your next cut?');
    expect(rebook?.support).toContain(DEMO_SHOP_NAME);
    expect(rebook?.support?.toLowerCase()).not.toContain('make returning as easy');
  });

  it('keeps builder-derived confirmation subjects as claim-safe fixtures, not hero moments', () => {
    expect(example.shopName).toBe(DEMO_SHOP_NAME);
    expect(example.clientName).toBe(AFTER_BOOKING_EXAMPLE_CLIENT);
    expect(example.confirmationSubject).toBe('Your booking is confirmed');
    expect(example.reminderSubject).toBe(`Reminder: your appointment tomorrow at ${DEMO_SHOP_NAME}`);
    expect(example.manageLabels).toEqual(['Reschedule booking', 'Cancel booking']);
    expect(example.confirmationLines.length).toBeGreaterThan(0);
    expect(example.moments.map((moment) => moment.id)).not.toContain('confirmReminder');
  });

  it('decodes HTML entities in extracted email summary lines', () => {
    expect(decodeHtmlEntities('Date &amp; time (Europe/London)')).toBe('Date & time (Europe/London)');
    expect(extractStrongLines('<p><strong>Date &amp; time (Europe/London):</strong> Thu</p>')).toEqual([
      { label: 'Date & time (Europe/London)', value: 'Thu' },
    ]);
    for (const line of [...example.confirmationLines, ...example.reminderLines]) {
      expect(line.label).not.toContain('&amp;');
      expect(line.value).not.toContain('&amp;');
    }
    expect(example.reminderLines.some((line) => line.label.includes('Date & time'))).toBe(true);
  });

  it('keeps one section-level planned status and bans live automation claims', () => {
    const thanks = example.moments.find((moment) => moment.id === 'thanks');
    const review = example.moments.find((moment) => moment.id === 'review');
    const rebook = example.moments.find((moment) => moment.id === 'rebook');

    expect(thanks?.display).toBe('THANKS FOR COMING IN.');
    expect(rebook?.display).toBe('READY FOR YOUR NEXT CUT?');
    expect(review?.ctaLabel).toBe('Leave a Google Review');
    expect(rebook?.ctaLabel).toBe('BOOK AGAIN');

    const blob = [
      example.conceptStatus,
      example.disclosure,
      ...example.moments.flatMap((moment) => [
        moment.display,
        moment.support ?? '',
        moment.stageLabel ?? '',
        moment.ctaLabel ?? '',
        moment.thanksPreview?.from ?? '',
        moment.thanksPreview?.subject ?? '',
        moment.thanksPreview?.message ?? '',
        moment.reviewPreview?.heading ?? '',
        moment.reviewPreview?.body ?? '',
        moment.reviewPreview?.ctaLabel ?? '',
        moment.rebookPreview?.shopName ?? '',
        moment.rebookPreview?.heading ?? '',
        moment.rebookPreview?.ctaLabel ?? '',
      ]),
    ]
      .join(' ')
      .toLowerCase();

    for (const banned of AFTER_BOOKING_BANNED_CLAIMS) {
      expect(blob).not.toContain(banned);
    }
    expect(blob).toContain('planned for full kersivo');
    expect(blob).toContain('not currently live');
  });
});
