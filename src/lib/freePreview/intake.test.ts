import { describe, expect, it } from 'vitest';
import {
  FREE_PREVIEW_LINKS_REQUIRED_MESSAGE,
  normaliseLinkInput,
  parseFreePreviewRequest,
} from './intake';

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
    expect(result.value.instagramUrl).toBe('https://instagram.com/sharpcuts');
    expect(result.value.bookingPageUrl).toBeNull();
    expect(result.value.notes).toBeNull();
    expect(result.value.marketingOptIn).toBe(false);
  });

  it('requires at least one link', () => {
    const result = parseFreePreviewRequest({ ...valid, instagramUrl: '' });
    expect(result).toEqual({ ok: false, fieldErrors: { links: FREE_PREVIEW_LINKS_REQUIRED_MESSAGE } });
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
    expect(normaliseLinkInput('http://sharpcuts.co.uk/book')).toBe('http://sharpcuts.co.uk/book');
    expect(normaliseLinkInput('javascript:alert(1)')).toBeNull();
    expect(normaliseLinkInput('ftp://sharpcuts.co.uk')).toBeNull();
    expect(normaliseLinkInput('https://user:pass@sharpcuts.co.uk')).toBeNull();
    expect(normaliseLinkInput('localhost')).toBeNull();
  });
});
