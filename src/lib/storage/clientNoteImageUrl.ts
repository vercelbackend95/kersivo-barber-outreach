/**
 * Client-safe helpers for client-note image URLs.
 * Keep this module free of Node-only image codecs so admin islands can hydrate.
 */

/**
 * True when `url` is a legacy public http(s) URL, data URL, or site-relative public path.
 * New private uploads store a Blob pathname (no scheme / not site-rooted).
 */
export function isLegacyPublicNoteImageUrl(url: string): boolean {
  const v = url.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  if (/^data:/i.test(v)) return true;
  if (v.startsWith('/') && !v.startsWith('/api/')) return true;
  return false;
}

/** True when ClientNoteImage.url holds a private Vercel Blob pathname (new uploads). */
export function isPrivateNoteBlobPathname(url: string): boolean {
  const v = url.trim();
  if (!v) return false;
  return !isLegacyPublicNoteImageUrl(v);
}

export function makePrivateNoteImagePath(
  shopId: string,
  clientId: string,
  noteId: string,
  index: number,
): string {
  return `client-notes/${shopId.trim()}/${clientId.trim()}/${noteId.trim()}-${index}.webp`;
}

/** Same-origin authenticated stream URL for private note images; leave legacy URLs unchanged. */
export function resolveClientNoteImageSrc(
  clientId: string,
  image: { id: string; url: string },
): string {
  if (isLegacyPublicNoteImageUrl(image.url)) return image.url;
  return `/api/admin/clients/${encodeURIComponent(clientId)}/notes/images/${encodeURIComponent(image.id)}`;
}
