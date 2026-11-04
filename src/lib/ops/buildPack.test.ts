import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { shapeBuildPack, type BuildPackRows } from './buildPack';

const at = (s: string) => new Date(s);

function baseRequest(overrides: Partial<BuildPackRows['request']> = {}): BuildPackRows['request'] {
  return {
    id: 'req_1',
    shopName: 'Fade Co',
    townCity: 'Leeds',
    bookingPageUrl: null,
    instagramUrl: null,
    googleListingUrl: null,
    websiteUrl: null,
    workLinks: null,
    barberCount: '2-3',
    currentBookingSystem: null,
    hasOwnDomain: 'yes',
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

function emptyRows(overrides: Partial<BuildPackRows> = {}): BuildPackRows {
  return {
    request: baseRequest(),
    shop: null,
    profile: null,
    hours: [],
    services: [],
    barbers: [],
    products: [],
    assets: [],
    changeRequests: [],
    ...overrides,
  };
}

function asset(id: string, kind: string, extra: Partial<BuildPackRows['assets'][number]> = {}): BuildPackRows['assets'][number] {
  return {
    id,
    kind,
    storagePath: `preview-hub/req_1/${kind.toLowerCase()}/${id}.jpg`,
    thumbPath: `preview-hub/req_1/${kind.toLowerCase()}/${id}-thumb.webp`,
    originalFileName: `${id}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 1000,
    width: 1600,
    height: 1067,
    caption: null,
    sortOrder: 0,
    barberId: null,
    uploadedBy: 'OWNER',
    createdAt: at('2026-11-01T10:00:00Z'),
    ...extra,
  };
}

function fullRows(): BuildPackRows {
  return emptyRows({
    request: baseRequest({
      draftShopId: 'shop_1',
      aboutText: 'Line one\nLine two',
      instagramUrl: 'https://instagram.com/fadeco',
      brandPrimaryColour: '#1f6f6b',
      brandSecondaryColour: '#C9A24A',
      brandBackgroundTone: 'DARK',
      brandColoursSource: 'LOGO',
      styleNotes: 'Warm',
    }),
    shop: {
      id: 'shop_1',
      name: 'Fade Co',
      townCity: 'Leeds',
      logoUrl: null,
      bookingSlug: 'fade-co',
      sitePreviewUrl: null,
      sitePreviewVersion: null,
    },
    profile: {
      tagline: 'Sharp cuts',
      description: null,
      addressLine1: '1 High St',
      addressLine2: null,
      postcode: 'LS1 1AA',
      phone: '0113 000 0000',
      email: 'hello@fadeco.example',
      instagramUrl: 'https://www.instagram.com/fadeco/',
      facebookUrl: null,
      tiktokUrl: null,
      otherSocialUrl: null,
      brandPrimaryColour: '#1F6F6B',
      brandSecondaryColour: null,
    },
    hours: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startMinutes: 540, endMinutes: 1080, active: true })),
    services: [
      { id: 's2', name: 'Beard', description: null, imageUrl: null, pricePence: 1500, priceFrom: false, durationMinutes: 20, displayOrder: 1, category: null, featured: false },
      { id: 's1', name: 'Fade', description: null, imageUrl: null, pricePence: 2200, priceFrom: true, durationMinutes: 45, displayOrder: 0, category: 'Haircuts', featured: true },
    ],
    barbers: [
      { id: 'b1', name: 'Alex', avatarUrl: null, title: 'Owner', bio: null, sortOrder: 0 },
      { id: 'b2', name: 'Jordan', avatarUrl: null, title: null, bio: null, sortOrder: 1 },
    ],
    assets: [
      asset('logo', 'LOGO'),
      asset('p2', 'SHOP_PHOTO', { sortOrder: 1, caption: 'Chairs' }),
      asset('p1', 'SHOP_PHOTO', { sortOrder: 0, caption: ' Front ' }),
      asset('t1', 'TEAM_PHOTO', { barberId: 'b1' }),
      asset('pl', 'PRICE_LIST', { contentType: 'application/pdf', thumbPath: null }),
      asset('m1', 'MESSAGE_ATTACHMENT'),
    ],
    changeRequests: [
      { id: 'c1', round: 1, page: 'HOME', body: 'Bigger logo', attachmentId: null, status: 'SENT', createdAt: at('2026-11-02T10:00:00Z'), sentAt: at('2026-11-02T10:00:00Z') },
      { id: 'c2', round: null, page: 'HOME', body: 'Draft', attachmentId: null, status: 'DRAFT', createdAt: at('2026-11-02T10:00:00Z'), sentAt: null },
      { id: 'c3', round: 1, page: 'HOME', body: 'Done', attachmentId: null, status: 'DONE', createdAt: at('2026-11-02T10:00:00Z'), sentAt: null },
    ],
  });
}

describe('shapeBuildPack', () => {
  it('maps a full request into every section', () => {
    const pack = shapeBuildPack(fullRows(), at('2026-11-04T12:00:00Z'));
    expect(pack.schemaVersion).toBe(1);
    expect(pack.contact).toMatchObject({ tagline: 'Sharp cuts', addressLine1: '1 High St', postcode: 'LS1 1AA', hasOwnDomain: 'Yes' });
    expect(pack.hours.saved).toBe(true);
    expect(pack.hours.days[0]).toEqual({ dayOfWeek: 1, day: 'Monday', isOpen: true, opens: '09:00', closes: '18:00' });
    expect(pack.hours.days[6]).toEqual({ dayOfWeek: 7, day: 'Sunday', isOpen: false, opens: null, closes: null });
    expect(pack.services.map((s) => s.name)).toEqual(['Fade', 'Beard']);
    expect(pack.team[0]).toMatchObject({ name: 'Alex', role: 'Owner', photoAssetIds: ['t1'] });
    expect(pack.assets.SHOP_PHOTO.map((a) => [a.id, a.caption])).toEqual([
      ['p1', 'Front'],
      ['p2', 'Chairs'],
    ]);
    expect(pack.assets.TEAM_PHOTO[0].barberName).toBe('Alex');
    expect(pack.assets.PRICE_LIST).toHaveLength(1);
    expect(pack.revisionFiles.map((a) => a.id)).toEqual(['m1']);
    expect(pack.brand.currentLogoAssetId).toBe('logo');
    expect(pack.brand.primary).toEqual({ request: '#1F6F6B', profile: '#1F6F6B' });
    expect(pack.text.about).toBe('Line one\nLine two');
    expect(pack.changeRequests.map((c) => c.id)).toEqual(['c1']);
    expect(pack.readiness.every((r) => r.ok)).toBe(true);
    expect(pack.missing).toEqual(['Team photos for Jordan']);
    // Same colour in different case and the same Instagram URL with www/trailing slash are not conflicts.
    expect(pack.conflicts).toEqual([]);
  });

  it('lists everything as missing for an empty request without a draft shop', () => {
    const pack = shapeBuildPack(emptyRows());
    expect(pack.shop.draftShopId).toBeNull();
    expect(pack.hours.saved).toBe(false);
    expect(pack.hours.days).toHaveLength(7);
    expect(pack.readiness.every((r) => !r.ok)).toBe(true);
    expect(pack.missing[0]).toMatch(/^Draft shop/);
    expect(pack.missing).toEqual(
      expect.arrayContaining(['Business details', 'Opening hours', 'Logo', 'Colours', 'Shop photos', 'Team', 'Services', 'About text', 'Price list', 'Tagline', 'Social links']),
    );
    expect(pack.conflicts).toEqual([]);
  });

  it('returns both values and a conflict when sources disagree', () => {
    const rows = fullRows();
    rows.request.brandPrimaryColour = '#000000';
    rows.request.aboutText = 'From the hub';
    rows.profile!.description = 'From the dashboard';
    rows.profile!.instagramUrl = 'https://instagram.com/other';
    rows.shop!.name = 'Fade & Co';
    const pack = shapeBuildPack(rows);
    expect(pack.brand.primary).toEqual({ request: '#000000', profile: '#1F6F6B' });
    expect(pack.conflicts.map((c) => c.field).sort()).toEqual(['brand.primary', 'links.instagram', 'shop.name', 'text.about']);
    const name = pack.conflicts.find((c) => c.field === 'shop.name')!;
    expect(name.values.map((v) => v.value)).toEqual(['Fade Co', 'Fade & Co']);
  });

  it('keeps the snapshot logo as current once brand is sent, and flags snapshot colour drift', () => {
    const rows = fullRows();
    rows.assets.push(asset('logo2', 'LOGO', { createdAt: at('2026-11-03T10:00:00Z') }));
    rows.request.brandColoursSentAt = at('2026-11-02T09:00:00Z');
    rows.request.brandSubmittedSnapshot = { logoAssetId: 'logo', brandPrimaryColour: '#123456', logoOriginalFileName: 'logo.jpg' };
    const pack = shapeBuildPack(rows);
    expect(pack.brand.currentLogoAssetId).toBe('logo');
    expect(pack.brand.submittedSnapshot?.logoOriginalFileName).toBe('logo.jpg');
    expect(pack.conflicts.find((c) => c.field === 'brand.primary')?.values.map((v) => v.source)).toEqual(['request', 'profile', 'snapshot']);
  });
});
