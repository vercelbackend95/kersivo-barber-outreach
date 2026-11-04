/**
 * Ops build pack (.zip): where every file goes, and the JSON written next to them. Pure: no Prisma, no
 * blob access. The route (api/ops/preview-requests/[id]/build-pack.ts) streams the files in this order.
 *
 * Data minimisation: the pack is meant to be pasted into an AI tool. BuildPack never carries the owner's
 * first name, personal request email, consent records, internal notes, tokens or Stripe ids
 * (buildPackFields.ts), and storage paths are stripped here.
 */
import {
  BUILD_PACK_ASSET_KINDS,
  buildPackShopName,
  type BuildPack,
  type BuildPackAsset,
  type BuildPackAssetKind,
} from './buildPack';

/** ASCII slug: "Fade & Co. Barbers" → "fade-and-co-barbers". Empty input → fallback. */
export function asciiSlug(input: string, fallback = 'file', max = 60): string {
  const slug = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[øö]/g, 'o')
    .replace(/[ł]/g, 'l')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || fallback;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/** Lowercase ASCII extension: the stored file's (what the upload pipeline actually wrote) wins. */
export function fileExtension(asset: Pick<BuildPackAsset, 'storagePath' | 'fileName' | 'contentType'>): string {
  for (const candidate of [asset.storagePath, asset.fileName]) {
    const match = /\.([a-z0-9]{1,8})$/i.exec(candidate.trim());
    if (match) return match[1].toLowerCase();
  }
  return EXT_BY_TYPE[asset.contentType] ?? 'bin';
}

/**
 * One safe path segment: no separators, no "." or "..", no control characters, ASCII only, bounded
 * length. Keeps the extension readable ("Price list 2026.pdf" → "price-list-2026.pdf").
 */
export function sanitiseSegment(input: string, fallback = 'file'): string {
  const raw = String(input ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/[\\/]/)
    .pop()!
    .trim();
  const dot = raw.lastIndexOf('.');
  const base = dot > 0 ? raw.slice(0, dot) : raw;
  const ext = dot > 0 ? raw.slice(dot + 1) : '';
  // Underscores survive ("01_shopfront"); everything else becomes ASCII slug characters.
  const safeBase =
    base
      .split('_')
      .map((part) => asciiSlug(part, '', 80))
      .filter(Boolean)
      .join('_')
      .slice(0, 80) || fallback;
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/** Adds -2, -3… before the extension until the path is unused. Case-insensitive (Windows unzip). */
export function uniquePath(path: string, used: Set<string>): string {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  let candidate = path;
  for (let n = 2; used.has(candidate.toLowerCase()); n += 1) {
    candidate = dot > 0 ? `${dir}${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${dir}${name}-${n}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export type BuildPackZipFile = { path: string; asset: BuildPackAsset };

/** Paths (relative to the pack folder) for every original file, in zip order. */
export function planBuildPackFiles(pack: Pick<BuildPack, 'assets' | 'revisionFiles' | 'team'>): BuildPackZipFile[] {
  const used = new Set<string>();
  const out: BuildPackZipFile[] = [];
  const add = (asset: BuildPackAsset, dir: string, name: string) => {
    // dir is one of the fixed folders below; the name is user-derived, so it is sanitised once more.
    out.push({ asset, path: uniquePath(`${dir}/${sanitiseSegment(name, 'file')}`, used) });
  };
  const base = (asset: BuildPackAsset) => {
    const name = asset.fileName.replace(/\.[^.]+$/, '');
    return asciiSlug(name, asset.kind.toLowerCase().replace(/_/g, '-'));
  };

  for (const asset of pack.assets.LOGO) add(asset, 'brand/logo', `${base(asset)}.${fileExtension(asset)}`);
  pack.assets.SHOP_PHOTO.forEach((asset, index) => {
    const label = asset.caption ? asciiSlug(asset.caption, base(asset), 40) : base(asset);
    add(asset, 'photos/shop', `${String(index + 1).padStart(2, '0')}_${label}.${fileExtension(asset)}`);
  });
  for (const asset of pack.assets.TEAM_PHOTO) {
    const name = asset.barberName ? asciiSlug(asset.barberName, 'team') : base(asset);
    add(asset, 'photos/team', `${name}.${fileExtension(asset)}`);
  }
  // Dashboard avatars after hub team photos, so a barber with both gets "<name>.jpg" and "<name>-2.jpg".
  for (const remote of remotes.filter((r) => r.source === 'barber')) addRemote(remote, 'photos/team', asciiSlug(remote.ownerName, 'team'));
  remotes
    .filter((r) => r.source === 'product')
    .forEach((remote, index) => addRemote(remote, 'photos/products', `${nn(index)}_${asciiSlug(remote.ownerName, 'product', 50)}`));
  remotes
    .filter((r) => r.source === 'service')
    .forEach((remote, index) => addRemote(remote, 'photos/services', `${nn(index)}_${asciiSlug(remote.ownerName, 'service', 50)}`));

  for (const asset of pack.assets.PRICE_LIST) add(asset, 'documents/price-list', `${base(asset)}.${fileExtension(asset)}`);
  for (const asset of pack.assets.OTHER) add(asset, 'documents/other', `${base(asset)}.${fileExtension(asset)}`);
  for (const asset of pack.revisionFiles) add(asset, 'revisions/attachments', `${base(asset)}.${fileExtension(asset)}`);
  return out;
}

/** Same path with another extension ("photos/team/alex.img" + "png" -> "photos/team/alex.png"). */
export function withExtension(path: string, ext: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  const stem = dot > slash ? path.slice(0, dot) : path;
  const safe = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'img';
  return `${stem}.${safe}`;
}

/** Path of each file by its pack id, leaving out files that could not be included. */
export function includedPaths(files: BuildPackZipFile[], failedIds: ReadonlySet<string> = new Set()): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    const id = zipFileId(file);
    if (!failedIds.has(id)) map.set(id, file.path);
  }
  return map;
}

/** "kersivo-build-pack_fade-and-co_2026-11-04" (London date). */
export function buildPackFolderName(pack: Pick<BuildPack, 'shop'>, now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return `kersivo-build-pack_${asciiSlug(buildPackShopName(pack), 'barbershop', 48)}_${date}`;
}

export type BuildPackJsonFile = Omit<BuildPackAsset, 'storagePath' | 'hasThumb'> & {
  /** Path inside the pack folder, or null when the file could not be included. */
  path: string | null;
};

/** shop.json (schemaVersion 1): the BuildPack with file paths instead of storage paths. */
export type BuildPackJson = Omit<BuildPack, 'assets' | 'revisionFiles'> & {
  assets: Record<BuildPackAssetKind, BuildPackJsonFile[]>;
  revisionFiles: BuildPackJsonFile[];
};

export function toBuildPackJson(
  pack: BuildPack,
  files: BuildPackZipFile[],
  failedAssetIds: ReadonlySet<string> = new Set(),
): BuildPackJson {
  const pathById = new Map(files.map((file) => [file.asset.id, file.path]));
  const toFile = ({ storagePath: _storagePath, hasThumb: _hasThumb, ...rest }: BuildPackAsset): BuildPackJsonFile => ({
    ...rest,
    path: failedAssetIds.has(rest.id) ? null : pathById.get(rest.id) ?? null,
  });
  return {
    ...pack,
    assets: Object.fromEntries(BUILD_PACK_ASSET_KINDS.map((kind) => [kind, pack.assets[kind].map(toFile)])) as Record<
      BuildPackAssetKind,
      BuildPackJsonFile[]
    >,
    revisionFiles: pack.revisionFiles.map(toFile),
    remoteImages: pack.remoteImages.map((image) => ({ ...image, path: pathById.get(image.id) ?? null })),
    team: pack.team.map((member) => {
      const photoPaths = [...member.photoAssetIds.map((id) => pathById.get(id)), remotePath('barber', member.id)].filter(
        (path): path is string => Boolean(path),
      );
      return { ...member, photoPath: photoPaths[0] ?? null, photoPaths };
    }),
    products: pack.products.map((product) => ({ ...product, photoPath: remotePath('product', product.id) })),
    services: pack.services.map((service) => ({ ...service, photoPath: remotePath('service', service.id) })),
  };
}

export function buildPackColoursJson(pack: BuildPack) {
  return {
    primary: pack.brand.primary.request ?? pack.brand.primary.profile,
    secondary: pack.brand.secondary.request ?? pack.brand.secondary.profile,
    backgroundTone: pack.brand.backgroundTone,
    source: pack.brand.source,
    paletteExtracted: pack.brand.paletteExtracted,
    sources: { request: { primary: pack.brand.primary.request, secondary: pack.brand.secondary.request }, profile: { primary: pack.brand.primary.profile, secondary: pack.brand.secondary.profile } },
    submittedToKersivo: pack.brand.submittedSnapshot ? { at: pack.brand.submittedAt, ...pack.brand.submittedSnapshot } : null,
  };
}

export function buildPackChangeRequestsMd(pack: BuildPack, files: BuildPackZipFile[]): string {
  const pathById = includedPaths(files);
  const lines = ['# Open change requests', ''];
  if (!pack.changeRequests.length && !pack.legacyChangesRequested) lines.push('None open.', '');
  for (const change of pack.changeRequests) {
    lines.push(`## ${change.page}${change.round ? ` · round ${change.round}` : ''} · ${change.status}`, '');
    lines.push(...change.body.split(/\r?\n/).map((line) => `> ${line}`), '');
    const attachment = change.attachmentId ? pathById.get(change.attachmentId) : null;
    if (attachment) lines.push(`Attachment: \`${attachment}\``, '');
  }
  if (pack.legacyChangesRequested) {
    lines.push('## Changes requested (earlier preview page)', '');
    lines.push(...pack.legacyChangesRequested.text.split(/\r?\n/).map((line) => `> ${line}`), '');
  }
  return lines.join('\n');
}

const REMOTE_LABEL: Record<BuildPackRemoteImage['source'], string> = {
  barber: 'dashboard photo',
  product: 'product image',
  service: 'service image',
  shopLogo: 'shop settings logo',
};

export function buildPackReadme(input: {
  pack: BuildPack;
  folder: string;
  files: BuildPackZipFile[];
  failed: Array<{ path: string; reason: string }>;
}): string {
  const { pack, folder, files, failed } = input;
  const lines = [
    `# KERSIVO build pack — ${buildPackShopName(pack)}`,
    '',
    `Generated ${pack.generatedAt} (schema version ${pack.schemaVersion}).`,
    '',
    '## How to use',
    '',
    '1. Read `brief.md` first: it is the brief for designing this shop\'s website, written for an AI tool or a designer.',
    '2. Give the AI tool `brief.md`, `shop.json` and the files in `brand/` and `photos/`.',
    '3. Build only from what is in this pack. Anything under "Not provided" must stay a clear placeholder.',
    '',
    '## Contents',
    '',
    '- `README.md` — this file',
    '- `brief.md` — the design brief',
    '- `shop.json` — every field as structured data (file paths are relative to this folder)',
    '- `brand/colours.json` — brand colours, background tone and extracted palette',
    '- `revisions/change-requests.md` — open change requests from the owner',
    ...files.map((file) => `- \`${file.path}\`${file.asset.caption ? ` — ${file.asset.caption}` : ''}`),
    '',
    '## Not provided',
    '',
    ...(pack.missing.length ? pack.missing.map((item) => `- ${item}`) : ['- Nothing on the checklist is missing.']),
    '',
    '## Conflicts to confirm',
    '',
    ...(pack.conflicts.length
      ? pack.conflicts.map((c) => `- ${c.label}: ${c.values.map((v) => `"${v.value}" (${v.label})`).join(' vs ')}`)
      : ['- None.']),
    '',
  ];
  if (failed.length) {
    lines.push('## Files that could not be included', '');
    for (const item of failed) lines.push(`- \`${item.path}\` — ${item.reason}`);
    lines.push('');
  }
  lines.push(`Folder: \`${folder}/\``, '');
  return lines.join('\n');
}
