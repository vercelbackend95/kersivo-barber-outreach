const LONDON_TZ = 'Europe/London';

export function toUtcFromLondon(date: string, minutes: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0));
  const londonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(utcGuess);

  const get = (type: string) => Number(londonParts.find((p) => p.type === type)?.value ?? '0');
  const diffMinutes = (get('hour') * 60 + get('minute')) - minutes;
  return new Date(utcGuess.getTime() - diffMinutes * 60000);
}

export function minutesInLondonDay(dateUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(dateUtc);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

export function londonDateKey(dateUtc: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateUtc);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function formatLondonTime(dateUtc: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateUtc);
}
