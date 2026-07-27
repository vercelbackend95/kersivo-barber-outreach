import { describe, expect, it } from 'vitest';
import { buildAppointmentReminderBody } from './templates';

describe('buildAppointmentReminderBody', () => {
  it('includes shop, service and UK time', () => {
    const body = buildAppointmentReminderBody({
      shopName: 'North Cuts',
      serviceName: 'Skin fade',
      startAt: new Date('2026-07-28T10:00:00.000Z'),
      timezone: 'Europe/London',
    });
    expect(body).toContain('North Cuts');
    expect(body).toContain('Skin fade');
    expect(body).toContain('UK');
    expect(body.length).toBeLessThan(200);
  });
});
