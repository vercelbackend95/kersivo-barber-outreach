import { describe, expect, it } from 'vitest';
import {
  PRICE_LIST_MAX_ITEMS,
  PRICE_LIST_SUGGESTED_SERVICES,
  buildPriceListText,
  formatMinutes,
  itemsMissingPrice,
  normalisePriceList,
  parsePriceGbp,
  type PriceListItem,
} from './priceListText';

const item = (name: string, priceGbp: number | null, extra: Partial<PriceListItem> = {}): PriceListItem => ({
  name,
  priceGbp,
  from: false,
  minutes: null,
  ...extra,
});

describe('price list text', () => {
  it('parses typed prices and rejects nonsense', () => {
    expect(parsePriceGbp('12')).toBe(12);
    expect(parsePriceGbp('£12.50')).toBe(12.5);
    expect(parsePriceGbp(' 1,000 ')).toBeNull();
    expect(parsePriceGbp('0')).toBeNull();
    expect(parsePriceGbp('12.555')).toBeNull();
    expect(parsePriceGbp('abc')).toBeNull();
  });

  it('formats durations in minutes and hours', () => {
    expect(formatMinutes(30)).toBe('30 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(75)).toBe('1 hr 15 min');
  });

  it('builds copyable text with from-prices, durations and a footer', () => {
    const text = buildPriceListText({
      shopName: '  Northside   Barbers ',
      showDuration: true,
      footer: 'Book online at northside.example',
      items: [item('Skin fade', 18, { minutes: 45 }), item('Long hair', 20, { from: true }), item('  ', 5)],
    });
    expect(text).toBe(
      ['Northside Barbers prices', '', 'Skin fade (45 min): £18', 'Long hair: from £20', '', 'Book online at northside.example'].join('\n'),
    );
  });

  it('flags rows without a price and caps the list length', () => {
    const items = Array.from({ length: PRICE_LIST_MAX_ITEMS + 5 }, (_, i) => item(`Service ${i}`, i % 2 ? 10 : null));
    const options = { shopName: '', showDuration: false, footer: '', items };
    expect(normalisePriceList(options).items).toHaveLength(PRICE_LIST_MAX_ITEMS);
    expect(itemsMissingPrice(options)).toHaveLength(PRICE_LIST_MAX_ITEMS / 2);
  });

  it('suggests service names only, never prices', () => {
    expect(PRICE_LIST_SUGGESTED_SERVICES.every((name) => !name.includes('£'))).toBe(true);
  });
});
