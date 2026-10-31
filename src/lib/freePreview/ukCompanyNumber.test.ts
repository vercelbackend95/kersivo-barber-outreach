import { describe, expect, it } from 'vitest';
import { isValidUkCompanyNumber, normalizeUkCompanyNumber } from './ukCompanyNumber';

describe('UK company number', () => {
  it('accepts 8 digits and SC/NI/OC prefixes', () => {
    expect(isValidUkCompanyNumber('01234567')).toBe(true);
    expect(isValidUkCompanyNumber('SC123456')).toBe(true);
    expect(isValidUkCompanyNumber('ni123456')).toBe(true);
    expect(isValidUkCompanyNumber('OC 123456')).toBe(true);
  });

  it('rejects other lengths and prefixes', () => {
    expect(isValidUkCompanyNumber('1234567')).toBe(false);
    expect(isValidUkCompanyNumber('SO123456')).toBe(false);
    expect(isValidUkCompanyNumber('ABC12345')).toBe(false);
    expect(isValidUkCompanyNumber('')).toBe(false);
  });

  it('normalises spaces and case', () => {
    expect(normalizeUkCompanyNumber('sc 123456')).toBe('SC123456');
  });
});
