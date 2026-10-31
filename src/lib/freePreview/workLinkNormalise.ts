import {
  WORK_PLATFORM_IDS,
  WORK_PLATFORMS,
  isWorkPlatformId,
  workPlatformById,
  workPlatformName,
  type WorkLink,
  type WorkPlatform,
  type WorkPlatformId,
} from './workPlatforms';

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const TIKTOK_HANDLE = /^[A-Za-z0-9._]{2,24}$/;
const INSTAGRAM_RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'explore',
  'tv',
  'accounts',
  'direct',
  'legal',
  'about',
]);
const TIKTOK_RESERVED = new Set(['foryou', 'following', 'video', 'tag', 'music', 'discover', 'live', 'place']);
const TIKTOK_SHORT_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com'];

const TRACKING_PARAMS = new Set([
  'igsh',
  'igshid',
  'fbclid',
  'gclid',
  'msclkid',
  'dclid',
  'wbraid',
  'gbraid',
  '_ga',
  '_gl',
  'si',
  'ref',
  '_t',
  '_r',
  'tt_from',
  'is_from_webapp',
  'sender_device',
  'share_app_id',
  'mc_cid',
  'mc_eid',
  'ig_rid',
  'img_index',
]);

function workLink(
  platform: WorkPlatformId,
  value: string,
  url: string | null,
  handle: string | null = null,
): WorkLink {
  return { platform, value, url, handle };
}

export function parseWebUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('@')) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) return null;
  if (url.protocol === 'http:') {
    const forced = new URL(url.toString());
    forced.protocol = 'https:';
    return forced;
  }
  return url;
}

function hostWithoutWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function hostMatches(hostname: string, roots: readonly string[]): boolean {
  const host = hostWithoutWww(hostname);
  return roots.some((root) => host === root || host.endsWith(`.${root}`));
}

function isGoogleListingUrl(url: URL): boolean {
  const host = hostWithoutWww(url.hostname);
  if (host === 'maps.app.goo.gl' || host === 'g.page' || host === 'g.co' || host === 'business.google.com') {
    return true;
  }
  if (host === 'goo.gl' && url.pathname.toLowerCase().startsWith('/maps')) return true;
  if (host === 'maps.google.com' || host.startsWith('maps.google.')) return true;
  if (host === 'google.com' || host.startsWith('google.')) {
    return url.pathname.toLowerCase().startsWith('/maps');
  }
  return false;
}

function stripTracking(url: URL): URL {
  const next = new URL(url.toString());
  for (const key of [...next.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) {
      next.searchParams.delete(key);
    }
  }
  return next;
}

function serialiseUrl(url: URL, options?: { dropTrailingSlash?: boolean }): string {
  const next = new URL(url.toString());
  if (options?.dropTrailingSlash && next.pathname.length > 1 && next.pathname.endsWith('/')) {
    next.pathname = next.pathname.replace(/\/+$/, '');
  }
  if ([...next.searchParams.keys()].length === 0) next.search = '';
  if (!next.hash || next.hash === '#') next.hash = '';
  let href = next.toString();
  if (options?.dropTrailingSlash && !next.search && !next.hash && href.endsWith('/')) {
    href = href.slice(0, -1);
  }
  return href;
}

function pathSegments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function stripAt(value: string): string {
  return value.trim().replace(/^@+/, '');
}

function asSafeUrl(url: URL): string | null {
  const cleaned = stripTracking(url);
  if (cleaned.protocol !== 'http:' && cleaned.protocol !== 'https:') return null;
  return serialiseUrl(cleaned, { dropTrailingSlash: true });
}

function instagramHandleFromUrl(url: URL, hosts: readonly string[]): string | null {
  if (!hostMatches(url.hostname, hosts)) return null;
  const [first] = pathSegments(url);
  if (!first || INSTAGRAM_RESERVED.has(first.toLowerCase())) return null;
  return INSTAGRAM_HANDLE.test(first) ? first : null;
}

function isTiktokShortHost(hostname: string): boolean {
  return TIKTOK_SHORT_HOSTS.includes(hostWithoutWww(hostname));
}

function tiktokHandleFromUrl(url: URL, hosts: readonly string[]): string | null {
  if (isTiktokShortHost(url.hostname)) return null;
  if (!hostMatches(url.hostname, hosts)) return null;
  const [first] = pathSegments(url);
  if (!first) return null;
  const handle = stripAt(first);
  if (TIKTOK_RESERVED.has(handle.toLowerCase())) return null;
  return TIKTOK_HANDLE.test(handle) ? handle : null;
}

export function detectBookingPlatform(raw: string): 'booksy' | 'fresha' | 'treatwell' | null {
  const url = parseWebUrl(raw);
  if (!url) return null;
  if (hostMatches(url.hostname, workPlatformById('booksy').hosts)) return 'booksy';
  if (hostMatches(url.hostname, workPlatformById('fresha').hosts)) return 'fresha';
  if (hostMatches(url.hostname, workPlatformById('treatwell').hosts)) return 'treatwell';
  return null;
}

/** Host → platform for the smart-paste field. Unknown URLs become `website`. Non-URLs return null. */
export function detectPlatform(raw: string): WorkPlatformId | null {
  const url = parseWebUrl(raw);
  if (!url) return null;
  for (const platform of WORK_PLATFORMS) {
    if (platform.kind === 'website' || platform.kind === 'other' || !platform.hosts.length) continue;
    if (platform.kind === 'google') {
      if (isGoogleListingUrl(url)) return 'google';
      continue;
    }
    if (hostMatches(url.hostname, platform.hosts)) return platform.id;
  }
  return 'website';
}

function normaliseHandlePlatform(platform: WorkPlatform, raw: string): WorkLink {
  const value = raw.trim();
  const url = parseWebUrl(value);
  const isTiktok = platform.id === 'tiktok';

  if (url) {
    if (isTiktok && isTiktokShortHost(url.hostname)) {
      return workLink(platform.id, value, asSafeUrl(url), null);
    }
    const handle = isTiktok
      ? tiktokHandleFromUrl(url, platform.hosts)
      : instagramHandleFromUrl(url, platform.hosts);
    if (handle) {
      const profile = isTiktok
        ? `https://www.tiktok.com/@${handle}`
        : `https://www.instagram.com/${handle}`;
      return workLink(platform.id, value, profile, handle);
    }
    if (hostMatches(url.hostname, platform.hosts)) {
      return workLink(platform.id, value, asSafeUrl(url), null);
    }
    return workLink(platform.id, value, null, null);
  }

  const handle = stripAt(value);
  const pattern = isTiktok ? TIKTOK_HANDLE : INSTAGRAM_HANDLE;
  if (pattern.test(handle) && !handle.includes(' ')) {
    const profile = isTiktok
      ? `https://www.tiktok.com/@${handle}`
      : `https://www.instagram.com/${handle}`;
    return workLink(platform.id, value, profile, handle);
  }
  return workLink(platform.id, value, null, null);
}

function normaliseDomainPlatform(platform: WorkPlatform, raw: string): WorkLink {
  const value = raw.trim();
  const url = parseWebUrl(value);
  if (url && hostMatches(url.hostname, platform.hosts)) {
    return workLink(platform.id, value, asSafeUrl(url), null);
  }
  return workLink(platform.id, value, null, null);
}

function normaliseGoogle(raw: string): WorkLink {
  const value = raw.trim();
  const url = parseWebUrl(value);
  if (url && isGoogleListingUrl(url)) {
    return workLink('google', value, asSafeUrl(url), null);
  }
  return workLink('google', value, null, null);
}

function normaliseWebsite(raw: string): WorkLink {
  const value = raw.trim();
  const url = parseWebUrl(value);
  if (!url) return workLink('website', value, null, null);
  return workLink('website', value, asSafeUrl(url), null);
}

function normaliseOther(raw: string): WorkLink {
  const value = raw.trim();
  const url = parseWebUrl(value);
  if (!url) return workLink('other', value, null, null);
  return workLink('other', value, asSafeUrl(url), null);
}

export function normaliseWorkLink(platform: WorkPlatformId, raw: string): WorkLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const config = workPlatformById(platform);
  switch (config.kind) {
    case 'handle':
      return normaliseHandlePlatform(config, trimmed);
    case 'domain':
      return normaliseDomainPlatform(config, trimmed);
    case 'google':
      return normaliseGoogle(trimmed);
    case 'website':
      return normaliseWebsite(trimmed);
    case 'other':
      return normaliseOther(trimmed);
  }
}

/** Soft client hint only — never used to block submit. */
export function workLinkLooksValid(platform: WorkPlatformId, raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const parsed = normaliseWorkLink(platform, trimmed);
  if (!parsed) return true;
  const config = workPlatformById(platform);
  switch (config.kind) {
    case 'handle':
      return platform === 'tiktok' ? Boolean(parsed.handle || parsed.url) : Boolean(parsed.handle);
    case 'domain':
      return platform === 'facebook' ? Boolean(parsed.url) || !parseWebUrl(trimmed) : Boolean(parsed.url);
    case 'google':
      return Boolean(parsed.url) || !parseWebUrl(trimmed);
    case 'website':
      return Boolean(parsed.url);
    case 'other':
      return true;
  }
}

/** Host-style preview under the row, e.g. `instagram.com/yourshop`. Empty when there is nothing to show. */
export function workLinkPreviewText(platform: WorkPlatformId, raw: string): string {
  const parsed = normaliseWorkLink(platform, raw);
  if (!parsed) return '';
  if (parsed.handle) {
    return platform === 'tiktok' ? `tiktok.com/@${parsed.handle}` : `${workPlatformById(platform).hosts[0]}/${parsed.handle}`;
  }
  if (!parsed.url) return '';
  try {
    const url = new URL(parsed.url);
    const host = hostWithoutWww(url.hostname);
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`;
  } catch {
    return '';
  }
}

export function normaliseWorkLinksInput(
  items: ReadonlyArray<{ platform: string; value: string }>,
): WorkLink[] {
  const out: WorkLink[] = [];
  const seen = new Set<WorkPlatformId>();
  for (const item of items) {
    if (!isWorkPlatformId(item.platform)) continue;
    if (seen.has(item.platform)) continue;
    const link = normaliseWorkLink(item.platform, item.value);
    if (!link) continue;
    seen.add(item.platform);
    out.push(link);
  }
  return out;
}

export function workLinksToLegacyFields(links: readonly WorkLink[]): {
  bookingPageUrl: string | null;
  instagramUrl: string | null;
  googleListingUrl: string | null;
  websiteUrl: string | null;
} {
  const find = (id: WorkPlatformId) => links.find((link) => link.platform === id);
  const booking = (['booksy', 'fresha', 'treatwell'] as const)
    .map(find)
    .find((link) => link?.url);
  return {
    bookingPageUrl: booking?.url ?? null,
    instagramUrl: find('instagram')?.url ?? null,
    googleListingUrl: find('google')?.url ?? null,
    websiteUrl: find('website')?.url ?? null,
  };
}

export function legacyFieldsToWorkLinks(fields: {
  bookingPageUrl: string | null;
  instagramUrl: string | null;
  googleListingUrl: string | null;
  websiteUrl: string | null;
}): WorkLink[] {
  const links: WorkLink[] = [];
  if (fields.instagramUrl) {
    links.push(
      normaliseWorkLink('instagram', fields.instagramUrl) ??
        workLink('instagram', fields.instagramUrl, fields.instagramUrl, null),
    );
  }
  if (fields.bookingPageUrl) {
    const platform = detectBookingPlatform(fields.bookingPageUrl) ?? 'other';
    links.push(
      normaliseWorkLink(platform, fields.bookingPageUrl) ??
        workLink(platform, fields.bookingPageUrl, fields.bookingPageUrl, null),
    );
  }
  if (fields.googleListingUrl) {
    links.push(
      normaliseWorkLink('google', fields.googleListingUrl) ??
        workLink('google', fields.googleListingUrl, fields.googleListingUrl, null),
    );
  }
  if (fields.websiteUrl) {
    links.push(
      normaliseWorkLink('website', fields.websiteUrl) ??
        workLink('website', fields.websiteUrl, fields.websiteUrl, null),
    );
  }
  return links;
}

export function parseStoredWorkLinks(value: unknown): WorkLink[] {
  if (!Array.isArray(value)) return [];
  const out: WorkLink[] = [];
  const seen = new Set<WorkPlatformId>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isWorkPlatformId(record.platform) || typeof record.value !== 'string' || !record.value.trim()) continue;
    if (seen.has(record.platform)) continue;
    seen.add(record.platform);
    const url = typeof record.url === 'string' && record.url.trim() ? record.url.trim() : null;
    const handle = typeof record.handle === 'string' && record.handle.trim() ? record.handle.trim() : null;
    out.push({ platform: record.platform, value: record.value.trim(), url, handle });
  }
  return out;
}

export type DisplayWorkLink = { label: string; value: string; url: string | null; handle: string | null };

/** Prefer stored `workLinks`; fall back to the four legacy URL columns on older rows. */
export function displayWorkLinks(request: {
  workLinks?: unknown;
  bookingPageUrl?: string | null;
  instagramUrl?: string | null;
  googleListingUrl?: string | null;
  websiteUrl?: string | null;
}): DisplayWorkLink[] {
  const stored = parseStoredWorkLinks(request.workLinks);
  if (stored.length) {
    return stored.map((link) => ({
      label: workPlatformName(link.platform),
      value: link.value,
      url: link.url,
      handle: link.handle,
    }));
  }

  const entries: DisplayWorkLink[] = [];
  if (request.instagramUrl) {
    const link = normaliseWorkLink('instagram', request.instagramUrl);
    entries.push({
      label: workPlatformName('instagram'),
      value: link?.value ?? request.instagramUrl,
      url: link?.url ?? request.instagramUrl,
      handle: link?.handle ?? null,
    });
  }
  if (request.bookingPageUrl) {
    const detected = detectBookingPlatform(request.bookingPageUrl);
    const link = normaliseWorkLink(detected ?? 'other', request.bookingPageUrl);
    entries.push({
      label: detected ? workPlatformName(detected) : 'Booking page',
      value: link?.value ?? request.bookingPageUrl,
      url: link?.url ?? request.bookingPageUrl,
      handle: link?.handle ?? null,
    });
  }
  if (request.googleListingUrl) {
    const link = normaliseWorkLink('google', request.googleListingUrl);
    entries.push({
      label: workPlatformName('google'),
      value: link?.value ?? request.googleListingUrl,
      url: link?.url ?? request.googleListingUrl,
      handle: link?.handle ?? null,
    });
  }
  if (request.websiteUrl) {
    const link = normaliseWorkLink('website', request.websiteUrl);
    entries.push({
      label: workPlatformName('website'),
      value: link?.value ?? request.websiteUrl,
      url: link?.url ?? request.websiteUrl,
      handle: link?.handle ?? null,
    });
  }
  return entries;
}

export { WORK_PLATFORM_IDS };
