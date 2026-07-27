import { describe, expect, it } from 'vitest';
import { normalizePhoneToE164 } from './phone';

describe('normalizePhoneToE164', () => {
  it('normalizes UK 07… mobiles to +44', () => {
    expect(normalizePhoneToE164('07123456789')).toBe('+447123456789');
    expect(normalizePhoneToE164('07 1234 56789')).toBe('+447123456789');
  });

  it('normalizes 7… without leading 0', () => {
    expect(normalizePhoneToE164('7123456789')).toBe('+447123456789');
  });

  it('accepts already-E.164 and 00 prefix', () => {
    expect(normalizePhoneToE164('+447123456789')).toBe('+447123456789');
    expect(normalizePhoneToE164('00447123456789')).toBe('+447123456789');
    expect(normalizePhoneToE164('447123456789')).toBe('+447123456789');
  });

  it('rejects empty and invalid', () => {
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('123')).toBeNull();
    expect(normalizePhoneToE164('not-a-phone')).toBeNull();
  });
});
