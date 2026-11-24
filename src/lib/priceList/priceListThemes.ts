/**
 * Sheet styles for /barbershop-price-list-template. One source for the on-page sheet (CSS custom
 * properties), the printed sheet and the downloaded image, so all three always match.
 */

export type PriceListThemeId = 'paper' | 'chalk' | 'shopfront' | 'clean';

export type PriceListTheme = {
  id: PriceListThemeId;
  label: string;
  /** Short hint read by screen readers with the label. */
  hint: string;
  bg: string;
  ink: string;
  muted: string;
  leader: string;
  /** Rule under the shop name. */
  rule: string;
  /** Title face: the condensed display face or the UI face set bold. */
  titleFace: 'display' | 'ui';
};

export const PRICE_LIST_THEMES: readonly PriceListTheme[] = [
  {
    id: 'paper',
    label: 'Paper',
    hint: 'warm off-white, black ink',
    bg: '#f4f1ea',
    ink: '#141414',
    muted: '#5f5a51',
    leader: '#9a958b',
    rule: '#141414',
    titleFace: 'display',
  },
  {
    id: 'chalk',
    label: 'Chalkboard',
    hint: 'dark slate, chalk white',
    bg: '#1f2624',
    ink: '#f1efe6',
    muted: '#b4bbb3',
    leader: '#7d8780',
    rule: '#f1efe6',
    titleFace: 'display',
  },
  {
    id: 'shopfront',
    label: 'Shopfront',
    hint: 'black, white type, red rule',
    bg: '#0a0a0b',
    ink: '#ffffff',
    muted: '#a3a3a8',
    leader: '#5c5c61',
    rule: '#d72638',
    titleFace: 'display',
  },
  {
    id: 'clean',
    label: 'Clean',
    hint: 'white, modern type',
    bg: '#ffffff',
    ink: '#111111',
    muted: '#5c5c5c',
    leader: '#c4c4c4',
    rule: '#e2e2e2',
    titleFace: 'ui',
  },
];

export const PRICE_LIST_DEFAULT_THEME: PriceListThemeId = 'paper';

export function getPriceListTheme(id: string | null | undefined): PriceListTheme {
  return PRICE_LIST_THEMES.find((theme) => theme.id === id) ?? PRICE_LIST_THEMES[0];
}

/** Inline CSS custom properties for the sheet and the style swatches. */
export function priceListThemeStyle(theme: PriceListTheme): string {
  return [
    `--pl-bg:${theme.bg}`,
    `--pl-ink:${theme.ink}`,
    `--pl-muted:${theme.muted}`,
    `--pl-leader:${theme.leader}`,
    `--pl-rule:${theme.rule}`,
  ].join(';');
}
