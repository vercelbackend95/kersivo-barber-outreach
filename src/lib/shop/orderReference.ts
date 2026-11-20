/**
 * Short human pickup reference for the chair (e.g. KRV-A1B2C3).
 * Collision-safe via DB unique constraint — callers retry on P2002.
 */
export function generateOrderReference(seed = Date.now()): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // `>>> 0` keeps n an unsigned 32-bit integer: `^` returns signed values, and a negative n
  // used to index past the alphabet ("KRV-AundefinedundefinedYPB").
  let n = (Math.abs(Math.floor(seed)) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[n % alphabet.length]!;
    n = (Math.floor(n / alphabet.length) ^ ((i + 1) * 2654435761)) >>> 0;
  }
  return `KRV-${out}`;
}
