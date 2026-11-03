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
  ADMIN_HUB_ADD_TEXT,
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
  ADMIN_HUB_COLOURS_SENT_HINT,
  ADMIN_HUB_COLOURS_SENT_HINT_UNDATED,
  ADMIN_HUB_CONTENT_DONE,
  ADMIN_HUB_NOT_ADDED,
  formatBrandSubmittedDate,
} from './copy';
import { currentHubLogo, type CurrentHubLogoOptions } from './currentLogo';
import { ADMIN_HUB_API_BASE, ADMIN_HUB_LINKS } from './links';
import { PREVIEW_HUB_PATHS } from './previewHubPaths';
import {
  betterButtonText,
  hexToClampedOklch,
  isLightHex,
  nameSwatch,
  parseCssColour,
  siteBackgroundHex,
} from '@/lib/adminHub/colour';

export function shopInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export type OverviewColoursState = 'no_logo' | 'not_started' | 'draft' | 'sent' | 'kersivo';
/** One extracted logo colour; `share` is its part of the logo (0–1) when the extractor recorded it. */
export type OverviewPaletteChip = { hex: string; css: string; light: boolean; share: number | null };
export type OverviewRoleColour = { hex: string; css: string; light: boolean; name: string };
/** The mini "how it looks" card: same background / button-text rules as the Brand colours app. */
export type OverviewColoursLook = {
  background: string;
  header: { css: string; text: string } | null;
  button: { css: string; text: string } | null;
};

/** Most logo colours the tile shows (the Brand colours app saves at most MAX_SWATCHES). */
export const OVERVIEW_PALETTE_CAP = 5;

function roleColour(colour: { hex: string; css: string } | null): OverviewRoleColour | null {
  if (!colour) return null;
  const lch = hexToClampedOklch(colour.hex);
  return { hex: colour.hex, css: colour.css, light: isLightHex(colour.hex), name: lch ? nameSwatch(lch) : colour.hex };
}

export function overviewColours(input: {
  hasLogo: boolean;
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandColoursSentAt?: Date | string | null;
  brandColoursSource?: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandBackgroundTone?: 'DARK' | 'LIGHT' | null;
  brandPaletteExtracted?: Array<{ hex: string; share?: number }> | null;
}): {
  state: OverviewColoursState;
  /** Logo colours as saved by the Brand colours app, de-duplicated, at most OVERVIEW_PALETTE_CAP. */
  palette: OverviewPaletteChip[];
  /** Only when the owner (or KERSIVO) set them — never guessed from the palette. */
  main: OverviewRoleColour | null;
  accent: OverviewRoleColour | null;
  look: OverviewColoursLook | null;
  /** Counts exactly the chips the tile renders (palette, or Main / Accent when there is no palette). */
  headline: string;
  statusLabel: string;
  guidance: string;
  href: string;
  locked: boolean;
  submittedAt: string | null;
} {
  const main = roleColour(parseCssColour(input.brandPrimaryColour));
  const accentParsed = parseCssColour(input.brandSecondaryColour);
  const accent = accentParsed && accentParsed.hex !== main?.hex ? roleColour(accentParsed) : null;

  const palette: OverviewPaletteChip[] = [];
  const seen = new Set<string>();
  for (const row of input.brandPaletteExtracted ?? []) {
    if (palette.length >= OVERVIEW_PALETTE_CAP) break;
    const colour = parseCssColour(row.hex);
    if (!colour || seen.has(colour.hex)) continue;
    seen.add(colour.hex);
    const share = typeof row.share === 'number' && Number.isFinite(row.share) && row.share > 0 ? Math.min(1, row.share) : null;
    palette.push({ hex: colour.hex, css: colour.css, light: isLightHex(colour.hex), share });
  }

  const sent = Boolean(input.brandColoursSentAt);
  const saved = Boolean(main || accent || input.brandColoursSource || palette.length);
  const state: OverviewColoursState = sent
    ? input.brandColoursSource === 'KERSIVO_CHOOSES'
      ? 'kersivo'
      : 'sent'
    : saved
      ? 'draft'
      : input.hasLogo
        ? 'not_started'
        : 'no_logo';
  const submittedAt =
    input.brandColoursSentAt instanceof Date
      ? input.brandColoursSentAt.toISOString()
      : input.brandColoursSentAt ?? null;

  const statusLabel =
    state === 'kersivo'
      ? ADMIN_HUB_COLOURS_KERSIVO
      : state === 'sent'
        ? ADMIN_HUB_COLOURS_SENT
        : state === 'draft'
          ? ADMIN_HUB_COLOURS_DRAFT
          : ADMIN_HUB_COLOURS_NOT_SENT;
  const sentDate = submittedAt ? formatBrandSubmittedDate(submittedAt) : '';
  const guidance =
    state === 'no_logo'
      ? ADMIN_HUB_COLOURS_EMPTY
      : state === 'not_started'
        ? ADMIN_HUB_COLOURS_MINUTE
        : state === 'draft'
          ? ADMIN_HUB_COLOURS_DRAFT_HINT
          : sentDate
            ? ADMIN_HUB_COLOURS_SENT_HINT(sentDate)
            : ADMIN_HUB_COLOURS_SENT_HINT_UNDATED;

  const roleCount = (main ? 1 : 0) + (accent ? 1 : 0);
  const headline = palette.length
    ? ADMIN_HUB_COLOURS_FOUND(palette.length)
    : roleCount
      ? ADMIN_HUB_COLOURS_SAVED(roleCount)
      : input.hasLogo
        ? ADMIN_HUB_COLOURS_HINT
        : ADMIN_HUB_COLOURS_NO_LOGO;

  const look: OverviewColoursLook | null =
    main || accent
      ? {
          background: siteBackgroundHex(input.brandBackgroundTone ?? 'DARK', main?.hex ?? null),
          header: main ? { css: main.css, text: betterButtonText(main.hex) } : null,
          button: accent ? { css: accent.css, text: betterButtonText(accent.hex) } : null,
        }
      : null;

  return {
    state,
    palette,
    main,
    accent,
    look,
    headline,
    statusLabel,
    guidance,
    href: state === 'no_logo' ? adminHubMaterialsHref('logo') : adminHubAppHref('colours'),
    locked: sent,
    submittedAt,
  };
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

export type OverviewContentStatusId = 'logo' | 'photos' | 'text' | 'other';

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
    empty: !hasLogo && photos.length === 0 && !hasText && others.length === 0 && !hasPriceList,
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

/**
 * True when a logo really has a transparent background: at least 5 % of pixels see-through (alpha < 250) and
 * all four corners see-through. A JPG, or a PNG/WebP drawn on its own square, returns false.
 */
export function logoHasTransparency(image: { data: ArrayLike<number>; width: number; height: number }): boolean {
  const pixels = image.width * image.height;
  if (!pixels) return false;
  const alpha = (index: number) => image.data[index * 4 + 3] ?? 255;
  const corners = [0, image.width - 1, (image.height - 1) * image.width, pixels - 1];
  if (corners.some((index) => alpha(index) >= 250)) return false;
  let seeThrough = 0;
  for (let i = 0; i < pixels; i += 1) if (alpha(i) < 250) seeThrough += 1;
  return seeThrough / pixels >= 0.05;
}

/**
 * How the hub paints the shop's logo: as itself ("plain"), with rounded corners when it brings its own
 * background ("opaque"), or on a subtle light plate only when it is transparent AND would vanish on the dark
 * surface ("plate"). Opaque images never get a plate.
 */
export type HubLogoLook = 'plain' | 'opaque' | 'plate';

export function hubLogoLook(image: { data: ArrayLike<number>; width: number; height: number }): HubLogoLook {
  if (!image.width || !image.height) return 'plain';
  if (!logoHasTransparency(image)) return 'opaque';
  return logoNeedsLightPlate(image) ? 'plate' : 'plain';
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
