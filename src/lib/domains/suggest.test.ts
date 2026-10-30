import { describe, expect, it } from 'vitest';
import { EMPTY_QUERY_SUGGESTION_COUNT, suggestDomains, suggestSecondaryDomains } from './suggest';

const SHOP = { shopName: 'The Fade Room', townCity: 'Leeds' };

describe('suggestDomains', () => {
  it('returns six smart suggestions from shop name + town when the query is empty', () => {
    const rows = suggestDomains(SHOP);
    expect(rows).toHaveLength(EMPTY_QUERY_SUGGESTION_COUNT);
    const names = rows.map((row) => row.domain);
    expect(names.some((name) => name.startsWith('faderoom'))).toBe(true);
    expect(names.some((name) => name.includes('fade-room'))).toBe(true);
    expect(names.some((name) => name.includes('leeds'))).toBe(true);
    expect(names.some((name) => name.endsWith('.co.uk'))).toBe(true);
    expect(names.some((name) => name.endsWith('.uk'))).toBe(true);
    expect(names.some((name) => name.endsWith('.com'))).toBe(true);
  });

  it('never suggests .uk.com or .uk.net from shop name + town', () => {
    const rows = [
      ...suggestDomains(SHOP),
      ...suggestDomains({ ...SHOP, query: 'fade room' }),
      ...suggestSecondaryDomains(SHOP),
    ];
    expect(rows.map((row) => row.domain).join(' ')).not.toMatch(/\.uk\.com|\.uk\.net/);
    expect(rows.some((row) => row.tld === '.uk.com' || row.tld === '.uk.net')).toBe(false);
  });

  it('treats a typed label as the first stem and still offers town variants', () => {
    const rows = suggestDomains({ ...SHOP, query: 'sharp' });
    expect(rows[0]?.domain.startsWith('sharp')).toBe(true);
    expect(rows.some((row) => row.domain.includes('leeds'))).toBe(true);
    expect(rows.every((row) => !row.domain.includes('.uk.com'))).toBe(true);
  });

  it('keeps an explicit disallowed hostname only so it can be marked not included, plus real alternatives', () => {
    const rows = suggestDomains({ ...SHOP, query: 'faderoom.uk.com' });
    expect(rows[0]).toEqual({ domain: 'faderoom.uk.com', tld: '.uk.com' });
    expect(rows.some((row) => row.domain === 'faderoom.co.uk')).toBe(true);
    expect(rows.filter((row) => row.tld === '.uk.com' || row.tld === '.uk.net')).toHaveLength(1);
  });
});
