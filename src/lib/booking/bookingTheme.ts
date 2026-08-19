export type BookingAppearance = 'dark' | 'light';
export type BookingThemePreset = 'blackline' | 'kersivo' | 'light';

export type BookingThemeInput = {
  appearance: BookingAppearance;
  accent: string;
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  fontDisplay: string;
  fontBody: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  shadow: string;
  shadowHover: string;
  logoUrl?: string | null;
  shopName?: string | null;
};

export type BookingThemeResolved = BookingThemeInput & {
  accentHover: string;
  accentPressed: string;
  accentContrast: string;
  accentSoft: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
};

const WHITE = '#ffffff';
const BLACK = '#0b0d10';

export const BOOKING_THEME_PRESETS: Record<BookingThemePreset, BookingThemeInput> = {
  blackline: {
    appearance: 'dark',
    accent: '#315ef5',
    background: '#0b0c0e',
    backgroundElevated: '#121316',
    surface: '#17181c',
    surfaceRaised: '#1e2025',
    surfaceHover: '#24262c',
    border: 'rgba(244, 241, 234, 0.12)',
    borderStrong: 'rgba(244, 241, 234, 0.22)',
    text: '#f4f1ea',
    textMuted: '#b8b4ab',
    textSubtle: '#8c8880',
    fontDisplay: '"Bebas Neue", "Arial Narrow", Impact, sans-serif',
    fontBody: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    radiusSm: '10px',
    radiusMd: '14px',
    radiusLg: '20px',
    shadow: '0 12px 32px rgb(0 0 0 / 0.28)',
    shadowHover: '0 16px 40px rgb(0 0 0 / 0.34)',
    shopName: 'Blackline Barbers',
  },
  kersivo: {
    appearance: 'dark',
    accent: '#d72638',
    background: '#030303',
    backgroundElevated: '#070707',
    surface: '#0d0d0d',
    surfaceRaised: '#141414',
    surfaceHover: '#1a1a1a',
    border: '#24201c',
    borderStrong: '#3a342c',
    text: '#fff8ee',
    textMuted: '#c9c1b7',
    textSubtle: '#9a9288',
    fontDisplay: '"Bebas Neue", "Arial Narrow", Impact, sans-serif',
    fontBody: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    shadow: '0 12px 32px rgb(0 0 0 / 0.32)',
    shadowHover: '0 18px 40px rgb(0 0 0 / 0.38)',
    shopName: 'KERSIVO',
  },
  light: {
    appearance: 'light',
    accent: '#c41e3a',
    background: '#f4f1ea',
    backgroundElevated: '#fffdf8',
    surface: '#ffffff',
    surfaceRaised: '#fffdf8',
    surfaceHover: '#f7f3ec',
    border: '#e4ddd0',
    borderStrong: '#cfc6b6',
    text: '#161412',
    textMuted: '#5c574e',
    textSubtle: '#7a7468',
    fontDisplay: '"Bebas Neue", "Arial Narrow", Impact, sans-serif',
    fontBody: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    shadow: '0 10px 28px rgb(22 20 18 / 0.08)',
    shadowHover: '0 14px 32px rgb(22 20 18 / 0.12)',
  },
};

export function parseCssColor(input: string): { r: number; g: number; b: number } | null {
  const value = input.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    const full =
      raw.length === 3
        ? raw
            .split('')
            .map((part) => part + part)
            .join('')
        : raw;
    const int = Number.parseInt(full, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number | null {
  const rgb = parseCssColor(color);
  if (!rgb) return null;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickAccentContrast(accent: string): string {
  const white = contrastRatio(WHITE, accent) ?? 0;
  const black = contrastRatio(BLACK, accent) ?? 0;
  return white >= black && white >= 4.5 ? WHITE : black >= 4.5 ? BLACK : white >= black ? WHITE : BLACK;
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('')}`;
}

export function mixColors(a: string, b: string, amount: number): string {
  const left = parseCssColor(a);
  const right = parseCssColor(b);
  if (!left || !right) return a;
  const t = Math.max(0, Math.min(1, amount));
  return toHex({
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t,
  });
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseCssColor(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function resolveBookingTheme(
  preset: BookingThemePreset = 'kersivo',
  overrides: Partial<BookingThemeInput> = {},
): BookingThemeResolved {
  const base = { ...BOOKING_THEME_PRESETS[preset], ...overrides };
  const accentContrast = pickAccentContrast(base.accent);
  const accentLum = relativeLuminance(base.accent) ?? 0;
  const hoverMix = accentLum > 0.45 ? BLACK : WHITE;
  return {
    ...base,
    accentHover: mixColors(base.accent, hoverMix, accentLum > 0.45 ? 0.16 : 0.12),
    accentPressed: mixColors(base.accent, hoverMix, accentLum > 0.45 ? 0.28 : 0.2),
    accentContrast,
    accentSoft: withAlpha(base.accent, base.appearance === 'light' ? 0.12 : 0.16),
    focusRing: withAlpha(base.accent, 0.42),
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
  };
}

export function bookingThemeToCssVars(theme: BookingThemeResolved): Record<string, string> {
  return {
    '--booking-bg': theme.background,
    '--booking-bg-elevated': theme.backgroundElevated,
    '--booking-surface': theme.surface,
    '--booking-surface-raised': theme.surfaceRaised,
    '--booking-surface-hover': theme.surfaceHover,
    '--booking-border': theme.border,
    '--booking-border-strong': theme.borderStrong,
    '--booking-text': theme.text,
    '--booking-text-muted': theme.textMuted,
    '--booking-text-subtle': theme.textSubtle,
    '--booking-accent': theme.accent,
    '--booking-accent-hover': theme.accentHover,
    '--booking-accent-pressed': theme.accentPressed,
    '--booking-accent-contrast': theme.accentContrast,
    '--booking-accent-soft': theme.accentSoft,
    '--booking-focus-ring': theme.focusRing,
    '--booking-success': theme.success,
    '--booking-warning': theme.warning,
    '--booking-danger': theme.danger,
    '--booking-radius-sm': theme.radiusSm,
    '--booking-radius-md': theme.radiusMd,
    '--booking-radius-lg': theme.radiusLg,
    '--booking-shadow': theme.shadow,
    '--booking-shadow-hover': theme.shadowHover,
    '--booking-font-display': theme.fontDisplay,
    '--booking-font-body': theme.fontBody,
  };
}
