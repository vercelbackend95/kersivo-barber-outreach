import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { resolveCanonicalUrl, resolvePageSeo } from '@/lib/seo/meta';
import {
  publicBookingPageSeo,
  resolvePublicBookingIdentifier,
} from './resolvePublicBookingIdentifier';
import {
  legacyPublicBookingPathFromShopId,
  preferredPublicBookingPath,
  publicBookingPathFromSlug,
} from './publicBookingPath';

vi.mock('../db/client', () => ({ prisma: {} }));

type Row = { id: string; bookingSlug: string | null };

function fakeDb(rows: Row[]) {
  const findUnique = vi.fn(async ({ where }: { where: { id?: string; bookingSlug?: string } }) => {
    const row = rows.find((r) =>
      where.bookingSlug !== undefined ? r.bookingSlug === where.bookingSlug : r.id === where.id,
    );
    return row ? { ...row } : null;
  });
  return { db: { shopSettings: { findUnique } } as never, findUnique };
}

const freeShop: Row = { id: 'cmfree123', bookingSlug: 'blackline-barbers' };
const legacyFullShop: Row = { id: 'cmlegacyfull', bookingSlug: null };

describe('resolvePublicBookingIdentifier', () => {
  it('K: a slug resolves to the correct internal shop id', async () => {
    const { db } = fakeDb([freeShop, legacyFullShop]);
    expect(await resolvePublicBookingIdentifier('blackline-barbers', '', db)).toEqual({
      kind: 'shop',
      shopId: 'cmfree123',
      bookingSlug: 'blackline-barbers',
      resolvedBy: 'slug',
    });
  });

  it('L: a legacy raw id for a shop with a slug permanently redirects to the slug URL', async () => {
    const { db } = fakeDb([freeShop]);
    expect(await resolvePublicBookingIdentifier('cmfree123', '', db)).toEqual({
      kind: 'redirect',
      location: '/book/blackline-barbers',
      status: 308,
    });
  });

  it('M: the redirect preserves the query string', async () => {
    const { db } = fakeDb([freeShop]);
    const result = await resolvePublicBookingIdentifier('cmfree123', '?deposit=cancelled', db);
    expect(result).toMatchObject({ location: '/book/blackline-barbers?deposit=cancelled' });
  });

  it('N: a legacy Full shop without a slug keeps working on its raw id route', async () => {
    const { db } = fakeDb([legacyFullShop]);
    expect(await resolvePublicBookingIdentifier('cmlegacyfull', '?x=1', db)).toEqual({
      kind: 'shop',
      shopId: 'cmlegacyfull',
      bookingSlug: null,
      resolvedBy: 'id',
    });
  });

  it('O: an unknown identifier is not found', async () => {
    const { db } = fakeDb([freeShop]);
    expect(await resolvePublicBookingIdentifier('nope', '', db)).toEqual({ kind: 'not_found' });
    expect(await resolvePublicBookingIdentifier('   ', '', db)).toEqual({ kind: 'not_found' });
  });

  it('never resolves or redirects demo identifiers into a tenant', async () => {
    const { db, findUnique } = fakeDb([{ id: 'real', bookingSlug: 'demo-shop' }]);
    expect(await resolvePublicBookingIdentifier('demo-shop', '', db)).toEqual({ kind: 'demo' });
    expect(await resolvePublicBookingIdentifier('blackline-barbers-demo', '', db)).toEqual({ kind: 'demo' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('prefers a slug match over an id match', async () => {
    const { db } = fakeDb([
      { id: 'shop-a', bookingSlug: 'shop-b' },
      { id: 'shop-b', bookingSlug: 'other' },
    ]);
    expect(await resolvePublicBookingIdentifier('shop-b', '', db)).toMatchObject({
      kind: 'shop',
      shopId: 'shop-a',
    });
  });
});

describe('public booking paths', () => {
  it('distinguishes canonical slug paths from legacy raw-id paths', () => {
    expect(publicBookingPathFromSlug('blackline-barbers')).toBe('/book/blackline-barbers');
    expect(legacyPublicBookingPathFromShopId('cm123')).toBe('/book/cm123');
    expect(preferredPublicBookingPath({ id: 'cm123', bookingSlug: 'blackline-barbers' })).toBe(
      '/book/blackline-barbers',
    );
    expect(preferredPublicBookingPath({ id: 'cm123', bookingSlug: null })).toBe('/book/cm123');
  });
});

describe('booking page SEO', () => {
  it('Q: booking pages are explicitly noindex, follow', () => {
    const seo = resolvePageSeo(publicBookingPageSeo(freeShop));
    expect(seo.robotsContent).toBe('noindex, follow');
  });

  it('R: canonical points to /book/{slug}, never the raw id', () => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://kersivo.co.uk');
    try {
      const seo = publicBookingPageSeo(freeShop);
      expect(seo.canonicalPath).toBe('/book/blackline-barbers');
      expect(resolveCanonicalUrl(seo.canonicalPath)).toBe('https://kersivo.co.uk/book/blackline-barbers');
      expect(publicBookingPageSeo(legacyFullShop).canonicalPath).toBe('/book/cmlegacyfull');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('P/Q/R: the booking page wires resolution, internal shop id and explicit noindex', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(join(here, '../../pages/book/[shopId].astro'), 'utf8');

    expect(page).toContain('resolvePublicBookingIdentifier(identifier, Astro.url.search)');
    expect(page).toContain('Astro.redirect(bookingPageData.location, bookingPageData.status)');
    // Internal APIs and cart use the resolved shop.id, never the public identifier.
    expect(page).toContain('publicShopId={shop.id}');
    expect(page).toContain('`/api/public/bookings/${shop.id}/create`');
    expect(page).toContain('shopId={shop?.id}');
    expect(page).not.toMatch(/api\/public\/bookings\/\$\{identifier\}/);
    expect(page).not.toMatch(/shopId=\{identifier\}/);
    expect(page).toContain('noindex={true}');
    expect(page).toContain('robotsFollow={true}');
    expect(page).toContain('publicBookingPageSeo(shop)');
  });
});
