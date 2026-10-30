import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canSelectForRegister,
  checkAvailability,
  classifySuggestion,
  clearAvailabilityCache,
  mapNominetRdapStatus,
} from './availability';
import { usdPriceToPence } from './tldPolicy';

afterEach(() => {
  clearAvailabilityCache();
  vi.unstubAllGlobals();
});

describe('mapNominetRdapStatus', () => {
  it('maps 404 to available, 200 to taken, and anything else to unknown', () => {
    expect(mapNominetRdapStatus(404)).toBe('available');
    expect(mapNominetRdapStatus(200)).toBe('taken');
    expect(mapNominetRdapStatus(429)).toBe('unknown');
    expect(mapNominetRdapStatus(500)).toBe('unknown');
    expect(mapNominetRdapStatus('timeout')).toBe('unknown');
    expect(mapNominetRdapStatus('error')).toBe('unknown');
  });
});

describe('classifySuggestion', () => {
  it('marks an available Nominet .co.uk as included without inventing a price', () => {
    expect(
      classifySuggestion({
        domain: 'faderoom.co.uk',
        tld: '.co.uk',
        availability: 'available',
        pricePence: null,
      }),
    ).toEqual({
      domain: 'faderoom.co.uk',
      tld: '.co.uk',
      status: 'available',
      included: true,
      pricePence: null,
    });
  });

  it('marks .uk.com as not included even when available', () => {
    expect(
      classifySuggestion({
        domain: 'faderoom.uk.com',
        tld: '.uk.com',
        availability: 'available',
        pricePence: 900,
      }),
    ).toMatchObject({ status: 'not_included', included: false });
  });

  it('marks a secondary TLD without a live price as not included', () => {
    expect(
      classifySuggestion({
        domain: 'faderoom.studio',
        tld: '.studio',
        availability: 'available',
        pricePence: null,
      }),
    ).toMatchObject({ status: 'not_included', included: false, pricePence: null });
  });

  it('marks premium or over-allowance names as not included', () => {
    expect(
      classifySuggestion({
        domain: 'fade.com',
        tld: '.com',
        availability: 'available',
        pricePence: usdPriceToPence(10),
        premium: true,
      }),
    ).toMatchObject({ status: 'not_included', included: false });
    expect(
      classifySuggestion({
        domain: 'fade.studio',
        tld: '.studio',
        availability: 'available',
        pricePence: usdPriceToPence(80),
      }),
    ).toMatchObject({ status: 'not_included', included: false });
  });

  it('includes a secondary TLD only when a live price is within the allowance', () => {
    expect(
      classifySuggestion({
        domain: 'faderoom.net',
        tld: '.net',
        availability: 'available',
        pricePence: usdPriceToPence(12),
      }),
    ).toMatchObject({ status: 'available', included: true });
  });
});

describe('checkAvailability', () => {
  it('uses Nominet RDAP mapping for .co.uk and .uk', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const status = String(url).includes('taken.co.uk') ? 200 : 404;
      return new Response('{}', { status });
    });
    const rows = await checkAvailability(
      [
        { domain: 'open.co.uk', tld: '.co.uk' },
        { domain: 'taken.co.uk', tld: '.co.uk' },
      ],
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(rows[0]).toMatchObject({ domain: 'open.co.uk', status: 'available', included: true, pricePence: null });
    expect(rows[1]).toMatchObject({ domain: 'taken.co.uk', status: 'taken', included: false });
  });

  it('treats a Nominet timeout as unknown without inventing a price', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('aborted');
    });
    const [row] = await checkAvailability([{ domain: 'slow.co.uk', tld: '.co.uk' }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(row).toMatchObject({ status: 'unknown', included: true, pricePence: null });
    expect(canSelectForRegister(row)).toBe(true);
  });

  it('uses a Vercel price when returned and does not invent one on DNS fallback', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          results: [{ domain: 'open.com', available: true, price: 12, premium: false }],
        }),
        { status: 200 },
      );
    });
    const priced = await checkAvailability([{ domain: 'open.com', tld: '.com' }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(priced[0]?.status).toBe('available');
    expect(priced[0]?.included).toBe(true);
    expect(priced[0]?.pricePence).toBe(usdPriceToPence(12));

    const fallback = await checkAvailability([{ domain: 'other.com', tld: '.com' }], {
      fetchImpl: vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch,
      dnsLookup: async () => 'available',
    });
    expect(fallback[0]).toMatchObject({ status: 'available', included: true, pricePence: null });
  });
});
