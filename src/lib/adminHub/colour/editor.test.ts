import { describe, expect, it } from 'vitest';
import {
  addToPalette,
  clearAccent,
  commitEdit,
  mergePalette,
  parseHexInput,
  setRoleColour,
  swapRoles,
  undoEdit,
  type ColourSnapshot,
  type UndoState,
} from './editor';
import { swatchFromHex } from './extract';
import type { ExtractedSwatch } from './types';

const sw = (hex: string, share = 0) => swatchFromHex(hex, share) as ExtractedSwatch;
const hexes = (rows: ExtractedSwatch[]) => rows.map((row) => row.hex);

describe('mergePalette', () => {
  const logo = [sw('#C9A24A', 0.3), sw('#1F6F6B', 0.5), sw('#141414', 0.2)];

  it('puts logo clusters first by share, then saved / manual colours', () => {
    const rows = mergePalette({ logo, saved: [sw('#22AA88')] });
    expect(hexes(rows)).toEqual(['#1F6F6B', '#C9A24A', '#141414', '#22AA88']);
  });

  it('drops saved colours within ΔE_OK 0.02 of a logo cluster', () => {
    // #1F706B is one step away from #1F6F6B; #8A2D2D is clearly different.
    const rows = mergePalette({ logo, saved: [sw('#1F706B'), sw('#8A2D2D')] });
    expect(hexes(rows)).toEqual(['#1F6F6B', '#C9A24A', '#141414', '#8A2D2D']);
  });

  it('caps at six and always keeps the current Main / Accent', () => {
    const saved = ['#8A2D2D', '#2D4C8A', '#7A3A8A', '#3A8A4C', '#E07B39'].map((hex) => sw(hex));
    const rows = mergePalette({ logo, saved, keep: ['#E07B39', '#ABCDEF'] });
    expect(rows).toHaveLength(6);
    expect(hexes(rows)).toContain('#E07B39');
    expect(hexes(rows)).toContain('#ABCDEF');
    expect(hexes(rows).slice(0, 3)).toEqual(['#1F6F6B', '#C9A24A', '#141414']);
  });

  it('keeps a typed hex that is not in the logo', () => {
    const rows = mergePalette({ logo, saved: [], keep: ['#22aa88'] });
    expect(hexes(rows)).toContain('#22AA88');
  });

  it('addToPalette appends a picked colour once', () => {
    const rows = addToPalette(mergePalette({ logo, saved: [] }), '#22AA88', []);
    expect(hexes(rows)).toEqual(['#1F6F6B', '#C9A24A', '#141414', '#22AA88']);
    expect(addToPalette(rows, '#22AA88', [])).toBe(rows);
  });
});

describe('parseHexInput', () => {
  it('accepts #RGB / #RRGGBB with or without #', () => {
    expect(parseHexInput('#1f6f6b')).toEqual({ ok: true, hex: '#1F6F6B' });
    expect(parseHexInput('1F6F6B')).toEqual({ ok: true, hex: '#1F6F6B' });
    expect(parseHexInput('#abc')).toEqual({ ok: true, hex: '#AABBCC' });
    expect(parseHexInput(' abc ')).toEqual({ ok: true, hex: '#AABBCC' });
  });

  it('rejects bad characters at once and wrong lengths on submit', () => {
    expect(parseHexInput('#12zz')).toEqual({ ok: false, reason: 'chars' });
    expect(parseHexInput('#1234567')).toEqual({ ok: false, reason: 'length' });
    expect(parseHexInput('#1234', false)).toEqual({ ok: false, reason: 'empty' });
    expect(parseHexInput('#1234')).toEqual({ ok: false, reason: 'length' });
    expect(parseHexInput('')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('role edits', () => {
  const base: ColourSnapshot = { main: '#1F6F6B', accent: '#C9A24A', tone: 'DARK', source: 'LOGO' };

  it('swaps main and accent', () => {
    expect(swapRoles(base)).toEqual({ ...base, main: '#C9A24A', accent: '#1F6F6B' });
  });

  it('clears the accent', () => {
    expect(clearAccent(base)).toEqual({ ...base, accent: '' });
  });

  it('refuses the same hex for Main and Accent and keeps the previous value', () => {
    const result = setRoleColour(base, 'accent', '#1f6f6b');
    expect(result.note).toBe('same-hex');
    expect(result.next).toBe(base);
    expect(setRoleColour(base, 'accent', '#22AA88', 'MANUAL')).toEqual({
      next: { ...base, accent: '#22AA88', source: 'MANUAL' },
      note: null,
    });
  });

  it('undoes the last change only', () => {
    let undo: UndoState = { current: base, previous: null };
    undo = commitEdit(undo, swapRoles(undo.current));
    undo = commitEdit(undo, clearAccent(undo.current));
    expect(undo.current.accent).toBe('');
    undo = undoEdit(undo);
    expect(undo.current).toEqual(swapRoles(base));
    expect(undo.previous).toBeNull();
    expect(undoEdit(undo)).toBe(undo);
  });

  it('a slider drag commits once against the value at drag start', () => {
    let undo: UndoState = { current: base, previous: null };
    const start = undo.current;
    undo = { ...undo, current: { ...undo.current, main: '#226F6B' } };
    undo = { ...undo, current: { ...undo.current, main: '#2A6F6B' } };
    undo = commitEdit(undo, undo.current, start);
    expect(undo.previous).toEqual(base);
    expect(undoEdit(undo).current).toEqual(base);
  });
});
