import { describe, expect, it } from 'vitest';
import {
  detectBookingPlatform,
  detectPlatform,
  displayWorkLinks,
  legacyFieldsToWorkLinks,
  normaliseWorkLink,
  normaliseWorkLinksInput,
  parseWebUrl,
  workLinkLooksValid,
  workLinkPreviewText,
  workLinksToLegacyFields,
} from './workLinkNormalise';
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
    expect(workLinkLooksValid('instagram', 'not a handle')).toBe(false);
    expect(workLinkLooksValid('instagram', '@sharpcuts')).toBe(true);
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
    expect(workLinkLooksValid('tiktok', 'https://vm.tiktok.com/ZMxxxx')).toBe(true);
    expect(workLinkLooksValid('tiktok', 'not a handle')).toBe(false);
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
    expect(workLinkLooksValid('facebook', 'Sharp Cuts Barbers')).toBe(true);
    expect(workLinkLooksValid('facebook', 'https://example.com/not-facebook')).toBe(false);
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
    expect(workLinkLooksValid('booksy', 'https://not-booksy.example/x')).toBe(false);
    expect(workLinkLooksValid('booksy', 'https://booksy.com/en-gb/1')).toBe(true);
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
    expect(workLinkLooksValid('google', 'Northside Barbers, Leeds')).toBe(true);
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
    expect(workLinkLooksValid('website', 'not a url')).toBe(false);
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
  it('drops blanks, uniques by platform and projects onto the legacy columns', () => {
    const links = normaliseWorkLinksInput([
      { platform: 'instagram', value: '  ' },
      { platform: 'instagram', value: '@shop' },
      { platform: 'instagram', value: '@ignored' },
      { platform: 'booksy', value: 'https://booksy.com/en-gb/1' },
      { platform: 'fresha', value: 'https://fresha.com/a/shop' },
      { platform: 'unknown', value: 'x' },
    ]);
    expect(links.map((link) => link.platform)).toEqual(['instagram', 'booksy', 'fresha']);
    expect(links[0]).toEqual({
      platform: 'instagram',
      value: '@shop',
      url: 'https://www.instagram.com/shop',
      handle: 'shop',
    });
    expect(workLinksToLegacyFields(links)).toEqual({
      bookingPageUrl: 'https://booksy.com/en-gb/1',
      instagramUrl: 'https://www.instagram.com/shop',
      googleListingUrl: null,
      websiteUrl: null,
    });
  });

  it('synthesises work links from the four legacy URL columns', () => {
    const links = legacyFieldsToWorkLinks({
      bookingPageUrl: 'https://www.treatwell.co.uk/place/sharp',
      instagramUrl: 'https://instagram.com/sharpcuts',
      googleListingUrl: 'https://maps.app.goo.gl/abc',
      websiteUrl: 'https://sharpcuts.co.uk',
    });
    expect(links.map((link) => link.platform)).toEqual(['instagram', 'treatwell', 'google', 'website']);
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

  it('lists platforms in the picker order', () => {
    expect(WORK_PLATFORM_IDS).toEqual([
      'instagram',
      'google',
      'booksy',
      'fresha',
      'treatwell',
      'tiktok',
      'facebook',
      'website',
      'other',
    ]);
  });
});
