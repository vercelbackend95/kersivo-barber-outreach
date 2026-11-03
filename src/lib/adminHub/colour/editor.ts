/**
 * Pure state helpers for the Brand colours app: palette merge, hex input, role edits and one-level undo.
 */
import { normaliseHexColour } from './hex';
import { deltaEok, hexToOklab } from './space';
import { swatchFromHex } from './extract';
import {
  MAX_PALETTE,
  PALETTE_DUPLICATE_DE_OK,
  type BrandBackgroundTone,
  type BrandColoursSource,
  type ColourRole,
  type ExtractedSwatch,
} from './types';

function nearDuplicate(hex: string, rows: ExtractedSwatch[]): boolean {
  const lab = hexToOklab(hex);
  if (!lab) return true;
  return rows.some((row) => {
    const other = hexToOklab(row.hex);
    return other ? deltaEok(lab, other) < PALETTE_DUPLICATE_DE_OK : false;
  });
}

/**
 * Logo clusters first (by share), then saved / manual swatches that are not within ΔE_OK 0.02 of one already kept,
 * capped at MAX_PALETTE. The current Main / Accent always stay in the list (they replace the last extras if needed).
 */
export function mergePalette(input: {
  logo: ExtractedSwatch[];
  saved: ExtractedSwatch[];
  keep?: Array<string | null | undefined>;
  cap?: number;
}): ExtractedSwatch[] {
  const cap = input.cap ?? MAX_PALETTE;
  const keep = (input.keep ?? [])
    .map((hex) => normaliseHexColour(hex ?? ''))
    .filter((hex): hex is string => Boolean(hex));
  const rows: ExtractedSwatch[] = [];
  for (const row of [...input.logo].sort((a, b) => b.share - a.share)) {
    if (!rows.some((kept) => kept.hex === row.hex)) rows.push(row);
  }
  for (const row of input.saved) {
    if (!nearDuplicate(row.hex, rows)) rows.push(row);
  }
  for (const hex of keep) {
    if (rows.some((row) => row.hex === hex)) continue;
    const extra = swatchFromHex(hex, 0);
    if (extra) rows.push(extra);
  }
  if (rows.length <= cap) return rows;
  // Over the cap: drop the last rows that are not Main / Accent.
  const out = [...rows];
  for (let i = out.length - 1; i >= 0 && out.length > cap; i -= 1) {
    if (!keep.includes(out[i]!.hex)) out.splice(i, 1);
  }
  return out.slice(0, cap);
}

/** Add one owner-picked colour (hex box / screen picker) to the palette without duplicating a near match. */
export function addToPalette(rows: ExtractedSwatch[], hex: string, keep: Array<string | null | undefined>): ExtractedSwatch[] {
  const swatch = swatchFromHex(hex, 0);
  if (!swatch || rows.some((row) => row.hex === swatch.hex)) return rows;
  return mergePalette({ logo: [], saved: [...rows, swatch], keep: [...keep, swatch.hex] });
}

export type HexInputResult =
  | { ok: true; hex: string }
  | { ok: false; reason: 'empty' | 'chars' | 'length' };

/** #RGB / #RRGGBB, with or without “#”. `final` = the owner pressed Enter / Use (length errors only then). */
export function parseHexInput(raw: string, final = true): HexInputResult {
  const body = raw.trim().replace(/^#/, '');
  if (!body) return { ok: false, reason: 'empty' };
  if (!/^[0-9A-Fa-f]*$/.test(body)) return { ok: false, reason: 'chars' };
  if (body.length > 6) return { ok: false, reason: 'length' };
  const hex = body.length === 3 || body.length === 6 ? normaliseHexColour(`#${body}`) : null;
  if (hex) return { ok: true, hex };
  return { ok: false, reason: final ? 'length' : 'empty' };
}

export type ColourSnapshot = {
  main: string;
  accent: string;
  tone: BrandBackgroundTone;
  source: BrandColoursSource;
};

export type EditResult = { next: ColourSnapshot; note: 'same-hex' | null };

function same(a: ColourSnapshot, b: ColourSnapshot): boolean {
  return a.main === b.main && a.accent === b.accent && a.tone === b.tone && a.source === b.source;
}

export function snapshotsEqual(a: ColourSnapshot, b: ColourSnapshot): boolean {
  return same(a, b);
}

/** Set one role. Main and Accent can never share a hex: the edit is refused and the previous value kept. */
export function setRoleColour(
  state: ColourSnapshot,
  role: ColourRole,
  hex: string,
  source: BrandColoursSource = state.source,
): EditResult {
  const value = normaliseHexColour(hex);
  if (!value) return { next: state, note: null };
  const other = role === 'main' ? state.accent : state.main;
  if (other && other === value) return { next: state, note: 'same-hex' };
  return { next: { ...state, [role]: value, source }, note: null };
}

export function swapRoles(state: ColourSnapshot): ColourSnapshot {
  if (!state.main && !state.accent) return state;
  return { ...state, main: state.accent, accent: state.main };
}

export function clearAccent(state: ColourSnapshot): ColourSnapshot {
  return state.accent ? { ...state, accent: '' } : state;
}

/** One-level undo: remember the state before the last change. */
export type UndoState = { current: ColourSnapshot; previous: ColourSnapshot | null };

export function commitEdit(undo: UndoState, next: ColourSnapshot, before: ColourSnapshot = undo.current): UndoState {
  if (same(before, next)) return { current: next, previous: undo.previous };
  return { current: next, previous: before };
}

export function undoEdit(undo: UndoState): UndoState {
  if (!undo.previous) return undo;
  return { current: undo.previous, previous: null };
}
