import { describe, expect, it } from 'vitest';
import { getServiceCode } from './serviceCode';

describe('getServiceCode', () => {
  it('returns mapped codes for known services', () => {
    expect(getServiceCode('Haircut')).toBe('H');
    expect(getServiceCode('Skin Fade')).toBe('FD');
    expect(getServiceCode('Beard Trim')).toBe('BT');
    expect(getServiceCode('Haircut + Beard')).toBe('H+B');
    expect(getServiceCode('Haircut & Beard')).toBe('H+B');
  });

  it('normalizes whitespace and case before matching', () => {
    expect(getServiceCode('  skin   fade ')).toBe('FD');
  });

  it('falls back deterministically for unknown services', () => {
    expect(getServiceCode('Hot Towel')).toBe('HT');
    expect(getServiceCode('Colour')).toBe('COL');
    expect(getServiceCode('')).toBe('SRV');
  });
});
