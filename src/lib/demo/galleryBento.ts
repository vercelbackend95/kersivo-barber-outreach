import {
  DEMO_GALLERY,
  demoGallerySequence,
  type DemoGalleryArea,
  type DemoGalleryImage,
} from '@/lib/demo/gallery';

export type GalleryTileVariant =
  | 'featured'
  | 'stack-top'
  | 'stack-bottom'
  | 'medium'
  | 'large'
  | 'wide';

export type DemoGalleryBentoTile = {
  image: DemoGalleryImage;
  index: number;
  variant: GalleryTileVariant;
  /** Desktop / tablet stage aspect ratio (CSS). Used on mobile for all; desktop fill stages may override. */
  ratio: string;
  /** Mobile stage aspect ratio (CSS). */
  ratioMobile: string;
};

export type DemoGalleryBentoClusters = {
  primary: {
    featured: DemoGalleryBentoTile;
    stack: [DemoGalleryBentoTile, DemoGalleryBentoTile];
  };
  secondary: [DemoGalleryBentoTile, DemoGalleryBentoTile];
  closing: DemoGalleryBentoTile;
};

const VARIANT_BY_ID: Record<DemoGalleryArea, GalleryTileVariant> = {
  'barber-at-work': 'featured',
  fade: 'stack-top',
  hairline: 'stack-bottom',
  beard: 'medium',
  'scissor-cut': 'large',
  'interior-detail': 'wide',
};

const RATIO_BY_VARIANT: Record<
  GalleryTileVariant,
  { desktop: string; mobile: string }
> = {
  featured: { desktop: '3 / 2', mobile: '4 / 3' },
  'stack-top': { desktop: '4 / 5', mobile: '16 / 10' },
  'stack-bottom': { desktop: '4 / 5', mobile: '4 / 5' },
  medium: { desktop: '4 / 3', mobile: '4 / 3' },
  large: { desktop: '4 / 5', mobile: '4 / 5' },
  wide: { desktop: '16 / 10', mobile: '16 / 10' },
};

function toTile(image: DemoGalleryImage, index: number): DemoGalleryBentoTile {
  const variant = VARIANT_BY_ID[image.id] ?? 'medium';
  const ratios = RATIO_BY_VARIANT[variant];
  return {
    image,
    index,
    variant,
    ratio: ratios.desktop,
    ratioMobile: ratios.mobile,
  };
}

export function demoGalleryBentoTiles(
  images: readonly DemoGalleryImage[] = DEMO_GALLERY,
): DemoGalleryBentoTile[] {
  return demoGallerySequence(images).map(toTile);
}

export function demoGalleryBentoClusters(
  images: readonly DemoGalleryImage[] = DEMO_GALLERY,
): DemoGalleryBentoClusters {
  const tiles = demoGalleryBentoTiles(images);
  if (tiles.length !== 6) {
    throw new Error(`Expected 6 gallery tiles, received ${tiles.length}`);
  }
  return {
    primary: {
      featured: tiles[0]!,
      stack: [tiles[1]!, tiles[2]!],
    },
    secondary: [tiles[3]!, tiles[4]!],
    closing: tiles[5]!,
  };
}

export function demoGalleryBentoClassName(tile: DemoGalleryBentoTile): string {
  return ['bl-work-item', 'bl-work-tile', `bl-work-tile--${tile.variant}`].join(' ');
}

export function demoGalleryBentoSizes(tile: DemoGalleryBentoTile): string {
  switch (tile.variant) {
    case 'featured':
      return '(max-width: 699px) 100vw, (max-width: 1099px) 100vw, 68vw';
    case 'stack-top':
    case 'stack-bottom':
      return '(max-width: 699px) 100vw, (max-width: 1099px) 50vw, 32vw';
    case 'medium':
      return '(max-width: 699px) 100vw, (max-width: 1099px) 100vw, 42vw';
    case 'large':
      return '(max-width: 699px) 100vw, (max-width: 1099px) 100vw, 58vw';
    case 'wide':
      return '(max-width: 699px) 100vw, min(90rem, 100vw)';
    default:
      return '(max-width: 699px) 100vw, 50vw';
  }
}
