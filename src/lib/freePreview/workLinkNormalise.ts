import {
  WORK_PLATFORM_IDS,
  isWorkPlatformId,
  workPlatformName,
  type WorkLink,
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

const FACEBOOK_HOSTS = ['facebook.com', 'fb.com', 'fb.me'];
const BOOKING_HOSTS: Record<'booksy' | 'fresha' | 'treatwell', readonly string[]> = {
  booksy: ['booksy.com'],
  fresha: ['fresha.com'],
  treatwell: ['treatwell.co.uk', 'treatwell.com'],
};

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
  if (host === 'maps.app.goo.gl' || host === 'g.page' || host === 'business.google.com') return true;
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
  return next.toString();
}

function cleanedUrl(url: URL, options?: { dropTrailingSlash?: boolean }): string {
  return serialiseUrl(stripTracking(url), options);
}

function pathSegments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function stripAt(value: string): string {
  return value.trim().replace(/^@+/, '');
}

function instagramHandleFromUrl(url: URL): string | null {
  if (!hostMatches(url.hostname, ['instagram.com'])) return null;
  const [first] = pathSegments(url);
  if (!first || INSTAGRAM_RESERVED.has(first.toLowerCase())) return null;
  return INSTAGRAM_HANDLE.test(first) ? first : null;
}

function tiktokHandleFromUrl(url: URL): string | null {
  if (!hostMatches(url.hostname, ['tiktok.com'])) return null;
  const [first] = pathSegments(url);
  if (!first) return null;
  const handle = stripAt(first);
  if (TIKTOK_RESERVED.has(handle.toLowerCase())) return null;
  return TIKTOK_HANDLE.test(handle) ? handle : null;
}

export function detectBookingPlatform(raw: string): 'booksy' | 'fresha' | 'treatwell' | null {
  const url = parseWebUrl(raw);
  if (!url) return null;
  if (hostMatches(url.hostname, BOOKING_HOSTS.booksy)) return 'booksy';
  if (hostMatches(url.hostname, BOOKING_HOSTS.fresha)) return 'fresha';
  if (hostMatches(url.hostname, BOOKING_HOSTS.treatwell)) return 'treatwell';
  return null;
}

function asSafeUrl(url: URL): string | null {
  const cleaned = stripTracking(url);
  if (cleaned.protocol !== 'http:' && cleaned.protocol !== 'https:') return null;
  return serialiseUrl(cleaned, { dropTrailingSlash: true });
}

function handleOrRaw(platform: 'instagram' | 'tiktok', raw: string, handle: string | null, profileUrl: string | null): WorkLink {
  if (handle && profileUrl) return { platform, value: handle, url: profileUrl };
  const url = parseWebUrl(raw);
  if (url && (platform === 'instagram' ? hostMatches(url.hostname, ['instagram.com']) : hostMatches(url.hostname, ['tiktok.com']))) {
    return { platform, value: raw.trim(), url: asSafeUrl(url) };
  }
  return { platform, value: raw.trim(), url: null };
}

function normaliseInstagram(raw: string): WorkLink {
  const url = parseWebUrl(raw);
  if (url) {
    const handle = instagramHandleFromUrl(url);
    return handleOrRaw('instagram', raw, handle, handle ? `https://www.instagram.com/${handle}` : null);
  }
  const handle = stripAt(raw);
  if (INSTAGRAM_HANDLE.test(handle) && !handle.includes(' ')) {
    return { platform: 'instagram', value: handle, url: `https://www.instagram.com/${handle}` };
  }
  return { platform: 'instagram', value: raw.trim(), url: null };
}

function normaliseTiktok(raw: string): WorkLink {
  const url = parseWebUrl(raw);
  if (url) {
    const handle = tiktokHandleFromUrl(url);
    return handleOrRaw('tiktok', raw, handle, handle ? `https://www.tiktok.com/@${handle}` : null);
  }
  const handle = stripAt(raw);
  if (TIKTOK_HANDLE.test(handle) && !handle.includes(' ')) {
    return { platform: 'tiktok', value: handle, url: `https://www.tiktok.com/@${handle}` };
  }
  return { platform: 'tiktok', value: raw.trim(), url: null };
}

function normaliseDomainPlatform(platform: 'booksy' | 'fresha' | 'treatwell' | 'facebook', raw: string, roots: readonly string[]): WorkLink {
  const url = parseWebUrl(raw);
  if (url && hostMatches(url.hostname, roots)) {
    const cleaned = asSafeUrl(url);
    return { platform, value: cleaned ?? raw.trim(), url: cleaned };
  }
  return { platform, value: raw.trim(), url: null };
}

function normaliseGoogle(raw: string): WorkLink {
  const url = parseWebUrl(raw);
  if (url && isGoogleListingUrl(url)) {
    const cleaned = asSafeUrl(url);
    return { platform: 'google', value: cleaned ?? raw.trim(), url: cleaned };
  }
  return { platform: 'google', value: raw.trim(), url: null };
}

function normaliseWebsite(raw: string): WorkLink {
  const url = parseWebUrl(raw);
  if (!url) return { platform: 'website', value: raw.trim(), url: null };
  const cleaned = stripTracking(url);
  return { platform: 'website', value: serialiseUrl(cleaned), url: serialiseUrl(cleaned) };
}

function normaliseOther(raw: string): WorkLink {
  const url = parseWebUrl(raw);
  if (!url) return { platform: 'other', value: raw.trim(), url: null };
  const cleaned = asSafeUrl(url);
  return { platform: 'other', value: raw.trim(), url: cleaned };
}

export function normaliseWorkLink(platform: WorkPlatformId, raw: string): WorkLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  switch (platform) {
    case 'instagram':
      return normaliseInstagram(trimmed);
    case 'tiktok':
      return normaliseTiktok(trimmed);
    case 'facebook':
      return normaliseDomainPlatform('facebook', trimmed, FACEBOOK_HOSTS);
    case 'booksy':
      return normaliseDomainPlatform('booksy', trimmed, BOOKING_HOSTS.booksy);
    case 'fresha':
      return normaliseDomainPlatform('fresha', trimmed, BOOKING_HOSTS.fresha);
    case 'treatwell':
      return normaliseDomainPlatform('treatwell', trimmed, BOOKING_HOSTS.treatwell);
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
  switch (platform) {
    case 'instagram':
    case 'tiktok':
      return Boolean(parsed.url && parsed.value !== parsed.url);
    case 'booksy':
    case 'fresha':
    case 'treatwell':
      return Boolean(parsed.url);
    case 'facebook':
      return Boolean(parsed.url) || !parseWebUrl(trimmed);
    case 'google':
      return Boolean(parsed.url) || !parseWebUrl(trimmed);
    case 'website':
      return Boolean(parsed.url);
    case 'other':
      return true;
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
    links.push(normaliseWorkLink('instagram', fields.instagramUrl) ?? {
      platform: 'instagram',
      value: fields.instagramUrl,
      url: fields.instagramUrl,
    });
  }
  if (fields.bookingPageUrl) {
    const platform = detectBookingPlatform(fields.bookingPageUrl) ?? 'other';
    links.push(normaliseWorkLink(platform, fields.bookingPageUrl) ?? {
      platform,
      value: fields.bookingPageUrl,
      url: fields.bookingPageUrl,
    });
  }
  if (fields.googleListingUrl) {
    links.push(normaliseWorkLink('google', fields.googleListingUrl) ?? {
      platform: 'google',
      value: fields.googleListingUrl,
      url: fields.googleListingUrl,
    });
  }
  if (fields.websiteUrl) {
    links.push(normaliseWorkLink('website', fields.websiteUrl) ?? {
      platform: 'website',
      value: fields.websiteUrl,
      url: fields.websiteUrl,
    });
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
    out.push({ platform: record.platform, value: record.value.trim(), url });
  }
  return out;
}

export type DisplayWorkLink = { label: string; value: string; url: string | null };

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
    }));
  }

  const entries: DisplayWorkLink[] = [];
  if (request.instagramUrl) {
    const link = normaliseWorkLink('instagram', request.instagramUrl);
    entries.push({
      label: workPlatformName('instagram'),
      value: link?.value ?? request.instagramUrl,
      url: link?.url ?? request.instagramUrl,
    });
  }
  if (request.bookingPageUrl) {
    const detected = detectBookingPlatform(request.bookingPageUrl);
    const link = normaliseWorkLink(detected ?? 'other', request.bookingPageUrl);
    entries.push({
      label: detected ? workPlatformName(detected) : 'Booking page',
      value: link?.value ?? request.bookingPageUrl,
      url: link?.url ?? request.bookingPageUrl,
    });
  }
  if (request.googleListingUrl) {
    const link = normaliseWorkLink('google', request.googleListingUrl);
    entries.push({
      label: workPlatformName('google'),
      value: link?.value ?? request.googleListingUrl,
      url: link?.url ?? request.googleListingUrl,
    });
  }
  if (request.websiteUrl) {
    const link = normaliseWorkLink('website', request.websiteUrl);
    entries.push({
      label: workPlatformName('website'),
      value: link?.value ?? request.websiteUrl,
      url: link?.url ?? request.websiteUrl,
    });
  }
  return entries;
}

export { WORK_PLATFORM_IDS };
