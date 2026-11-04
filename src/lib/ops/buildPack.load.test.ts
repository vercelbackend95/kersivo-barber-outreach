import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  previewRequest: { findUnique: vi.fn() },
  shopSettings: { findUnique: vi.fn() },
  shopPublicProfile: { findUnique: vi.fn() },
  shopOpeningHours: { findMany: vi.fn() },
  service: { findMany: vi.fn() },
  barber: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  previewHubAsset: { findMany: vi.fn() },
  previewChangeRequest: { findMany: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: db }));

import { loadBuildPack } from './buildPack';
import { BUILD_PACK_MAPPED_FIELDS } from './buildPackFields';

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    shopName: 'Fade Co',
    townCity: 'Leeds',
    bookingPageUrl: null,
    instagramUrl: null,
    googleListingUrl: null,
    websiteUrl: null,
    workLinks: null,
    barberCount: null,
    currentBookingSystem: null,
    hasOwnDomain: null,
    notes: null,
    draftShopId: null,
    changesRequestedText: null,
    changesRequestedAt: null,
    anonymisedAt: null,
    brandPrimaryColour: null,
    brandSecondaryColour: null,
    brandBackgroundTone: null,
    brandColoursSource: null,
    brandPaletteExtracted: null,
    brandColoursSentAt: null,
    brandSubmittedSnapshot: null,
    styleNotes: null,
    aboutText: null,
    websiteExtraText: null,
    ...overrides,
  };
}

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset().mockResolvedValue([]);
  db.shopSettings.findUnique.mockResolvedValue(null);
  db.shopPublicProfile.findUnique.mockResolvedValue(null);
});

describe('loadBuildPack', () => {
  it('returns null for an unknown request', async () => {
    db.previewRequest.findUnique.mockResolvedValue(null);
    expect(await loadBuildPack('nope')).toBeNull();
  });

  it('returns null for an anonymised request without reading anything else', async () => {
    db.previewRequest.findUnique.mockResolvedValue(request({ anonymisedAt: new Date() }));
    expect(await loadBuildPack('req_1')).toBeNull();
    expect(db.previewHubAsset.findMany).not.toHaveBeenCalled();
  });

  it('selects exactly the mapped request fields (no personal data)', async () => {
    db.previewRequest.findUnique.mockResolvedValue(request());
    await loadBuildPack('req_1');
    const select = db.previewRequest.findUnique.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual([...BUILD_PACK_MAPPED_FIELDS.PreviewRequest].sort());
    expect(select).not.toHaveProperty('email');
    expect(select).not.toHaveProperty('firstName');
  });

  it('skips draft-shop queries when there is no draft shop', async () => {
    db.previewRequest.findUnique.mockResolvedValue(request());
    const pack = await loadBuildPack('req_1');
    expect(pack?.shop.draftShopId).toBeNull();
    expect(db.shopSettings.findUnique).not.toHaveBeenCalled();
    expect(db.service.findMany).not.toHaveBeenCalled();
    expect(db.previewHubAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { previewRequestId: 'req_1', deletedAt: null } }),
    );
  });

  it('reads only active services, visible active barbers and active products of the draft shop', async () => {
    db.previewRequest.findUnique.mockResolvedValue(request({ draftShopId: 'shop_1' }));
    db.shopSettings.findUnique.mockResolvedValue({
      id: 'shop_1',
      name: 'Fade Co',
      townCity: 'Leeds',
      logoUrl: null,
      bookingSlug: null,
      sitePreviewUrl: null,
      sitePreviewVersion: null,
    });
    db.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Clay', description: null, pricePence: 1400, imageUrl: null, featured: false, category: 'STYLING', sortOrder: 0 },
    ]);
    const pack = await loadBuildPack('req_1');
    expect(db.service.findMany.mock.calls[0][0].where).toEqual({ shopId: 'shop_1', isActive: true });
    expect(db.barber.findMany.mock.calls[0][0].where).toEqual({ shopId: 'shop_1', active: true, showOnWebsite: true });
    expect(db.product.findMany.mock.calls[0][0].where).toEqual({ shopId: 'shop_1', active: true });
    expect(db.product.findMany.mock.calls[0][0].select).not.toHaveProperty('inStock');
    expect(pack?.products[0]).toMatchObject({ name: 'Clay', category: 'STYLING' });
  });
});
