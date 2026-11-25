/**
 * Pure booking-time helpers shared by the server (page data) and the browser (simulator, diary
 * scrubber). No imports, so the client bundle never pulls in the demo fixtures.
 */

export type SimAppointment = { start: number; end: number; service: string };

/** 570 → "09:30". */
export function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** £26 / £26.50 from pence. */
export function poundsLabel(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

/** The appointment a service starting at `start` would run into, if any. */
export function clashAt(appointments: readonly SimAppointment[], start: number, duration: number): SimAppointment | undefined {
  return appointments.find((a) => start < a.end && a.start < start + duration);
}

/** Start times the diary offers for one barber and one service length. */
export function offeredStarts(
  appointments: readonly SimAppointment[],
  open: number,
  close: number,
  duration: number,
  step = 15,
): number[] {
  const starts: number[] = [];
  for (let start = open; start + duration <= close; start += step) {
    if (!clashAt(appointments, start, duration)) starts.push(start);
  }
  return starts;
}

export type StartVerdict =
  | { ok: true }
  | { ok: false; reason: 'closing' }
  | { ok: false; reason: 'inside'; appointment: SimAppointment }
  | { ok: false; reason: 'runs-into'; appointment: SimAppointment };

/** Why one start time is or isn't offered. */
export function judgeStart(
  appointments: readonly SimAppointment[],
  close: number,
  start: number,
  duration: number,
): StartVerdict {
  if (start + duration > close) return { ok: false, reason: 'closing' };
  const clash = clashAt(appointments, start, duration);
  if (!clash) return { ok: true };
  return clash.start <= start ? { ok: false, reason: 'inside', appointment: clash } : { ok: false, reason: 'runs-into', appointment: clash };
}
