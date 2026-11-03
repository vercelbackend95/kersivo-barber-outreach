import { describe, expect, it } from 'vitest';
import { HUB_THUMB_EDGE } from '@/lib/freePreview/hubAssets';
import {
  logoNeedsLightPlate,
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
