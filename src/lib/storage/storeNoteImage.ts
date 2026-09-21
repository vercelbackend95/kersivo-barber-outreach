import { convertImageFileToWebp } from '@/lib/storage/convertImageToWebp';
import {
  isLegacyPublicNoteImageUrl,
  isPrivateNoteBlobPathname,
  makePrivateNoteImagePath,
  resolveClientNoteImageSrc,
} from '@/lib/storage/clientNoteImageUrl';
import { uploadPrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';

export {
  isLegacyPublicNoteImageUrl,
  isPrivateNoteBlobPathname,
  makePrivateNoteImagePath,
  resolveClientNoteImageSrc,
};

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
