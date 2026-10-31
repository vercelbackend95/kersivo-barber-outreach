import { describe, expect, it } from 'vitest';
import { normaliseLinkInput, parseFreePreviewRequest } from './intake';

const valid = {
  firstName: 'Sam',
  email: ' Sam@Example.COM ',
  shopName: 'Sharp Cuts',
  townCity: 'Leeds',
  instagramUrl: 'instagram.com/sharpcuts',
  barberCount: '2-3',
  currentBookingSystem: 'booksy',
  hasOwnDomain: 'not_sure',
  authorisationConsent: true,
};

describe('parseFreePreviewRequest', () => {
  it('accepts a minimal valid request and normalises email and links', () => {
    const result = parseFreePreviewRequest(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe('sam@example.com');
    expect(result.value.instagramUrl).toBe('https://www.instagram.com/sharpcuts');
    expect(result.value.bookingPageUrl).toBeNull();
    expect(result.value.workLinks).toEqual([
      {
        platform: 'instagram',
        value: 'https://instagram.com/sharpcuts',
        url: 'https://www.instagram.com/sharpcuts',
        handle: 'sharpcuts',
      },
    ]);
    expect(result.value.notes).toBeNull();
    expect(result.value.marketingOptIn).toBe(false);
  });

  it('allows a request with no work links', () => {
    const result = parseFreePreviewRequest({ ...valid, instagramUrl: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workLinks).toEqual([]);
    expect(result.value.instagramUrl).toBeNull();
  });

  it('normalises a workLinks payload and projects the legacy URL columns', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      instagramUrl: '',
      workLinks: [
        { platform: 'instagram', value: '@sharpcuts' },
        { platform: 'booksy', value: 'https://booksy.com/en-gb/1?utm_source=bio' },
        { platform: 'google', value: 'Northside Barbers, Leeds' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workLinks).toEqual([
      {
        platform: 'instagram',
        value: '@sharpcuts',
        url: 'https://www.instagram.com/sharpcuts',
        handle: 'sharpcuts',
      },
      {
        platform: 'booksy',
        value: 'https://booksy.com/en-gb/1?utm_source=bio',
        url: 'https://booksy.com/en-gb/1',
        handle: null,
      },
      { platform: 'google', value: 'Northside Barbers, Leeds', url: null, handle: null },
    ]);
    expect(result.value.instagramUrl).toBe('https://www.instagram.com/sharpcuts');
    expect(result.value.bookingPageUrl).toBe('https://booksy.com/en-gb/1');
    expect(result.value.googleListingUrl).toBeNull();
  });

  it('lets workLinks win over the four legacy URL fields', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      instagramUrl: 'instagram.com/legacy',
      workLinks: [{ platform: 'website', value: 'sharpcuts.co.uk' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workLinks.map((link) => link.platform)).toEqual(['website']);
    expect(result.value.instagramUrl).toBeNull();
    expect(result.value.websiteUrl).toBe('https://sharpcuts.co.uk');
  });

  it('still stores a mistyped Booksy link instead of rejecting the request', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      instagramUrl: '',
      workLinks: [{ platform: 'booksy', value: 'not-a-booksy-link' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workLinks).toEqual([
      { platform: 'booksy', value: 'not-a-booksy-link', url: null, handle: null },
    ]);
    expect(result.value.bookingPageUrl).toBeNull();
  });

  it('accepts the shared booking-system list including mixed tools', () => {
    expect(parseFreePreviewRequest({ ...valid, currentBookingSystem: 'mixed-manual' }).ok).toBe(true);
    expect(parseFreePreviewRequest({ ...valid, currentBookingSystem: 'other-platform' }).ok).toBe(true);
    expect(parseFreePreviewRequest({ ...valid, currentBookingSystem: 'other' }).ok).toBe(false);
  });

  it('rejects invalid links, select values and missing consent', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      websiteUrl: 'not a url',
      barberCount: '12',
      currentBookingSystem: 'calendly',
      hasOwnDomain: 'maybe',
      authorisationConsent: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      ['authorisationConsent', 'barberCount', 'currentBookingSystem', 'hasOwnDomain', 'websiteUrl'].sort(),
    );
  });

  it('caps notes at 1000 characters', () => {
    expect(parseFreePreviewRequest({ ...valid, notes: 'x'.repeat(1000) }).ok).toBe(true);
    expect(parseFreePreviewRequest({ ...valid, notes: 'x'.repeat(1001) }).ok).toBe(false);
  });

  it('caps each work link at 300 characters', () => {
    const long = `https://booksy.com/${'a'.repeat(300)}`;
    expect(
      parseFreePreviewRequest({
        ...valid,
        instagramUrl: '',
        workLinks: [{ platform: 'booksy', value: 'https://booksy.com/en-gb/1' }],
      }).ok,
    ).toBe(true);
    expect(
      parseFreePreviewRequest({
        ...valid,
        instagramUrl: '',
        workLinks: [{ platform: 'booksy', value: long }],
      }).ok,
    ).toBe(false);
  });

  it('keeps only a safe internal entry point', () => {
    const ok = parseFreePreviewRequest({ ...valid, entryPoint: 'Homepage-Hero' });
    expect(ok.ok && ok.value.entryPoint).toBe('homepage-hero');
    const dropped = parseFreePreviewRequest({ ...valid, entryPoint: 'utm_source=google&x=1' });
    expect(dropped.ok && dropped.value.entryPoint).toBeNull();
  });
});

describe('normaliseLinkInput', () => {
  it('adds https and rejects non-web or credentialed URLs', () => {
    expect(normaliseLinkInput('sharpcuts.co.uk')).toBe('https://sharpcuts.co.uk/');
    expect(normaliseLinkInput('http://sharpcuts.co.uk/book')).toBe('https://sharpcuts.co.uk/book');
    expect(normaliseLinkInput('javascript:alert(1)')).toBeNull();
    expect(normaliseLinkInput('ftp://sharpcuts.co.uk')).toBeNull();
    expect(normaliseLinkInput('https://user:pass@sharpcuts.co.uk')).toBeNull();
    expect(normaliseLinkInput('localhost')).toBeNull();
  });
});
