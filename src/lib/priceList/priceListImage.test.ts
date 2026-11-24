import { describe, expect, it } from 'vitest';
import {
  PRICE_LIST_IMAGE_HEIGHT,
  PRICE_LIST_IMAGE_WIDTH,
  fitText,
  layoutPriceListImage,
  priceListImageFileName,
  type MeasureText,
} from './priceListImage';
import type { PriceListItem } from './priceListText';
import { getPriceListTheme, PRICE_LIST_THEMES } from './priceListThemes';

/** Rough stand-in for canvas measuring: width grows with length and font size. */
const measure: MeasureText = (text, font) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 16);
  return text.length * size * 0.55;
};

const item = (name: string, priceGbp: number | null, extra: Partial<PriceListItem> = {}): PriceListItem => ({
  name,
  priceGbp,
  from: false,
  minutes: null,
  ...extra,
});

describe('price list image', () => {
  it('is a 4:5 Instagram portrait', () => {
    expect(PRICE_LIST_IMAGE_WIDTH / PRICE_LIST_IMAGE_HEIGHT).toBeCloseTo(4 / 5);
  });

  it('lays out rows in order, inside the image, with from-prices and times', () => {
    const layout = layoutPriceListImage(
      {
        shopName: 'Northside Barbers',
        showDuration: true,
        footer: 'Book online, link in bio',
        items: [item('Skin fade', 25, { minutes: 45 }), item('Long hair', 30, { from: true }), item('Beard trim', null)],
      },
      getPriceListTheme('paper'),
      measure,
    );
    expect(layout.title).toBe('NORTHSIDE BARBERS');
    expect(layout.rows.map((row) => row.price)).toEqual(['£25', 'from £30', '£—']);
    expect(layout.rows[0].time).toBe('45 min');
    expect(layout.rows[2].missing).toBe(true);
    const ys = layout.rows.map((row) => row.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(Math.max(...ys)).toBeLessThan(layout.footerY);
    expect(layout.footer).toBe('Book online, link in bio');
  });

  it('keeps the shop name as typed in the clean style, and falls back when empty', () => {
    const clean = layoutPriceListImage({ shopName: 'Fade & Co', showDuration: false, footer: '', items: [] }, getPriceListTheme('clean'), measure);
    expect(clean.title).toBe('Fade & Co');
    const empty = layoutPriceListImage({ shopName: '', showDuration: false, footer: '', items: [] }, getPriceListTheme('paper'), measure);
    expect(empty.title).toBe('YOUR BARBERSHOP');
  });

  it('fits twenty rows above the bottom edge', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`Service ${i + 1}`, 10 + i));
    for (const theme of PRICE_LIST_THEMES) {
      const layout = layoutPriceListImage({ shopName: 'A', showDuration: false, footer: 'x', items }, theme, measure);
      expect(layout.rows).toHaveLength(20);
      expect(layout.rows[19].y).toBeLessThan(PRICE_LIST_IMAGE_HEIGHT - 100);
    }
  });

  it('cuts long text with an ellipsis', () => {
    const cut = fitText('A very long service name that will not fit', '600 40px Inter', 300, measure);
    expect(cut.endsWith('…')).toBe(true);
    expect(measure(cut, '600 40px Inter')).toBeLessThanOrEqual(300);
  });

  it('names the file after the shop', () => {
    expect(priceListImageFileName('Northside Barbers')).toBe('northside-barbers-price-list.png');
    expect(priceListImageFileName('  ')).toBe('price-list.png');
    expect(priceListImageFileName('Fade & Co.')).toBe('fade-co-price-list.png');
  });
});
