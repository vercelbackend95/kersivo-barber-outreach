import { isEnumValue } from './taxonomy';

/**
 * Canonicalize a closed taxonomy enum array that uses UNKNOWN as a sentinel.
 * - Deduplicate
 * - Preserve taxonomy order
 * - If any known values exist, strip UNKNOWN
 * - If nothing known remains, return [UNKNOWN]
 * Never emits UNKNOWN mixed with known values.
 */
export function canonicalizeClosedEnumArray<T extends string>(
  taxonomy: readonly T[],
  input: readonly T[],
  unknownValue: T = 'UNKNOWN' as T,
): T[] {
  const present = new Set<T>();
  for (const value of input) {
    if (isEnumValue(taxonomy, value)) present.add(value);
  }

  const knownOrdered = taxonomy.filter((value) => value !== unknownValue && present.has(value));
  if (knownOrdered.length > 0) return knownOrdered;
  return [unknownValue];
}

/**
 * Clamp raw input to a taxonomy enum array, then strip UNKNOWN mixed with known.
 */
export function clampAndCanonicalizeEnumArray<T extends string>(
  taxonomy: readonly T[],
  input: unknown,
  unknownValue: T = 'UNKNOWN' as T,
): T[] {
  if (!Array.isArray(input) || input.length === 0) return [unknownValue];
  const clamped = input.filter((v): v is T => isEnumValue(taxonomy, v));
  return canonicalizeClosedEnumArray(taxonomy, clamped, unknownValue);
}
