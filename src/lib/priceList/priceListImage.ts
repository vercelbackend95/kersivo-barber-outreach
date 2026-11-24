/**
 * Instagram-size image (1080 x 1350, 4:5) of the price list. The layout is pure (text measuring is
 * passed in) so it can be tested without a canvas; drawPriceListImage paints it in the browser.
 */
import { formatItemPrice, formatMinutes, normalisePriceList, type PriceListOptions } from './priceListText';
import type { PriceListTheme } from './priceListThemes';

export const PRICE_LIST_IMAGE_WIDTH = 1080;
export const PRICE_LIST_IMAGE_HEIGHT = 1350;

const PAD_X = 96;
const TOP = 120;
const BOTTOM = 110;
const DISPLAY_FAMILY = '"Bebas Neue", "Arial Narrow", Impact, sans-serif';
const UI_FAMILY = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Shown on the sheet and the image until the owner types a shop name. */
export const PRICE_LIST_FALLBACK_TITLE = 'Your barbershop';

export type MeasureText = (text: string, font: string) => number;

export type ImageRow = {
  name: string;
  time: string;
  price: string;
  missing: boolean;
  y: number;
};

export type PriceListImageLayout = {
  width: number;
  height: number;
  padX: number;
  eyebrowY: number;
  title: string;
  titleFont: string;
  titleY: number;
  ruleY: number;
  itemFont: string;
  priceFont: string;
  timeFont: string;
  rows: ImageRow[];
  footer: string;
  footerFont: string;
  footerY: number;
};

export function titleFontFor(theme: PriceListTheme, size: number): string {
  return theme.titleFace === 'display' ? `400 ${size}px ${DISPLAY_FAMILY}` : `700 ${size}px ${UI_FAMILY}`;
}

/** Cuts text to fit maxWidth, adding an ellipsis when it had to cut. */
export function fitText(text: string, font: string, maxWidth: number, measure: MeasureText): string {
  if (measure(text, font) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && measure(`${cut}…`, font) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export function layoutPriceListImage(
  input: PriceListOptions,
  theme: PriceListTheme,
  measure: MeasureText,
): PriceListImageLayout {
  const options = normalisePriceList(input);
  const width = PRICE_LIST_IMAGE_WIDTH;
  const height = PRICE_LIST_IMAGE_HEIGHT;
  const contentWidth = width - PAD_X * 2;

  // Title: largest size that fits on one line, down to a floor; then cut.
  // The display face is set in capitals, as on the page.
  const name = options.shopName || PRICE_LIST_FALLBACK_TITLE;
  const fullTitle = theme.titleFace === 'display' ? name.toUpperCase() : name;
  let titleSize = theme.titleFace === 'display' ? 168 : 112;
  const titleFloor = theme.titleFace === 'display' ? 84 : 60;
  while (titleSize > titleFloor && measure(fullTitle, titleFontFor(theme, titleSize)) > contentWidth) titleSize -= 4;
  const titleFont = titleFontFor(theme, titleSize);
  const title = fitText(fullTitle, titleFont, contentWidth, measure);

  const eyebrowY = TOP;
  const titleY = eyebrowY + 36 + titleSize * 0.92;
  const ruleY = titleY + 40;

  const footerSize = 30;
  const footerFont = `500 ${footerSize}px ${UI_FAMILY}`;
  const footer = options.footer ? fitText(options.footer, footerFont, contentWidth, measure) : '';
  const footerY = height - BOTTOM;

  // Rows share the space between the rule and the footer; the type shrinks for long lists.
  const listTop = ruleY + 64;
  const listBottom = footer ? footerY - footerSize - 56 : height - BOTTOM;
  const count = Math.max(options.items.length, 1);
  const step = Math.min(96, (listBottom - listTop) / count);
  const itemSize = Math.max(22, Math.min(44, Math.round(step * 0.46)));
  const itemFont = `600 ${itemSize}px ${UI_FAMILY}`;
  const priceFont = `700 ${itemSize}px ${UI_FAMILY}`;
  const timeFont = `400 ${Math.round(itemSize * 0.72)}px ${UI_FAMILY}`;

  const rows: ImageRow[] = options.items.map((item, index) => {
    const price = formatItemPrice(item);
    const time = options.showDuration && item.minutes !== null ? formatMinutes(item.minutes) : '';
    const priceWidth = measure(price, priceFont);
    const timeWidth = time ? measure(` ${time}`, timeFont) + 12 : 0;
    const nameRoom = contentWidth - priceWidth - timeWidth - 48;
    return {
      name: fitText(item.name, itemFont, Math.max(nameRoom, 80), measure),
      time,
      price,
      missing: item.priceGbp === null,
      y: listTop + step * index + itemSize,
    };
  });

  return {
    width,
    height,
    padX: PAD_X,
    eyebrowY,
    title,
    titleFont,
    titleY,
    ruleY,
    itemFont,
    priceFont,
    timeFont,
    rows,
    footer,
    footerFont,
    footerY,
  };
}

/** Paints the layout. Call after the page fonts have loaded so the canvas uses them. */
export function drawPriceListImage(ctx: CanvasRenderingContext2D, layout: PriceListImageLayout, theme: PriceListTheme): void {
  const { width, height, padX } = layout;
  const right = width - padX;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = theme.muted;
  ctx.font = `700 24px ${UI_FAMILY}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('PRICE LIST', padX, layout.eyebrowY);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = theme.ink;
  ctx.font = layout.titleFont;
  ctx.fillText(layout.title, padX, layout.titleY);

  ctx.fillStyle = theme.rule;
  ctx.fillRect(padX, layout.ruleY, width - padX * 2, theme.id === 'shopfront' ? 6 : 4);

  for (const row of layout.rows) {
    ctx.font = layout.itemFont;
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'left';
    ctx.fillText(row.name, padX, row.y);
    let nameEnd = padX + ctx.measureText(row.name).width;

    if (row.time) {
      ctx.font = layout.timeFont;
      ctx.fillStyle = theme.muted;
      ctx.fillText(row.time, nameEnd + 14, row.y);
      nameEnd += 14 + ctx.measureText(row.time).width;
    }

    ctx.font = layout.priceFont;
    ctx.textAlign = 'right';
    ctx.fillStyle = row.missing ? theme.leader : theme.ink;
    ctx.fillText(row.price, right, row.y);
    const priceStart = right - ctx.measureText(row.price).width;

    // Dotted leader between name and price.
    ctx.fillStyle = theme.leader;
    const leaderY = row.y - 6;
    for (let x = nameEnd + 18; x < priceStart - 14; x += 12) ctx.fillRect(x, leaderY, 3, 3);
  }

  if (layout.footer) {
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.leader;
    ctx.fillRect(padX, layout.footerY - 64, width - padX * 2, 2);
    ctx.font = layout.footerFont;
    ctx.fillStyle = theme.muted;
    ctx.fillText(layout.footer, padX, layout.footerY);
  }
  ctx.textAlign = 'left';
}

/** File name from the shop name: "northside-barbers-price-list.png". */
export function priceListImageFileName(shopName: string): string {
  const slug = shopName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${slug ? `${slug}-` : ''}price-list.png`;
}
