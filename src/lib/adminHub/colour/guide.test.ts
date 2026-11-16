import { describe, expect, it } from 'vitest';
import {
  BARBERSHOP_PAIRS,
  accentSuggestions,
  buttonTextPasses,
  colourBlindSafe,
  contrastMeter,
  mainOnBackgroundPasses,
  readabilityReport,
  simulateVision,
  standsOut,
} from './guide';
import { contrastRatio, siteBackgroundHex } from './contrast';

describe('readabilityReport', () => {
  it('passes a well-chosen pair and lists the two required checks first', () => {
    const report = readabilityReport({ mainHex: '#C9A24A', accentHex: '#7A1F2B', tone: 'DARK' });
    expect(report.checks.map((row) => row.id)).toEqual(['button', 'main', 'accentBg', 'distinct', 'colourBlind']);
    expect(report.checks.filter((row) => row.level === 'required').every((row) => row.pass)).toBe(true);
    expect(report.failing).toBe(0);
    expect(report.fixAll).toBeNull();
  });

  it('flags a dark Main on a dark background, fixes it lighter and offers the light background', () => {
    const report = readabilityReport({ mainHex: '#1D3557', accentHex: null, tone: 'DARK' });
    const main = report.checks.find((row) => row.id === 'main')!;
    expect(main.pass).toBe(false);
    if (main.fix?.kind !== 'colour') throw new Error('no fix');
    expect(main.fix.direction).toBe('lighter');
    expect(mainOnBackgroundPasses(main.fix.hex, 'DARK')).toBe(true);
    expect(report.toneSwitch).toEqual({ tone: 'LIGHT' });
  });

  it('fix all fixes both roles in one go', () => {
    const report = readabilityReport({ mainHex: '#1D3557', accentHex: '#7A7A7A', tone: 'DARK' });
    expect(report.failing).toBe(2);
    expect(report.fixAll?.main).toBeTruthy();
    expect(report.fixAll?.accent).toBeTruthy();
    const after = readabilityReport({ mainHex: report.fixAll!.main!, accentHex: report.fixAll!.accent!, tone: 'DARK' });
    expect(after.failing).toBe(0);
  });

  it('tips: a near-identical accent does not stand out and gets a suggested accent', () => {
    const report = readabilityReport({ mainHex: '#C9A24A', accentHex: '#CDA650', tone: 'DARK' });
    const distinct = report.checks.find((row) => row.id === 'distinct')!;
    expect(distinct.pass).toBe(false);
    expect(distinct.level).toBe('tip');
    if (distinct.fix?.kind !== 'accent') throw new Error('no suggestion');
    expect(standsOut('#C9A24A', distinct.fix.hex)).toBe(true);
  });

  it('tips: red and green of the same lightness are not colour-blind safe', () => {
    expect(colourBlindSafe('#B5502A', '#5E8C2A')).toBe(false);
    expect(colourBlindSafe('#1D3557', '#E3C58E')).toBe(true);
  });

  it('no colours: no checks, nothing failing', () => {
    const report = readabilityReport({ mainHex: null, accentHex: null, tone: 'DARK' });
    expect(report.checks).toEqual([]);
    expect(report.failing).toBe(0);
  });
});

describe('suggestions and presets', () => {
  it('every barbershop pair passes both required checks and stands out', () => {
    for (const pair of BARBERSHOP_PAIRS) {
      const report = readabilityReport({ mainHex: pair.main, accentHex: pair.accent, tone: pair.tone });
      expect({ id: pair.id, failing: report.failing }).toEqual({ id: pair.id, failing: 0 });
      expect(standsOut(pair.main, pair.accent)).toBe(true);
    }
  });

  it('accent suggestions all pass and are different from each other', () => {
    for (const [mainHex, tone] of [
      ['#1F6F6B', 'DARK'],
      ['#7A1F2B', 'LIGHT'],
      ['#808080', 'DARK'],
    ] as const) {
      const rows = accentSuggestions({ mainHex, tone });
      expect(rows.length).toBeGreaterThanOrEqual(3);
      const bg = siteBackgroundHex(tone, mainHex);
      for (const row of rows) {
        expect(buttonTextPasses(row.hex)).toBe(true);
        expect(contrastRatio(row.hex, bg)).toBeGreaterThanOrEqual(3);
        expect(standsOut(mainHex, row.hex)).toBe(true);
      }
      expect(new Set(rows.map((row) => row.hex)).size).toBe(rows.length);
    }
  });

  it('simulates colour blindness and maps the meter', () => {
    expect(simulateVision('#FFFFFF', 'deuteranopia')).toBe('#FFFFFF');
    expect(simulateVision('#FF0000', 'deuteranopia')).not.toBe('#FF0000');
    expect(contrastMeter(1)).toBe(0);
    expect(contrastMeter(7)).toBe(1);
    expect(contrastMeter(21)).toBe(1);
  });
});
