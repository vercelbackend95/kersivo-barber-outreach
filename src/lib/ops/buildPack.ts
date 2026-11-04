/**
 * Ops build pack: everything the owner gave KERSIVO for their website, read from every source the hub
 * writes to, in one shape. The Overview "Build brief" on /ops/preview-requests/[id] and the build-pack
 * download render from this and nothing else.
 *
 * Read-only. Where two sources hold the same fact (request vs draft shop profile), both are returned and
 * listed in `conflicts`; nothing is silently picked. Field coverage is guarded by buildPackFields.ts and
 * buildPack.coverage.test.ts.
 */
import { prisma } from '@/lib/db/client';
import { parseBrandPalette } from '@/lib/adminHub/brandColours';
import { normaliseHexColour } from '@/lib/adminHub/colour';
import { currentHubLogo, parseBrandSnapshotLogoAssetId } from '@/lib/adminHub/currentLogo';
import { minutesToTimeString } from '@/lib/admin/timeStrings';
import { currentBookingSystemLabel } from '@/lib/forms/currentBookingSystems';
import { FREE_PREVIEW_BARBER_COUNTS, FREE_PREVIEW_DOMAIN_OPTIONS, labelFor } from '@/lib/freePreview/intake';
import { displayWorkLinks, type DisplayWorkLink } from '@/lib/freePreview/workLinkNormalise';
import { selectFor } from './buildPackFields';

export const BUILD_PACK_SCHEMA_VERSION = 1 as const;

export const BUILD_PACK_ASSET_KINDS = ['LOGO', 'SHOP_PHOTO', 'TEAM_PHOTO', 'PRICE_LIST', 'OTHER'] as const;
export type BuildPackAssetKind = (typeof BUILD_PACK_ASSET_KINDS)[number];
export const BUILD_PACK_REVISION_KINDS = ['CHANGE_ATTACHMENT', 'MESSAGE_ATTACHMENT'] as const;

/** Open = sent by the owner and not yet closed by KERSIVO. Drafts are still being written by the owner. */
export const BUILD_PACK_OPEN_CHANGE_STATUSES = ['SENT', 'IN_PROGRESS'] as const;

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export type BuildPackAsset = {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  barberId: string | null;
  /** Name of the linked team member when the barber is still on the team. */
  barberName: string | null;
  uploadedBy: 'OWNER' | 'KERSIVO';
  createdAt: string;
  isImage: boolean;
  /** Private blob path of the original. Server-side only: never sent to a browser or written into shop.json. */
  storagePath: string;
  hasThumb: boolean;
};

export type BuildPackHoursDay = {
  dayOfWeek: number;
  day: (typeof WEEKDAY_NAMES)[number];
  isOpen: boolean;
  opens: string | null;
  closes: string | null;
};

export type BuildPackService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  pricePence: number;
  priceFrom: boolean;
  category: string | null;
  featured: boolean;
  imageUrl: string | null;
};

export type BuildPackTeamMember = {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /** TEAM_PHOTO uploads linked to this barber (barberId). */
  photoAssetIds: string[];
};

export type BuildPackProduct = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  category: string;
  featured: boolean;
  imageUrl: string | null;
};

export type BuildPackChangeRequest = {
  id: string;
  round: number | null;
  page: string;
  body: string;
  status: string;
  sentAt: string | null;
  attachmentId: string | null;
};

export type BuildPackSource = 'request' | 'profile' | 'shop' | 'snapshot';

export type BuildPackConflict = {
  field: string;
  label: string;
  values: Array<{ source: BuildPackSource; label: string; value: string }>;
};

export type BuildPackReadinessKey =
  | 'business'
  | 'hours'
  | 'logo'
  | 'colours'
  | 'shopPhotos'
  | 'team'
  | 'services'
  | 'about'
  | 'priceList';

export type BuildPackReadiness = { key: BuildPackReadinessKey; label: string; ok: boolean };

export type BuildPackSnapshot = {
  logoAssetId: string | null;
  logoOriginalFileName: string | null;
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: string | null;
  brandColoursSource: string | null;
  brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
};

export type BuildPack = {
  schemaVersion: typeof BUILD_PACK_SCHEMA_VERSION;
  requestId: string;
  generatedAt: string;
  shop: {
    /** Name the owner typed in the preview form. */
    requestName: string;
    /** Name on the draft shop (hub › Business details). Null without a draft shop. */
    draftName: string | null;
    requestTownCity: string;
    draftTownCity: string | null;
    draftShopId: string | null;
    bookingSlug: string | null;
    sitePreviewUrl: string | null;
    sitePreviewVersion: string | null;
  };
  contact: {
    tagline: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    /** Intake answer: "Yes" / "No" / "Not sure" / "—". */
    hasOwnDomain: string;
  };
  hours: { saved: boolean; days: BuildPackHoursDay[] };
  brand: {
    primary: { request: string | null; profile: string | null };
    secondary: { request: string | null; profile: string | null };
    backgroundTone: string | null;
    source: string | null;
    paletteExtracted: Array<{ hex: string; share: number }> | null;
    /** ShopSettings.logoUrl (draft shop); usually empty in the preview phase, logos are hub uploads. */
    shopLogoUrl: string | null;
    /** The logo KERSIVO should build from (snapshot logo when sent, else the newest upload). */
    currentLogoAssetId: string | null;
    submittedAt: string | null;
    submittedSnapshot: BuildPackSnapshot | null;
    styleNotes: string | null;
  };
  text: {
    /** Request "About your shop" (hub /details). */
    about: string | null;
    /** Draft shop profile description (same field in the paid dashboard). */
    description: string | null;
    websiteExtra: string | null;
  };
  links: {
    /** Links from the preview form (workLinks, or the four legacy URL columns on older rows). */
    work: DisplayWorkLink[];
    instagram: { request: string | null; profile: string | null };
    facebook: string | null;
    tiktok: string | null;
    other: string | null;
  };
  services: BuildPackService[];
  team: BuildPackTeamMember[];
  products: BuildPackProduct[];
  /** Images added in the dashboard screens (public Blob URLs): avatars, product, service and shop logo images. */
  remoteImages: BuildPackRemoteImage[];
  assets: Record<BuildPackAssetKind, BuildPackAsset[]>;
  /** Change and message attachments: for revisions, not the first build. */
  revisionFiles: BuildPackAsset[];
  changeRequests: BuildPackChangeRequest[];
  /** Legacy single "changes requested" text from the old preview page. */
  legacyChangesRequested: { text: string; at: string | null } | null;
  intake: {
    barberCount: string;
    currentBookingSystem: string;
    notes: string | null;
  };
  readiness: BuildPackReadiness[];
  missing: string[];
  conflicts: BuildPackConflict[];
};

const REQUEST_SELECT = selectFor('PreviewRequest');
const SHOP_SELECT = selectFor('ShopSettings');
const PROFILE_SELECT = selectFor('ShopPublicProfile');
const SERVICE_SELECT = selectFor('Service');
const BARBER_SELECT = selectFor('Barber');
const PRODUCT_SELECT = selectFor('Product');
const ASSET_SELECT = selectFor('PreviewHubAsset');
const CHANGE_SELECT = selectFor('PreviewChangeRequest');

type Nullable<T> = { [K in keyof T]: T[K] | null };

export type BuildPackRows = {
  request: {
    id: string;
    shopName: string;
    townCity: string;
    bookingPageUrl: string | null;
    instagramUrl: string | null;
    googleListingUrl: string | null;
    websiteUrl: string | null;
    workLinks: unknown;
    barberCount: string | null;
    currentBookingSystem: string | null;
    hasOwnDomain: string | null;
    notes: string | null;
    draftShopId: string | null;
    changesRequestedText: string | null;
    changesRequestedAt: Date | null;
    anonymisedAt: Date | null;
    brandPrimaryColour: string | null;
    brandSecondaryColour: string | null;
    brandBackgroundTone: string | null;
    brandColoursSource: string | null;
    brandPaletteExtracted: unknown;
    brandColoursSentAt: Date | null;
    brandSubmittedSnapshot: unknown;
    styleNotes: string | null;
    aboutText: string | null;
    websiteExtraText: string | null;
  };
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    logoUrl: string | null;
    bookingSlug: string | null;
    sitePreviewUrl: string | null;
    sitePreviewVersion: string | null;
  } | null;
  profile: Nullable<{
    tagline: string;
    description: string;
    addressLine1: string;
    addressLine2: string;
    postcode: string;
    phone: string;
    email: string;
    instagramUrl: string;
    facebookUrl: string;
    tiktokUrl: string;
    otherSocialUrl: string;
    brandPrimaryColour: string;
    brandSecondaryColour: string;
  }> | null;
  hours: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number; active: boolean }>;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    pricePence: number;
    priceFrom: boolean;
    durationMinutes: number;
    displayOrder: number;
    category: string | null;
    featured: boolean;
  }>;
  barbers: Array<{ id: string; name: string; avatarUrl: string | null; title: string | null; bio: string | null; sortOrder: number }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    pricePence: number;
    imageUrl: string | null;
    featured: boolean;
    category: string;
    sortOrder: number;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    storagePath: string;
    thumbPath: string | null;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    caption: string | null;
    sortOrder: number;
    barberId: string | null;
    uploadedBy: 'OWNER' | 'KERSIVO';
    createdAt: Date;
  }>;
  changeRequests: Array<{
    id: string;
    round: number | null;
    page: string;
    body: string;
    attachmentId: string | null;
    status: string;
    createdAt: Date;
    sentAt: Date | null;
  }>;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function hex(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  return normaliseHexColour(v) ?? v;
}

function sameText(a: string | null, b: string | null): boolean {
  return (a ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === (b ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sameUrl(a: string | null, b: string | null): boolean {
  const norm = (v: string | null) =>
    (v ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  return norm(a) === norm(b);
}

function parseSnapshot(value: unknown): BuildPackSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const str = (key: string) => (typeof v[key] === 'string' && (v[key] as string).trim() ? (v[key] as string).trim() : null);
  return {
    logoAssetId: parseBrandSnapshotLogoAssetId(value),
    logoOriginalFileName: str('logoOriginalFileName'),
    brandPrimaryColour: hex(str('brandPrimaryColour')),
    brandSecondaryColour: hex(str('brandSecondaryColour')),
    brandBackgroundTone: str('brandBackgroundTone'),
    brandColoursSource: str('brandColoursSource'),
    brandPaletteExtracted: parseBrandPalette(v.brandPaletteExtracted),
  };
}

function pushConflict(
  out: BuildPackConflict[],
  field: string,
  label: string,
  values: Array<{ source: BuildPackSource; label: string; value: string | null }>,
  same: (a: string | null, b: string | null) => boolean = sameText,
) {
  const present = values.filter((entry): entry is { source: BuildPackSource; label: string; value: string } => Boolean(entry.value));
  if (present.length < 2) return;
  const first = present[0].value;
  if (present.every((entry) => same(entry.value, first))) return;
  out.push({ field, label, values: present });
}

/** Pure shaping of database rows into the pack. Exported for tests. */
export function shapeBuildPack(rows: BuildPackRows, now: Date = new Date()): BuildPack {
  const { request, shop, profile } = rows;
  const p = profile ?? null;

  // Barbers first: team photos are matched to them by id.
  const barberNames = new Map(rows.barbers.map((barber) => [barber.id, barber.name]));

  const toAsset = (row: BuildPackRows['assets'][number]): BuildPackAsset => ({
    id: row.id,
    kind: row.kind,
    fileName: row.originalFileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    caption: clean(row.caption),
    sortOrder: row.sortOrder,
    barberId: row.barberId,
    barberName: row.barberId ? barberNames.get(row.barberId) ?? null : null,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    isImage: row.contentType.startsWith('image/'),
    storagePath: row.storagePath,
    hasThumb: Boolean(row.thumbPath),
  });

  const sortedAssets = [...rows.assets].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const assets = Object.fromEntries(BUILD_PACK_ASSET_KINDS.map((kind) => [kind, [] as BuildPackAsset[]])) as Record<
    BuildPackAssetKind,
    BuildPackAsset[]
  >;
  const revisionFiles: BuildPackAsset[] = [];
  for (const row of sortedAssets) {
    if ((BUILD_PACK_ASSET_KINDS as readonly string[]).includes(row.kind)) {
      assets[row.kind as BuildPackAssetKind].push(toAsset(row));
    } else if ((BUILD_PACK_REVISION_KINDS as readonly string[]).includes(row.kind)) {
      revisionFiles.push(toAsset(row));
    }
  }

  const snapshot = parseSnapshot(request.brandSubmittedSnapshot);
  const currentLogo = currentHubLogo(
    rows.assets.filter((a) => a.kind === 'LOGO'),
    { brandLocked: Boolean(request.brandColoursSentAt), snapshotLogoAssetId: snapshot?.logoAssetId ?? null },
  );

  const hoursByDay = new Map(rows.hours.map((row) => [row.dayOfWeek, row]));
  const hours = {
    saved: rows.hours.some((row) => row.active),
    days: WEEKDAY_NAMES.map((day, index) => {
      const row = hoursByDay.get(index + 1);
      const isOpen = Boolean(row?.active);
      return {
        dayOfWeek: index + 1,
        day,
        isOpen,
        opens: isOpen && row ? minutesToTimeString(row.startMinutes) : null,
        closes: isOpen && row ? minutesToTimeString(row.endMinutes) : null,
      };
    }),
  };

  const teamPhotoIds = new Map<string, string[]>();
  for (const asset of assets.TEAM_PHOTO) {
    if (!asset.barberId) continue;
    teamPhotoIds.set(asset.barberId, [...(teamPhotoIds.get(asset.barberId) ?? []), asset.id]);
  }

  const services: BuildPackService[] = [...rows.services]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: clean(s.description),
      durationMinutes: s.durationMinutes,
      pricePence: s.pricePence,
      priceFrom: s.priceFrom,
      category: clean(s.category),
      featured: s.featured,
      imageUrl: clean(s.imageUrl),
    }));
  const team: BuildPackTeamMember[] = [...rows.barbers]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((b) => ({
      id: b.id,
      name: b.name,
      role: clean(b.title),
      bio: clean(b.bio),
      avatarUrl: clean(b.avatarUrl),
      photoAssetIds: teamPhotoIds.get(b.id) ?? [],
    }));
  const products: BuildPackProduct[] = [...rows.products]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: clean(item.description),
      pricePence: item.pricePence,
      category: item.category,
      featured: item.featured,
      imageUrl: clean(item.imageUrl),
    }));

  const changeRequests: BuildPackChangeRequest[] = rows.changeRequests
    .filter((c) => (BUILD_PACK_OPEN_CHANGE_STATUSES as readonly string[]).includes(c.status))
    .sort((a, b) => (a.sentAt ?? a.createdAt).getTime() - (b.sentAt ?? b.createdAt).getTime())
    .map((c) => ({
      id: c.id,
      round: c.round,
      page: c.page,
      body: c.body,
      status: c.status,
      sentAt: iso(c.sentAt),
      attachmentId: c.attachmentId,
    }));

  const contact = {
    tagline: clean(p?.tagline),
    addressLine1: clean(p?.addressLine1),
    addressLine2: clean(p?.addressLine2),
    postcode: clean(p?.postcode),
    phone: clean(p?.phone),
    email: clean(p?.email),
    hasOwnDomain: labelFor(FREE_PREVIEW_DOMAIN_OPTIONS, request.hasOwnDomain),
  };

  const brand = {
    primary: { request: hex(request.brandPrimaryColour), profile: hex(p?.brandPrimaryColour) },
    secondary: { request: hex(request.brandSecondaryColour), profile: hex(p?.brandSecondaryColour) },
    backgroundTone: clean(request.brandBackgroundTone),
    source: clean(request.brandColoursSource),
    paletteExtracted: parseBrandPalette(request.brandPaletteExtracted),
    shopLogoUrl: clean(shop?.logoUrl),
    currentLogoAssetId: currentLogo?.id ?? null,
    submittedAt: iso(request.brandColoursSentAt),
    submittedSnapshot: snapshot,
    styleNotes: clean(request.styleNotes),
  };

  const text = {
    about: clean(request.aboutText),
    description: clean(p?.description),
    websiteExtra: clean(request.websiteExtraText),
  };

  const links = {
    work: displayWorkLinks(request),
    instagram: { request: clean(request.instagramUrl), profile: clean(p?.instagramUrl) },
    facebook: clean(p?.facebookUrl),
    tiktok: clean(p?.tiktokUrl),
    other: clean(p?.otherSocialUrl),
  };

  const conflicts: BuildPackConflict[] = [];
  if (shop) {
    pushConflict(conflicts, 'shop.name', 'Shop name', [
      { source: 'request', label: 'Preview form', value: clean(request.shopName) },
      { source: 'shop', label: 'Business details', value: clean(shop.name) },
    ]);
    pushConflict(conflicts, 'shop.townCity', 'Town / city', [
      { source: 'request', label: 'Preview form', value: clean(request.townCity) },
      { source: 'shop', label: 'Business details', value: clean(shop.townCity) },
    ]);
  }
  pushConflict(conflicts, 'brand.primary', 'Primary colour', [
    { source: 'request', label: 'Colours (hub)', value: brand.primary.request },
    { source: 'profile', label: 'Shop profile', value: brand.primary.profile },
    { source: 'snapshot', label: 'Sent to KERSIVO', value: snapshot?.brandPrimaryColour ?? null },
  ]);
  pushConflict(conflicts, 'brand.secondary', 'Secondary colour', [
    { source: 'request', label: 'Colours (hub)', value: brand.secondary.request },
    { source: 'profile', label: 'Shop profile', value: brand.secondary.profile },
    { source: 'snapshot', label: 'Sent to KERSIVO', value: snapshot?.brandSecondaryColour ?? null },
  ]);
  pushConflict(conflicts, 'brand.backgroundTone', 'Background tone', [
    { source: 'request', label: 'Colours (hub)', value: brand.backgroundTone },
    { source: 'snapshot', label: 'Sent to KERSIVO', value: snapshot?.brandBackgroundTone ?? null },
  ]);
  pushConflict(conflicts, 'text.about', 'About text', [
    { source: 'request', label: 'About your shop (hub)', value: text.about },
    { source: 'profile', label: 'Shop profile description', value: text.description },
  ]);
  pushConflict(
    conflicts,
    'links.instagram',
    'Instagram',
    [
      { source: 'request', label: 'Hub / preview form', value: links.instagram.request },
      { source: 'profile', label: 'Shop profile', value: links.instagram.profile },
    ],
    sameUrl,
  );

  const hasBusiness = Boolean(contact.addressLine1 || contact.postcode || contact.phone || contact.email);
  const hasLogo = assets.LOGO.length > 0 || Boolean(brand.shopLogoUrl);
  const hasColours = Boolean(
    brand.primary.request || brand.primary.profile || snapshot?.brandPrimaryColour || brand.paletteExtracted?.length,
  );
  const readiness: BuildPackReadiness[] = [
    { key: 'business', label: 'Business details', ok: hasBusiness },
    { key: 'hours', label: 'Opening hours', ok: hours.saved },
    { key: 'logo', label: 'Logo', ok: hasLogo },
    { key: 'colours', label: 'Colours', ok: hasColours },
    { key: 'shopPhotos', label: 'Shop photos', ok: assets.SHOP_PHOTO.length > 0 },
    { key: 'team', label: 'Team', ok: team.length > 0 },
    { key: 'services', label: 'Services', ok: services.length > 0 },
    { key: 'about', label: 'About text', ok: Boolean(text.about || text.description) },
    { key: 'priceList', label: 'Price list', ok: assets.PRICE_LIST.length > 0 },
  ];

  const missing: string[] = [];
  if (!shop) missing.push('Draft shop (not created yet, so no business details, hours, services, team or products)');
  for (const item of readiness) if (!item.ok) missing.push(item.label);
  if (hasBusiness) {
    if (!contact.addressLine1) missing.push('Street address');
    if (!contact.postcode) missing.push('Postcode');
    if (!contact.phone) missing.push('Phone number');
    if (!contact.email) missing.push('Public email');
  }
  if (!contact.tagline) missing.push('Tagline');
  const without = team.filter((member) => !memberHasPhoto(member)).map((m) => m.name);
  if (without.length) missing.push(`Team photos for ${without.join(', ')}`);
  if (!links.instagram.request && !links.instagram.profile && !links.facebook && !links.tiktok && !links.other) {
    missing.push('Social links');
  }

  return {
    schemaVersion: BUILD_PACK_SCHEMA_VERSION,
    requestId: request.id,
    generatedAt: now.toISOString(),
    shop: {
      requestName: request.shopName,
      draftName: clean(shop?.name),
      requestTownCity: request.townCity,
      draftTownCity: clean(shop?.townCity),
      draftShopId: shop?.id ?? null,
      bookingSlug: shop?.bookingSlug ?? null,
      sitePreviewUrl: clean(shop?.sitePreviewUrl),
      sitePreviewVersion: clean(shop?.sitePreviewVersion),
    },
    contact,
    hours,
    brand,
    text,
    links,
    services,
    team,
    products,
    remoteImages: collectRemoteImages({
      team,
      products,
      services,
      shop: shop ? { id: shop.id, name: clean(shop.name) ?? request.shopName, logoUrl: brand.shopLogoUrl } : null,
    }),
    assets,
    revisionFiles,
    changeRequests,
    legacyChangesRequested: clean(request.changesRequestedText)
      ? { text: request.changesRequestedText!.trim(), at: iso(request.changesRequestedAt) }
      : null,
    intake: {
      barberCount: labelFor(FREE_PREVIEW_BARBER_COUNTS, request.barberCount),
      currentBookingSystem: currentBookingSystemLabel(request.currentBookingSystem),
      notes: clean(request.notes),
    },
    readiness,
    missing,
    conflicts,
  };
}

/** Display name for the pack: the draft shop's name when set, else the preview-form name. */
export function buildPackShopName(pack: Pick<BuildPack, 'shop'>): string {
  return pack.shop.draftName ?? pack.shop.requestName;
}

export function buildPackTownCity(pack: Pick<BuildPack, 'shop'>): string {
  return pack.shop.draftTownCity ?? pack.shop.requestTownCity;
}

/** Every file in the pack (build files first, then revision files). */
export function buildPackFiles(pack: Pick<BuildPack, 'assets' | 'revisionFiles'>): BuildPackAsset[] {
  return [...BUILD_PACK_ASSET_KINDS.flatMap((kind) => pack.assets[kind]), ...pack.revisionFiles];
}

/**
 * Loads the pack for one preview request. Null when the request does not exist or its personal data has
 * been deleted (anonymised): the retention job's promise covers the pack too.
 */
export async function loadBuildPack(requestId: string, now: Date = new Date()): Promise<BuildPack | null> {
  const request = await prisma.previewRequest.findUnique({ where: { id: requestId }, select: REQUEST_SELECT });
  if (!request || request.anonymisedAt) return null;
  const shopId = request.draftShopId;

  const [shop, profile, hours, services, barbers, products, assets, changeRequests] = await Promise.all([
    shopId ? prisma.shopSettings.findUnique({ where: { id: shopId }, select: SHOP_SELECT }) : null,
    shopId ? prisma.shopPublicProfile.findUnique({ where: { shopId }, select: PROFILE_SELECT }) : null,
    shopId
      ? prisma.shopOpeningHours.findMany({
          where: { shopId },
          select: { dayOfWeek: true, startMinutes: true, endMinutes: true, active: true },
        })
      : [],
    shopId ? prisma.service.findMany({ where: { shopId, isActive: true }, select: SERVICE_SELECT }) : [],
    shopId
      ? prisma.barber.findMany({ where: { shopId, active: true, showOnWebsite: true }, select: BARBER_SELECT })
      : [],
    shopId ? prisma.product.findMany({ where: { shopId, active: true }, select: PRODUCT_SELECT }) : [],
    prisma.previewHubAsset.findMany({ where: { previewRequestId: requestId, deletedAt: null }, select: ASSET_SELECT }),
    prisma.previewChangeRequest.findMany({ where: { previewRequestId: requestId }, select: CHANGE_SELECT }),
  ]);

  return shapeBuildPack(
    {
      request,
      shop: shop ?? null,
      profile: profile ?? null,
      hours,
      services,
      barbers,
      products: products.map((item) => ({ ...item, category: String(item.category) })),
      assets: assets.map((a) => ({ ...a, kind: String(a.kind), uploadedBy: a.uploadedBy })),
      changeRequests: changeRequests.map((c) => ({ ...c, status: String(c.status) })),
    },
    now,
  );
}
