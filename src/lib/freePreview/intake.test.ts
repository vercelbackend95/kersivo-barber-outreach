import { describe, expect, it } from 'vitest';
import {
  FREE_PREVIEW_AUTHORISATION_STATEMENT,
  FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION,
  parseFreePreviewDetails,
  parseFreePreviewRequest,
} from './intake';

const valid = {
  email: ' Sam@Example.COM ',
  shopName: 'Sharp Cuts',
  townCity: 'Leeds',
};

const TOKEN = 'a'.repeat(43);

describe('parseFreePreviewRequest', () => {
  it('needs only shop, town and email, leaving everything else empty', () => {
    const result = parseFreePreviewRequest(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      email: 'sam@example.com',
      workLinks: [],
      instagramUrl: null,
      bookingPageUrl: null,
      barberCount: null,
      currentBookingSystem: null,
      hasOwnDomain: null,
      firstName: null,
      notes: null,
      marketingOptIn: false,
    });
  });

  it('uses the approved wording for missing required fields', () => {
    const result = parseFreePreviewRequest({ email: 'nope', shopName: '', townCity: ' ' });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        email: 'Please enter a valid email address.',
        shopName: 'Please enter your barbershop name.',
        townCity: 'Please enter your town or city.',
      },
    });
  });

  it('normalises links, detects the platform itself and projects the legacy URL columns', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      links: [
        { url: '@sharpcuts', platform: 'website' },
        { url: 'https://booksy.com/en-gb/1?utm_source=bio' },
        { url: 'https://maps.app.goo.gl/abc' },
        { url: 'https://sharpcuts.co.uk' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workLinks.map((link) => [link.platform, link.url])).toEqual([
      ['instagram', 'https://www.instagram.com/sharpcuts'],
      ['booksy', 'https://booksy.com/en-gb/1'],
      ['google', 'https://maps.app.goo.gl/abc'],
      ['website', 'https://sharpcuts.co.uk'],
    ]);
    expect(result.value).toMatchObject({
      instagramUrl: 'https://www.instagram.com/sharpcuts',
      bookingPageUrl: 'https://booksy.com/en-gb/1',
      googleListingUrl: 'https://maps.app.goo.gl/abc',
      websiteUrl: 'https://sharpcuts.co.uk',
    });
  });

  it('dedupes links after normalising, and keeps two different links on one platform', () => {
    const result = parseFreePreviewRequest({
      ...valid,
      links: [
        { url: 'instagram.com/sharp' },
        { url: 'https://www.instagram.com/sharp/?igsh=1' },
        { url: '@othershop' },
      ],
    });
    expect(result.ok && result.value.workLinks.map((link) => link.handle)).toEqual(['sharp', 'othershop']);
  });

  it.each([
    ['not a link', 'hello there'],
    ['a script URL', 'javascript:alert(1)'],
    ['a non-web scheme', 'ftp://sharpcuts.co.uk'],
    ['an email address', 'sam@example.com'],
    ['a host with no real TLD', 'https://localhost'],
    ['over 300 characters', `https://booksy.com/${'a'.repeat(300)}`],
  ])('rejects %s in links', (_name, url) => {
    const result = parseFreePreviewRequest({ ...valid, links: [{ url }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toEqual(['links']);
  });

  it('allows 5 links and rejects a sixth', () => {
    const links = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://shop${i}.co.uk` }));
    expect(parseFreePreviewRequest({ ...valid, links: links(5) }).ok).toBe(true);
    expect(parseFreePreviewRequest({ ...valid, links: links(6) })).toEqual({
      ok: false,
      fieldErrors: { links: "That's plenty — 5 links is the maximum." },
    });
  });

  it('still validates the optional answers when they are sent', () => {
    expect(parseFreePreviewRequest({ ...valid, currentBookingSystem: 'mixed-manual' }).ok).toBe(true);
    const result = parseFreePreviewRequest({
      ...valid,
      barberCount: '12',
      currentBookingSystem: 'calendly',
      hasOwnDomain: 'maybe',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['barberCount', 'currentBookingSystem', 'hasOwnDomain']);
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

describe('parseFreePreviewDetails', () => {
  it('accepts every Step 2 field, all of them optional', () => {
    expect(parseFreePreviewDetails({ token: TOKEN }).ok).toBe(true);
    const result = parseFreePreviewDetails({
      token: TOKEN,
      barberCount: '4-6',
      currentBookingSystem: 'booksy',
      hasOwnDomain: 'not_sure',
      firstName: ' Sam ',
      notes: 'Use the red logo',
      marketingOptIn: true,
    });
    expect(result.ok && result.value.firstName).toBe('Sam');
  });

  it('rejects a malformed or missing token', () => {
    expect(parseFreePreviewDetails({}).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: 'short' }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: `${'a'.repeat(42)}!` }).ok).toBe(false);
  });

  it.each(['email', 'shopName', 'townCity', 'status', 'publicToken', 'links'])(
    'rejects the non-Step-2 field %s',
    (field) => {
      expect(parseFreePreviewDetails({ token: TOKEN, [field]: 'x' }).ok).toBe(false);
    },
  );

  it('rejects values outside the allowed lists and over-long text', () => {
    expect(parseFreePreviewDetails({ token: TOKEN, barberCount: '12' }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: TOKEN, currentBookingSystem: 'calendly' }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: TOKEN, hasOwnDomain: 'maybe' }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: TOKEN, notes: 'x'.repeat(1001) }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: TOKEN, firstName: 'x'.repeat(81) }).ok).toBe(false);
    expect(parseFreePreviewDetails({ token: TOKEN, marketingOptIn: 'on' }).ok).toBe(false);
  });
});

describe('authorisation statement', () => {
  it('pins the wording to its version: change one, change both', () => {
    expect(FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION).toBe('2026-10-31');
    expect(FREE_PREVIEW_AUTHORISATION_STATEMENT).toBe(
      'By sending this, you confirm you own or manage this barbershop and that KERSIVO can use the details and photos from your links to build your private preview.',
    );
  });
});
