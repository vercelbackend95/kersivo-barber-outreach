/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractPalette } from './extract';
import { twoColourLogo } from './fixtures';
import { drawImageToSwatchPixels, extractPaletteInWorker, extractPaletteOnThread } from './runExtract';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('worker integration', () => {
  it('draws a bitmap onto a 256px canvas and reads pixels', () => {
    const drawn: Array<{ w: number; h: number }> = [];
    const pixels = twoColourLogo();
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage(_img: unknown, _x: number, _y: number, w: number, h: number) {
            drawn.push({ w, h });
          },
          getImageData() {
            return { data: pixels.data, width: thisW(), height: thisH() };
          },
        };
      },
    };
    const thisW = () => canvas.width;
    const thisH = () => canvas.height;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
    const result = drawImageToSwatchPixels({} as CanvasImageSource, 512, 512);
    expect(drawn[0]).toEqual({ w: 256, h: 256 });
    expect(result?.width).toBe(256);
    expect(result?.height).toBe(256);
  });

  it('falls back to the same extract on this thread when Worker is missing', async () => {
    vi.stubGlobal('Worker', undefined);
    const image = twoColourLogo();
    const fromWorker = await extractPaletteInWorker(image);
    expect(fromWorker).toEqual(extractPaletteOnThread(image));
    expect(fromWorker).toEqual(extractPalette(image));
  });

  it('posts pixels to a Worker and returns its swatches', async () => {
    const image = twoColourLogo();
    const expected = extractPalette(image);
    class FakeWorker {
      onmessage: ((event: MessageEvent<{ swatches: unknown }>) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(payload: { data: Uint8ClampedArray; width: number; height: number }) {
        const swatches = extractPalette(payload);
        queueMicrotask(() => this.onmessage?.({ data: { swatches } } as MessageEvent<{ swatches: unknown }>));
      }
      terminate() {}
    }
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor() {
          super();
        }
      },
    );
    const result = await extractPaletteInWorker(image);
    expect(result).toEqual(expected);
  });
});
