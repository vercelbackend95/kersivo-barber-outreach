// src/lib/time/londonDateBucket.ts
const LONDON_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function toLondonDateBucket(date: Date): string {
  return LONDON_DAY_FORMATTER.format(date);
}