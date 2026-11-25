import { describe, expect, it } from 'vitest';
import {
  type SimAppointment,
  buildBookingSimulatorData,
  clashAt,
  judgeStart,
  minuteLabel,
  offeredStarts,
  poundsLabel,
  scrubberServices,
} from './bookingSimulator';
import { HERITAGE_DEMO_SHOP_NAME } from '@/lib/demo/heritage/demoShapes';

const diary: SimAppointment[] = [
  { start: 9 * 60 + 30, end: 10 * 60 + 15, service: 'Haircut' },
  { start: 13 * 60, end: 14 * 60, service: 'Haircut and beard' },
];

describe('booking time helpers', () => {
  it('formats minutes and pence', () => {
    expect(minuteLabel(570)).toBe('09:30');
    expect(minuteLabel(1140)).toBe('19:00');
    expect(poundsLabel(2900)).toBe('£29');
    expect(poundsLabel(2650)).toBe('£26.50');
  });

  it('finds the appointment a start would run into', () => {
    expect(clashAt(diary, 12 * 60 + 30, 45)?.service).toBe('Haircut and beard');
    expect(clashAt(diary, 12 * 60, 45)).toBeUndefined();
    expect(clashAt(diary, 10 * 60 + 15, 45)).toBeUndefined();
  });

  it('offers only starts where the whole service fits before the next booking and closing', () => {
    const starts = offeredStarts(diary, 9 * 60, 19 * 60, 45);
    expect(starts[0]).toBe(10 * 60 + 15);
    expect(starts).toContain(12 * 60 + 15);
    expect(starts).not.toContain(12 * 60 + 30);
    expect(starts).not.toContain(13 * 60);
    expect(starts.at(-1)).toBe(18 * 60 + 15);
    expect(starts.every((start) => start % 15 === 0)).toBe(true);
  });

  it('explains why a start is not offered', () => {
    expect(judgeStart(diary, 19 * 60, 12 * 60, 45)).toEqual({ ok: true });
    expect(judgeStart(diary, 19 * 60, 18 * 60 + 30, 45)).toEqual({ ok: false, reason: 'closing' });
    expect(judgeStart(diary, 19 * 60, 13 * 60 + 15, 45)).toMatchObject({ ok: false, reason: 'inside' });
    expect(judgeStart(diary, 19 * 60, 12 * 60 + 30, 45)).toMatchObject({ ok: false, reason: 'runs-into' });
  });
});

describe('booking simulator data (Heritage Grooming example day)', () => {
  const data = buildBookingSimulatorData();

  it('uses one trading day of the demo shop with 15-minute starts', () => {
    expect(HERITAGE_DEMO_SHOP_NAME).toBe('Heritage Grooming');
    expect(data.open).toBe(9 * 60);
    expect(data.close).toBe(19 * 60);
    expect(data.step).toBe(15);
  });

  it('shows Owen as off and gives every working barber a booked, partly free diary', () => {
    const owen = data.barbers.find((barber) => barber.firstName === 'Owen');
    expect(owen?.working).toBe(false);
    const working = data.barbers.filter((barber) => barber.working);
    expect(working.map((barber) => barber.firstName)).toEqual(['Arthur', 'Kit', 'Rafi']);
    for (const barber of working) {
      expect(barber.appointments.length).toBeGreaterThan(0);
      expect(barber.appointments.every((a) => a.start >= data.open && a.end <= data.close && a.end > a.start)).toBe(true);
    }
  });

  it('offers Kit the same skin-fade times the page text describes', () => {
    const kit = data.barbers.find((barber) => barber.firstName === 'Kit')!;
    const skinFade = data.services.find((service) => service.name === 'Skin fade')!;
    expect(skinFade.duration).toBe(45);
    expect(offeredStarts(kit.appointments, data.open, data.close, skinFade.duration).map(minuteLabel)).toEqual([
      '12:00',
      '12:15',
      '14:45',
      '15:00',
      '15:15',
      '15:30',
    ]);
    expect(judgeStart(kit.appointments, data.close, 12 * 60 + 30, 45)).toMatchObject({
      ok: false,
      reason: 'runs-into',
      appointment: { start: 13 * 60 },
    });
  });

  it('never sends the fictional client names to the page', () => {
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/clientName|customerName|email|phone/i);
    for (const barber of data.barbers) {
      for (const appointment of barber.appointments) {
        expect(Object.keys(appointment).sort()).toEqual(['end', 'service', 'start']);
      }
    }
  });

  it('orders the scrubber services from short to long', () => {
    const durations = scrubberServices().map((service) => service.duration);
    expect(durations).toEqual([...durations].sort((a, b) => a - b));
    expect(durations.length).toBeGreaterThanOrEqual(3);
  });
});
