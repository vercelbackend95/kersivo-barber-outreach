/**
 * Colours of the small "how your website looks" preview (BrandSitePreview). One copy of the maths for the
 * Brand colours app and the Overview tile, so the same Main / Accent / tone always paint the same site.
 */
import { betterButtonText, siteBackgroundHex, siteTextHex } from './contrast';
import { oklchToHex } from './space';
import type { BrandBackgroundTone } from './types';

export type SitePreviewPaint = { background: string; color: string };

export type SitePreviewColours = {
  main: string | null;
  accent: string | null;
  /** Website background (tone, in Main's hue) and its body text. */
  background: string;
  text: string;
  /** Hero: Main (neutral grey without one), with an Accent glow when there is an Accent. */
  hero: SitePreviewPaint;
  heroText: string;
  /** "Book" buttons: Accent; without one, the site background on the Main hero (or inverted greys). */
  button: SitePreviewPaint;
  /** Service-row marker. */
  marker: string;
  /** First time slot: Main with readable text; without Main, an outline only. */
  slot: { background?: string; color?: string; borderColor: string };
  /** Other time slots / row dividers (text colour at low alpha). */
  slotBorder: string;
  divider: string;
};

/** Neutral greys when there is no Main yet — never a made-up brand colour. */
export function neutralHeroHex(tone: BrandBackgroundTone): string {
  return oklchToHex({ L: tone === 'LIGHT' ? 0.88 : 0.3, C: 0, h: 0 });
}

export function sitePreviewColours(input: {
  mainHex?: string | null;
  accentHex?: string | null;
  tone: BrandBackgroundTone;
}): SitePreviewColours {
  const main = input.mainHex || null;
  const accent = input.accentHex || null;
  const background = siteBackgroundHex(input.tone, main);
  const text = siteTextHex(input.tone);
  const heroBg = main ?? neutralHeroHex(input.tone);
  const heroText = betterButtonText(heroBg);
  const button = accent
    ? { background: accent, color: betterButtonText(accent) }
    : main
      ? { background, color: text }
      : { background: text, color: background };
  const slotBorder = `${text}2E`;
  return {
    main,
    accent,
    background,
    text,
    hero: {
      background: accent ? `radial-gradient(90% 90% at 85% 0%, ${accent}59, transparent 55%), ${heroBg}` : heroBg,
      color: heroText,
    },
    heroText,
    button,
    marker: accent ?? main ?? text,
    slot: main ? { background: main, color: betterButtonText(main), borderColor: main } : { borderColor: slotBorder },
    slotBorder,
    divider: `${text}1F`,
  };
}
