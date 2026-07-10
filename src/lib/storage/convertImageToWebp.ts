import sharp from 'sharp';

const MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_WEBP_QUALITY = 84;

export async function convertImageFileToWebp(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<Buffer> {
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    throw new Error('Image is too large. Maximum size is 10MB.');
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_WEBP_QUALITY;
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const metadata = await sharp(inputBuffer, { failOn: 'none' }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unsupported or invalid image file.');
  }

  return sharp(inputBuffer)
    .rotate()
    .resize({
      width: metadata.width > metadata.height ? maxDimension : undefined,
      height: metadata.height >= metadata.width ? maxDimension : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}
