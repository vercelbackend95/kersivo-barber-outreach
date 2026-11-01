import { extractPalette } from './extract';
import type { ExtractedSwatch, RgbaImage } from './types';

const MAX_EDGE = 256;

export function logoDisplayUrl(
  apiBase: string,
  asset: { id: string; hasThumb: boolean; contentType: string; kind: string },
): string | null {
  if (asset.kind !== 'LOGO') return null;
  if (asset.hasThumb) return `${apiBase}/assets/${encodeURIComponent(asset.id)}?size=thumb`;
  if (asset.contentType.startsWith('image/') && !asset.contentType.includes('svg')) {
    return `${apiBase}/assets/${encodeURIComponent(asset.id)}?size=full`;
  }
  return null;
}

export function drawImageToSwatchPixels(image: CanvasImageSource, width: number, height: number): RgbaImage | null {
  const edge = Math.max(width, height);
  const scale = edge > MAX_EDGE ? MAX_EDGE / edge : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  return { data: pixels.data, width: w, height: h };
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./extract.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

export function extractPaletteOnThread(image: RgbaImage): ExtractedSwatch[] {
  return extractPalette(image);
}

export function extractPaletteInWorker(image: RgbaImage): Promise<ExtractedSwatch[]> {
  const worker = createWorker();
  if (!worker) return Promise.resolve(extractPalette(image));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('extract-timeout'));
    }, 2_000);
    worker.onmessage = (event: MessageEvent<{ swatches: ExtractedSwatch[] }>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data.swatches);
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(extractPalette(image));
    };
    worker.postMessage({
      data: image.data,
      width: image.width,
      height: image.height,
    });
  });
}

export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('logo-load-failed'));
    img.src = url;
  });
}

export async function extractFromLogoUrl(url: string): Promise<ExtractedSwatch[]> {
  const img = await loadImageElement(url);
  const pixels = drawImageToSwatchPixels(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
  if (!pixels) return [];
  return extractPaletteInWorker(pixels);
}
