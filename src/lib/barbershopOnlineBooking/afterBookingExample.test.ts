import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import {
  AFTER_BOOKING_BANNED_CLAIMS,
  AFTER_BOOKING_EXAMPLE_CLIENT,
  AFTER_BOOKING_GOOGLE_MARK_SRC,
  AFTER_BOOKING_LIVE_STATUS,
  AFTER_BOOKING_PLANNED_STATUS,
  buildAfterBookingExample,
  decodeHtmlEntities,
  extractStrongLines,
} from './afterBookingExample';

describe('Section 06 after-booking cinematic scroll example', () => {
  const example = buildAfterBookingExample();

  it('exposes three claim-safe cinematic scenes', () => {
    expect(example.scenes.map((scene) => scene.id)).toEqual([
      'confirmReminder',
      'thanksReview',
      'rebook',
    ]);
    expect(example).not.toHaveProperty('stages');
    expect(example).not.toHaveProperty('photo');
    expect(example.googleMarkSrc).toBe(AFTER_BOOKING_GOOGLE_MARK_SRC);
    expect(example.smsPreviewLine).toBe('Your appointment is coming up.');
  });

  it('derives live confirmation and reminder subjects from the real builders', () => {
    expect(example.shopName).toBe(DEMO_SHOP_NAME);
    expect(example.clientName).toBe(AFTER_BOOKING_EXAMPLE_CLIENT);
    expect(example.confirmationSubject).toBe('Your booking is confirmed');
    expect(example.handoffLabel).toBe(example.confirmationSubject);
    expect(example.reminderSubject).toBe(`Reminder: your appointment tomorrow at ${DEMO_SHOP_NAME}`);
    expect(example.manageLabels).toEqual(['Reschedule booking', 'Cancel booking']);
    const confirm = example.scenes.find((scene) => scene.id === 'confirmReminder');
    expect(confirm?.statusLabel).toBe(AFTER_BOOKING_LIVE_STATUS);
    expect(confirm?.title).toBe('Your appointment is coming up.');
    expect(example.smsNote.toLowerCase()).toContain('full kersivo');
    expect(example.smsNote.toLowerCase()).toContain('not every booking');
    expect(example.smsNote.toLowerCase()).toContain('monthly sms allowance');
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

  it('keeps planned Full thank-you and rebook labelled and free of live automation claims', () => {
    const thanks = example.scenes.find((scene) => scene.id === 'thanksReview');
    const rebook = example.scenes.find((scene) => scene.id === 'rebook');
    expect(thanks?.statusLabel).toBe(AFTER_BOOKING_PLANNED_STATUS);
    expect(rebook?.statusLabel).toBe(AFTER_BOOKING_PLANNED_STATUS);
    expect(thanks?.display).toBe('THANKS FOR COMING IN.');
    expect(rebook?.display).toBe('READY FOR YOUR NEXT CUT?');
    expect(rebook?.ctaLabel).toBe('Book Again');
    expect(thanks?.ctaLabel).toBe('Leave a Google Review');
    expect(rebook?.title).toContain(DEMO_SHOP_NAME);

    const blob = example.scenes
      .flatMap((scene) => [
        scene.display ?? '',
        scene.title,
        scene.body ?? '',
        scene.note ?? '',
        scene.statusLabel,
        scene.ctaLabel ?? '',
      ])
      .concat([example.disclosure, example.smsNote, example.emailReminderNote])
      .join(' ')
      .toLowerCase();

    for (const banned of AFTER_BOOKING_BANNED_CLAIMS) {
      expect(blob).not.toContain(banned);
    }
    expect(blob).toContain('planned for full kersivo');
  });
});
