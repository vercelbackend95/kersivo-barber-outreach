import { describe, expect, it } from 'vitest';
import {
  bookingThemeToCssVars,
  contrastRatio,
  mixColors,
  pickAccentContrast,
  resolveBookingTheme,
} from './bookingTheme';
import { groupTimeSlots, shiftIsoDate, startOfIsoWeek } from './bookingDateUi';

describe('booking theme contract', () => {
  it('picks readable accent contrast for light and dark accents', () => {
    expect(pickAccentContrast('#fff4c2')).toBe('#0b0d10');
    expect(pickAccentContrast('#111111')).toBe('#ffffff');
    expect(pickAccentContrast('#d72638')).toBe('#ffffff');
    const lightAccent = contrastRatio(pickAccentContrast('#ffe08a'), '#ffe08a');
    expect(lightAccent ?? 0).toBeGreaterThanOrEqual(4.5);
  });

  it('maps presets to scoped CSS variables without tenant-specific component rules', () => {
    const blackline = resolveBookingTheme('blackline');
    const kersivo = resolveBookingTheme('kersivo');
    const light = resolveBookingTheme('light', { shopName: 'North Street Cuts', logoUrl: null });
    const pale = resolveBookingTheme('light', { accent: '#ffe08a' });
    const ink = resolveBookingTheme('kersivo', { accent: '#101010' });

    expect(bookingThemeToCssVars(blackline)['--booking-accent']).toBe('#315ef5');
    expect(bookingThemeToCssVars(kersivo)['--booking-accent']).toBe('#d72638');
    expect(light.appearance).toBe('light');
    expect(light.shopName).toBe('North Street Cuts');
    expect(pale.accentContrast).toBe('#0b0d10');
    expect(ink.accentContrast).toBe('#ffffff');
    expect(light.logoUrl).toBeNull();

    const longName = 'North Street Traditional Gentlemen’s Grooming Company of Brighton & Hove';
    const branded = resolveBookingTheme('light', { shopName: longName, logoUrl: null });
    expect(branded.shopName).toBe(longName);
    expect(branded.logoUrl).toBeNull();
    expect(bookingThemeToCssVars(branded)['--booking-accent']).toBeTruthy();
  });

  it('keeps selected-state text readable on a soft accent surface', () => {
    const cases = [
      resolveBookingTheme('kersivo'),
      resolveBookingTheme('blackline'),
      resolveBookingTheme('light'),
      resolveBookingTheme('light', { accent: '#ffe08a' }),
    ];

    for (const theme of cases) {
      const selectedSurface = mixColors(theme.surface, theme.accent, 0.14);
      const ratio = contrastRatio(theme.text, selectedSurface);
      expect(ratio ?? 0).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accentContrast, theme.accent) ?? 0).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('booking date helpers', () => {
  it('keeps ISO dates stable when shifting weeks', () => {
    expect(startOfIsoWeek('2026-08-19')).toBe('2026-08-17');
    expect(shiftIsoDate('2026-08-17', 7)).toBe('2026-08-24');
  });

  it('omits empty time-of-day groups', () => {
    expect(groupTimeSlots(['09:00', '18:30']).map((group) => group.id)).toEqual(['morning', 'evening']);
  });
});
