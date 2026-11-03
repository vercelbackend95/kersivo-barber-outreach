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
};

export type OverviewContentThumb = {
  id: string;
  src: string;
};

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

export function overviewWebsiteContent(input: {
  assets: OverviewContentAsset[];
  aboutText?: string | null;
  websiteExtraText?: string | null;
}): {
  empty: boolean;
  thumbs: OverviewContentThumb[];
  status: OverviewContentStatus[];
} {
  const photos = input.assets.filter((asset) => asset.kind === 'SHOP_PHOTO');
  const teamPhotos = input.assets.filter((asset) => asset.kind === 'TEAM_PHOTO');
  const others = input.assets.filter((asset) => asset.kind === 'OTHER');
  const hasLogo = input.assets.some((asset) => asset.kind === 'LOGO');
  const hasPriceList = input.assets.some((asset) => asset.kind === 'PRICE_LIST');
  const hasText = Boolean(input.aboutText?.trim() || input.websiteExtraText?.trim());
  const thumbs = [...photos]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4)
    .flatMap((asset) => {
      const src = hubAssetThumbSrc(asset);
      return src ? [{ id: asset.id, src }] : [];
    });
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
    thumbs,
    status,
  };
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
