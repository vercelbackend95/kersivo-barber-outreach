import { describe, expect, it } from 'vitest';
import {
  detectBookingPlatform,
  detectPlatform,
  dedupeWorkLinks,
  displayWorkLinks,
  inferBookingSystem,
  normaliseWorkLink,
  parseLinkInput,
  parseStoredWorkLinks,
  parseWebUrl,
  splitLinkInput,
  workLinkPreviewText,
  workLinksToLegacyFields,
} from './workLinkNormalise';
import { CURRENT_BOOKING_SYSTEM_VALUE_SET } from '@/lib/forms/currentBookingSystems';
import { WORK_PLATFORM_IDS } from './workPlatforms';

describe('parseWebUrl', () => {
  it('adds https, forces https, and rejects non-web or credentialed URLs', () => {
    expect(parseWebUrl('sharpcuts.co.uk')?.toString()).toBe('https://sharpcuts.co.uk/');
    expect(parseWebUrl('http://sharpcuts.co.uk/book')?.toString()).toBe('https://sharpcuts.co.uk/book');
    expect(parseWebUrl('@yourshop')).toBeNull();
    expect(parseWebUrl('javascript:alert(1)')).toBeNull();
    expect(parseWebUrl('ftp://sharpcuts.co.uk')).toBeNull();
    expect(parseWebUrl('https://user:pass@sharpcuts.co.uk')).toBeNull();
    expect(parseWebUrl('localhost')).toBeNull();
    expect(parseWebUrl('192.168.0.1')).toBeNull();
    expect(parseWebUrl('https://shop.c')).toBeNull();
    expect(parseWebUrl('')).toBeNull();
  });
});

describe('detectPlatform', () => {
  it('maps known hosts, unknown URLs to website, and non-URLs to null', () => {
    expect(detectPlatform('https://www.instagram.com/sharpcuts')).toBe('instagram');
    expect(detectPlatform('instagr.am/sharpcuts')).toBe('instagram');
    expect(detectPlatform('https://maps.app.goo.gl/abc')).toBe('google');
    expect(detectPlatform('https://g.co/kgs/abc')).toBe('google');
    expect(detectPlatform('https://www.google.com/maps/place/Leeds')).toBe('google');
    expect(detectPlatform('https://www.google.com/search?q=barber')).toBe('website');
    expect(detectPlatform('https://booksy.com/en-gb/1')).toBe('booksy');
    expect(detectPlatform('https://fresha.com/a/shop')).toBe('fresha');
    expect(detectPlatform('https://www.treatwell.co.uk/place/sharp')).toBe('treatwell');
    expect(detectPlatform('https://vm.tiktok.com/ZMxxxx')).toBe('tiktok');
    expect(detectPlatform('https://m.facebook.com/sharpcuts')).toBe('facebook');
    expect(detectPlatform('https://share.google/abc')).toBe('google');
    expect(detectPlatform('https://goo.gl/maps/abc')).toBe('google');
    expect(detectPlatform('https://g.page/sharpcuts')).toBe('google');
    expect(detectPlatform('https://treatwell.com/place/sharp')).toBe('treatwell');
    expect(detectPlatform('https://fb.com/sharpcuts')).toBe('facebook');
    expect(detectPlatform('https://tiktok.com/@shop')).toBe('tiktok');
    expect(detectPlatform('https://nearcut.com/sharp')).toBe('nearcut');
    expect(detectPlatform('https://sharp.setora.co.uk')).toBe('setora');
    expect(detectPlatform('https://book.squareup.com/appointments/abc')).toBe('square');
    expect(detectPlatform('https://sharp.square.site')).toBe('square');
    expect(detectPlatform('https://yourshop.co.uk')).toBe('website');
    expect(detectPlatform('@sharpcuts')).toBeNull();
    expect(detectPlatform('hello')).toBeNull();
  });
});

describe('normaliseWorkLink', () => {
  it('normalises Instagram handles and profile URLs without rewriting the typed value', () => {
    expect(normaliseWorkLink('instagram', '@SharpCuts')).toEqual({
      platform: 'instagram',
      value: '@SharpCuts',
      url: 'https://www.instagram.com/SharpCuts',
      handle: 'SharpCuts',
    });
    expect(normaliseWorkLink('instagram', 'sharpcuts')).toEqual({
      platform: 'instagram',
      value: 'sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(normaliseWorkLink('instagram', 'instagram.com/sharpcuts/')).toEqual({
      platform: 'instagram',
      value: 'instagram.com/sharpcuts/',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(
      normaliseWorkLink('instagram', 'https://www.instagram.com/sharpcuts/?utm_source=ig&igsh=abc'),
    ).toEqual({
      platform: 'instagram',
      value: 'https://www.instagram.com/sharpcuts/?utm_source=ig&igsh=abc',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(normaliseWorkLink('instagram', 'http://instagram.com/sharpcuts')).toEqual({
      platform: 'instagram',
      value: 'http://instagram.com/sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(normaliseWorkLink('instagram', 'HTTPS://M.INSTAGRAM.COM/sharpcuts')).toEqual({
      platform: 'instagram',
      value: 'HTTPS://M.INSTAGRAM.COM/sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(normaliseWorkLink('instagram', 'https://instagr.am/sharpcuts')).toEqual({
      platform: 'instagram',
      value: 'https://instagr.am/sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
      handle: 'sharpcuts',
    });
    expect(workLinkPreviewText('instagram', '@sharpcuts')).toBe('instagram.com/sharpcuts');
  });

  it('keeps unparseable Instagram input without blocking', () => {
    expect(normaliseWorkLink('instagram', 'not a handle')).toEqual({
      platform: 'instagram',
      value: 'not a handle',
      url: null,
      handle: null,
    });
  });

  it('normalises TikTok handles, profile URLs and short links', () => {
    expect(normaliseWorkLink('tiktok', '@shop')).toEqual({
      platform: 'tiktok',
      value: '@shop',
      url: 'https://www.tiktok.com/@shop',
      handle: 'shop',
    });
    expect(normaliseWorkLink('tiktok', 'tiktok.com/@shop')).toEqual({
      platform: 'tiktok',
      value: 'tiktok.com/@shop',
      url: 'https://www.tiktok.com/@shop',
      handle: 'shop',
    });
    expect(normaliseWorkLink('tiktok', 'www.tiktok.com/@shop?si=1')).toEqual({
      platform: 'tiktok',
      value: 'www.tiktok.com/@shop?si=1',
      url: 'https://www.tiktok.com/@shop',
      handle: 'shop',
    });
    expect(normaliseWorkLink('tiktok', 'https://vm.tiktok.com/ZMxxxx/')).toEqual({
      platform: 'tiktok',
      value: 'https://vm.tiktok.com/ZMxxxx/',
      url: 'https://vm.tiktok.com/ZMxxxx',
      handle: null,
    });
    expect(workLinkPreviewText('tiktok', '@shop')).toBe('tiktok.com/@shop');
  });

  it('accepts a Facebook page URL or a page name', () => {
    expect(normaliseWorkLink('facebook', 'https://www.facebook.com/sharpcuts/?utm_source=fb&fbclid=1')).toEqual({
      platform: 'facebook',
      value: 'https://www.facebook.com/sharpcuts/?utm_source=fb&fbclid=1',
      url: 'https://www.facebook.com/sharpcuts',
      handle: null,
    });
    expect(normaliseWorkLink('facebook', 'https://m.facebook.com/sharpcuts')).toEqual({
      platform: 'facebook',
      value: 'https://m.facebook.com/sharpcuts',
      url: 'https://m.facebook.com/sharpcuts',
      handle: null,
    });
    expect(normaliseWorkLink('facebook', 'https://fb.com/sharpcuts')).toEqual({
      platform: 'facebook',
      value: 'https://fb.com/sharpcuts',
      url: 'https://fb.com/sharpcuts',
      handle: null,
    });
    expect(normaliseWorkLink('facebook', 'Sharp Cuts Barbers')).toEqual({
      platform: 'facebook',
      value: 'Sharp Cuts Barbers',
      url: null,
      handle: null,
    });
  });

  it('validates Booksy, Fresha and Treatwell by domain only', () => {
    expect(normaliseWorkLink('booksy', 'https://booksy.com/en-gb/123-sharp/')).toEqual({
      platform: 'booksy',
      value: 'https://booksy.com/en-gb/123-sharp/',
      url: 'https://booksy.com/en-gb/123-sharp',
      handle: null,
    });
    expect(normaliseWorkLink('fresha', 'www.fresha.com/a/shop')).toEqual({
      platform: 'fresha',
      value: 'www.fresha.com/a/shop',
      url: 'https://www.fresha.com/a/shop',
      handle: null,
    });
    expect(normaliseWorkLink('treatwell', 'https://www.treatwell.co.uk/place/sharp/')).toEqual({
      platform: 'treatwell',
      value: 'https://www.treatwell.co.uk/place/sharp/',
      url: 'https://www.treatwell.co.uk/place/sharp',
      handle: null,
    });
    expect(normaliseWorkLink('booksy', 'https://not-booksy.example/x')).toEqual({
      platform: 'booksy',
      value: 'https://not-booksy.example/x',
      url: null,
      handle: null,
    });
    expect(detectBookingPlatform('https://partners.fresha.com/a')).toBe('fresha');
  });

  it('accepts a Google Maps link or a shop name and town', () => {
    expect(normaliseWorkLink('google', 'https://maps.app.goo.gl/abc123?utm_source=share')).toEqual({
      platform: 'google',
      value: 'https://maps.app.goo.gl/abc123?utm_source=share',
      url: 'https://maps.app.goo.gl/abc123',
      handle: null,
    });
    expect(normaliseWorkLink('google', 'https://www.google.com/maps/place/Leeds')).toEqual({
      platform: 'google',
      value: 'https://www.google.com/maps/place/Leeds',
      url: 'https://www.google.com/maps/place/Leeds',
      handle: null,
    });
    expect(normaliseWorkLink('google', 'https://maps.google.com/?q=Leeds')).toEqual({
      platform: 'google',
      value: 'https://maps.google.com/?q=Leeds',
      url: 'https://maps.google.com/?q=Leeds',
      handle: null,
    });
    expect(normaliseWorkLink('google', 'https://g.page/sharpcuts')).toEqual({
      platform: 'google',
      value: 'https://g.page/sharpcuts',
      url: 'https://g.page/sharpcuts',
      handle: null,
    });
    expect(normaliseWorkLink('google', 'https://g.co/kgs/abc')).toEqual({
      platform: 'google',
      value: 'https://g.co/kgs/abc',
      url: 'https://g.co/kgs/abc',
      handle: null,
    });
    expect(normaliseWorkLink('google', 'Northside Barbers, Leeds')).toEqual({
      platform: 'google',
      value: 'Northside Barbers, Leeds',
      url: null,
      handle: null,
    });
  });

  it('normalises a website and strips tracking params', () => {
    expect(normaliseWorkLink('website', 'yourshop.co.uk')).toEqual({
      platform: 'website',
      value: 'yourshop.co.uk',
      url: 'https://yourshop.co.uk',
      handle: null,
    });
    expect(normaliseWorkLink('website', 'http://yourshop.co.uk/book/')).toEqual({
      platform: 'website',
      value: 'http://yourshop.co.uk/book/',
      url: 'https://yourshop.co.uk/book',
      handle: null,
    });
    expect(normaliseWorkLink('website', 'https://yourshop.co.uk/?utm_source=ig&fbclid=1')).toEqual({
      platform: 'website',
      value: 'https://yourshop.co.uk/?utm_source=ig&fbclid=1',
      url: 'https://yourshop.co.uk',
      handle: null,
    });
  });

  it('keeps Other as free text and attaches a URL when one is typed', () => {
    expect(normaliseWorkLink('other', 'Ask on WhatsApp')).toEqual({
      platform: 'other',
      value: 'Ask on WhatsApp',
      url: null,
      handle: null,
    });
    expect(normaliseWorkLink('other', 'https://linktr.ee/sharpcuts?utm_medium=bio')).toEqual({
      platform: 'other',
      value: 'https://linktr.ee/sharpcuts?utm_medium=bio',
      url: 'https://linktr.ee/sharpcuts',
      handle: null,
    });
  });

  it('omits empty values and never stores a javascript URL', () => {
    expect(normaliseWorkLink('instagram', '   ')).toBeNull();
    expect(normaliseWorkLink('website', 'javascript:alert(1)')).toEqual({
      platform: 'website',
      value: 'javascript:alert(1)',
      url: null,
      handle: null,
    });
    expect(normaliseWorkLink('website', 'https://user:pass@sharpcuts.co.uk')).toEqual({
      platform: 'website',
      value: 'https://user:pass@sharpcuts.co.uk',
      url: null,
      handle: null,
    });
  });
});

describe('workLinks projection', () => {
  it('projects the first link of each kind onto the legacy columns', () => {
    const links = ['@shop', '@second', 'https://nearcut.com/sharp', 'https://booksy.com/en-gb/1'].map(
      (raw) => parseLinkInput(raw)!,
    );
    expect(workLinksToLegacyFields(links)).toEqual({
      bookingPageUrl: 'https://nearcut.com/sharp',
      instagramUrl: 'https://www.instagram.com/shop',
      googleListingUrl: null,
      websiteUrl: null,
    });
  });

  it('reads several stored links on one platform, deduped by URL', () => {
    const stored = parseStoredWorkLinks([
      { platform: 'website', value: 'a.co.uk', url: 'https://a.co.uk' },
      { platform: 'website', value: 'b.co.uk', url: 'https://b.co.uk' },
      { platform: 'website', value: 'A.co.uk', url: 'https://A.co.uk' },
      { platform: 'unknown', value: 'x', url: null },
    ]);
    expect(stored.map((link) => link.url)).toEqual(['https://a.co.uk', 'https://b.co.uk']);
    expect(dedupeWorkLinks([...stored, ...stored])).toEqual(stored);
  });

  it('falls back to the four columns when workLinks is missing, labelling an unknown booking page', () => {
    expect(
      displayWorkLinks({
        bookingPageUrl: 'https://nearcut.com/sharp',
        instagramUrl: 'https://instagram.com/sharpcuts',
        googleListingUrl: null,
        websiteUrl: null,
      }),
    ).toEqual([
      {
        label: 'Instagram',
        value: 'https://instagram.com/sharpcuts',
        url: 'https://www.instagram.com/sharpcuts',
        handle: 'sharpcuts',
      },
      {
        label: 'Booking page',
        value: 'https://nearcut.com/sharp',
        url: 'https://nearcut.com/sharp',
        handle: null,
      },
    ]);
  });

  it('reads stored workLinks that predate the handle field', () => {
    expect(
      displayWorkLinks({
        workLinks: [{ platform: 'instagram', value: 'sharpcuts', url: 'https://www.instagram.com/sharpcuts' }],
      }),
    ).toEqual([
      {
        label: 'Instagram',
        value: 'sharpcuts',
        url: 'https://www.instagram.com/sharpcuts',
        handle: null,
      },
    ]);
  });

  it('lists the platforms', () => {
    expect(WORK_PLATFORM_IDS).toEqual([
      'instagram',
      'google',
      'booksy',
      'fresha',
      'treatwell',
      'nearcut',
      'setora',
      'square',
      'tiktok',
      'facebook',
      'website',
      'other',
    ]);
  });
});

describe('parseLinkInput', () => {
  it('treats a bare @handle as Instagram and normalises it', () => {
    expect(parseLinkInput(' @SharpCuts ')).toEqual({
      platform: 'instagram',
      value: '@SharpCuts',
      url: 'https://www.instagram.com/SharpCuts',
      handle: 'SharpCuts',
    });
  });

  it('adds https, strips tracking params and keeps what matters', () => {
    expect(
      parseLinkInput('booksy.com/en-gb/1?utm_source=a&utm_medium=b&igsh=c&igshid=d&fbclid=e&si=f&id=7')?.url,
    ).toBe('https://booksy.com/en-gb/1?id=7');
  });

  it.each(['', '   ', 'hello', 'two words', 'sam@example.com', '@not a handle', 'javascript:alert(1)', 'mailto:a@b.co'])(
    'returns null for %j',
    (raw) => {
      expect(parseLinkInput(raw)).toBeNull();
    },
  );

  it('returns null for anything over 300 characters', () => {
    expect(parseLinkInput(`https://booksy.com/${'a'.repeat(300)}`)).toBeNull();
  });
});

describe('splitLinkInput', () => {
  it('splits on spaces, commas and new lines', () => {
    expect(splitLinkInput('a.co.uk b.co.uk,c.co.uk, d.co.uk\ne.co.uk\r\n@f,@g')).toEqual([
      'a.co.uk',
      'b.co.uk',
      'c.co.uk',
      'd.co.uk',
      'e.co.uk',
      '@f',
      '@g',
    ]);
  });

  it('keeps a Google Maps URL with commas in one piece', () => {
    const url = 'https://www.google.com/maps/place/Northside+Barbers,+Leeds/@53.8,-1.54,15z/data=!3m1';
    expect(splitLinkInput(url)).toEqual([url]);
    expect(parseLinkInput(url)?.platform).toBe('google');
  });

  it('drops punctuation around a link', () => {
    expect(splitLinkInput('(booksy.com/shop), "sharp.co.uk".')).toEqual(['booksy.com/shop', 'sharp.co.uk']);
  });
});

describe('inferBookingSystem', () => {
  it('answers only when exactly one booking platform is linked', () => {
    expect(inferBookingSystem([{ platform: 'booksy' }, { platform: 'instagram' }])).toBe('booksy');
    expect(inferBookingSystem([{ platform: 'booksy' }, { platform: 'booksy' }])).toBe('booksy');
    expect(inferBookingSystem([{ platform: 'booksy' }, { platform: 'fresha' }])).toBeNull();
    expect(inferBookingSystem([{ platform: 'instagram' }])).toBeNull();
    expect(inferBookingSystem([])).toBeNull();
  });

  it('only ever answers with a stored booking-system value', () => {
    for (const platform of WORK_PLATFORM_IDS) {
      const inferred = inferBookingSystem([{ platform }]);
      if (inferred) expect(CURRENT_BOOKING_SYSTEM_VALUE_SET.has(inferred)).toBe(true);
    }
  });
});
