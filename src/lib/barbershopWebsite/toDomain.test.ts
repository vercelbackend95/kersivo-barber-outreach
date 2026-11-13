import { describe, expect, it } from 'vitest';
import { toDomain } from './init';

describe('toDomain', () => {
  it('turns a shop name into an illustrative .co.uk address', () => {
    expect(toDomain('Fade Street Barbers')).toBe('fadestreetbarbers.co.uk');
    expect(toDomain('  Cuts & Co. ')).toBe('cutsandco.co.uk');
    expect(toDomain('Café Barbería')).toBe('cafebarberia.co.uk');
    expect(toDomain('')).toBe('yourshop.co.uk');
    expect(toDomain('!!!')).toBe('yourshop.co.uk');
    expect(toDomain('x'.repeat(60))).toBe(`${'x'.repeat(30)}.co.uk`);
  });
});
