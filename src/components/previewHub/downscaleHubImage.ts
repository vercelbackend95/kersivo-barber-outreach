const MAX_EDGE = 2560;
const JPEG_QUALITY = 0.85;

const RASTER_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function isHubRasterImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (RASTER_TYPES.has(type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isHubSvgOrPdf(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || type === 'application/pdf') return true;
  return /\.(svg|pdf)$/i.test(file.name);
}

async function canvasHasTransparency(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<boolean> {
  const sample = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < sample.length; i += 16) {
    if ((sample[i] ?? 255) < 250) return true;
  }
  return false;
}

function rename(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.${ext}`;
}

export async function downscaleHubImage(file: File): Promise<File> {
  if (!isHubRasterImage(file) || isHubSvgOrPdf(file)) return file;
  if (typeof createImageBitmap !== 'function') return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const offscreen = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : null;
    const canvas = offscreen ?? Object.assign(document.createElement('canvas'), { width, height });
    if (!offscreen) {
      (canvas as HTMLCanvasElement).width = width;
      (canvas as HTMLCanvasElement).height = height;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const keepPng = await canvasHasTransparency(ctx, width, height);
    const type = keepPng ? 'image/png' : 'image/jpeg';
    const blob =
      'convertToBlob' in canvas
        ? await (canvas as OffscreenCanvas).convertToBlob({ type, quality: keepPng ? undefined : JPEG_QUALITY })
        : await new Promise<Blob | null>((resolve) =>
            (canvas as HTMLCanvasElement).toBlob(resolve, type, keepPng ? undefined : JPEG_QUALITY),
          );
    if (!blob) return file;
    return new File([blob], rename(file.name, keepPng ? 'png' : 'jpg'), { type: blob.type });
  } finally {
    bitmap.close();
  }
}
