import { convertImageFileToWebp } from '@/lib/storage/convertImageToWebp';
import { uploadPrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';

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

/**
 * Store a new client-note image in private Vercel Blob.
 * Returns the private pathname to persist in ClientNoteImage.url (not a public URL).
 */
export async function storeNoteImage(
  file: File,
  shopId: string,
  clientId: string,
  noteId: string,
  index: number,
): Promise<string> {
  const webpBuffer = await convertImageFileToWebp(file);
  const webpFile = new File([new Uint8Array(webpBuffer)], `note-${index}.webp`, {
    type: 'image/webp',
  });
  const pathname = makePrivateNoteImagePath(shopId, clientId, noteId, index);
  const uploaded = await uploadPrivateOnboardingFile(webpFile, pathname, 'image/webp');
  return uploaded.pathname || pathname;
}
