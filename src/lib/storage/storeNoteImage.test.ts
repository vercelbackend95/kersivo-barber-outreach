import { describe, expect, it } from 'vitest';
import {
  isLegacyPublicNoteImageUrl,
  isPrivateNoteBlobPathname,
  makePrivateNoteImagePath,
  resolveClientNoteImageSrc,
} from './clientNoteImageUrl';

describe('clientNoteImageUrl helpers', () => {
  it('treats http(s), data URLs, and site-relative paths as legacy public', () => {
    expect(isLegacyPublicNoteImageUrl('https://example.com/a.webp')).toBe(true);
    expect(isLegacyPublicNoteImageUrl('http://example.com/a.webp')).toBe(true);
    expect(isLegacyPublicNoteImageUrl('data:image/webp;base64,abc')).toBe(true);
    expect(isLegacyPublicNoteImageUrl('/images/demo.webp')).toBe(true);
    expect(isLegacyPublicNoteImageUrl('client-notes/shop/c/n-0.webp')).toBe(false);
  });

  it('builds private note pathnames under client-notes/{shopId}/...', () => {
    expect(makePrivateNoteImagePath('shop-1', 'client-1', 'note-9', 2)).toBe(
      'client-notes/shop-1/client-1/note-9-2.webp',
    );
    expect(isPrivateNoteBlobPathname('client-notes/shop-1/client-1/note-9-2.webp')).toBe(true);
  });

  it('routes private pathnames to authenticated stream API', () => {
    expect(
      resolveClientNoteImageSrc('client-1', {
        id: 'img-1',
        url: 'client-notes/shop-1/client-1/note-0.webp',
      }),
    ).toBe('/api/admin/clients/client-1/notes/images/img-1');

    expect(
      resolveClientNoteImageSrc('client-1', {
        id: 'img-2',
        url: 'https://public.blob.vercel-storage.com/legacy.webp',
      }),
    ).toBe('https://public.blob.vercel-storage.com/legacy.webp');
  });

  it('leaves legacy http, data, and site-relative URLs unchanged', () => {
    expect(
      resolveClientNoteImageSrc('client-1', {
        id: 'img-http',
        url: 'http://example.com/legacy.webp',
      }),
    ).toBe('http://example.com/legacy.webp');
    expect(
      resolveClientNoteImageSrc('client-1', {
        id: 'img-data',
        url: 'data:image/webp;base64,abc',
      }),
    ).toBe('data:image/webp;base64,abc');
    expect(
      resolveClientNoteImageSrc('client-1', {
        id: 'img-path',
        url: '/images/demo.webp',
      }),
    ).toBe('/images/demo.webp');
  });

  it('URL-encodes client and image ids in the authenticated stream path', () => {
    expect(
      resolveClientNoteImageSrc('client/with spaces', {
        id: 'img?id=1&x=y',
        url: 'client-notes/shop/c/n-0.webp',
      }),
    ).toBe('/api/admin/clients/client%2Fwith%20spaces/notes/images/img%3Fid%3D1%26x%3Dy');
  });
});
