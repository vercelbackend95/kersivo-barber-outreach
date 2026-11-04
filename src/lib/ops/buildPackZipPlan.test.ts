import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { shapeBuildPack, type BuildPackRows } from './buildPack';
import { BUILD_PACK_BRIEF_INSTRUCTION, buildPackBriefMd } from './buildPackBrief';
import {
  asciiSlug,
  buildPackFolderName,
  buildPackReadme,
  planBuildPackFiles,
  sanitiseSegment,
  toBuildPackJson,
  uniquePath,
} from './buildPackZipPlan';

describe('path sanitiser', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\windows\\win.ini', 'win.ini'],
    ['/absolute/path/logo.PNG', 'logo.png'],
    ['..', 'file'],
    ['.', 'file'],
    ['', 'file'],
    ['Café Crème & Co.jpeg', 'cafe-creme-and-co.jpeg'],
    ['photo\u0000name.jpg', 'photoname.jpg'],
    ['01_Shopfront on Kirkgate.jpg', '01_shopfront-on-kirkgate.jpg'],
    ['ZDJĘCIE łódź.jpg', 'zdjecie-lodz.jpg'],
    ['evil.ph p', 'evil.php'],
  ])('%j → %j', (input, expected) => {
    expect(sanitiseSegment(input)).toBe(expected);
  });

  it('never produces a segment with a separator or a dot-dot', () => {
    for (const input of ['a/../b', '..\\x', 'x/..', '....', '../..']) {
      const out = sanitiseSegment(input);
      expect(out).not.toMatch(/[\\/]/);
      expect(out).not.toMatch(/^\.\.?$/);
      expect(out.startsWith('.')).toBe(false);
    }
  });

  it('de-duplicates case-insensitively', () => {
    const used = new Set<string>();
    expect(uniquePath('photos/team/alex.jpg', used)).toBe('photos/team/alex.jpg');
    expect(uniquePath('photos/team/Alex.jpg', used)).toBe('photos/team/Alex-2.jpg');
    expect(uniquePath('photos/team/alex.jpg', used)).toBe('photos/team/alex-3.jpg');
    expect(uniquePath('documents/other/readme', used)).toBe('documents/other/readme');
    expect(uniquePath('documents/other/readme', used)).toBe('documents/other/readme-2');
  });

  it('slugs to ASCII with a fallback', () => {
    expect(asciiSlug('Fade & Co. Barbers')).toBe('fade-and-co-barbers');
    expect(asciiSlug('✂️✂️', 'barbershop')).toBe('barbershop');
  });
});

const at = (s: string) => new Date(s);

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

function sampleRows(): BuildPackRows {
  return {
    request: {
      id: 'req_1',
      shopName: 'Fade & Co',
      townCity: 'Leeds',
      bookingPageUrl: null,
      instagramUrl: 'https://instagram.com/fadeco',
      googleListingUrl: null,
      websiteUrl: null,
      workLinks: null,
      barberCount: '2-3',
      currentBookingSystem: null,
      hasOwnDomain: 'no',
      notes: 'Big booking button please.',
      draftShopId: 'shop_1',
      changesRequestedText: null,
      changesRequestedAt: null,
      anonymisedAt: null,
      brandPrimaryColour: '#1F6F6B',
      brandSecondaryColour: '#C9A24A',
      brandBackgroundTone: 'DARK',
      brandColoursSource: 'LOGO',
      brandPaletteExtracted: [{ hex: '#1F6F6B', share: 0.6 }],
      brandColoursSentAt: null,
      brandSubmittedSnapshot: null,
      styleNotes: 'Warm and old-school.',
      aboutText: 'Family-run since 2014.\nWalk-ins welcome.',
      websiteExtraText: null,
    },
    shop: { id: 'shop_1', name: 'Fade & Co', townCity: 'Leeds', logoUrl: null, bookingSlug: 'fade-and-co', sitePreviewUrl: null, sitePreviewVersion: null },
    profile: {
      tagline: 'Sharp cuts',
      description: null,
      addressLine1: '1 High St',
      addressLine2: null,
      postcode: 'LS1 1AA',
      phone: '0113 000 0000',
      email: 'hello@fadeco.example',
      instagramUrl: null,
      facebookUrl: null,
      tiktokUrl: null,
      otherSocialUrl: null,
      brandPrimaryColour: null,
      brandSecondaryColour: null,
    },
    hours: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startMinutes: 540, endMinutes: 1080, active: true })),
    services: [
      { id: 's1', name: 'Skin fade', description: null, imageUrl: null, pricePence: 2200, priceFrom: true, durationMinutes: 45, displayOrder: 0, category: 'Haircuts', featured: false },
    ],
    barbers: [
      { id: 'b1', name: 'Alex Reed', avatarUrl: null, title: 'Owner', bio: null, sortOrder: 0 },
      { id: 'b2', name: 'Alex Reed', avatarUrl: null, title: null, bio: null, sortOrder: 1 },
    ],
    products: [],
    assets: [
      asset('logo', 'LOGO', { originalFileName: 'My Logo.PNG', storagePath: 'preview-hub/req_1/logo/logo.png', contentType: 'image/png' }),
      asset('p1', 'SHOP_PHOTO', { caption: 'Shopfront', sortOrder: 0 }),
      asset('p2', 'SHOP_PHOTO', { originalFileName: '../../evil.jpg', sortOrder: 1 }),
      asset('t1', 'TEAM_PHOTO', { barberId: 'b1' }),
      asset('t2', 'TEAM_PHOTO', { barberId: 'b2' }),
      asset('pl', 'PRICE_LIST', { originalFileName: 'Prices.pdf', storagePath: 'preview-hub/req_1/price_list/pl.pdf', contentType: 'application/pdf', thumbPath: null }),
      asset('c1', 'CHANGE_ATTACHMENT', { originalFileName: 'mockup.jpg' }),
    ],
    changeRequests: [],
  };
}

describe('build pack zip plan', () => {
  const pack = shapeBuildPack(sampleRows(), at('2026-11-04T12:00:00Z'));
  const files = planBuildPackFiles(pack);

  it('lays files out as in the spec, sanitised and unique', () => {
    expect(files.map((f) => f.path)).toEqual([
      'brand/logo/current-logo.png',
      'photos/shop/01_shopfront.jpg',
      'photos/shop/02_evil.jpg',
      'photos/team/alex-reed.jpg',
      'photos/team/alex-reed-2.jpg',
      'documents/price-list/prices.pdf',
      'revisions/attachments/mockup.jpg',
    ]);
  });

  it('names the folder with an ASCII slug and the London date', () => {
    expect(buildPackFolderName(pack, at('2026-11-04T23:30:00Z'))).toBe('kersivo-build-pack_fade-and-co_2026-11-04');
    expect(buildPackFolderName(pack, at('2026-07-01T23:30:00Z'))).toBe('kersivo-build-pack_fade-and-co_2026-07-02');
  });

  it('shop.json has paths and no storage paths', () => {
    const json = toBuildPackJson(pack, files, new Set(['p2']));
    const text = JSON.stringify(json);
    expect(text).not.toContain('storagePath');
    expect(text).not.toContain('preview-hub/');
    expect(json.schemaVersion).toBe(2);
    expect(json.assets.SHOP_PHOTO.map((a) => a.path)).toEqual(['photos/shop/01_shopfront.jpg', null]);
  });

  it('README lists files that could not be included', () => {
    const readme = buildPackReadme({ pack, folder: 'f', files, failed: [{ path: 'photos/shop/02_evil.jpg', reason: 'not found in storage' }] });
    expect(readme).toContain('## Files that could not be included');
    expect(readme).toContain('`photos/shop/02_evil.jpg` — not found in storage');
  });

  it('brief.md starts with the fixed instruction and matches the snapshot', () => {
    const brief = buildPackBriefMd(pack, files);
    expect(brief.split('\n')[2]).toBe(`> ${BUILD_PACK_BRIEF_INSTRUCTION}`);
    expect(brief).toMatchSnapshot();
  });

  it('brief.md keeps the section order', () => {
    const headings = buildPackBriefMd(pack, files)
      .split('\n')
      .filter((line) => line.startsWith('## '));
    expect(headings).toEqual([
      '## Shop',
      '## Location & contact',
      '## Opening hours',
      '## Brand',
      '## Website text',
      '## Services & prices',
      '## Team',
      '## Photos',
      '## Links & socials',
      '## Owner notes from the preview form',
      '## Not provided — do not invent',
      '## Conflicts to confirm',
    ]);
  });
});

describe('build pack zip plan: dashboard images and logos', () => {
  const blob = (name: string) => `https://store1.public.blob.vercel-storage.com/shops/shop_1/${name}`;

  function rows() {
    const r = sampleRows();
    r.shop!.logoUrl = blob('logo/shop-logo-Xy.PNG');
    r.barbers[0].avatarUrl = blob('barbers/alex-1.jpg'); // also has TEAM_PHOTO t1
    r.barbers.push({ id: 'b3', name: 'Jess', avatarUrl: blob('barbers/jess'), title: null, bio: null, sortOrder: 2 });
    r.products = [
      { id: 'pr2', name: 'Hair gel', description: null, pricePence: 900, imageUrl: blob('products/gel.webp'), featured: false, category: 'HAIR', sortOrder: 1 },
      { id: 'pr1', name: 'YoŁ shampoo', description: null, pricePence: 2500, imageUrl: blob('products/sh.png'), featured: false, category: 'HAIR', sortOrder: 0 },
      { id: 'pr3', name: 'Comb', description: null, pricePence: 300, imageUrl: null, featured: false, category: 'TOOLS', sortOrder: 2 },
    ];
    r.services[0].imageUrl = blob('services/fade.jpg');
    // Three logos: an old one, a re-upload of the current one (same name and size), and the current one.
    r.assets = [
      asset('l1', 'LOGO', { originalFileName: 'IMG_2197.jpg', sizeBytes: 177342, createdAt: at('2026-11-01T02:45:00Z') }),
      asset('l2', 'LOGO', { originalFileName: 'Futuristic £39 Neon Showroom.jpg', sizeBytes: 139405, createdAt: at('2026-11-01T15:01:00Z') }),
      asset('l3', 'LOGO', { originalFileName: 'Futuristic £39 Neon Showroom.jpg', sizeBytes: 139405, createdAt: at('2026-11-01T20:21:00Z') }),
      ...r.assets.filter((a) => a.kind !== 'LOGO'),
    ];
    return r;
  }

  const pack = shapeBuildPack(rows(), at('2026-11-04T12:00:00Z'));
  const files = planBuildPackFiles(pack);
  const paths = files.map((f) => f.path);

  it('current logo, earlier uploads, shop settings logo; exact duplicate left out', () => {
    expect(pack.brand.currentLogoAssetId).toBe('l3');
    expect(paths.filter((p) => p.startsWith('brand/'))).toEqual([
      'brand/logo/current-logo.jpg',
      'brand/logo/earlier/img-2197.jpg',
      'brand/logo/shop-settings-logo.png',
    ]);
    expect(files.some((f) => f.asset?.id === 'l2')).toBe(false);
    const json = toBuildPackJson(pack, files);
    expect(json.assets.LOGO.find((a) => a.id === 'l2')).toMatchObject({ path: null, duplicateOf: 'l3' });
    const readme = buildPackReadme({ pack, folder: 'f', files, failed: [] });
    expect(readme).toContain('## Duplicate logo uploads left out');
    expect(readme).toContain('- Futuristic £39 Neon Showroom.jpg (uploaded 2026-11-01)');
  });

  it('avatar, product and service paths in display order; avatar next to a hub team photo gets -2', () => {
    expect(paths.filter((p) => p.startsWith('photos/team/'))).toEqual([
      'photos/team/alex-reed.jpg',
      'photos/team/alex-reed-2.jpg',
      'photos/team/alex-reed-3.jpg',
      'photos/team/jess.img',
    ]);
    expect(files.find((f) => f.remote?.id === 'barber:b3')).toMatchObject({ extFromUrl: false });
    expect(paths.filter((p) => p.startsWith('photos/products/'))).toEqual(['photos/products/01_yol-shampoo.png', 'photos/products/02_hair-gel.webp']);
    expect(paths.filter((p) => p.startsWith('photos/services/'))).toEqual(['photos/services/01_skin-fade.jpg']);
  });

  it('shop.json v2: remoteImages with paths and photoPath on team, products and services', () => {
    const json = toBuildPackJson(pack, files, new Set(['product:pr2']));
    expect(json.schemaVersion).toBe(2);
    expect(json.remoteImages.find((i) => i.id === 'product:pr2')?.path).toBeNull();
    expect(json.remoteImages.find((i) => i.id === 'shopLogo:shop_1')?.path).toBe('brand/logo/shop-settings-logo.png');
    expect(json.team[0]).toMatchObject({ photoPath: 'photos/team/alex-reed.jpg', photoPaths: ['photos/team/alex-reed.jpg', 'photos/team/alex-reed-3.jpg'] });
    expect(json.products.map((p) => p.photoPath)).toEqual(['photos/products/01_yol-shampoo.png', null, null]);
    expect(json.services[0].photoPath).toBe('photos/services/01_skin-fade.jpg');
  });

  it('brief: current logo path and a factual raster hint for a JPEG logo', () => {
    const brief = buildPackBriefMd(pack, files);
    expect(brief).toContain('- Logo: `brand/logo/current-logo.jpg`');
    expect(brief).toContain('- Logo file is a raster image (JPG/PNG photo), not a vector or transparent logo.');
    expect(brief).toContain('- Earlier logo uploads (use only if asked): `brand/logo/earlier/img-2197.jpg`');
  });

  it('brief: falls back to the shop settings logo, and says "Not provided" only when there is none', () => {
    const noHub = rows();
    noHub.assets = noHub.assets.filter((a) => a.kind !== 'LOGO');
    const p1 = shapeBuildPack(noHub);
    const b1 = buildPackBriefMd(p1, planBuildPackFiles(p1));
    expect(b1).toContain('- Logo: `brand/logo/shop-settings-logo.png`');
    expect(b1).not.toContain('raster image');
    expect(buildPackBriefMd(p1, planBuildPackFiles(p1), new Set(['shopLogo:shop_1']))).toContain('- Logo: Not provided');
  });
});
