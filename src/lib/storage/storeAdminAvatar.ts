import { getBlobReadWriteToken, makeBlobPath, uploadPublicImageToBlob } from '@/lib/storage/vercelBlob';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtensionForType(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return null;
}

export async function storeAdminAvatar(file: File, prefix: 'barbers' | 'clients', idHint?: string) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('Avatar must be a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Avatar is too large. Maximum size is 5MB.');
  }

  const extension = getExtensionForType(file.type);
  if (!extension) {
    throw new Error('Unsupported avatar format.');
  }
  if (!getBlobReadWriteToken()) {
    throw new Error('Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN before uploading avatars.');
  }

  const pathname = makeBlobPath(prefix, file, idHint);
  return uploadPublicImageToBlob(file, pathname);
}
