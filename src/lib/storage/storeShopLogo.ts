import sharp from 'sharp';
import { getBlobReadWriteToken, uploadPublicImageToBlob } from '@/lib/storage/vercelBlob';

export const MAX_SHOP_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_SHOP_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const LOGO_OUTPUT_SIZE = 512;
const MIN_SOURCE_DIMENSION = 64;
const WEBP_QUALITY = 90;

export async function storeShopLogo(file: File, shopId: string): Promise<string> {
  if (!ALLOWED_SHOP_LOGO_TYPES.has(file.type)) {
    throw new Error('Logo must be a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_SHOP_LOGO_SIZE_BYTES) {
    throw new Error('Logo is too large. Maximum size is 2MB.');
  }
  if (!getBlobReadWriteToken()) {
    throw new Error('Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN before uploading a logo.');
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(inputBuffer, { failOn: 'none' }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unsupported or invalid image file.');
  }
  if (metadata.width < MIN_SOURCE_DIMENSION || metadata.height < MIN_SOURCE_DIMENSION) {
    throw new Error(`Logo is too small. Use an image at least ${MIN_SOURCE_DIMENSION}×${MIN_SOURCE_DIMENSION}px.`);
  }

  const webpBuffer = await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize(LOGO_OUTPUT_SIZE, LOGO_OUTPUT_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();

  const webpFile = new File([new Uint8Array(webpBuffer)], 'shop-logo.webp', { type: 'image/webp' });
  const pathname = `shops/${shopId}/logo-${Date.now()}.webp`;
  return uploadPublicImageToBlob(webpFile, pathname);
}
