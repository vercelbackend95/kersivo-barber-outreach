/**
 * brief.md for the ops build pack: the design brief handed to an AI tool or designer. Generated only from
 * BuildPack (no owner personal data: see buildPackFields.ts). British English.
 */
import { buildPackShopName, buildPackTownCity, type BuildPack, type BuildPackAsset } from './buildPack';
import type { BuildPackZipFile } from './buildPackZipPlan';

export const BUILD_PACK_BRIEF_INSTRUCTION =
  'This pack contains everything the barbershop owner supplied to KERSIVO. Design a unique website for this shop based on its logo, colours, photos and text. Use only the facts in this pack: do not invent prices, services, reviews, awards, opening hours or claims. Where something is listed under "Not provided", leave a clear placeholder instead of making it up. Use British English.';

function money(pence: number, from = false): string {
  const value = `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
  return from ? `from ${value}` : value;
}

function quote(text: string): string[] {
  return text.split(/\r?\n/).map((line) => (line ? `> ${line}` : '>'));
}

/** Markdown-safe inline text: no table breaks, no stray formatting from owner input. */
function inline(text: string): string {
  return text.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

function fileRef(asset: BuildPackAsset, pathById: Map<string, string>): string {
  const path = pathById.get(asset.id);
  return path ? `\`${path}\`` : `${asset.fileName} (not in this pack)`;
}

export function buildPackBriefMd(pack: BuildPack, files: BuildPackZipFile[] = []): string {
  const pathById = new Map(files.map((file) => [file.asset.id, file.path]));
  const name = buildPackShopName(pack);
  const out: string[] = [`# Website brief — ${inline(name)}`, '', ...quote(BUILD_PACK_BRIEF_INSTRUCTION), ''];

  out.push('## Shop', '');
  out.push(`- Name: ${inline(name)}`);
  out.push(`- Town / city: ${inline(buildPackTownCity(pack))}`);
  if (pack.contact.tagline) out.push(`- Tagline: ${inline(pack.contact.tagline)}`);
  out.push(`- Barbers (approx.): ${pack.intake.barberCount}`);
  out.push(`- Has its own domain: ${pack.contact.hasOwnDomain}`);
  out.push('');

  out.push('## Location & contact', '');
  const address = [pack.contact.addressLine1, pack.contact.addressLine2, buildPackTownCity(pack), pack.contact.postcode].filter(Boolean);
  out.push(`- Address: ${pack.contact.addressLine1 || pack.contact.postcode ? inline(address.join(', ')) : 'Not provided'}`);
  out.push(`- Phone: ${pack.contact.phone ? inline(pack.contact.phone) : 'Not provided'}`);
  out.push(`- Public email: ${pack.contact.email ? inline(pack.contact.email) : 'Not provided'}`);
  out.push('');

  out.push('## Opening hours', '');
  if (pack.hours.saved) {
    for (const day of pack.hours.days) out.push(`- ${day.day}: ${day.isOpen ? `${day.opens}–${day.closes}` : 'Closed'}`);
  } else {
    out.push('Not provided. Leave a placeholder; do not invent hours.');
  }
  out.push('');

  out.push('## Brand', '');
  const logos = pack.assets.LOGO;
  const current = logos.find((logo) => logo.id === pack.brand.currentLogoAssetId);
  out.push(`- Logo: ${current ? fileRef(current, pathById) : 'Not provided'}`);
  if (logos.length > 1) out.push(`- Other logo files: ${logos.filter((l) => l !== current).map((l) => fileRef(l, pathById)).join(', ')}`);
  const primary = pack.brand.primary.request ?? pack.brand.primary.profile;
  const secondary = pack.brand.secondary.request ?? pack.brand.secondary.profile;
  out.push(`- Primary colour: ${primary ?? 'Not provided'}`);
  out.push(`- Secondary colour: ${secondary ?? 'Not provided'}`);
  if (pack.brand.backgroundTone) out.push(`- Background tone: ${pack.brand.backgroundTone.toLowerCase()}`);
  if (pack.brand.source === 'KERSIVO_CHOOSES') out.push('- The owner asked KERSIVO to choose the colours.');
  if (pack.brand.paletteExtracted?.length) {
    out.push(`- Palette extracted from the logo: ${pack.brand.paletteExtracted.map((p) => `${p.hex} (${Math.round(p.share * 100)}%)`).join(', ')}`);
  }
  out.push('');
  if (pack.brand.styleNotes) out.push('Style notes from the owner:', '', ...quote(pack.brand.styleNotes), '');

  out.push('## Website text', '');
  const texts: Array<[string, string | null]> = [
    ['About the shop', pack.text.about],
    ['Shop description (dashboard)', pack.text.description && pack.text.description !== pack.text.about ? pack.text.description : null],
    ['Anything else the owner wants on the site', pack.text.websiteExtra],
  ];
  let anyText = false;
  for (const [label, value] of texts) {
    if (!value) continue;
    anyText = true;
    out.push(`### ${label}`, '', ...quote(value), '');
  }
  if (!anyText) out.push('Not provided. Leave placeholders; do not write an invented story.', '');

  out.push('## Services & prices', '');
  if (pack.services.length) {
    out.push('| Service | Duration | Price | Category |', '| --- | --- | --- | --- |');
    for (const s of pack.services) {
      out.push(`| ${inline(s.name)}${s.description ? ` — ${inline(s.description)}` : ''} | ${s.durationMinutes} min | ${money(s.pricePence, s.priceFrom)} | ${s.category ? inline(s.category) : ''} |`);
    }
  } else {
    out.push('Not provided. Do not invent services or prices.');
  }
  if (pack.assets.PRICE_LIST.length) out.push('', `Price list file: ${pack.assets.PRICE_LIST.map((a) => fileRef(a, pathById)).join(', ')}`);
  out.push('');

  out.push('## Team', '');
  if (pack.team.length) {
    for (const member of pack.team) {
      const photos = member.photoAssetIds
        .map((id) => pack.assets.TEAM_PHOTO.find((a) => a.id === id))
        .filter((a): a is BuildPackAsset => Boolean(a))
        .map((a) => fileRef(a, pathById));
      out.push(`- **${inline(member.name)}**${member.role ? ` — ${inline(member.role)}` : ''}${photos.length ? ` · photo: ${photos.join(', ')}` : ' · no photo'}`);
      if (member.bio) out.push(...quote(member.bio).map((line) => `  ${line}`));
    }
  } else {
    out.push('Not provided.');
  }
  out.push('');

  if (pack.products.length) {
    out.push('## Products', '');
    for (const product of pack.products) {
      out.push(`- ${inline(product.name)} — ${money(product.pricePence)}${product.description ? ` (${inline(product.description)})` : ''}`);
    }
    out.push('');
  }

  out.push('## Photos', '');
  const photoGroups: Array<[string, BuildPackAsset[]]> = [
    ['Shop', pack.assets.SHOP_PHOTO],
    ['Team', pack.assets.TEAM_PHOTO],
  ];
  let anyPhoto = false;
  for (const [label, items] of photoGroups) {
    for (const asset of items) {
      anyPhoto = true;
      const dims = asset.width && asset.height ? ` (${asset.width}×${asset.height})` : '';
      const who = asset.barberName ? ` — ${inline(asset.barberName)}` : '';
      out.push(`- ${label}: ${fileRef(asset, pathById)}${dims}${who}${asset.caption ? ` — ${inline(asset.caption)}` : ''}`);
    }
  }
  if (!anyPhoto) out.push('No photos provided. Use neutral placeholders, not stock photos of other shops.');
  if (pack.assets.OTHER.length) out.push('', `Other files from the owner: ${pack.assets.OTHER.map((a) => fileRef(a, pathById)).join(', ')}`);
  out.push('');

  out.push('## Links & socials', '');
  const links: string[] = [];
  const seen = new Set<string>();
  const key = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  const addLink = (label: string, value: string | null) => {
    if (!value || seen.has(key(value))) return;
    seen.add(key(value));
    links.push(`- ${label}: ${inline(value)}`);
  };
  for (const link of pack.links.work) addLink(link.label, link.url ?? link.value);
  addLink('Instagram', pack.links.instagram.request);
  addLink('Instagram', pack.links.instagram.profile);
  addLink('Facebook', pack.links.facebook);
  addLink('TikTok', pack.links.tiktok);
  addLink('Other social', pack.links.other);
  out.push(...(links.length ? links : ['Not provided.']), '');

  if (pack.intake.notes) out.push('## Owner notes from the preview form', '', ...quote(pack.intake.notes), '');

  out.push('## Not provided — do not invent', '');
  out.push(...(pack.missing.length ? pack.missing.map((item) => `- ${item}`) : ['- Nothing on the checklist is missing.']), '');

  out.push('## Conflicts to confirm', '');
  out.push(
    ...(pack.conflicts.length
      ? pack.conflicts.map((c) => `- ${c.label}: ${c.values.map((v) => `"${inline(v.value)}" (${v.label})`).join(' vs ')}. Ask KERSIVO which one to use.`)
      : ['- None.']),
    '',
  );
  return out.join('\n');
}
