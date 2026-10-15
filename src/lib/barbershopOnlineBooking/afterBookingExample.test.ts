import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';
import {
  AFTER_BOOKING_CONCEPTS,
  AFTER_BOOKING_EXAMPLE_CLIENT,
  buildAfterBookingExample,
} from './afterBookingExample';

describe('Section 06 after-booking example', () => {
  const example = buildAfterBookingExample();

  it('derives confirmation and reminder previews from the live email builders', () => {
    expect(example.shopName).toBe(DEMO_SHOP_NAME);
    expect(example.clientName).toBe(AFTER_BOOKING_EXAMPLE_CLIENT);
    expect(example.confirmation.subject).toBe('Your booking is confirmed');
    expect(example.reminder.subject).toBe(`Reminder: your appointment tomorrow at ${DEMO_SHOP_NAME}`);
    expect(example.confirmation.fromLabel).toContain('via KERSIVO');
  });

  it('shows confirmation manage actions and booking summary lines', () => {
    expect(example.confirmation.actions.map((action) => action.label)).toEqual([
      'Reschedule booking',
      'Cancel booking',
    ]);
    expect(example.confirmation.lines.map((line) => line.label)).toEqual([
      'Shop',
      'Service',
      'Barber',
      'Date & time (Europe/London)',
    ]);
    expect(example.confirmation.lines.find((line) => line.label === 'Shop')?.value).toBe(DEMO_SHOP_NAME);
    expect(example.confirmation.footer.toLowerCase()).toContain('reschedule or cancel');
  });

  it('keeps the reminder preview free of invented manage links', () => {
    expect(example.reminder.actions).toEqual([]);
    expect(example.reminder.footer).toContain('use the links in your confirmation email');
    expect(example.reminder.lines.some((line) => line.label === 'Shop')).toBe(true);
  });

  it('keeps concept copy free of live automation claims', () => {
    expect(AFTER_BOOKING_CONCEPTS).toHaveLength(3);
    const blob = AFTER_BOOKING_CONCEPTS.map((card) => `${card.title} ${card.body}`).join(' ').toLowerCase();
    for (const banned of ['automatically', 'will send', 'sends you', 'guaranteed', 'incentive']) {
      expect(blob).not.toContain(banned);
    }
    expect(example.concepts.map((card) => card.id)).toEqual(['thanks', 'review', 'rebook']);
  });
});
