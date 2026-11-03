/**
 * Overview tile view-models that the live islands also run in the browser (hub store, P7).
 * Client-safe: no Prisma / server imports. `overview.ts` re-exports these.
 */
import { adminHubMaterialsHref } from './addMenu';
import { adminHubAppHref } from './apps';
import {
  ADMIN_HUB_ADD_LOGO,
  ADMIN_HUB_ADD_OTHER,
  ADMIN_HUB_ADD_PHOTOS,
  ADMIN_HUB_ADD_TEAM_PHOTOS,
  ADMIN_HUB_ADD_TEXT,
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_FOUND,
  ADMIN_HUB_COLOURS_HINT,
  ADMIN_HUB_COLOURS_KERSIVO,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_NOT_SENT,
  ADMIN_HUB_COLOURS_SAVED,
  ADMIN_HUB_COLOURS_SENT,
  ADMIN_HUB_CONTENT_DONE,
  ADMIN_HUB_NOT_ADDED,
} from './copy';
import { currentHubLogo, type CurrentHubLogoOptions } from './currentLogo';
import { ADMIN_HUB_API_BASE, ADMIN_HUB_LINKS } from './links';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';
import { parseCssColour } from '@/lib/adminHub/colour';

export function shopInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function isLightHex(hex: string): boolean {
  const raw = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(raw.slice(1, 3), 16);
  const g = parseInt(raw.slice(3, 5), 16);
  const b = parseInt(raw.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export type OverviewSwatch = { hex: string; css: string; role: 'Main' | 'Accent' | null; light: boolean };
export type OverviewColoursStatus = 'not_sent' | 'sent' | 'kersivo';

export function overviewColours(input: {
  hasLogo: boolean;
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandColoursSentAt?: Date | string | null;
  brandColoursSource?: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted?: Array<{ hex: string; share?: number }> | null;
}): {
  swatches: OverviewSwatch[];
  headline: string;
  status: OverviewColoursStatus;
  statusLabel: string;
  locked: boolean;
  submittedAt: string | null;
} {
  const primary = parseCssColour(input.brandPrimaryColour);
  const secondary = parseCssColour(input.brandSecondaryColour);
  const palette = (input.brandPaletteExtracted ?? [])
    .map((row) => parseCssColour(row.hex))
    .filter((colour): colour is NonNullable<typeof colour> => Boolean(colour));

  const swatches: OverviewSwatch[] = [];
  const seen = new Set<string>();
  const push = (colour: { hex: string; css: string }, role: OverviewSwatch['role']) => {
    if (seen.has(colour.hex)) return;
    seen.add(colour.hex);
    swatches.push({ hex: colour.hex, css: colour.css, role, light: isLightHex(colour.hex) });
  };
  if (primary) push(primary, ADMIN_HUB_COLOURS_MAIN);
  if (secondary && secondary.hex !== primary?.hex) push(secondary, ADMIN_HUB_COLOURS_ACCENT);
  for (const colour of palette) {
    if (swatches.length >= 4) break;
    push(colour, null);
  }

  const source = input.brandColoursSource;
  const sent = Boolean(input.brandColoursSentAt);
  const submittedAt =
    input.brandColoursSentAt instanceof Date
      ? input.brandColoursSentAt.toISOString()
      : input.brandColoursSentAt ?? null;
  const status: OverviewColoursStatus =
    sent && source === 'KERSIVO_CHOOSES' ? 'kersivo' : sent ? 'sent' : 'not_sent';
  const statusLabel =
    status === 'kersivo' ? ADMIN_HUB_COLOURS_KERSIVO : status === 'sent' ? ADMIN_HUB_COLOURS_SENT : ADMIN_HUB_COLOURS_NOT_SENT;

  const headline = palette.length
    ? ADMIN_HUB_COLOURS_FOUND(palette.length)
    : swatches.length
      ? ADMIN_HUB_COLOURS_SAVED(swatches.length)
      : input.hasLogo
        ? ADMIN_HUB_COLOURS_HINT
        : ADMIN_HUB_COLOURS_EMPTY;

  return { swatches, headline, status, statusLabel, locked: sent, submittedAt };
}

export type OverviewContentAsset = {
  id: string;
  kind: string;
  hasThumb: boolean;
  contentType: string;
  createdAt: string;
  /** Display-file size (PreviewHubAsset.width/height); null for PDFs and older rows. */
  width?: number | null;
  height?: number | null;
};

/** One image the tile can paint: the thumb src plus its intrinsic size (for width/height attrs, zero CLS). */
export type OverviewContentImage = {
  id: string;
  src: string;
  width: number;
  height: number;
  /** The display file and its width, for a srcset on cells that render larger than the thumb. */
  fullSrc: string | null;
  fullWidth: number | null;
};

/** The logo slot: `src` is null when the file cannot be painted (e.g. a PDF logo) — the slot still shows. */
export type OverviewContentLogo = Omit<OverviewContentImage, 'src'> & { src: string | null };

/** Mirrors HUB_THUMB_EDGE in freePreview/hubAssets.ts (server-only; asserted equal in overview.test.ts). */
export const OVERVIEW_THUMB_EDGE = 480;
/** Website content tile shows at most this many shop photos (2 rows × 4 in the widest container). */
export const OVERVIEW_CONTENT_PHOTO_CAP = 8;

export type OverviewContentStatusId = 'logo' | 'photos' | 'team-photos' | 'text' | 'other';

export type OverviewContentStatus = {
  id: OverviewContentStatusId;
  label: string;
  href: string;
  value: string;
  done: boolean;
};

export function hubAssetThumbSrc(asset: Pick<OverviewContentAsset, 'id' | 'hasThumb' | 'contentType'>): string | null {
  if (asset.hasThumb) return `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=thumb`;
  if (asset.contentType.startsWith('image/') && !asset.contentType.includes('svg')) {
    return `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=full`;
  }
  return null;
}

function positiveInt(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/**
 * Intrinsic size of what `src` serves: the thumb is the display file fitted inside OVERVIEW_THUMB_EDGE
 * (never enlarged). Unknown size falls back to a square thumb edge.
 */
export function overviewImageSize(
  asset: Pick<OverviewContentAsset, 'hasThumb' | 'width' | 'height'>,
): { width: number; height: number } {
  const width = positiveInt(asset.width);
  const height = positiveInt(asset.height);
  if (!width || !height) return { width: OVERVIEW_THUMB_EDGE, height: OVERVIEW_THUMB_EDGE };
  if (!asset.hasThumb) return { width, height };
  const scale = Math.min(1, OVERVIEW_THUMB_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function overviewContentImage(asset: OverviewContentAsset): OverviewContentImage | null {
  const src = hubAssetThumbSrc(asset);
  if (!src) return null;
  const size = overviewImageSize(asset);
  const displayWidth = positiveInt(asset.width);
  const fullSrc =
    asset.hasThumb && displayWidth && displayWidth > size.width
      ? `${ADMIN_HUB_API_BASE}/assets/${encodeURIComponent(asset.id)}?size=full`
      : null;
  return { id: asset.id, src, ...size, fullSrc, fullWidth: fullSrc ? displayWidth : null };
}

export function overviewWebsiteContent(input: {
  assets: OverviewContentAsset[];
  aboutText?: string | null;
  websiteExtraText?: string | null;
  /** Same options the sidebar / Brand colours use, so the tile shows the one current logo. */
  logoOptions?: CurrentHubLogoOptions;
}): {
  empty: boolean;
  /** The current logo (currentHubLogo), never a shop photo. Null when there is no logo. */
  logo: OverviewContentLogo | null;
  /** Shop photos only, newest first, up to OVERVIEW_CONTENT_PHOTO_CAP, only ones the browser can paint. */
  photos: OverviewContentImage[];
  /** Every shop photo in Materials (also the ones not shown). */
  photoTotal: number;
  status: OverviewContentStatus[];
} {
  const photos = input.assets.filter((asset) => asset.kind === 'SHOP_PHOTO');
  const teamPhotos = input.assets.filter((asset) => asset.kind === 'TEAM_PHOTO');
  const others = input.assets.filter((asset) => asset.kind === 'OTHER');
  const currentLogo = currentHubLogo(input.assets, input.logoOptions);
  const hasLogo = Boolean(currentLogo);
  const hasPriceList = input.assets.some((asset) => asset.kind === 'PRICE_LIST');
  const hasText = Boolean(input.aboutText?.trim() || input.websiteExtraText?.trim());
  const photoImages = [...photos]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .flatMap((asset) => {
      const image = overviewContentImage(asset);
      return image ? [image] : [];
    })
    .slice(0, OVERVIEW_CONTENT_PHOTO_CAP);
  const logo = currentLogo
    ? (overviewContentImage(currentLogo) ?? {
        id: currentLogo.id,
        src: null,
        ...overviewImageSize(currentLogo),
        fullSrc: null,
        fullWidth: null,
      })
    : null;
  const status: OverviewContentStatus[] = [
    {
      id: 'logo',
      label: ADMIN_HUB_ADD_LOGO,
      href: adminHubMaterialsHref('logo'),
      value: hasLogo ? ADMIN_HUB_CONTENT_DONE : ADMIN_HUB_NOT_ADDED,
      done: hasLogo,
    },
    {
      id: 'photos',
      label: ADMIN_HUB_ADD_PHOTOS,
      href: adminHubMaterialsHref('photos'),
      value: String(photos.length),
      done: photos.length > 0,
    },
    {
      id: 'team-photos',
      label: ADMIN_HUB_ADD_TEAM_PHOTOS,
      href: adminHubMaterialsHref('team-photos'),
      value: String(teamPhotos.length),
      done: teamPhotos.length > 0,
    },
    {
      id: 'text',
      label: ADMIN_HUB_ADD_TEXT,
      href: adminHubMaterialsHref('text'),
      value: hasText ? ADMIN_HUB_CONTENT_DONE : ADMIN_HUB_NOT_ADDED,
      done: hasText,
    },
  ];
  if (others.length > 0) {
    status.push({
      id: 'other',
      label: ADMIN_HUB_ADD_OTHER,
      href: adminHubMaterialsHref('other'),
      value: String(others.length),
      done: true,
    });
  }
  return {
    empty: !hasLogo && photos.length === 0 && teamPhotos.length === 0 && !hasText && others.length === 0 && !hasPriceList,
    logo,
    photos: photoImages,
    photoTotal: photos.length,
    status,
  };
}

export type OverviewPhotoLayout = 'one' | 'two' | 'three' | 'many';
/** Tile content widths: narrow < 420 px, mid 420–720 px, wide > 720 px (CSS container queries on the tile body). */
export type OverviewPhotoWidth = 'narrow' | 'mid' | 'wide';
export type OverviewPhotoCell = {
  /** First container width at which the cell shows (4+ photos: 2×2 → 3×2 → 4×2). */
  from: OverviewPhotoWidth;
  /** "+N" overlay: shown at these widths, where this is the last visible cell and more photos exist. */
  more: { n: number; at: OverviewPhotoWidth[] } | null;
};

const OVERVIEW_PHOTO_WIDTHS: Array<{ at: OverviewPhotoWidth; visible: number }> = [
  { at: 'narrow', visible: 4 },
  { at: 'mid', visible: 6 },
  { at: 'wide', visible: 8 },
];

/**
 * Which cells show at which container width and where the "+N" goes. Pure, so SSR and every width agree
 * without measuring (no layout shift); CSS container queries switch between the precomputed states.
 */
export function overviewPhotoGrid(count: number, total: number): { layout: OverviewPhotoLayout; cells: OverviewPhotoCell[] } {
  const shown = Math.max(0, Math.min(count, OVERVIEW_CONTENT_PHOTO_CAP));
  const all = Math.max(total, shown);
  if (shown < 4) {
    const layout: OverviewPhotoLayout = shown <= 1 ? 'one' : shown === 2 ? 'two' : 'three';
    const cells: OverviewPhotoCell[] = Array.from({ length: shown }, (_, index) => ({
      from: 'narrow',
      more: index === shown - 1 && all > shown ? { n: all - shown, at: ['narrow', 'mid', 'wide'] } : null,
    }));
    return { layout, cells };
  }
  const cells: OverviewPhotoCell[] = Array.from({ length: shown }, (_, index) => ({
    from: index < 4 ? 'narrow' : index < 6 ? 'mid' : 'wide',
    more: null,
  }));
  for (const width of OVERVIEW_PHOTO_WIDTHS) {
    const visible = Math.min(shown, width.visible);
    if (all <= visible) continue;
    const cell = cells[visible - 1]!;
    if (cell.more) cell.more.at.push(width.at);
    else cell.more = { n: all - visible, at: [width.at] };
  }
  return { layout: 'many', cells };
}

/** sRGB → linear, for the logo plate check below. */
function srgbChannelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The neutral logo surface (#1a1a1c) as relative luminance. */
const LOGO_SURFACE_LUMINANCE =
  0.2126 * srgbChannelToLinear(0x1a) + 0.7152 * srgbChannelToLinear(0x1a) + 0.0722 * srgbChannelToLinear(0x1c);

/**
 * True when most of a logo's visible pixels would almost vanish on the dark logo surface (a black logo on
 * a transparent background). The tile then puts the logo on a light plate instead. Fully transparent or
 * empty images return false.
 */
export function logoNeedsLightPlate(image: { data: ArrayLike<number>; width: number; height: number }): boolean {
  let visible = 0;
  let faint = 0;
  const pixels = image.width * image.height;
  for (let i = 0; i < pixels; i += 1) {
    const alpha = image.data[i * 4 + 3] ?? 0;
    if (alpha < 64) continue;
    visible += 1;
    const luminance =
      0.2126 * srgbChannelToLinear(image.data[i * 4] ?? 0) +
      0.7152 * srgbChannelToLinear(image.data[i * 4 + 1] ?? 0) +
      0.0722 * srgbChannelToLinear(image.data[i * 4 + 2] ?? 0);
    const contrast = (Math.max(luminance, LOGO_SURFACE_LUMINANCE) + 0.05) / (Math.min(luminance, LOGO_SURFACE_LUMINANCE) + 0.05);
    if (contrast < 1.6) faint += 1;
  }
  return visible > 0 && faint / visible > 0.6;
}

export function overviewTileHrefs() {
  return {
    preview: ADMIN_HUB_LINKS.website,
    booking: ADMIN_HUB_LINKS.booking,
    colours: adminHubAppHref('colours'),
    messages: ADMIN_HUB_LINKS.messages,
    changes: ADMIN_HUB_LINKS.changes,
    activity: adminHubAppHref('activity'),
    materials: adminHubAppHref('materials'),
    team: PREVIEW_HUB_PATHS.team,
    services: PREVIEW_HUB_PATHS.services,
    products: PREVIEW_HUB_PATHS.products,
  };
}
