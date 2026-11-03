import { describe, expect, it } from 'vitest';
import { HUB_THUMB_EDGE } from '@/lib/freePreview/hubAssets';
import {
  ADMIN_HUB_COLOURS_DRAFT,
  ADMIN_HUB_COLOURS_DRAFT_HINT,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_FOUND,
  ADMIN_HUB_COLOURS_HINT,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_MINUTE,
  ADMIN_HUB_COLOURS_NO_LOGO,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SAVED,
  ADMIN_HUB_COLOURS_SENT,
} from './copy';
import {
  hubLogoLook,
  logoHasTransparency,
  logoNeedsLightPlate,
  OVERVIEW_PALETTE_CAP,
  overviewColours,
  OVERVIEW_CONTENT_PHOTO_CAP,
  OVERVIEW_THUMB_EDGE,
  overviewImageSize,
  overviewPhotoGrid,
  overviewWebsiteContent,
  type OverviewContentAsset,
} from './overviewTiles';

function asset(
  id: string,
  kind: string,
  createdAt: string,
  extra: Partial<OverviewContentAsset> = {},
): OverviewContentAsset {
  return { id, kind, hasThumb: true, contentType: 'image/jpeg', createdAt, width: 1600, height: 1200, ...extra };
}

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T10:00:00.000Z`;

describe('overviewWebsiteContent — logo and photos (O3)', () => {
  it('keeps the thumb edge in step with the server thumbnailer', () => {
    expect(OVERVIEW_THUMB_EDGE).toBe(HUB_THUMB_EDGE);
  });

  it('orders shop photos newest first, caps at 8 and counts every shop photo', () => {
    const photos = Array.from({ length: 11 }, (_, i) => asset(`p${i + 1}`, 'SHOP_PHOTO', day(i + 1)));
    const content = overviewWebsiteContent({ assets: [...photos, asset('team', 'TEAM_PHOTO', day(30))] });
    expect(content.photos).toHaveLength(OVERVIEW_CONTENT_PHOTO_CAP);
    expect(content.photos.map((photo) => photo.id)).toEqual(['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4']);
    expect(content.photoTotal).toBe(11);
    expect(content.status.find((row) => row.id === 'photos')?.value).toBe('11');
  });

  it('has no Team photos row and barber photos never count towards website content (O8)', () => {
    const barberPhoto = asset('barber', 'TEAM_PHOTO', day(3));
    const onlyBarber = overviewWebsiteContent({ assets: [barberPhoto] });
    expect(onlyBarber.status.map((row) => row.id)).toEqual(['logo', 'photos', 'text']);
    expect(onlyBarber.status.map((row) => row.label)).not.toContain('Team photos');
    expect(onlyBarber.empty).toBe(true);
    expect(onlyBarber.photoTotal).toBe(0);
    const withShop = overviewWebsiteContent({ assets: [barberPhoto, asset('p1', 'SHOP_PHOTO', day(4))] });
    expect(withShop.status.find((row) => row.id === 'photos')?.value).toBe('1');
  });

  it('never puts the logo or a logo-like file among the photos, and takes the logo from currentHubLogo', () => {
    const content = overviewWebsiteContent({
      assets: [
        asset('logo_old', 'LOGO', day(1), { contentType: 'image/png', width: 1200, height: 200 }),
        asset('logo_new', 'LOGO', day(5), { contentType: 'image/png', width: 1200, height: 200 }),
        asset('photo', 'SHOP_PHOTO', day(2)),
      ],
    });
    expect(content.photos.map((photo) => photo.id)).toEqual(['photo']);
    expect(content.logo).toMatchObject({
      id: 'logo_new',
      src: '/api/admin-hub/assets/logo_new?size=thumb',
      width: 480,
      height: 80,
    });

    const locked = overviewWebsiteContent({
      assets: [asset('logo_old', 'LOGO', day(1)), asset('logo_new', 'LOGO', day(5))],
      logoOptions: { brandLocked: true, snapshotLogoAssetId: 'logo_old' },
    });
    expect(locked.logo?.id).toBe('logo_old');
    expect(locked.empty).toBe(false);
    expect(locked.photos).toEqual([]);
  });

  it('handles SVG and no-thumb files: rasterised thumbs show, unpaintable files are skipped', () => {
    const content = overviewWebsiteContent({
      assets: [
        asset('svg_logo', 'LOGO', day(3), { contentType: 'image/svg+xml', hasThumb: false, width: 480, height: 120 }),
        asset('svg_rastered', 'SHOP_PHOTO', day(4), { contentType: 'image/svg+xml', hasThumb: true, width: 480, height: 480 }),
        asset('svg_raw', 'SHOP_PHOTO', day(5), { contentType: 'image/svg+xml', hasThumb: false }),
        asset('pdf', 'SHOP_PHOTO', day(6), { contentType: 'application/pdf', hasThumb: false, width: null, height: null }),
        asset('png_no_thumb', 'SHOP_PHOTO', day(2), { contentType: 'image/png', hasThumb: false, width: 300, height: 200 }),
      ],
    });
    // The logo slot still shows (with an icon) when the logo file cannot be painted.
    expect(content.logo).toMatchObject({ id: 'svg_logo', src: null });
    expect(content.photos.map((photo) => [photo.id, photo.src])).toEqual([
      ['svg_rastered', '/api/admin-hub/assets/svg_rastered?size=thumb'],
      ['png_no_thumb', '/api/admin-hub/assets/png_no_thumb?size=full'],
    ]);
    expect(content.photos[1]).toMatchObject({ width: 300, height: 200, fullSrc: null });
    expect(content.photoTotal).toBe(4);
  });

  it('sizes images as the thumb is served and falls back to a square thumb edge without width/height', () => {
    expect(overviewImageSize({ hasThumb: true, width: 2560, height: 1440 })).toEqual({ width: 480, height: 270 });
    expect(overviewImageSize({ hasThumb: true, width: 300, height: 900 })).toEqual({ width: 160, height: 480 });
    expect(overviewImageSize({ hasThumb: true, width: 200, height: 100 })).toEqual({ width: 200, height: 100 });
    expect(overviewImageSize({ hasThumb: false, width: 1000, height: 500 })).toEqual({ width: 1000, height: 500 });
    expect(overviewImageSize({ hasThumb: true, width: null, height: 300 })).toEqual({ width: 480, height: 480 });
    expect(overviewImageSize({ hasThumb: true })).toEqual({ width: 480, height: 480 });
    expect(overviewImageSize({ hasThumb: true, width: 0, height: -1 })).toEqual({ width: 480, height: 480 });

    const content = overviewWebsiteContent({
      assets: [asset('big', 'SHOP_PHOTO', day(2), { width: 2000, height: 1500 }), asset('nodims', 'SHOP_PHOTO', day(1), { width: null, height: null })],
    });
    expect(content.photos[0]).toMatchObject({
      width: 480,
      height: 360,
      fullSrc: '/api/admin-hub/assets/big?size=full',
      fullWidth: 2000,
    });
    expect(content.photos[1]).toMatchObject({ width: 480, height: 480, fullSrc: null, fullWidth: null });
  });

  it('logo only is not empty and has no photos', () => {
    const content = overviewWebsiteContent({ assets: [asset('logo', 'LOGO', day(1))] });
    expect(content).toMatchObject({ empty: false, photos: [], photoTotal: 0 });
    expect(content.logo?.id).toBe('logo');
  });
});

describe('overviewPhotoGrid', () => {
  it('picks the layout by count', () => {
    expect(overviewPhotoGrid(0, 0)).toEqual({ layout: 'one', cells: [] });
    expect(overviewPhotoGrid(1, 1).layout).toBe('one');
    expect(overviewPhotoGrid(2, 2).layout).toBe('two');
    expect(overviewPhotoGrid(3, 3).layout).toBe('three');
    expect(overviewPhotoGrid(4, 4).layout).toBe('many');
  });

  it('shows 2×2 / 3×2 / 4×2 and puts "+N" on the last visible cell at each width', () => {
    const nine = overviewPhotoGrid(8, 9);
    expect(nine.cells.map((cell) => cell.from)).toEqual(['narrow', 'narrow', 'narrow', 'narrow', 'mid', 'mid', 'wide', 'wide']);
    expect(nine.cells.map((cell) => cell.more)).toEqual([
      null,
      null,
      null,
      { n: 5, at: ['narrow'] },
      null,
      { n: 3, at: ['mid'] },
      null,
      { n: 1, at: ['wide'] },
    ]);

    const four = overviewPhotoGrid(4, 9);
    expect(four.cells[3]?.more).toEqual({ n: 5, at: ['narrow', 'mid', 'wide'] });

    const five = overviewPhotoGrid(5, 5);
    expect(five.cells.map((cell) => cell.more)).toEqual([null, null, null, { n: 1, at: ['narrow'] }, null]);

    expect(overviewPhotoGrid(8, 8).cells[7]?.more).toBeNull();
  });

  it('adds "+N" to small layouts when some shop photos cannot be shown', () => {
    expect(overviewPhotoGrid(2, 3).cells[1]?.more).toEqual({ n: 1, at: ['narrow', 'mid', 'wide'] });
    expect(overviewPhotoGrid(3, 3).cells.every((cell) => cell.more === null)).toBe(true);
  });
});

describe('logoNeedsLightPlate', () => {
  const image = (pixels: Array<[number, number, number, number]>) => ({
    data: new Uint8ClampedArray(pixels.flat()),
    width: pixels.length,
    height: 1,
  });

  it('flags a black logo on a transparent background', () => {
    expect(logoNeedsLightPlate(image([[0, 0, 0, 255], [10, 10, 12, 255], [0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(true);
  });

  it('leaves light, colourful and opaque-background logos on the dark surface', () => {
    expect(logoNeedsLightPlate(image([[255, 255, 255, 255], [0, 0, 0, 0]]))).toBe(false);
    expect(logoNeedsLightPlate(image([[200, 30, 40, 255], [0, 0, 0, 0]]))).toBe(false);
    // Black mark on an opaque white square: most visible pixels are light.
    expect(logoNeedsLightPlate(image([[0, 0, 0, 255], [255, 255, 255, 255], [255, 255, 255, 255]]))).toBe(false);
  });

  it('ignores fully transparent images', () => {
    expect(logoNeedsLightPlate(image([[0, 0, 0, 0]]))).toBe(false);
    expect(logoNeedsLightPlate({ data: new Uint8ClampedArray(), width: 0, height: 0 })).toBe(false);
  });
});

describe('logoHasTransparency / hubLogoLook (O7)', () => {
  // 10×10 fixtures: a centred 4×4 mark on a background.
  const logo = (mark: [number, number, number, number], background: [number, number, number, number]) => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) data.set(x > 2 && x < 7 && y > 2 && y < 7 ? mark : background, (y * 10 + x) * 4);
    }
    return { data, width: 10, height: 10 };
  };
  const clear: [number, number, number, number] = [0, 0, 0, 0];

  it('opaque dark JPG-like logo with a red mark: no transparency, rounded corners, no plate', () => {
    const image = logo([200, 16, 46, 255], [12, 12, 13, 255]);
    expect(logoHasTransparency(image)).toBe(false);
    // Treated as "faint" on its own (mostly dark pixels) — the reason opaque images must never get a plate.
    expect(logoNeedsLightPlate(image)).toBe(true);
    expect(hubLogoLook(image)).toBe('opaque');
  });

  it('black on transparent: plate', () => {
    const image = logo([0, 0, 0, 255], clear);
    expect(logoHasTransparency(image)).toBe(true);
    expect(hubLogoLook(image)).toBe('plate');
  });

  it('white or colourful on transparent: no plate', () => {
    expect(hubLogoLook(logo([250, 250, 250, 255], clear))).toBe('plain');
    expect(hubLogoLook(logo([201, 162, 74, 255], clear))).toBe('plain');
  });

  it('needs transparent corners and at least 5 % see-through pixels', () => {
    // Transparent pixels only in the middle (corners opaque): not a transparent logo.
    expect(logoHasTransparency(logo(clear, [0, 0, 0, 255]))).toBe(false);
    // A single see-through corner pixel is below 5 %.
    const almost = logo([0, 0, 0, 255], [0, 0, 0, 255]);
    almost.data[3] = 0;
    expect(logoHasTransparency(almost)).toBe(false);
  });

  it('empty images stay plain', () => {
    expect(hubLogoLook({ data: new Uint8ClampedArray(), width: 0, height: 0 })).toBe('plain');
    expect(hubLogoLook(logo(clear, clear))).toBe('plain');
  });
});

describe('overviewColours — Brand colours tile (O4)', () => {
  const palette = [
    { hex: '#1F6F6B', share: 0.42 },
    { hex: '#C9A24A', share: 0.24 },
    { hex: '#141414', share: 0.18 },
    { hex: '#F2E8D5', share: 0.1 },
    { hex: '#8A2D2D', share: 0.06 },
  ];

  it('no logo: Materials → Logo link, amber "Not sent yet", nothing invented', () => {
    expect(overviewColours({ hasLogo: false })).toMatchObject({
      state: 'no_logo',
      palette: [],
      main: null,
      accent: null,
      look: null,
      headline: ADMIN_HUB_COLOURS_NO_LOGO,
      statusLabel: ADMIN_HUB_COLOURS_NOT_SENT,
      guidance: ADMIN_HUB_COLOURS_EMPTY,
      href: '/admin?app=materials&item=logo',
      locked: false,
      submittedAt: null,
    });
  });

  it('logo, not started: links to Brand colours with "Takes about a minute"', () => {
    expect(overviewColours({ hasLogo: true })).toMatchObject({
      state: 'not_started',
      palette: [],
      look: null,
      headline: ADMIN_HUB_COLOURS_HINT,
      statusLabel: ADMIN_HUB_COLOURS_NOT_SENT,
      guidance: ADMIN_HUB_COLOURS_MINUTE,
      href: '/admin?app=colours',
    });
  });

  it('draft: saved colours without brandColoursSentAt, Main / Accent named, look card from the colour helpers', () => {
    const tile = overviewColours({
      hasLogo: true,
      brandPrimaryColour: '#1f6f6b',
      brandSecondaryColour: '#C9A24A',
      brandColoursSource: 'LOGO',
      brandBackgroundTone: 'LIGHT',
      brandPaletteExtracted: palette,
    });
    expect(tile.state).toBe('draft');
    expect(tile.statusLabel).toBe(ADMIN_HUB_COLOURS_DRAFT);
    expect(tile.guidance).toBe(ADMIN_HUB_COLOURS_DRAFT_HINT);
    expect(tile.locked).toBe(false);
    expect(tile.main).toMatchObject({ hex: '#1F6F6B', name: 'Teal' });
    expect(tile.accent).toMatchObject({ hex: '#C9A24A', name: 'Brass' });
    // The tile preview paints from the same three inputs as the Brand colours app.
    expect(tile.look).toEqual({ mainHex: '#1F6F6B', accentHex: '#C9A24A', tone: 'LIGHT' });
    expect(tile.palette.map((chip) => [chip.hex, chip.share])).toEqual(palette.map((row) => [row.hex, row.share]));
    // A saved draft with only a Main colour (or only a source) is still a draft.
    expect(overviewColours({ hasLogo: false, brandPrimaryColour: '#1F6F6B' }).state).toBe('draft');
    expect(overviewColours({ hasLogo: true, brandColoursSource: 'MANUAL' }).state).toBe('draft');
  });

  it('sent: locked, dated guidance; KERSIVO chooses gets its own pill', () => {
    expect(
      overviewColours({
        hasLogo: true,
        brandPrimaryColour: '#1F6F6B',
        brandColoursSource: 'LOGO',
        brandColoursSentAt: '2026-11-02T10:00:00.000Z',
      }),
    ).toMatchObject({
      state: 'sent',
      statusLabel: ADMIN_HUB_COLOURS_SENT,
      guidance: 'Sent on 2 November 2026. Message us to change it.',
      locked: true,
      href: '/admin?app=colours',
    });
    expect(
      overviewColours({
        hasLogo: true,
        brandColoursSource: 'KERSIVO_CHOOSES',
        brandColoursSentAt: new Date('2026-10-31T12:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'kersivo',
      statusLabel: ADMIN_HUB_COLOURS_KERSIVO,
      guidance: 'Sent on 31 October 2026. Message us to change it.',
      main: null,
      accent: null,
      look: null,
      locked: true,
    });
    // Sent wins over "no logo": the tile still opens Brand colours (locked view).
    expect(overviewColours({ hasLogo: false, brandColoursSentAt: '2026-11-02T10:00:00.000Z' }).href).toBe('/admin?app=colours');
  });

  it('headline count always equals the chips rendered (cap 5, duplicates and bad values dropped)', () => {
    const seven = [...palette, { hex: '#334455', share: 0.03 }, { hex: '#AABBCC', share: 0.02 }];
    const capped = overviewColours({ hasLogo: true, brandColoursSource: 'LOGO', brandPaletteExtracted: seven });
    expect(capped.palette).toHaveLength(OVERVIEW_PALETTE_CAP);
    expect(capped.headline).toBe(ADMIN_HUB_COLOURS_FOUND(capped.palette.length));

    // The old tile said "5 colours found" next to 4 chips when Main / Accent took chip slots.
    const roles = overviewColours({
      hasLogo: true,
      brandPrimaryColour: '#8A2D2D',
      brandSecondaryColour: '#C9A24A',
      brandPaletteExtracted: palette,
    });
    expect(roles.palette).toHaveLength(5);
    expect(roles.headline).toBe(ADMIN_HUB_COLOURS_FOUND(5));

    const messy = overviewColours({
      hasLogo: true,
      brandPaletteExtracted: [
        { hex: '#1f6f6b', share: 0.5 },
        { hex: '#1F6F6B', share: 0.2 },
        { hex: 'not-a-colour', share: 0.2 },
        { hex: '#141414' },
      ],
    });
    expect(messy.palette.map((chip) => [chip.hex, chip.share])).toEqual([
      ['#1F6F6B', 0.5],
      ['#141414', null],
    ]);
    expect(messy.headline).toBe(ADMIN_HUB_COLOURS_FOUND(2));

    // No palette: the count is the Main / Accent rows actually shown.
    expect(overviewColours({ hasLogo: true, brandPrimaryColour: '#1F6F6B', brandSecondaryColour: '#1f6f6b' })).toMatchObject({
      accent: null,
      headline: ADMIN_HUB_COLOURS_SAVED(1),
    });
  });

  it('black-and-white logo: Ink / Cream names and readable button text', () => {
    const tile = overviewColours({
      hasLogo: true,
      brandPrimaryColour: '#111111',
      brandSecondaryColour: '#F5F5F5',
      brandPaletteExtracted: [
        { hex: '#111111', share: 0.7 },
        { hex: '#F5F5F5', share: 0.3 },
      ],
    });
    expect(tile.main?.name).toBe('Ink');
    expect(tile.accent?.name).toBe('Cream');
    expect(tile.look).toEqual({ mainHex: '#111111', accentHex: '#F5F5F5', tone: 'DARK' });
    expect(tile.headline).toBe(ADMIN_HUB_COLOURS_FOUND(2));
  });

  it('Main and Accent with the same table name get a lightness word', () => {
    const tile = overviewColours({ hasLogo: true, brandPrimaryColour: '#401010', brandSecondaryColour: '#742A27' });
    expect(tile.main?.name).toBe('Dark copper');
    expect(tile.accent?.name).toBe('Copper');
    // Accent only (no Main): the preview still gets its inputs, Main stays empty.
    expect(overviewColours({ hasLogo: true, brandSecondaryColour: '#C9A24A' }).look).toEqual({
      mainHex: null,
      accentHex: '#C9A24A',
      tone: 'DARK',
    });
  });
});
