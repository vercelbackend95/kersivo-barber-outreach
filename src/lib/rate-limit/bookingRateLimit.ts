const bucket = new Map<string, number[]>();

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

export function checkBookingRateLimit(ip: string): { ok: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entries = (bucket.get(ip) ?? []).filter((stamp) => now - stamp < WINDOW_MS);

  if (entries.length >= LIMIT) {
    const oldest = entries[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }

  entries.push(now);
  bucket.set(ip, entries);
  return { ok: true };
}
