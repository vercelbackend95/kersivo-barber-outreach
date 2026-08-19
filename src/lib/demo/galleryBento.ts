import {
  DEMO_GALLERY,
  demoGallerySequence,
  type DemoGalleryImage,
} from '@/lib/demo/gallery';

export type GalleryTileSize = 'feature' | 'standard';
export type GalleryTileSide = 'left' | 'right';
export type GalleryRemainderKind = 'one' | 'pair' | 'partial' | 'four';

export type DemoGalleryBentoTile = {
  image: DemoGalleryImage;
  index: number;
  size: GalleryTileSize;
  side: GalleryTileSide;
  remainder: boolean;
  remainderKind: GalleryRemainderKind | null;
};

const GROUP_SIZE = 5;

function sideForGroup(groupIndex: number): GalleryTileSide {
  return groupIndex % 2 === 0 ? 'left' : 'right';
}

function pushGroup(
  tiles: DemoGalleryBentoTile[],
  images: readonly DemoGalleryImage[],
  startIndex: number,
  count: number,
  side: GalleryTileSide,
  remainder: boolean,
  remainderKind: GalleryRemainderKind | null,
) {
  for (let offset = 0; offset < count; offset += 1) {
    const image = images[startIndex + offset];
    if (!image) continue;
    const size: GalleryTileSize = offset === 0 && (count === 5 || count === 3) ? 'feature' : 'standard';
    tiles.push({
      image,
      index: startIndex + offset,
      size,
      side,
      remainder,
      remainderKind: remainder ? remainderKind : null,
    });
  }
}

export function demoGalleryBentoTiles(
  images: readonly DemoGalleryImage[] = DEMO_GALLERY,
): DemoGalleryBentoTile[] {
  const sequence = demoGallerySequence(images);
  const tiles: DemoGalleryBentoTile[] = [];
  let cursor = 0;
  let groupIndex = 0;

  while (cursor < sequence.length) {
    const remaining = sequence.length - cursor;
    if (remaining >= GROUP_SIZE) {
      pushGroup(tiles, sequence, cursor, GROUP_SIZE, sideForGroup(groupIndex), false, null);
      cursor += GROUP_SIZE;
      groupIndex += 1;
      continue;
    }

    const side = sideForGroup(groupIndex);
    if (remaining === 1) {
      pushGroup(tiles, sequence, cursor, 1, side, true, 'one');
    } else if (remaining === 2) {
      for (let offset = 0; offset < 2; offset += 1) {
        const image = sequence[cursor + offset];
        if (!image) continue;
        tiles.push({
          image,
          index: cursor + offset,
          size: 'standard',
          side,
          remainder: true,
          remainderKind: 'pair',
        });
      }
    } else if (remaining === 3) {
      pushGroup(tiles, sequence, cursor, 3, side, true, 'partial');
    } else {
      for (let offset = 0; offset < remaining; offset += 1) {
        const image = sequence[cursor + offset];
        if (!image) continue;
        tiles.push({
          image,
          index: cursor + offset,
          size: 'standard',
          side,
          remainder: true,
          remainderKind: 'four',
        });
      }
    }
    break;
  }

  return tiles;
}

export function demoGalleryBentoClassName(tile: DemoGalleryBentoTile): string {
  const classes = [
    'bl-work-item',
    'bl-work-tile',
    `bl-work-tile--${tile.size}`,
    `bl-work-tile--${tile.side}`,
  ];
  if (tile.remainder && tile.remainderKind) {
    classes.push('bl-work-tile--remainder', `bl-work-tile--remainder-${tile.remainderKind}`);
  }
  return classes.join(' ');
}

export function demoGalleryBentoSizes(tile: DemoGalleryBentoTile): string {
  if (tile.size === 'feature') {
    return '(max-width: 719px) 100vw, (max-width: 1099px) 66vw, 50vw';
  }
  if (tile.remainderKind === 'one') {
    return '(max-width: 719px) 50vw, (max-width: 1099px) 50vw, 50vw';
  }
  return '(max-width: 719px) 50vw, (max-width: 1099px) 33vw, 25vw';
}
