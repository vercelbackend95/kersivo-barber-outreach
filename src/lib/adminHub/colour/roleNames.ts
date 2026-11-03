/**
 * Main / Accent names that never read the same for two different colours. The name table (nameSwatch) is coarse,
 * so e.g. #401010 and #742A27 are both "Copper"; then one of them gets a lightness word ("Dark copper" / "Copper",
 * or "Copper" / "Light copper"). Equal hexes are prevented by the editor, so they keep the same name.
 */
import { nameSwatch } from './name';
import { hexToClampedOklch } from './space';
import type { OkLch } from './types';

/** Names that already mean "very dark" / "very light": tag the other side instead. */
const DARK_NAMES = new Set(['Ink', 'Charcoal', 'Navy']);
const LIGHT_NAMES = new Set(['Cream']);
/** Above this mean lightness the lighter colour is tagged ("Light …"), otherwise the darker ("Dark …"). */
const TAG_LIGHTER_FROM_L = 0.6;

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

function sameHex(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function distinguish(name: string, main: OkLch, accent: OkLch): { main: string; accent: string } {
  if (main.L !== accent.L) {
    const mainIsDarker = main.L < accent.L;
    const tagLighter = DARK_NAMES.has(name)
      ? true
      : LIGHT_NAMES.has(name)
        ? false
        : (main.L + accent.L) / 2 >= TAG_LIGHTER_FROM_L;
    const word = name === 'Ink' ? 'Soft' : tagLighter ? 'Light' : 'Dark';
    const tagged = `${word} ${lower(name)}`;
    const mainTagged = tagLighter ? !mainIsDarker : mainIsDarker;
    return mainTagged ? { main: tagged, accent: name } : { main: name, accent: tagged };
  }
  if (main.C !== accent.C) {
    const tagged = `Muted ${lower(name)}`;
    return main.C < accent.C ? { main: tagged, accent: name } : { main: name, accent: tagged };
  }
  // Same lightness and chroma, a slightly different hue: still never the same label.
  return { main: name, accent: `Alt. ${lower(name)}` };
}

export function distinctRoleNames(
  mainHex: string | null | undefined,
  accentHex: string | null | undefined,
): { main: string | null; accent: string | null } {
  const mainLch = mainHex ? hexToClampedOklch(mainHex) : null;
  const accentLch = accentHex ? hexToClampedOklch(accentHex) : null;
  const main = mainLch ? nameSwatch(mainLch) : null;
  const accent = accentLch ? nameSwatch(accentLch) : null;
  if (!main || !accent || main !== accent || !mainLch || !accentLch || sameHex(mainHex!, accentHex!)) {
    return { main, accent };
  }
  return distinguish(main, mainLch, accentLch);
}
