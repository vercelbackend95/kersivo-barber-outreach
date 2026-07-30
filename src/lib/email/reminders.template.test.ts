import { describe, expect, it } from 'vitest';
import { buildAppointmentReminderEmail } from './sender';

describe('buildAppointmentReminderEmail', () => {
  it('includes shop name in subject and formatted time in body', () => {
    const { subject, html } = buildAppointmentReminderEmail({
      to: 'client@example.com',
      fullName: 'Alex Client',
      shopName: 'Northside Cuts',
      serviceName: 'Skin fade',
      barberName: 'Jordan',
      startAt: new Date('2026-07-28T14:00:00.000Z'),
      timezone: 'Europe/London',
    });

    expect(subject).toBe('Reminder: your appointment tomorrow at Northside Cuts');
    expect(html).toContain('Alex Client');
    expect(html).toContain('Northside Cuts');
    expect(html).toContain('Skin fade');
    expect(html).toContain('Jordan');
    expect(html).toContain('Europe/London');
    expect(html).toContain('confirmation email');
    expect(html).not.toContain('/book/reschedule');
    expect(html).not.toContain('/book/cancel');
  });
});
