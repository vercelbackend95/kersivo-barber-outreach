/**
 * Short human pickup reference for the chair (e.g. KRV-A1B2C3).
 * Collision-safe via DB unique constraint — callers retry on P2002.
 */
export function generateOrderReference(seed = Date.now()): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n = Math.abs(Math.floor(seed)) ^ Math.floor(Math.random() * 0xffffffff);
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[n % alphabet.length]!;
    n = Math.floor(n / alphabet.length) ^ (i + 1) * 2654435761;
  }
  return `KRV-${out}`;
}
