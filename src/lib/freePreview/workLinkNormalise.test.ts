import { describe, expect, it } from 'vitest';
import {
  detectBookingPlatform,
  displayWorkLinks,
  legacyFieldsToWorkLinks,
  normaliseWorkLink,
  normaliseWorkLinksInput,
  parseWebUrl,
  workLinkLooksValid,
  workLinksToLegacyFields,
} from './workLinkNormalise';

describe('parseWebUrl', () => {
  it('adds https and rejects non-web or credentialed URLs', () => {
    expect(parseWebUrl('sharpcuts.co.uk')?.toString()).toBe('https://sharpcuts.co.uk/');
    expect(parseWebUrl('http://sharpcuts.co.uk/book')?.toString()).toBe('http://sharpcuts.co.uk/book');
    expect(parseWebUrl('@yourshop')).toBeNull();
    expect(parseWebUrl('javascript:alert(1)')).toBeNull();
    expect(parseWebUrl('ftp://sharpcuts.co.uk')).toBeNull();
    expect(parseWebUrl('https://user:pass@sharpcuts.co.uk')).toBeNull();
    expect(parseWebUrl('localhost')).toBeNull();
    expect(parseWebUrl('')).toBeNull();
  });
});

describe('normaliseWorkLink', () => {
  it('normalises Instagram handles and profile URLs', () => {
    expect(normaliseWorkLink('instagram', '@SharpCuts')).toEqual({
      platform: 'instagram',
      value: 'SharpCuts',
      url: 'https://www.instagram.com/SharpCuts',
    });
    expect(normaliseWorkLink('instagram', 'instagram.com/sharpcuts/')).toEqual({
      platform: 'instagram',
      value: 'sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
    });
    expect(
      normaliseWorkLink('instagram', 'https://www.instagram.com/sharpcuts/?utm_source=ig&igsh=abc'),
    ).toEqual({
      platform: 'instagram',
      value: 'sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
    });
    expect(normaliseWorkLink('instagram', 'http://instagram.com/sharpcuts')).toEqual({
      platform: 'instagram',
      value: 'sharpcuts',
      url: 'https://www.instagram.com/sharpcuts',
    });
  });

  it('keeps unparseable Instagram input without blocking', () => {
    expect(normaliseWorkLink('instagram', 'not a handle')).toEqual({
      platform: 'instagram',
      value: 'not a handle',
      url: null,
    });
    expect(workLinkLooksValid('instagram', 'not a handle')).toBe(false);
    expect(workLinkLooksValid('instagram', '@sharpcuts')).toBe(true);
  });

  it('normalises TikTok handles and profile URLs', () => {
    expect(normaliseWorkLink('tiktok', '@shop')).toEqual({
      platform: 'tiktok',
      value: 'shop',
      url: 'https://www.tiktok.com/@shop',
    });
    expect(normaliseWorkLink('tiktok', 'tiktok.com/@shop')).toEqual({
      platform: 'tiktok',
      value: 'shop',
      url: 'https://www.tiktok.com/@shop',
    });
    expect(normaliseWorkLink('tiktok', 'www.tiktok.com/@shop?_t=1')).toEqual({
      platform: 'tiktok',
      value: 'shop',
      url: 'https://www.tiktok.com/@shop',
    });
  });

  it('accepts a Facebook page URL or a page name', () => {
    expect(normaliseWorkLink('facebook', 'https://www.facebook.com/sharpcuts/?utm_source=fb')).toEqual({
      platform: 'facebook',
      value: 'https://www.facebook.com/sharpcuts',
      url: 'https://www.facebook.com/sharpcuts',
    });
    expect(normaliseWorkLink('facebook', 'Sharp Cuts Barbers')).toEqual({
      platform: 'facebook',
      value: 'Sharp Cuts Barbers',
      url: null,
    });
    expect(workLinkLooksValid('facebook', 'Sharp Cuts Barbers')).toBe(true);
    expect(workLinkLooksValid('facebook', 'https://example.com/not-facebook')).toBe(false);
  });

  it('validates Booksy, Fresha and Treatwell by domain only', () => {
    expect(normaliseWorkLink('booksy', 'https://booksy.com/en-gb/123-sharp/')).toEqual({
      platform: 'booksy',
      value: 'https://booksy.com/en-gb/123-sharp',
      url: 'https://booksy.com/en-gb/123-sharp',
    });
    expect(normaliseWorkLink('fresha', 'www.fresha.com/a/shop')).toEqual({
      platform: 'fresha',
      value: 'https://www.fresha.com/a/shop',
      url: 'https://www.fresha.com/a/shop',
    });
    expect(normaliseWorkLink('treatwell', 'https://www.treatwell.co.uk/place/sharp/')).toEqual({
      platform: 'treatwell',
      value: 'https://www.treatwell.co.uk/place/sharp',
      url: 'https://www.treatwell.co.uk/place/sharp',
    });
    expect(normaliseWorkLink('booksy', 'https://not-booksy.example/x')).toEqual({
      platform: 'booksy',
      value: 'https://not-booksy.example/x',
      url: null,
    });
    expect(workLinkLooksValid('booksy', 'https://not-booksy.example/x')).toBe(false);
    expect(workLinkLooksValid('booksy', 'https://booksy.com/en-gb/1')).toBe(true);
    expect(detectBookingPlatform('https://partners.fresha.com/a')).toBe('fresha');
  });

  it('accepts a Google Maps link or a shop name and town', () => {
    expect(normaliseWorkLink('google', 'https://maps.app.goo.gl/abc123?utm_source=share')).toEqual({
      platform: 'google',
      value: 'https://maps.app.goo.gl/abc123',
      url: 'https://maps.app.goo.gl/abc123',
    });
    expect(normaliseWorkLink('google', 'Northside Barbers, Leeds')).toEqual({
      platform: 'google',
      value: 'Northside Barbers, Leeds',
      url: null,
    });
    expect(workLinkLooksValid('google', 'Northside Barbers, Leeds')).toBe(true);
  });

  it('normalises a website and strips tracking params', () => {
    expect(normaliseWorkLink('website', 'yourshop.co.uk')).toEqual({
      platform: 'website',
      value: 'https://yourshop.co.uk/',
      url: 'https://yourshop.co.uk/',
    });
    expect(normaliseWorkLink('website', 'https://yourshop.co.uk/?utm_source=ig&fbclid=1')).toEqual({
      platform: 'website',
      value: 'https://yourshop.co.uk/',
      url: 'https://yourshop.co.uk/',
    });
    expect(workLinkLooksValid('website', 'not a url')).toBe(false);
  });

  it('keeps Other as free text and attaches a URL when one is typed', () => {
    expect(normaliseWorkLink('other', 'Ask on WhatsApp')).toEqual({
      platform: 'other',
      value: 'Ask on WhatsApp',
      url: null,
    });
    expect(normaliseWorkLink('other', 'https://linktr.ee/sharpcuts?utm_medium=bio')).toEqual({
      platform: 'other',
      value: 'https://linktr.ee/sharpcuts?utm_medium=bio',
      url: 'https://linktr.ee/sharpcuts',
    });
  });

  it('omits empty values and never stores a javascript URL', () => {
    expect(normaliseWorkLink('instagram', '   ')).toBeNull();
    expect(normaliseWorkLink('website', 'javascript:alert(1)')).toEqual({
      platform: 'website',
      value: 'javascript:alert(1)',
      url: null,
    });
    expect(normaliseWorkLink('website', 'https://user:pass@sharpcuts.co.uk')).toEqual({
      platform: 'website',
      value: 'https://user:pass@sharpcuts.co.uk',
      url: null,
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
      { label: 'Instagram', value: 'sharpcuts', url: 'https://www.instagram.com/sharpcuts' },
      { label: 'Booking page', value: 'https://nearcut.com/sharp', url: 'https://nearcut.com/sharp' },
    ]);
  });
});
