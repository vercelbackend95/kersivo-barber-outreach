import { convertImageFileToWebp } from '@/lib/storage/convertImageToWebp';
import { uploadPublicImageToBlob } from '@/lib/storage/vercelBlob';

export async function storeNoteImage(
  file: File,
  clientId: string,
  noteId: string,
  index: number,
): Promise<string> {
  const webpBuffer = await convertImageFileToWebp(file);
  const webpFile = new File([new Uint8Array(webpBuffer)], `note-${index}.webp`, { type: 'image/webp' });
  const pathname = `client-notes/${clientId}/${noteId}-${index}.webp`;
  return uploadPublicImageToBlob(webpFile, pathname);
}
