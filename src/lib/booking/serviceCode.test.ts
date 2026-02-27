import { describe, expect, it } from 'vitest';
import { getServiceCode } from './serviceCode';

describe('getServiceCode', () => {
  it('returns mapped codes for known service names', () => {
    expect(getServiceCode('Haircut')).toBe('H');
    expect(getServiceCode('Skin Fade')).toBe('FD');
    expect(getServiceCode('Beard Trim')).toBe('BT');
    expect(getServiceCode('Haircut + Beard')).toBe('H+B');
    expect(getServiceCode('Haircut & Beard')).toBe('H+B');
  });

  it('prefers id mapping when a known service id is available', () => {
    expect(getServiceCode({ id: 'svc-haircut', name: 'Unknown' })).toBe('H');
    expect(getServiceCode({ id: 'svc-skin-fade' })).toBe('FD');
    expect(getServiceCode({ id: 'svc-beard-trim' })).toBe('BT');
    expect(getServiceCode({ id: 'svc-haircut-beard' })).toBe('H+B');
  });

  it('normalizes whitespace and case before matching by name', () => {

    expect(getServiceCode('  skin   fade ')).toBe('FD');
    expect(getServiceCode({ name: '  haircut   +   beard ' })).toBe('H+B');
  });

  it('falls back deterministically for unknown services', () => {
    expect(getServiceCode('Hot Towel')).toBe('HT');
expect(getServiceCode('Colour')).toBe('CO');
    expect(getServiceCode('')).toBe('SRV');
  });
});
