import { describe, expect, it } from 'vitest';
import { pickActiveServiceCategory, serviceMenuReadingY } from './serviceMenuSpy';

const sections = [
  { id: 'cuts-and-fades', top: 400, bottom: 900 },
  { id: 'beard-and-shave', top: 900, bottom: 1400 },
  { id: 'hair-and-beard-combos', top: 1400, bottom: 1900 },
  { id: 'grooming-and-care', top: 1900, bottom: 2400 },
] as const;

describe('pickActiveServiceCategory', () => {
  it('keeps the first category while the reading line is above the menu', () => {
    expect(pickActiveServiceCategory(sections, 120)).toBe('cuts-and-fades');
  });

  it('activates a category when its top reaches the reading line', () => {
    expect(pickActiveServiceCategory(sections, 400)).toBe('cuts-and-fades');
    expect(pickActiveServiceCategory(sections, 900)).toBe('beard-and-shave');
    expect(pickActiveServiceCategory(sections, 1400)).toBe('hair-and-beard-combos');
  });

  it('does not flicker to the next category before its top reaches the line', () => {
    expect(pickActiveServiceCategory(sections, 899)).toBe('cuts-and-fades');
    expect(pickActiveServiceCategory(sections, 1399)).toBe('beard-and-shave');
  });

  it('keeps the last category near the menu footer', () => {
    expect(pickActiveServiceCategory(sections, 1900)).toBe('grooming-and-care');
    expect(pickActiveServiceCategory(sections, 2200, 2100)).toBe('grooming-and-care');
  });
});

describe('serviceMenuReadingY', () => {
  it('places the reading line below the fixed header', () => {
    expect(serviceMenuReadingY(66, 88)).toBe(154);
  });
});
