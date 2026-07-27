import { describe, expect, it } from 'vitest';
import { demoBarberRulesResponse } from './demoFixtures/barbers';
import { normalizeWorkingHourRows } from './normalizeWorkingHourRows';

describe('demoBarberRulesResponse', () => {
  it('matches GET /api/admin/barbers/:id/rules shape (startTime/endTime)', () => {
    expect(demoBarberRulesResponse.rules).toHaveLength(7);
    expect(demoBarberRulesResponse.rules[0]).toEqual({
      dayOfWeek: 1,
      active: true,
      startTime: '09:00',
      endTime: '19:00',
    });
    expect(demoBarberRulesResponse.rules[6]).toMatchObject({
      dayOfWeek: 7,
      active: false,
      startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      endTime: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
    expect(demoBarberRulesResponse.rules[0]).not.toHaveProperty('startMinutes');
  });
});

describe('normalizeWorkingHourRows', () => {
  it('keeps production HH:mm rows', () => {
    const rows = normalizeWorkingHourRows([
      { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '19:00' },
    ]);
    expect(rows.find((r) => r.dayOfWeek === 1)).toEqual({
      dayOfWeek: 1,
      active: true,
      startTime: '09:00',
      endTime: '19:00',
    });
    expect(rows.find((r) => r.dayOfWeek === 2)?.active).toBe(false);
  });

  it('converts legacy startMinutes/endMinutes to HH:mm', () => {
    const rows = normalizeWorkingHourRows([
      { dayOfWeek: 2, active: true, startMinutes: 540, endMinutes: 1140 },
    ]);
    expect(rows.find((r) => r.dayOfWeek === 2)).toEqual({
      dayOfWeek: 2,
      active: true,
      startTime: '09:00',
      endTime: '19:00',
    });
  });
});
